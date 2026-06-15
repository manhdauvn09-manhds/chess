import type { Server } from 'socket.io';
import { Game, registerGame } from './gameManager.js';
import type {
  ClientToServerEvents,
  PlayerInfo,
  ServerToClientEvents,
  TimeControl,
} from './types.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

interface QueueEntry {
  player: PlayerInfo;
  socketId: string;
  tc: TimeControl;
  joinedAt: number;
}

function tcKey(tc: TimeControl) {
  return `${tc.base}+${tc.inc}`;
}

export class Matchmaking {
  private queues = new Map<string, QueueEntry[]>();

  constructor(private io: IO) {
    // Quét định kỳ để nới rộng cửa sổ rating cho người chờ lâu.
    setInterval(() => this.tryMatchAll(), 2000);
  }

  join(player: PlayerInfo, socketId: string, tc: TimeControl) {
    this.leave(socketId); // tránh trùng
    const key = tcKey(tc);
    const q = this.queues.get(key) ?? [];
    q.push({ player, socketId, tc, joinedAt: Date.now() });
    this.queues.set(key, q);
    this.io.to(socketId).emit('queue:waiting');
    this.tryMatch(key);
  }

  leave(socketId: string) {
    for (const [key, q] of this.queues) {
      const idx = q.findIndex((e) => e.socketId === socketId);
      if (idx >= 0) q.splice(idx, 1);
      if (q.length === 0) this.queues.delete(key);
    }
  }

  private tryMatchAll() {
    for (const key of this.queues.keys()) this.tryMatch(key);
  }

  // Ghép cặp có rating gần nhau; cửa sổ nới theo thời gian chờ.
  private tryMatch(key: string) {
    const q = this.queues.get(key);
    if (!q || q.length < 2) return;

    for (let i = 0; i < q.length; i++) {
      const a = q[i];
      let bestJ = -1;
      let bestDiff = Infinity;
      for (let j = i + 1; j < q.length; j++) {
        const b = q[j];
        const diff = Math.abs(a.player.rating - b.player.rating);
        const waited = Math.max(Date.now() - a.joinedAt, Date.now() - b.joinedAt);
        const window = 100 + Math.floor(waited / 1000) * 50; // +50 elo mỗi giây chờ
        if (diff <= window && diff < bestDiff) {
          bestDiff = diff;
          bestJ = j;
        }
      }
      if (bestJ >= 0) {
        const b = q[bestJ];
        q.splice(bestJ, 1);
        q.splice(i, 1);
        if (q.length === 0) this.queues.delete(key);
        this.createGame(a, b);
        return;
      }
    }
  }

  private createGame(a: QueueEntry, b: QueueEntry) {
    // Random màu (dùng tổng thời gian join làm seed nhẹ — đủ ngẫu nhiên cho matchmaking).
    const aIsWhite = (a.joinedAt + b.joinedAt) % 2 === 0;
    const white = aIsWhite ? a : b;
    const black = aIsWhite ? b : a;
    const game = new Game(
      this.io,
      white.player,
      black.player,
      white.socketId,
      black.socketId,
      a.tc
    );
    registerGame(game);
    game.start();
  }
}
