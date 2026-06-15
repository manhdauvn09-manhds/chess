import { Chess, type Square } from 'chess.js';
import { useCallback, useRef, useState } from 'react';
import type { EndReason, GameResultType } from '../types';

export interface GameStatus {
  over: boolean;
  result?: GameResultType;
  reason?: EndReason;
}

export interface LocalGameState {
  fen: string;
  turn: 'white' | 'black';
  history: string[];
  lastMove: { from: string; to: string } | null;
  inCheck: boolean;
  status: GameStatus;
}

function computeStatus(chess: Chess): GameStatus {
  if (!chess.isGameOver()) return { over: false };
  if (chess.isCheckmate()) {
    return { over: true, result: chess.turn() === 'w' ? 'black' : 'white', reason: 'checkmate' };
  }
  if (chess.isStalemate()) return { over: true, result: 'draw', reason: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { over: true, result: 'draw', reason: 'insufficient' };
  if (chess.isThreefoldRepetition()) return { over: true, result: 'draw', reason: 'threefold' };
  if (chess.isDraw()) return { over: true, result: 'draw', reason: 'fiftymove' };
  return { over: true, result: 'draw', reason: 'agreement' };
}

export function useChessGame(initialFen?: string) {
  const chessRef = useRef(new Chess(initialFen));
  const [state, setState] = useState<LocalGameState>(() => snapshot(chessRef.current, null));

  function snapshot(chess: Chess, last: { from: string; to: string } | null): LocalGameState {
    return {
      fen: chess.fen(),
      turn: chess.turn() === 'w' ? 'white' : 'black',
      history: chess.history(),
      lastMove: last,
      inCheck: chess.inCheck(),
      status: computeStatus(chess),
    };
  }

  const sync = useCallback((last: { from: string; to: string } | null) => {
    setState(snapshot(chessRef.current, last));
  }, []);

  // Thử đi 1 nước. Trả về true nếu hợp lệ.
  const move = useCallback(
    (from: string, to: string, promotion: 'q' | 'r' | 'b' | 'n' = 'q'): boolean => {
      try {
        const m = chessRef.current.move({ from, to, promotion });
        if (!m) return false;
        sync({ from, to });
        return true;
      } catch {
        return false;
      }
    },
    [sync]
  );

  // Các nước hợp lệ từ 1 ô (để highlight).
  const legalMoves = useCallback((square: string): string[] => {
    const moves = chessRef.current.moves({ square: square as Square, verbose: true });
    return moves.map((m) => m.to);
  }, []);

  const reset = useCallback(
    (fen?: string) => {
      chessRef.current = new Chess(fen);
      sync(null);
    },
    [sync]
  );

  const undo = useCallback(() => {
    chessRef.current.undo();
    sync(null);
  }, [sync]);

  // Kiểm tra nước đi có cần phong cấp không (tốt tới hàng cuối).
  const needsPromotion = useCallback((from: string, to: string): boolean => {
    const piece = chessRef.current.get(from as Square);
    if (!piece || piece.type !== 'p') return false;
    const rank = to[1];
    return (piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1');
  }, []);

  const resign = useCallback(
    (loser: 'white' | 'black') => {
      setState((s) => ({
        ...s,
        status: { over: true, result: loser === 'white' ? 'black' : 'white', reason: 'resign' },
      }));
    },
    []
  );

  const forceResult = useCallback((result: GameResultType, reason: EndReason) => {
    setState((s) => ({ ...s, status: { over: true, result, reason } }));
  }, []);

  return { state, chess: chessRef.current, move, legalMoves, reset, undo, needsPromotion, resign, forceResult };
}
