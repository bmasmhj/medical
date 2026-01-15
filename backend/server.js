"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const csv_parse_1 = require("csv-parse");
const csv_stringify_1 = require("csv-stringify");
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const xlsx = __importStar(require("xlsx"));
const chemistwarehouse_1 = require("./chemistwarehouse");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*", // Allow all for dev simplicity (or restrict to renderer URL)
        methods: ["GET", "POST"]
    }
});
const PORT = 5175;
const upload = (0, multer_1.default)({ dest: 'uploads/' });
const CSV_PATH = path_1.default.join(__dirname, 'data.csv');
// Helper to read CSV
const readCSV = () => {
    return new Promise((resolve, reject) => {
        const results = [];
        if (!fs_1.default.existsSync(CSV_PATH)) {
            return resolve([]);
        }
        fs_1.default.createReadStream(CSV_PATH)
            .pipe((0, csv_parse_1.parse)({ columns: true, skip_empty_lines: true, trim: true }))
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
    });
};
// Helper to write CSV
const writeCSV = (data) => {
    return new Promise((resolve, reject) => {
        // Collect all unique headers from all objects
        const headers = new Set();
        data.forEach(row => {
            Object.keys(row).forEach(key => headers.add(key));
        });
        const columns = Array.from(headers);
        (0, csv_stringify_1.stringify)(data, { header: true, columns }, (err, output) => {
            if (err)
                return reject(err);
            fs_1.default.writeFile(CSV_PATH, output, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    });
};
app.get('/api/data', async (req, res) => {
    try {
        const data = await readCSV();
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ... (existing helper functions)
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file)
            throw new Error('No file uploaded');
        const existingData = await readCSV();
        const existingMap = new Map(existingData.map(item => [item['li item id'], item]));
        const isExcel = req.file.originalname.endsWith('.xlsx') || req.file.originalname.endsWith('.xls');
        if (isExcel) {
            const workbook = xlsx.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = xlsx.utils.sheet_to_json(sheet);
            jsonData.forEach((row) => {
                const id = row['li item id'];
                if (id) {
                    // Start of workaround: ensure all keys are strings if needed, matching CSV structure
                    // But usually, JSON is fine. We just merge.
                    if (existingMap.has(id)) {
                        const existing = existingMap.get(id);
                        existingMap.set(id, { ...existing, ...row });
                    }
                    else {
                        existingMap.set(id, row);
                    }
                }
            });
        }
        else {
            // Parse uploaded CSV file
            await new Promise((resolve, reject) => {
                fs_1.default.createReadStream(req.file.path)
                    .pipe((0, csv_parse_1.parse)({ columns: true, skip_empty_lines: true, trim: true }))
                    .on('data', (row) => {
                    const id = row['li item id'];
                    if (id && existingMap.has(id)) {
                        // Update existing (merge fields)
                        const existing = existingMap.get(id);
                        existingMap.set(id, { ...existing, ...row });
                    }
                    else {
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
        fs_1.default.unlinkSync(req.file.path);
        res.json({ message: 'Merged successfully', count: finalData.length });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/save', express_1.default.json({ limit: '50mb' }), async (req, res) => {
    try {
        const { data } = req.body;
        if (!Array.isArray(data))
            throw new Error('Invalid data format');
        await writeCSV(data);
        res.json({ message: 'Saved successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/download', (req, res) => {
    if (fs_1.default.existsSync(CSV_PATH)) {
        res.download(CSV_PATH, 'data.csv');
    }
    else {
        res.status(404).send('File not found');
    }
});
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('ping-backend', async () => {
        try {
            const results = await readCSV();
            const newcsv = [];
            const doneurls = new Set();
            const uniqueDoneItems = [];
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
                        const doneItem = uniqueDoneItems.find((item_inner) => item_inner['cw_url'] === item['cw_url']);
                        if (doneItem) {
                            newcsv.push({
                                ...item,
                                rrp: doneItem['rrp']
                            });
                        }
                        continue;
                    }
                    doneurls.add(slugUrl);
                    const data = await (0, chemistwarehouse_1.fetchProductData)(code, slugUrl);
                    console.log(data);
                    let price = data?.price || 0;
                    if (price === 0) {
                        console.log(`Price not found for ${slugUrl}, trying python script...`);
                        try {
                            // Use PYTHON_PATH from environment if set (for bundled builds), otherwise use venv
                            let pythonPath;
                            if (process.env.PYTHON_PATH) {
                                pythonPath = process.env.PYTHON_PATH;
                            }
                            else {
                                // Try bundled venv first
                                const bundledVenvPath = process.platform === 'win32'
                                    ? path_1.default.join(__dirname, 'venv', 'Scripts', 'python.exe')
                                    : path_1.default.join(__dirname, 'venv', 'bin', 'python');
                                if (fs_1.default.existsSync(bundledVenvPath)) {
                                    pythonPath = bundledVenvPath;
                                }
                                else {
                                    // Fallback to system Python
                                    pythonPath = process.platform === 'win32' ? 'python' : 'python3';
                                }
                            }
                            const scriptPath = path_1.default.join(__dirname, 'single.py');
                            const { stdout } = await execAsync(`"${pythonPath}" "${scriptPath}" "${item['cw_url']}"`);
                            console.log(`Python script output: ${stdout}`);
                            const scrapedPrice = parseFloat(stdout.trim().replace('$', ''));
                            if (!isNaN(scrapedPrice)) {
                                price = scrapedPrice;
                            }
                        }
                        catch (e) {
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
                }
                else {
                    newcsv.push(item);
                }
                socket.emit('pong-backend', {
                    item: `${i + 1}/${results.length}`,
                    message: item["product name"],
                    time: new Date().toISOString()
                });
            }
            await writeCSV(newcsv);
        }
        catch (err) {
            console.error(err);
        }
    });
});
httpServer.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
// puppeter
// 
