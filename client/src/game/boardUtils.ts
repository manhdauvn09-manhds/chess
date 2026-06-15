import type { Color } from '../types';

// Tìm ô vua của 1 bên từ FEN (để highlight khi bị chiếu).
export function findKing(fen: string, color: Color): string | null {
  const rows = fen.split(' ')[0].split('/');
  const target = color === 'white' ? 'K' : 'k';
  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) file += Number(ch);
      else {
        if (ch === target) return String.fromCharCode(97 + file) + (8 - r);
        file++;
      }
    }
  }
  return null;
}
