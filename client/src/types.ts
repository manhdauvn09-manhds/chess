// Giữ ĐỒNG BỘ với server/src/types.ts

export type Color = 'white' | 'black';
export type GameResultType = 'white' | 'black' | 'draw';

export type EndReason =
  | 'checkmate'
  | 'resign'
  | 'timeout'
  | 'stalemate'
  | 'insufficient'
  | 'threefold'
  | 'fiftymove'
  | 'agreement'
  | 'abort';

export interface TimeControl {
  base: number;
  inc: number;
}

export interface PlayerInfo {
  id: string;
  name: string;
  rating: number;
  isGuest: boolean;
}

export interface MovePayload {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface Clocks {
  white: number;
  black: number;
}

export interface GameSnapshot {
  gameId: string;
  fen: string;
  moves: string[];
  turn: Color;
  white: PlayerInfo;
  black: PlayerInfo;
  yourColor: Color;
  timeControl: TimeControl;
  clocks: Clocks;
  status: 'active' | 'over';
}

export interface GameOverPayload {
  result: GameResultType;
  reason: EndReason;
  elo?: {
    white: { before: number; after: number; delta: number };
    black: { before: number; after: number; delta: number };
  };
}

export interface ServerToClientEvents {
  'queue:waiting': () => void;
  'match:found': (snapshot: GameSnapshot) => void;
  'game:snapshot': (snapshot: GameSnapshot) => void;
  'game:move': (data: {
    move: MovePayload;
    san: string;
    fen: string;
    clocks: Clocks;
    turn: Color;
    drawAvailable?: 'threefold' | 'fiftymove' | null;
  }) => void;
  'game:over': (data: GameOverPayload) => void;
  'opponent:disconnected': () => void;
  'opponent:reconnected': () => void;
  'draw:offered': () => void;
  'draw:declined': () => void;
  'rematch:offered': () => void;
  'rematch:start': (snapshot: GameSnapshot) => void;
  'error:msg': (msg: string) => void;
}

export interface ClientToServerEvents {
  'auth:hello': (token: string | null, cb: (info: PlayerInfo) => void) => void;
  'queue:join': (tc: TimeControl) => void;
  'queue:leave': () => void;
  'room:create': (tc: TimeControl, cb: (code: string) => void) => void;
  'room:join': (code: string, cb: (ok: boolean, err?: string) => void) => void;
  'game:move': (gameId: string, move: MovePayload) => void;
  'game:resign': (gameId: string) => void;
  'game:reconnect': (gameId: string) => void;
  'draw:offer': (gameId: string) => void;
  'draw:respond': (gameId: string, accept: boolean) => void;
  'draw:claim': (gameId: string) => void;
  'rematch:offer': (gameId: string) => void;
  'rematch:respond': (gameId: string, accept: boolean) => void;
}

// ---- UI domain ----
export const TIME_CONTROLS: { label: string; tc: TimeControl; cat: string }[] = [
  { label: '1+0', tc: { base: 60, inc: 0 }, cat: 'Bullet' },
  { label: '2+1', tc: { base: 120, inc: 1 }, cat: 'Bullet' },
  { label: '3+0', tc: { base: 180, inc: 0 }, cat: 'Blitz' },
  { label: '3+2', tc: { base: 180, inc: 2 }, cat: 'Blitz' },
  { label: '5+0', tc: { base: 300, inc: 0 }, cat: 'Blitz' },
  { label: '5+3', tc: { base: 300, inc: 3 }, cat: 'Blitz' },
  { label: '10+0', tc: { base: 600, inc: 0 }, cat: 'Rapid' },
  { label: '10+5', tc: { base: 600, inc: 5 }, cat: 'Rapid' },
  { label: '15+10', tc: { base: 900, inc: 10 }, cat: 'Rapid' },
  { label: '30+0', tc: { base: 1800, inc: 0 }, cat: 'Classical' },
];

export interface BotLevel {
  label: string;
  elo: number;
  skill: number; // Stockfish Skill Level 0-20
  depth: number;
  movetime: number; // ms
}

export const BOT_LEVELS: BotLevel[] = [
  { label: 'Mới chơi (~800)', elo: 800, skill: 0, depth: 5, movetime: 200 },
  { label: 'Dễ (~1100)', elo: 1100, skill: 3, depth: 6, movetime: 300 },
  { label: 'Trung bình (~1500)', elo: 1500, skill: 8, depth: 8, movetime: 500 },
  { label: 'Khá (~1800)', elo: 1800, skill: 12, depth: 10, movetime: 800 },
  { label: 'Giỏi (~2100)', elo: 2100, skill: 16, depth: 13, movetime: 1200 },
  { label: 'Cao thủ (~2400)', elo: 2400, skill: 19, depth: 16, movetime: 1800 },
  { label: 'Tối đa (Stockfish)', elo: 3200, skill: 20, depth: 22, movetime: 2500 },
];
