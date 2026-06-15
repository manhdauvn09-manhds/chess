// Engine cờ vua dự phòng (thuần JS) — dùng khi Stockfish WASM không tải được.
// Negamax + alpha-beta + bảng vị trí quân (piece-square tables) + sắp xếp nước đi.
// Đủ mạnh để chơi vui ở mọi cấp; độ khó điều chỉnh qua depth + độ ngẫu nhiên.
import { Chess, type Move } from 'chess.js';

const PIECE_VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Bảng vị trí (góc nhìn quân Trắng, ô a8..h1 theo hàng). Cộng cho Trắng, trừ cho Đen (gương).
const PST: Record<string, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10,
    25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10,
    10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0,
    -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5,
    -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0,
    0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5,
    0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0,
    5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50,
    -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

function squareIndex(sq: string): number {
  const file = sq.charCodeAt(0) - 97; // a=0
  const rank = 8 - Number(sq[1]); // rank8 -> 0
  return rank * 8 + file;
}

function evaluate(chess: Chess): number {
  // Góc nhìn của bên ĐANG đi (negamax).
  if (chess.isCheckmate()) return -100000;
  if (chess.isDraw() || chess.isStalemate()) return 0;
  let score = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p) continue;
      const idx = r * 8 + f;
      const val = PIECE_VALUE[p.type] + (p.color === 'w' ? PST[p.type][idx] : PST[p.type][63 - idx]);
      score += p.color === 'w' ? val : -val;
    }
  }
  return chess.turn() === 'w' ? score : -score;
}

// Đánh giá tĩnh theo góc nhìn quân TRẮNG (centipawn). Dùng cho thanh eval.
export function staticEval(fen: string): number {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) return chess.turn() === 'w' ? -100000 : 100000;
  if (chess.isDraw() || chess.isStalemate()) return 0;
  let score = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p) continue;
      const idx = r * 8 + f;
      const val = PIECE_VALUE[p.type] + (p.color === 'w' ? PST[p.type][idx] : PST[p.type][63 - idx]);
      score += p.color === 'w' ? val : -val;
    }
  }
  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return moves.sort((a, b) => scoreMove(b) - scoreMove(a));
}
function scoreMove(m: Move): number {
  let s = 0;
  if (m.captured) s += 10 * PIECE_VALUE[m.captured] - PIECE_VALUE[m.piece];
  if (m.promotion) s += PIECE_VALUE[m.promotion];
  return s;
}

function negamax(chess: Chess, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluate(chess) - chess.history().length; // ưu tiên chiếu hết sớm
  }
  let best = -Infinity;
  const moves = orderMoves(chess.moves({ verbose: true }) as Move[]);
  for (const m of moves) {
    chess.move(m);
    const score = -negamax(chess, depth - 1, -beta, -alpha);
    chess.undo();
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export interface FallbackOptions {
  depth: number;
  randomness: number; // 0..1: xác suất chọn nước không tối ưu (mô phỏng cấp thấp)
}

export function getBestMoveFallback(fen: string, opts: FallbackOptions): string | null {
  const chess = new Chess(fen);
  const moves = orderMoves(chess.moves({ verbose: true }) as Move[]);
  if (moves.length === 0) return null;

  // Cấp thấp: thỉnh thoảng đi đại 1 nước ngẫu nhiên cho "giống người mới".
  if (opts.randomness > 0 && Math.random() < opts.randomness) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return m.from + m.to + (m.promotion || '');
  }

  let bestMove = moves[0];
  let bestScore = -Infinity;
  const scored: { m: Move; s: number }[] = [];
  for (const m of moves) {
    chess.move(m);
    const score = -negamax(chess, opts.depth - 1, -Infinity, Infinity);
    chess.undo();
    scored.push({ m, s: score });
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }

  // Ở cấp thấp, chọn ngẫu nhiên trong nhóm nước "gần tốt" để bớt hoàn hảo.
  if (opts.randomness > 0) {
    const margin = 60;
    const good = scored.filter((x) => x.s >= bestScore - margin);
    bestMove = good[Math.floor(Math.random() * good.length)].m;
  }
  return bestMove.from + bestMove.to + (bestMove.promotion || '');
}
