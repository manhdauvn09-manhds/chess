// Bộ điều khiển bot: ưu tiên Stockfish (WASM, mạnh nhất), tự động chuyển
// sang engine JS dự phòng nếu không tải được. API thống nhất cho UI.
import type { BotLevel } from '../types';
import { getBestMoveFallback } from './fallbackEngine';

const SF_PATH = '/stockfish/stockfish-nnue-16-single.js';

type Listener = (line: string) => void;

class StockfishUci {
  private worker: Worker;
  private listeners: Listener[] = [];
  ready: Promise<void>;

  constructor() {
    this.worker = new Worker(SF_PATH);
    this.worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : e.data?.data ?? '';
      for (const l of this.listeners) l(line);
    };
    this.ready = this.handshake();
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private waitFor(token: string, timeout = 8000): Promise<string> {
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => {
        this.off(fn);
        reject(new Error('Stockfish timeout: ' + token));
      }, timeout);
      const fn: Listener = (line) => {
        if (line.includes(token)) {
          clearTimeout(to);
          this.off(fn);
          resolve(line);
        }
      };
      this.listeners.push(fn);
    });
  }

  private off(fn: Listener) {
    const i = this.listeners.indexOf(fn);
    if (i >= 0) this.listeners.splice(i, 1);
  }

  private async handshake() {
    this.send('uci');
    await this.waitFor('uciok');
    this.send('isready');
    await this.waitFor('readyok');
  }

  async bestMove(fen: string, level: BotLevel): Promise<string> {
    await this.ready;
    this.send('setoption name Skill Level value ' + level.skill);
    if (level.elo >= 1320 && level.elo <= 3190) {
      this.send('setoption name UCI_LimitStrength value true');
      this.send('setoption name UCI_Elo value ' + level.elo);
    } else {
      this.send('setoption name UCI_LimitStrength value false');
    }
    this.send('position fen ' + fen);
    this.send(`go depth ${level.depth} movetime ${level.movetime}`);
    const line = await this.waitFor('bestmove', level.movetime + 10000);
    const m = line.split(/\s+/);
    const idx = m.indexOf('bestmove');
    return m[idx + 1];
  }

  dispose() {
    this.worker.terminate();
  }
}

export class ChessEngine {
  private sf: StockfishUci | null = null;
  usingStockfish = false;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.tryInitStockfish();
  }

  private async tryInitStockfish() {
    try {
      const sf = new StockfishUci();
      await sf.ready;
      this.sf = sf;
      this.usingStockfish = true;
    } catch (e) {
      console.warn('[engine] Stockfish không khả dụng, dùng engine JS dự phòng.', e);
      this.usingStockfish = false;
    }
  }

  async ready() {
    await this.initPromise;
  }

  // Trả về nước đi dạng "e2e4" hoặc "e7e8q".
  async getBestMove(fen: string, level: BotLevel): Promise<string | null> {
    await this.initPromise;
    if (this.sf) {
      try {
        return await this.sf.bestMove(fen, level);
      } catch (e) {
        console.warn('[engine] Stockfish lỗi giữa chừng, chuyển dự phòng.', e);
        this.sf = null;
        this.usingStockfish = false;
      }
    }
    // Engine dự phòng: ánh xạ cấp độ -> depth + độ ngẫu nhiên.
    const depth = Math.max(2, Math.min(4, Math.round(level.skill / 6) + 2));
    const randomness = level.skill >= 16 ? 0 : (20 - level.skill) / 28;
    // Cho UI kịp render "đang nghĩ".
    await new Promise((r) => setTimeout(r, 120));
    return getBestMoveFallback(fen, { depth, randomness });
  }

  dispose() {
    this.sf?.dispose();
  }
}
