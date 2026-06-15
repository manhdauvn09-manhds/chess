// Các hàm luật cờ THUẦN (không phụ thuộc io/db) -> dễ kiểm thử đơn vị.
import { Chess } from 'chess.js';
import type { Color, EndReason, GameResultType } from './types.js';

// Bên `color` có đủ quân để (về lý thuyết) chiếu hết đối phương không?
// Dùng để xử hết-giờ: nếu bên còn lại không đủ quân -> HOÀ (luật FIDE 6.9).
export function hasMatingMaterial(chess: Chess, color: Color): boolean {
  const c = color === 'white' ? 'w' : 'b';
  let minors = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== c) continue;
      if (sq.type === 'p' || sq.type === 'r' || sq.type === 'q') return true;
      if (sq.type === 'b' || sq.type === 'n') minors++;
    }
  }
  return minors >= 2;
}

// Kết quả khi hết giờ cho `loser` (bên hết thời gian).
export function timeoutResult(chess: Chess, loser: Color): GameResultType {
  const winner: Color = loser === 'white' ? 'black' : 'white';
  return hasMatingMaterial(chess, winner) ? winner : 'draw';
}

export interface EndState {
  over: boolean;
  result?: GameResultType;
  reason?: EndReason;
}

// Trạng thái kết thúc BẮT BUỘC (không tính threefold/50-nước vì để người chơi claim).
export function forcedEndState(chess: Chess): EndState {
  if (chess.isCheckmate()) {
    return { over: true, result: chess.turn() === 'w' ? 'black' : 'white', reason: 'checkmate' };
  }
  if (chess.isStalemate()) return { over: true, result: 'draw', reason: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { over: true, result: 'draw', reason: 'insufficient' };
  // Bảo hiểm FIDE: 75 nước không ăn quân / đẩy tốt -> tự hoà.
  if (Number(chess.fen().split(' ')[4]) >= 150) return { over: true, result: 'draw', reason: 'fiftymove' };
  return { over: false };
}

// Loại hoà có thể "claim" tại thế cờ hiện tại.
export function claimableDraw(chess: Chess): 'threefold' | 'fiftymove' | null {
  if (chess.isThreefoldRepetition()) return 'threefold';
  if (Number(chess.fen().split(' ')[4]) >= 100) return 'fiftymove';
  return null;
}
