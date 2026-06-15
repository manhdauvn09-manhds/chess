import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { customAlphabet } from 'nanoid';

import { login, playerFromToken, publicUser, register, verify } from './auth.js';
import { queries, UserRow } from './db.js';
import { Matchmaking } from './matchmaking.js';
import { createRateLimiter } from './rateLimit.js';
import {
  Game,
  findGameBySocket,
  flushActiveGames,
  getGame,
  registerGame,
  restoreGames,
} from './gameManager.js';
import type {
  ClientToServerEvents,
  PlayerInfo,
  ServerToClientEvents,
  TimeControl,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const roomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);

const app = express();
const PROD = process.env.NODE_ENV === 'production';
app.set('trust proxy', 1); // sau Cloudflare/nginx -> lấy đúng IP client cho rate-limit
// Production: client cùng origin -> không mở CORS (chỉ cho CLIENT_ORIGIN nếu đặt).
app.use(cors(PROD ? { origin: process.env.CLIENT_ORIGIN || false } : undefined));
app.use(express.json({ limit: '16kb' }));

// Header bảo mật (không cần thêm thư viện).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'", // Stockfish WASM cần wasm-unsafe-eval
  "style-src 'self' 'unsafe-inline'", // React đặt style inline
  "img-src 'self' data:",
  "connect-src 'self' ws: wss:", // Socket.IO
  "worker-src 'self' blob:", // Stockfish worker
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join('; ');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Content-Security-Policy', CSP);
  if (PROD) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
});

// Health check cho Docker / uptime monitor.
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Chống brute-force: tối đa 10 lần đăng nhập/đăng ký mỗi phút / IP.
const authLimiter = createRateLimiter(10, 60_000);
function limitAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  if (!authLimiter(ip)) return res.status(429).json({ error: 'Quá nhiều yêu cầu, thử lại sau ít phút' });
  next();
}

// ---------- REST API ----------
app.post('/api/register', limitAuth, (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    const { token, user } = register(String(username), String(password));
    res.json({ token, user: publicUser(user) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/login', limitAuth, (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    const { token, user } = login(String(username), String(password));
    res.json({ token, user: publicUser(user) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/me', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const payload = verify(token);
  if (!payload) return res.status(401).json({ error: 'Chưa đăng nhập' });
  const user = queries.getUserById.get(payload.id) as UserRow | undefined;
  if (!user) return res.status(401).json({ error: 'Không tìm thấy người dùng' });
  res.json({ user: publicUser(user) });
});

app.get('/api/leaderboard', (_req, res) => {
  res.json({ players: queries.topPlayers.all() });
});

// ---------- Serve client (production) ----------
const clientDist = join(__dirname, '..', '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(join(clientDist, 'index.html')));
}

// ---------- Socket.IO ----------
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  // Production: client phục vụ cùng origin -> không cần mở CORS.
  cors: PROD ? { origin: process.env.CLIENT_ORIGIN || false } : { origin: '*' },
  // Mitigate DoS của ws (chưa có bản vá): gói tin cờ rất nhỏ nên giới hạn chặt.
  maxHttpBufferSize: 1e5, // 100KB
  perMessageDeflate: false,
});
const matchmaking = new Matchmaking(io);

// Khôi phục các ván đang chơi sau khi restart/redeploy.
restoreGames(io);

// Throttle sự kiện socket chống spam.
const moveLimiter = createRateLimiter(120, 10_000); // ~12 nước/giây/socket
const actionLimiter = createRateLimiter(20, 10_000); // tạo phòng / cầu hoà ...

// Phòng riêng đang chờ: code -> chủ phòng.
interface PendingRoom {
  player: PlayerInfo;
  socketId: string;
  tc: TimeControl;
}
const pendingRooms = new Map<string, PendingRoom>();

// socketId -> PlayerInfo hiện tại.
const socketPlayers = new Map<string, PlayerInfo>();

let guestCounter = 1;
function guestPlayer(socketId: string): PlayerInfo {
  return {
    id: 'guest-' + socketId,
    name: 'Khách-' + guestCounter++,
    rating: 1200,
    isGuest: true,
  };
}

io.on('connection', (socket) => {
  socket.on('auth:hello', (token, cb) => {
    const info = playerFromToken(token) ?? guestPlayer(socket.id);
    socketPlayers.set(socket.id, info);
    cb(info);
  });

  function me(): PlayerInfo {
    let p = socketPlayers.get(socket.id);
    if (!p) {
      p = guestPlayer(socket.id);
      socketPlayers.set(socket.id, p);
    }
    return p;
  }

  // ----- Matchmaking -----
  socket.on('queue:join', (tc) => matchmaking.join(me(), socket.id, normalizeTc(tc)));
  socket.on('queue:leave', () => matchmaking.leave(socket.id));

  // ----- Phòng riêng (chơi với bạn) -----
  socket.on('room:create', (tc, cb) => {
    if (!actionLimiter(socket.id)) return cb('');
    const code = roomCode();
    pendingRooms.set(code, { player: me(), socketId: socket.id, tc: normalizeTc(tc) });
    cb(code);
  });

  socket.on('room:join', (code, cb) => {
    if (!actionLimiter(socket.id)) return cb(false, 'Quá nhiều lần thử, chờ chút');
    const room = pendingRooms.get(String(code).toUpperCase().trim());
    if (!room) return cb(false, 'Mã phòng không tồn tại');
    if (room.socketId === socket.id) return cb(false, 'Không thể tự vào phòng của mình');
    pendingRooms.delete(String(code).toUpperCase().trim());
    cb(true);

    const host = room.player;
    const guest = me();
    const hostWhite = (Date.now() & 1) === 0;
    const game = new Game(
      io,
      hostWhite ? host : guest,
      hostWhite ? guest : host,
      hostWhite ? room.socketId : socket.id,
      hostWhite ? socket.id : room.socketId,
      room.tc
    );
    registerGame(game);
    game.start();
  });

  // ----- Trong ván -----
  socket.on('game:move', (gameId, move) => {
    if (!moveLimiter(socket.id)) return;
    const game = getGame(gameId);
    const r = game?.applyMove(socket.id, move);
    if (r && !r.ok && r.err) socket.emit('error:msg', r.err);
  });
  socket.on('game:resign', (gameId) => getGame(gameId)?.resign(socket.id));
  socket.on('draw:offer', (gameId) => {
    if (actionLimiter(socket.id)) getGame(gameId)?.offerDraw(socket.id);
  });
  socket.on('draw:respond', (gameId, accept) => getGame(gameId)?.respondDraw(socket.id, accept));
  socket.on('draw:claim', (gameId) => getGame(gameId)?.claimDraw(socket.id));
  socket.on('rematch:offer', (gameId) => {
    if (actionLimiter(socket.id)) getGame(gameId)?.offerRematch(socket.id);
  });
  socket.on('rematch:respond', (gameId, accept) => getGame(gameId)?.respondRematch(socket.id, accept));
  socket.on('game:reconnect', (gameId) => {
    const game = getGame(gameId);
    game?.reconnect(socket.id, me());
  });

  socket.on('disconnect', () => {
    matchmaking.leave(socket.id);
    for (const [code, r] of pendingRooms) if (r.socketId === socket.id) pendingRooms.delete(code);
    const game = findGameBySocket(socket.id);
    game?.onDisconnect(socket.id);
    socketPlayers.delete(socket.id);
  });
});

function normalizeTc(tc: TimeControl): TimeControl {
  const base = Math.min(3600, Math.max(10, Math.floor(tc?.base ?? 300)));
  const inc = Math.min(60, Math.max(0, Math.floor(tc?.inc ?? 0)));
  return { base, inc };
}

httpServer.listen(PORT, () => {
  console.log(`♟  Chess server chạy tại http://localhost:${PORT}`);
});

// Tắt êm: lưu ván đang chơi rồi đóng kết nối (giữ ván qua redeploy).
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} -> đang lưu ván & tắt server…`);
  try {
    flushActiveGames();
  } catch (e) {
    console.error('Lỗi khi lưu ván:', e);
  }
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
