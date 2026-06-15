import { Chess } from 'chess.js';
import { nanoid } from 'nanoid';
import type { Server } from 'socket.io';
import { queries, UserRow } from './db.js';
import { computeElo, GameResult } from './elo.js';
import { claimableDraw, forcedEndState, hasMatingMaterial } from './chessRules.js';
import { loadActive, saveActive, type PersistedGame } from './gamePersist.js';
import type {
  Clocks,
  Color,
  EndReason,
  GameOverPayload,
  GameSnapshot,
  MovePayload,
  PlayerInfo,
  ServerToClientEvents,
  ClientToServerEvents,
  TimeControl,
} from './types.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

interface Seat {
  player: PlayerInfo;
  socketId: string | null; // null = đang mất kết nối
}

type DrawReason = 'threefold' | 'fiftymove';

export class Game {
  id: string;
  chess = new Chess();
  white: Seat;
  black: Seat;
  tc: TimeControl;
  clocks: Clocks;
  status: 'active' | 'over' = 'active';
  turnStart = Date.now();
  paused = false; // sau khi khôi phục: chờ người chơi vào lại mới chạy đồng hồ
  private timer: NodeJS.Timeout | null = null;
  private drawOfferBy: Color | null = null;
  private drawOfferAt = 0;
  private drawAvailable: DrawReason | null = null;
  private disconnectTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private rematchOfferBy: Color | null = null;

  constructor(
    private io: IO,
    white: PlayerInfo,
    black: PlayerInfo,
    socketWhite: string | null,
    socketBlack: string | null,
    tc: TimeControl,
    id?: string
  ) {
    this.id = id ?? nanoid(10);
    this.white = { player: white, socketId: socketWhite };
    this.black = { player: black, socketId: socketBlack };
    this.tc = tc;
    this.clocks = { white: tc.base * 1000, black: tc.base * 1000 };
  }

  private seat(color: Color): Seat {
    return color === 'white' ? this.white : this.black;
  }
  private turn(): Color {
    return this.chess.turn() === 'w' ? 'white' : 'black';
  }

  snapshotFor(color: Color): GameSnapshot {
    return {
      gameId: this.id,
      fen: this.chess.fen(),
      moves: this.chess.history(),
      turn: this.turn(),
      white: this.white.player,
      black: this.black.player,
      yourColor: color,
      timeControl: this.tc,
      clocks: this.liveClocks(),
      status: this.status,
    };
  }

  private liveClocks(): Clocks {
    const c = { ...this.clocks };
    if (this.status === 'active' && !this.paused) {
      const elapsed = Date.now() - this.turnStart;
      c[this.turn()] = Math.max(0, c[this.turn()] - elapsed);
    }
    return c;
  }

  start() {
    this.turnStart = Date.now();
    this.armTimer();
    if (this.white.socketId) this.io.to(this.white.socketId).emit('match:found', this.snapshotFor('white'));
    if (this.black.socketId) this.io.to(this.black.socketId).emit('match:found', this.snapshotFor('black'));
    persistAll();
  }

  private armTimer() {
    if (this.timer) clearTimeout(this.timer);
    if (this.status !== 'active' || this.paused) return;
    const remaining = this.liveClocks()[this.turn()];
    this.timer = setTimeout(() => this.onTimeout(), remaining + 50);
  }

  private onTimeout() {
    if (this.status !== 'active' || this.paused) return;
    const loser = this.turn();
    const winnerColor: Color = loser === 'white' ? 'black' : 'white';
    // Luật FIDE: nếu bên còn lại không đủ quân để chiếu hết -> HOÀ.
    if (!hasMatingMaterial(this.chess, winnerColor)) {
      this.end('draw', 'timeout');
    } else {
      this.end(winnerColor, 'timeout');
    }
  }

  applyMove(socketId: string, move: MovePayload): { ok: boolean; err?: string } {
    if (this.status !== 'active') return { ok: false, err: 'Ván đã kết thúc' };
    const color = this.turn();
    if (this.seat(color).socketId !== socketId) return { ok: false, err: 'Chưa tới lượt bạn' };

    if (this.paused) {
      this.paused = false;
      this.turnStart = Date.now();
    }
    const elapsed = Date.now() - this.turnStart;
    this.clocks[color] = Math.max(0, this.clocks[color] - elapsed);
    if (this.clocks[color] <= 0) {
      this.onTimeout();
      return { ok: false, err: 'Hết giờ' };
    }

    let result;
    try {
      result = this.chess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
    } catch {
      return { ok: false, err: 'Nước đi không hợp lệ' };
    }
    if (!result) return { ok: false, err: 'Nước đi không hợp lệ' };

    this.clocks[color] += this.tc.inc * 1000;
    this.drawOfferBy = null;
    this.turnStart = Date.now();

    const ended = this.checkGameEnd();
    if (!ended) this.computeDrawAvailable();

    const payload = {
      move,
      san: result.san,
      fen: this.chess.fen(),
      clocks: this.liveClocks(),
      turn: this.turn(),
      drawAvailable: this.drawAvailable,
    };
    if (this.white.socketId) this.io.to(this.white.socketId).emit('game:move', payload);
    if (this.black.socketId) this.io.to(this.black.socketId).emit('game:move', payload);

    if (!ended) this.armTimer();
    persistAll();
    return { ok: true };
  }

  // Threefold & 50 nước: không tự kết thúc, để người chơi tự "claim".
  private computeDrawAvailable() {
    this.drawAvailable = claimableDraw(this.chess);
  }

  // Chỉ tự kết thúc ở các trạng thái bắt buộc (xem chessRules.forcedEndState).
  private checkGameEnd(): boolean {
    const s = forcedEndState(this.chess);
    if (!s.over) return false;
    this.end(s.result as GameResult, s.reason!);
    return true;
  }

  claimDraw(socketId: string) {
    if (this.status !== 'active' || !this.drawAvailable) return;
    if (this.white.socketId !== socketId && this.black.socketId !== socketId) return;
    this.end('draw', this.drawAvailable);
  }

  resign(socketId: string) {
    if (this.status !== 'active') return;
    const color = this.white.socketId === socketId ? 'white' : 'black';
    this.end(color === 'white' ? 'black' : 'white', 'resign');
  }

  offerDraw(socketId: string) {
    if (this.status !== 'active') return;
    const color = this.white.socketId === socketId ? 'white' : 'black';
    const now = Date.now();
    if (this.drawOfferBy === color && now - this.drawOfferAt < 10_000) return; // chống spam
    this.drawOfferBy = color;
    this.drawOfferAt = now;
    const opp = this.seat(color === 'white' ? 'black' : 'white');
    if (opp.socketId) this.io.to(opp.socketId).emit('draw:offered');
  }

  respondDraw(socketId: string, accept: boolean) {
    if (this.status !== 'active' || !this.drawOfferBy) return;
    const color = this.white.socketId === socketId ? 'white' : 'black';
    if (color === this.drawOfferBy) return;
    if (accept) this.end('draw', 'agreement');
    else {
      this.drawOfferBy = null;
      const opp = this.seat(color === 'white' ? 'black' : 'white');
      if (opp.socketId) this.io.to(opp.socketId).emit('draw:declined');
    }
  }

  // ---- Rematch ----
  offerRematch(socketId: string) {
    if (this.status !== 'over') return;
    const color = this.white.socketId === socketId ? 'white' : this.black.socketId === socketId ? 'black' : null;
    if (!color) return;
    this.rematchOfferBy = color;
    const opp = this.seat(color === 'white' ? 'black' : 'white');
    if (opp.socketId) this.io.to(opp.socketId).emit('rematch:offered');
  }

  respondRematch(socketId: string, accept: boolean) {
    if (this.status !== 'over' || !this.rematchOfferBy) return;
    const color = this.white.socketId === socketId ? 'white' : 'black';
    if (color === this.rematchOfferBy || !accept) {
      this.rematchOfferBy = null;
      return;
    }
    // Đổi màu, giữ nguyên đối thủ + thời gian.
    const newGame = new Game(
      this.io,
      this.black.player,
      this.white.player,
      this.black.socketId,
      this.white.socketId,
      this.tc
    );
    registerGame(newGame);
    newGame.startRematch();
  }

  private startRematch() {
    this.turnStart = Date.now();
    this.armTimer();
    if (this.white.socketId) this.io.to(this.white.socketId).emit('rematch:start', this.snapshotFor('white'));
    if (this.black.socketId) this.io.to(this.black.socketId).emit('rematch:start', this.snapshotFor('black'));
    persistAll();
  }

  onDisconnect(socketId: string) {
    if (this.status !== 'active') return;
    const seat = this.white.socketId === socketId ? this.white : this.black;
    seat.socketId = null;
    const opp = seat === this.white ? this.black : this.white;
    if (opp.socketId) this.io.to(opp.socketId).emit('opponent:disconnected');
    this.disconnectTimer = setTimeout(() => {
      if (this.status === 'active' && seat.socketId === null) {
        this.end(seat === this.white ? 'black' : 'white', 'abort');
      }
    }, 60_000);
  }

  reconnect(socketId: string, player: PlayerInfo): boolean {
    const seat =
      this.white.player.id === player.id ? this.white : this.black.player.id === player.id ? this.black : null;
    if (!seat) return false;
    seat.socketId = socketId;
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    if (this.cleanupTimer) clearTimeout(this.cleanupTimer);
    const color: Color = seat === this.white ? 'white' : 'black';
    // Nếu đang tạm dừng (vừa khôi phục) và là bên tới lượt -> chạy lại đồng hồ.
    if (this.paused && this.turn() === color) {
      this.paused = false;
      this.turnStart = Date.now();
      this.armTimer();
    }
    const opp = seat === this.white ? this.black : this.white;
    if (opp.socketId) this.io.to(opp.socketId).emit('opponent:reconnected');
    this.io.to(socketId).emit('game:snapshot', this.snapshotFor(color));
    return true;
  }

  // Khôi phục từ dữ liệu lưu: nạp thế cờ + đồng hồ, tạm dừng tới khi có người vào lại.
  hydrate(p: PersistedGame) {
    try {
      this.chess.loadPgn(p.pgn);
    } catch {
      /* nếu pgn lỗi giữ ván mới */
    }
    this.clocks = p.clocks;
    this.paused = true;
    this.white.socketId = null;
    this.black.socketId = null;
    // Nếu 5 phút không ai vào lại -> bỏ ván (không xử kết quả).
    this.cleanupTimer = setTimeout(() => {
      if (this.status === 'active' && !this.white.socketId && !this.black.socketId) {
        this.status = 'over';
        games.delete(this.id);
        persistAll();
      }
    }, 5 * 60_000);
  }

  toPersisted(): PersistedGame {
    return {
      id: this.id,
      tc: this.tc,
      pgn: this.chess.pgn(),
      clocks: this.liveClocks(),
      white: this.white.player,
      black: this.black.player,
    };
  }

  // (logic kết thúc bắt buộc & hoà-claim đã chuyển sang chessRules.ts)

  private end(result: GameResult, reason: EndReason) {
    if (this.status === 'over') return;
    this.status = 'over';
    if (this.timer) clearTimeout(this.timer);
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    if (this.cleanupTimer) clearTimeout(this.cleanupTimer);

    const elo = this.applyElo(result);
    const payload: GameOverPayload = { result, reason, elo };
    if (this.white.socketId) this.io.to(this.white.socketId).emit('game:over', payload);
    if (this.black.socketId) this.io.to(this.black.socketId).emit('game:over', payload);
    this.persist(result, reason, elo);
    onGameEnd(this.id);
    persistAll();
  }

  private applyElo(result: GameResult): GameOverPayload['elo'] {
    const w = this.white.player;
    const b = this.black.player;
    if (w.isGuest || b.isGuest) return undefined;
    const wu = queries.getUserById.get(w.id) as UserRow | undefined;
    const bu = queries.getUserById.get(b.id) as UserRow | undefined;
    if (!wu || !bu) return undefined;

    const upd = computeElo(
      { rating: wu.rating, gamesPlayed: wu.games_played, peakRating: wu.peak_rating },
      { rating: bu.rating, gamesPlayed: bu.games_played, peakRating: bu.peak_rating },
      result
    );
    queries.updateRating.run({
      id: wu.id,
      rating: upd.whiteNew,
      win: result === 'white' ? 1 : 0,
      loss: result === 'black' ? 1 : 0,
      draw: result === 'draw' ? 1 : 0,
    });
    queries.updateRating.run({
      id: bu.id,
      rating: upd.blackNew,
      win: result === 'black' ? 1 : 0,
      loss: result === 'white' ? 1 : 0,
      draw: result === 'draw' ? 1 : 0,
    });
    this.white.player = { ...w, rating: upd.whiteNew };
    this.black.player = { ...b, rating: upd.blackNew };
    return {
      white: { before: wu.rating, after: upd.whiteNew, delta: upd.whiteDelta },
      black: { before: bu.rating, after: upd.blackNew, delta: upd.blackDelta },
    };
  }

  private persist(result: GameResult, reason: EndReason, elo: GameOverPayload['elo']) {
    queries.insertGame.run({
      id: this.id,
      white_id: this.white.player.isGuest ? null : this.white.player.id,
      black_id: this.black.player.isGuest ? null : this.black.player.id,
      white_name: this.white.player.name,
      black_name: this.black.player.name,
      result,
      reason,
      pgn: this.chess.pgn(),
      white_delta: elo?.white.delta ?? null,
      black_delta: elo?.black.delta ?? null,
      created_at: Date.now(),
    });
  }
}

// ---- Registry + persistence ----
const games = new Map<string, Game>();

let saveQueued = false;
function persistAll() {
  if (saveQueued) return;
  saveQueued = true;
  queueMicrotask(() => {
    saveQueued = false;
    const list: PersistedGame[] = [];
    for (const g of games.values()) if (g.status === 'active') list.push(g.toPersisted());
    saveActive(list);
  });
}

// Ghi ngay (đồng bộ) các ván đang chơi — gọi khi tắt server để không mất ván.
export function flushActiveGames() {
  const list: PersistedGame[] = [];
  for (const g of games.values()) if (g.status === 'active') list.push(g.toPersisted());
  saveActive(list);
}

export function registerGame(g: Game) {
  games.set(g.id, g);
}
export function getGame(id: string): Game | undefined {
  return games.get(id);
}
function onGameEnd(id: string) {
  setTimeout(() => games.delete(id), 5 * 60_000);
}
export function findGameBySocket(socketId: string): Game | undefined {
  for (const g of games.values()) {
    if (g.white.socketId === socketId || g.black.socketId === socketId) return g;
  }
  return undefined;
}
export function findGameByPlayer(playerId: string): Game | undefined {
  for (const g of games.values()) {
    if (g.status === 'active' && (g.white.player.id === playerId || g.black.player.id === playerId)) return g;
  }
  return undefined;
}

// Khôi phục các ván đang chơi khi server khởi động lại.
export function restoreGames(io: IO) {
  const saved = loadActive();
  for (const p of saved) {
    const g = new Game(io, p.white, p.black, null, null, p.tc, p.id);
    g.hydrate(p);
    games.set(g.id, g);
  }
  if (saved.length) console.log(`♻  Khôi phục ${saved.length} ván đang chơi`);
}
