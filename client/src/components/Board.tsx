import { useEffect, useMemo, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Color } from '../types';

type Promo = 'q' | 'r' | 'b' | 'n';

// Đo bề rộng khung để bàn cờ luôn vuông và vừa container.
function useBoardWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => setWidth(Math.floor(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

interface BoardProps {
  position: string;
  orientation: Color;
  interactive: boolean;
  onMove: (from: string, to: string, promotion?: Promo) => boolean;
  getLegalMoves: (square: string) => string[];
  isPromotion: (from: string, to: string) => boolean;
  lastMove: { from: string; to: string } | null;
  checkSquare: string | null;
  arrows?: [string, string][];
  // Premove (online): cho phép đặt nước đi trước khi tới lượt.
  allowPremove?: boolean;
  premove?: { from: string; to: string } | null;
  onPremoveSet?: (from: string, to: string) => void;
  onPremoveClear?: () => void;
  ownPieceAt?: (square: string) => boolean;
}

const PROMO_PIECES: { p: Promo; label: string }[] = [
  { p: 'q', label: '♛' },
  { p: 'r', label: '♜' },
  { p: 'b', label: '♝' },
  { p: 'n', label: '♞' },
];

export default function Board({
  position,
  orientation,
  interactive,
  onMove,
  getLegalMoves,
  isPromotion,
  lastMove,
  checkSquare,
  arrows,
  allowPremove,
  premove,
  onPremoveSet,
  onPremoveClear,
  ownPieceAt,
}: BoardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [pending, setPending] = useState<{ from: string; to: string } | null>(null);
  const [preFrom, setPreFrom] = useState<string | null>(null);
  const { ref, width } = useBoardWidth();

  function clearSel() {
    setSelected(null);
    setOptions([]);
  }

  function tryMove(from: string, to: string): boolean {
    if (!interactive) return false;
    if (isPromotion(from, to)) {
      setPending({ from, to });
      clearSel();
      return false;
    }
    const ok = onMove(from, to);
    clearSel();
    return ok;
  }

  function handlePremoveClick(square: string) {
    if (preFrom) {
      if (square === preFrom) {
        setPreFrom(null);
        return;
      }
      onPremoveSet?.(preFrom, square);
      setPreFrom(null);
    } else if (ownPieceAt?.(square)) {
      setPreFrom(square);
    } else {
      onPremoveClear?.();
    }
  }

  function onSquareClick(square: string) {
    if (!interactive) {
      if (allowPremove) handlePremoveClick(square);
      return;
    }
    if (selected && options.includes(square)) {
      tryMove(selected, square);
      return;
    }
    const moves = getLegalMoves(square);
    if (moves.length > 0) {
      setSelected(square);
      setOptions(moves);
    } else {
      clearSel();
    }
  }

  function onPieceDrop(from: string, to: string): boolean {
    if (!interactive) {
      if (allowPremove && ownPieceAt?.(from)) {
        onPremoveSet?.(from, to);
        setPreFrom(null);
      }
      return false;
    }
    return tryMove(from, to);
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = { background: 'rgba(255, 213, 79, 0.45)' };
      styles[lastMove.to] = { background: 'rgba(255, 213, 79, 0.45)' };
    }
    if (premove) {
      styles[premove.from] = { background: 'rgba(126, 87, 194, 0.55)' };
      styles[premove.to] = { background: 'rgba(126, 87, 194, 0.55)' };
    }
    if (preFrom) styles[preFrom] = { background: 'rgba(126, 87, 194, 0.55)' };
    if (selected) styles[selected] = { background: 'rgba(66, 165, 245, 0.5)' };
    for (const sq of options) {
      styles[sq] = {
        ...styles[sq],
        background: 'radial-gradient(circle, rgba(0,0,0,0.28) 22%, transparent 24%)',
        borderRadius: '50%',
      };
    }
    if (checkSquare) {
      styles[checkSquare] = {
        background: 'radial-gradient(circle, rgba(229,57,53,0.85) 36%, transparent 40%)',
      };
    }
    return styles;
  }, [lastMove, selected, options, checkSquare, premove, preFrom]);

  return (
    <div className="board-wrap" ref={ref}>
      <Chessboard
        position={position}
        boardWidth={width}
        boardOrientation={orientation}
        onPieceDrop={onPieceDrop}
        onSquareClick={onSquareClick}
        arePiecesDraggable={interactive || !!allowPremove}
        customSquareStyles={squareStyles}
        customArrows={arrows && arrows.length ? (arrows as any) : undefined}
        customBoardStyle={{ borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,0.45)' }}
        customDarkSquareStyle={{ backgroundColor: '#769656' }}
        customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
        animationDuration={180}
        id="main-board"
      />

      {pending && (
        <div className="promo-overlay" onClick={() => setPending(null)}>
          <div className="promo-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="promo-title">Phong cấp</div>
            <div className="promo-pieces">
              {PROMO_PIECES.map(({ p, label }) => (
                <button
                  key={p}
                  className="promo-btn"
                  onClick={() => {
                    onMove(pending.from, pending.to, p);
                    setPending(null);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
