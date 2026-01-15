import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { parse } from "csv-parse";
import { stringify } from "csv-stringify";
import fs from "fs";
import multer from 'multer';
import path from 'path';
import * as xlsx from 'xlsx';
import { fetchProductData } from './chemistwarehouse';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for dev simplicity (or restrict to renderer URL)
        methods: ["GET", "POST"]
    }
});

const PORT = 5175;

const upload = multer({ dest: 'uploads/' });
const CSV_PATH = path.join(__dirname, 'data.csv');

// Helper to read CSV
const readCSV = (): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const results: any[] = [];
        if (!fs.existsSync(CSV_PATH)) {
            return resolve([]);
        }
        fs.createReadStream(CSV_PATH)
            .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
    });
};

// Helper to write CSV
const writeCSV = (data: any[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        // Collect all unique headers from all objects
        const headers = new Set<string>();
        data.forEach(row => {
            Object.keys(row).forEach(key => headers.add(key));
        });
        const columns = Array.from(headers);

        stringify(data, { header: true, columns }, (err, output) => {
            if (err) return reject(err);
            fs.writeFile(CSV_PATH, output, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
};

app.get('/api/data', async (req, res) => {
    try {
        const data = await readCSV();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});


// ... (existing helper functions)

app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) throw new Error('No file uploaded');

        const existingData = await readCSV();
        const existingMap = new Map(existingData.map(item => [item['li item id'], item]));

        const isExcel = req.file.originalname.endsWith('.xlsx') || req.file.originalname.endsWith('.xls');

        if (isExcel) {
            const workbook = xlsx.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = xlsx.utils.sheet_to_json(sheet);

            jsonData.forEach((row: any) => {
                const id = row['li item id'];
                if (id) {
                    // Start of workaround: ensure all keys are strings if needed, matching CSV structure
                    // But usually, JSON is fine. We just merge.
                    if (existingMap.has(id)) {
                        const existing = existingMap.get(id);
                        existingMap.set(id, { ...existing, ...row });
                    } else {
                        existingMap.set(id, row);
                    }
                }
            });
        } else {
            // Parse uploaded CSV file
            await new Promise<void>((resolve, reject) => {
                fs.createReadStream(req.file!.path)
                    .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
                    .on('data', (row: any) => {
                        const id = row['li item id'];
                        if (id && existingMap.has(id)) {
                            // Update existing (merge fields)
                            const existing = existingMap.get(id);
                            existingMap.set(id, { ...existing, ...row });
                        } else {
                            // Add new
                            existingMap.set(id, row);
                        }
                    })
                    .on('end', () => resolve())
                    .on('error', reject);
            });
        }

        // Convert map back to array
        const finalData = Array.from(existingMap.values());

        await writeCSV(finalData);

        // Cleanup uploaded file
        fs.unlinkSync(req.file.path);

        res.json({ message: 'Merged successfully', count: finalData.length });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.post('/api/save', express.json({ limit: '50mb' }), async (req, res) => {
    try {
        const { data } = req.body;
        if (!Array.isArray(data)) throw new Error('Invalid data format');
        await writeCSV(data);
        res.json({ message: 'Saved successfully' });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.get('/api/download', (req, res) => {
    if (fs.existsSync(CSV_PATH)) {
        res.download(CSV_PATH, 'data.csv');
    } else {
        res.status(404).send('File not found');
    }
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('ping-backend', async () => {
        try {
            const results = await readCSV();
            const newcsv: any[] = [];
            const doneurls = new Set();
            const uniqueDoneItems: any[] = [];
            for (let i = 0; i < results.length; i++) {
                const item = results[i];
                if (item['cw_url'] && item['cw_url'].trim() !== '') {
                    const fullcode = item['cw_url'].split('/buy/')[1];
                    const [code, slug] = fullcode.split('/');

                    // remove spaces from slug and replace with - and to lowercase
                    let slugUrl = slug.replace(/\s/g, '-').toLowerCase();
                    // check if slugUrl is already in doneurls 
                    if (doneurls.has(slugUrl)) {
                        // get value from done and save it 
                        const doneItem = uniqueDoneItems.find((item_inner: any) => item_inner['cw_url'] === item['cw_url']);
                        if (doneItem) {
                            newcsv.push({
                                ...item,
                                rrp: doneItem['rrp']
                            });
                        }
                        continue;
                    }
                    doneurls.add(slugUrl);
                    const data = await fetchProductData(code, slugUrl);
                    console.log(data);

                    let price = data?.price || 0;

                    if (price === 0) {
                        console.log(`Price not found for ${slugUrl}, trying python script...`);
                        try {
                            // Use PYTHON_PATH from environment if set (for bundled builds), otherwise use venv
                            let pythonPath: string;
                            if (process.env.PYTHON_PATH) {
                                pythonPath = process.env.PYTHON_PATH;
                            } else {
                                // Try bundled venv first
                                const bundledVenvPath = process.platform === 'win32'
                                    ? path.join(__dirname, 'venv', 'Scripts', 'python.exe')
                                    : path.join(__dirname, 'venv', 'bin', 'python');
                                
                                if (fs.existsSync(bundledVenvPath)) {
                                    pythonPath = bundledVenvPath;
                                } else {
                                    // Fallback to system Python
                                    pythonPath = process.platform === 'win32' ? 'python' : 'python3';
                                }
                            }
                            
                            const scriptPath = path.join(__dirname, 'single.py');
                            const { stdout } = await execAsync(`"${pythonPath}" "${scriptPath}" "${item['cw_url']}"`);
                            console.log(`Python script output: ${stdout}`);
                            const scrapedPrice = parseFloat(stdout.trim().replace('$', ''));
                            if (!isNaN(scrapedPrice)) {
                                price = scrapedPrice;
                            }
                        } catch (e) {
                            console.error(`Python script failed for ${slugUrl}:`, e);
                        }
                    }

                    newcsv.push({
                        ...item,
                        rrp: price
                    });

                    uniqueDoneItems.push({
                        ...item,
                        rrp: price
                    });

                } else {
                    newcsv.push(item);
                }

                socket.emit('pong-backend', {
                    item: `${i + 1}/${results.length}`,
                    message: item["product name"],
                    time: new Date().toISOString()
                });
            }

            await writeCSV(newcsv);
        } catch (err) {
            console.error(err);
        }
    });
});

httpServer.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});

// puppeter
// 

