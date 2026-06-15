// Tải Stockfish (single-threaded WASM) về client/public/stockfish để bot chạy offline.
// Chạy tự động sau `npm install`. Nếu đã có file thì bỏ qua.
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'client', 'public', 'stockfish');

// Build single-file (asm.js + wasm tích hợp) — không cần COOP/COEP header, chạy mọi nơi.
// Giữ NGUYÊN tên file gốc: build single-file tự tìm .wasm theo tên script của nó.
const FILES = [
  {
    name: 'stockfish-nnue-16-single.js',
    url: 'https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.js',
  },
  {
    name: 'stockfish-nnue-16-single.wasm',
    url: 'https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.wasm',
  },
];

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Quá nhiều redirect'));
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(download(res.headers.location, dest, redirects + 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} cho ${url}`));
        }
        const file = createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', reject);
  });
}

async function main() {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  for (const f of FILES) {
    const dest = join(outDir, f.name);
    if (existsSync(dest)) {
      console.log(`[stockfish] đã có ${f.name}, bỏ qua`);
      continue;
    }
    try {
      console.log(`[stockfish] tải ${f.name} ...`);
      await download(f.url, dest);
      console.log(`[stockfish] xong ${f.name}`);
    } catch (err) {
      console.warn(
        `[stockfish] CẢNH BÁO: không tải được ${f.name} (${err.message}).\n` +
          `  Bot vẫn chạy được bằng engine JS dự phòng, nhưng yếu hơn.\n` +
          `  Bạn có thể tự tải thủ công vào: ${outDir}`
      );
    }
  }
}

main();
