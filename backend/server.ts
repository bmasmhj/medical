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
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

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

app.use(express.static(path.join(__dirname, 'renderer')));


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

    const isExcel =
      req.file.originalname.endsWith('.xlsx') ||
      req.file.originalname.endsWith('.xls');

    let finalData: any[] = [];

    if (isExcel) {
      // ===== EXCEL → JSON =====
      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      finalData = xlsx.utils.sheet_to_json(sheet, {
        defval: '', // keep empty cells
      });
    } else {
      // ===== CSV → JSON =====
      finalData = await new Promise<any[]>((resolve, reject) => {
        const rows: any[] = [];

        fs.createReadStream(req.file!.path)
          .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
          .on('data', (row) => rows.push(row))
          .on('end', () => resolve(rows))
          .on('error', reject);
      });
    }

    // 🔥 DIRECT REPLACE
    await writeCSV(finalData);

    // cleanup
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'CSV replaced successfully',
      count: finalData.length,
    });
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
            socket.emit('completed_scraping');
        } catch (err) {
            console.error(err);
        }
    });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer/index.html'));
});

httpServer.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});


async function fetchProductData(code: string, slug: string) {

  let urlParsed = encodeURIComponent(slug);

  let data = `{"requests":[{"indexName":"prod_cwr-cw-au_products_en_query_suggestions","query":"${slug}","params":"hitsPerPage=5&highlightPreTag=__aa-highlight__&highlightPostTag=__%2Faa-highlight__&clickAnalytics=true"},{"indexName":"prod_cwr-cw-au_products_en","params":"hitsPerPage=3&highlightPreTag=__aa-highlight__&highlightPostTag=__%2Faa-highlight__&query=${urlParsed}&ruleContexts=%5B%22default%22%5D&clickAnalytics=true"}]}`;

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://42np1v2i98-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20JavaScript%20(4.23.3)%3B%20Browser%3B%20autocomplete-core%20(1.17.2)%3B%20autocomplete-js%20(1.17.2)',
    headers: {
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive',
      'Origin': 'https://www.chemistwarehouse.com.au',
      'Referer': 'https://www.chemistwarehouse.com.au/',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      'content-type': 'application/x-www-form-urlencoded',
      'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'x-algolia-api-key': '3ce54af79eae81a18144a7aa7ee10ec2',
      'x-algolia-application-id': '42NP1V2I98',
      'Content-Length': data.length
    },
    data: data
  };



  try {
    const response = await axios.request(config);
    const combinedSug = `${code}-${slug}`;
    for (const result of response.data.results) {
      const product = result.hits.find((p: any) => p.slug.en === combinedSug);
      if (product) {
        let newPrice = 0;
        if(product['prices']['AUD']['priceValues'][0]['customFields']['private-price']['centAmount']){
          newPrice = product['prices']['AUD']['priceValues'][0]['customFields']['private-price']['centAmount'] / 100;
        }else{
          newPrice = product.calculatedPrice / 100;
        }
        return {
          name: product.name.en,
          price: newPrice,
          slug: product.slug.en
        };
      }
    }
  } catch (error) {
    console.error(error);
  }
  return null;



}