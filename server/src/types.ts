// Giao thức realtime giữa client và server (Socket.IO).
// File này được giữ ĐỒNG BỘ với client/src/types.ts.

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

// Kiểm soát thời gian: base = giây ban đầu, inc = cộng thêm mỗi nước (giây).
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
  white: number; // ms còn lại
  black: number;
}

export interface GameSnapshot {
  gameId: string;
  fen: string;
  moves: string[]; // SAN
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

// ---- Client -> Server ----
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

// ---- Server -> Client ----
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
