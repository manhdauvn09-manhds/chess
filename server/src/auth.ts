import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { queries, UserRow } from './db.js';
import { DEFAULT_RATING } from './elo.js';
import type { PlayerInfo } from './types.js';

const DEFAULT_SECRET = 'doi-secret-nay-trong-production-nhe';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
const TOKEN_TTL = '30d';

// Bắt buộc đặt JWT_SECRET riêng khi chạy production (chống giả mạo token).
if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEFAULT_SECRET) {
  console.error('❌ Bắt buộc đặt biến môi trường JWT_SECRET khi NODE_ENV=production.');
  process.exit(1);
}

export interface TokenPayload {
  id: string;
  username: string;
}

export function register(username: string, password: string): { token: string; user: UserRow } {
  username = username.trim();
  if (username.length < 3 || username.length > 20) throw new Error('Tên đăng nhập 3-20 ký tự');
  if (password.length < 4) throw new Error('Mật khẩu tối thiểu 4 ký tự');
  if (queries.getUserByName.get(username)) throw new Error('Tên đăng nhập đã tồn tại');

  const id = nanoid();
  const hash = bcrypt.hashSync(password, 10);
  queries.insertUser.run({
    id,
    username,
    password: hash,
    rating: DEFAULT_RATING,
    peak_rating: DEFAULT_RATING,
    created_at: Date.now(),
  });
  const user = queries.getUserById.get(id) as UserRow;
  return { token: sign({ id, username }), user };
}

export function login(username: string, password: string): { token: string; user: UserRow } {
  const user = queries.getUserByName.get(username.trim()) as UserRow | undefined;
  if (!user || !bcrypt.compareSync(password, user.password)) {
    throw new Error('Sai tên đăng nhập hoặc mật khẩu');
  }
  return { token: sign({ id: user.id, username: user.username }), user };
}

export function sign(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verify(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

// Trả về PlayerInfo từ token. null => guest.
export function playerFromToken(token: string | null): PlayerInfo | null {
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;
  const user = queries.getUserById.get(payload.id) as UserRow | undefined;
  if (!user) return null;
  return {
    id: user.id,
    name: user.username,
    rating: user.rating,
    isGuest: false,
  };
}

export function publicUser(user: UserRow) {
  return {
    id: user.id,
    username: user.username,
    rating: user.rating,
    peakRating: user.peak_rating,
    gamesPlayed: user.games_played,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
  };
}
