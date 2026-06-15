// Lưu/khôi phục các ván ĐANG diễn ra để sống sót qua restart/redeploy server.
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Clocks, PlayerInfo, TimeControl } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
const file = join(dataDir, 'active-games.json');

export interface PersistedGame {
  id: string;
  tc: TimeControl;
  pgn: string;
  clocks: Clocks;
  white: PlayerInfo;
  black: PlayerInfo;
}

export function saveActive(games: PersistedGame[]) {
  const tmp = file + '.tmp';
  writeFileSync(tmp, JSON.stringify(games));
  renameSync(tmp, file);
}

export function loadActive(): PersistedGame[] {
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}
