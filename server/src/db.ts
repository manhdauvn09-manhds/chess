// Kho lưu trữ nhẹ dạng file JSON — không phụ thuộc thư viện native, chạy
// giống nhau trên Windows (dev) và Linux/Docker (production).
// Giữ cùng API kiểu prepared-statement (.run/.get/.all) để code gọi không phải đổi.
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_RATING } from './elo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
const dbFile = join(dataDir, 'chess.json');

export interface UserRow {
  id: string;
  username: string;
  password: string;
  rating: number;
  peak_rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  created_at: number;
}

export interface GameRow {
  id: string;
  white_id: string | null;
  black_id: string | null;
  white_name: string;
  black_name: string;
  result: string;
  reason: string;
  pgn: string;
  white_delta: number | null;
  black_delta: number | null;
  created_at: number;
}

interface Store {
  users: UserRow[];
  games: GameRow[];
}

const store: Store = load();

function load(): Store {
  if (existsSync(dbFile)) {
    try {
      return JSON.parse(readFileSync(dbFile, 'utf-8'));
    } catch {
      // file hỏng -> bắt đầu mới (không làm sập server)
    }
  }
  return { users: [], games: [] };
}

let saveQueued = false;
function persist() {
  // Ghi gộp trong cùng tick để tránh ghi đĩa quá nhiều.
  if (saveQueued) return;
  saveQueued = true;
  queueMicrotask(() => {
    saveQueued = false;
    const tmp = dbFile + '.tmp';
    writeFileSync(tmp, JSON.stringify(store));
    renameSync(tmp, dbFile); // ghi nguyên tử
  });
}

// ---- API tương thích better-sqlite3 ----
export const queries = {
  insertUser: {
    run(u: Omit<UserRow, 'wins' | 'losses' | 'draws' | 'games_played'>) {
      store.users.push({ games_played: 0, wins: 0, losses: 0, draws: 0, ...u });
      persist();
    },
  },
  getUserByName: {
    get(username: string): UserRow | undefined {
      return store.users.find((u) => u.username === username);
    },
  },
  getUserById: {
    get(id: string): UserRow | undefined {
      return store.users.find((u) => u.id === id);
    },
  },
  updateRating: {
    run(p: { id: string; rating: number; win: number; loss: number; draw: number }) {
      const u = store.users.find((x) => x.id === p.id);
      if (!u) return;
      u.rating = p.rating;
      u.peak_rating = Math.max(u.peak_rating, p.rating);
      u.games_played += 1;
      u.wins += p.win;
      u.losses += p.loss;
      u.draws += p.draw;
      persist();
    },
  },
  topPlayers: {
    all() {
      return [...store.users]
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 50)
        .map((u) => ({
          username: u.username,
          rating: u.rating,
          games_played: u.games_played,
          wins: u.wins,
          losses: u.losses,
          draws: u.draws,
        }));
    },
  },
  insertGame: {
    run(g: GameRow) {
      store.games.push(g);
      // Giữ tối đa 5000 ván gần nhất để file không phình.
      if (store.games.length > 5000) store.games.splice(0, store.games.length - 5000);
      persist();
    },
  },
};

export const DB_DEFAULT_RATING = DEFAULT_RATING;
export default store;
