import { Chess } from 'chess.js';
import { useEffect, useMemo, useRef, useState } from 'react';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface Ply {
  fen: string;
  from: string;
  to: string;
  san: string;
}

// Phát lại ván từ danh sách SAN -> FEN + ô đi của từng nước (để vẽ mũi tên).
export function replay(history: string[]): Ply[] {
  const chess = new Chess();
  const plies: Ply[] = [];
  for (const san of history) {
    try {
      const m = chess.move(san);
      if (!m) break;
      plies.push({ fen: chess.fen(), from: m.from, to: m.to, san: m.san });
    } catch {
      break;
    }
  }
  return plies;
}

// Hook xem lại: quản lý ply đang xem, FEN hiển thị, mũi tên & điều hướng.
export function useReview(history: string[], liveFen: string) {
  const plies = useMemo(() => replay(history), [history]);
  const [viewPly, setViewPly] = useState<number | null>(null); // null = đang theo dõi trực tiếp
  const wasLive = useRef(true);

  // Có nước mới: nếu đang ở chế độ live thì tự nhảy tới nước mới nhất.
  useEffect(() => {
    if (wasLive.current) setViewPly(null);
  }, [history.length]);

  const isLive = viewPly === null;
  wasLive.current = isLive;

  const lastPly = plies.length - 1;
  const cur = isLive ? lastPly : Math.min(viewPly!, lastPly);

  const displayFen = isLive ? liveFen : cur >= 0 ? plies[cur].fen : START_FEN;
  const arrow: [string, string] | null = cur >= 0 ? [plies[cur].from, plies[cur].to] : null;

  const goto = (ply: number) => setViewPly(ply >= lastPly ? null : Math.max(-1, ply));
  const prev = () => goto((isLive ? lastPly : cur) - 1);
  const next = () => goto(cur + 1);
  const toStart = () => goto(-1);
  const toLive = () => setViewPly(null);

  // Phím mũi tên để tua.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowUp') toStart();
      else if (e.key === 'ArrowDown') toLive();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return { displayFen, arrow, isLive, currentPly: cur, goto, prev, next, toStart, toLive };
}
