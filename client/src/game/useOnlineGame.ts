import { Chess } from 'chess.js';
import { useEffect, useRef, useState } from 'react';
import type { Clocks, Color, GameOverPayload, GameSnapshot, MovePayload } from '../types';
import type { GameSocket } from './socket';

type DrawReason = 'threefold' | 'fiftymove' | null;

export interface OnlineState {
  snapshot: GameSnapshot;
  fen: string;
  turn: Color;
  history: string[];
  lastMove: { from: string; to: string } | null;
  clocks: Clocks;
  over: GameOverPayload | null;
  drawOffered: boolean;
  drawSent: boolean;
  drawAvailable: DrawReason;
  oppDisconnected: boolean;
  inCheck: boolean;
  premove: { from: string; to: string } | null;
  rematchOffered: boolean;
  rematchSent: boolean;
}

export function useOnlineGame(socket: GameSocket, initial: GameSnapshot) {
  const chessRef = useRef(new Chess(initial.fen));
  const [st, setSt] = useState<OnlineState>(() => ({
    snapshot: initial,
    fen: initial.fen,
    turn: initial.turn,
    history: initial.moves,
    lastMove: null,
    clocks: initial.clocks,
    over: null,
    drawOffered: false,
    drawSent: false,
    drawAvailable: null,
    oppDisconnected: false,
    inCheck: chessRef.current.inCheck(),
    premove: null,
    rematchOffered: false,
    rematchSent: false,
  }));

  const gameId = initial.gameId;
  const myColor = initial.yourColor;
  const premoveRef = useRef<{ from: string; to: string } | null>(null);

  function emitMove(from: string, to: string, promotion: 'q' | 'r' | 'b' | 'n' = 'q') {
    socket.emit('game:move', gameId, { from, to, promotion });
  }

  useEffect(() => {
    const onMove = (data: { move: MovePayload; san: string; fen: string; clocks: Clocks; turn: Color; drawAvailable?: DrawReason }) => {
      chessRef.current.load(data.fen);
      setSt((s) => ({
        ...s,
        fen: data.fen,
        turn: data.turn,
        history: chessRef.current.history(),
        lastMove: { from: data.move.from, to: data.move.to },
        clocks: data.clocks,
        inCheck: chessRef.current.inCheck(),
        drawOffered: false,
        drawSent: false,
        drawAvailable: data.drawAvailable ?? null,
      }));

      // Tới lượt mình & có premove -> thực hiện nếu hợp lệ, ngược lại bỏ.
      if (data.turn === myColor && premoveRef.current) {
        const pm = premoveRef.current;
        premoveRef.current = null;
        setSt((s) => ({ ...s, premove: null }));
        const test = new Chess(data.fen);
        try {
          if (test.move({ from: pm.from, to: pm.to, promotion: 'q' })) emitMove(pm.from, pm.to);
        } catch {
          /* premove không hợp lệ -> bỏ qua */
        }
      }
    };
    const onOver = (data: GameOverPayload) => setSt((s) => ({ ...s, over: data, premove: null }));
    const onDrawOffered = () => setSt((s) => ({ ...s, drawOffered: true }));
    const onDrawDeclined = () => setSt((s) => ({ ...s, drawSent: false }));
    const onOppDisc = () => setSt((s) => ({ ...s, oppDisconnected: true }));
    const onOppRecon = () => setSt((s) => ({ ...s, oppDisconnected: false }));
    const onRematchOffered = () => setSt((s) => ({ ...s, rematchOffered: true }));
    const onSnapshot = (snap: GameSnapshot) => {
      chessRef.current.load(snap.fen);
      setSt((s) => ({
        ...s,
        snapshot: snap,
        fen: snap.fen,
        turn: snap.turn,
        history: snap.moves,
        clocks: snap.clocks,
        inCheck: chessRef.current.inCheck(),
      }));
    };

    socket.on('game:move', onMove);
    socket.on('game:over', onOver);
    socket.on('draw:offered', onDrawOffered);
    socket.on('draw:declined', onDrawDeclined);
    socket.on('opponent:disconnected', onOppDisc);
    socket.on('opponent:reconnected', onOppRecon);
    socket.on('rematch:offered', onRematchOffered);
    socket.on('game:snapshot', onSnapshot);
    socket.emit('game:reconnect', gameId);

    return () => {
      socket.off('game:move', onMove);
      socket.off('game:over', onOver);
      socket.off('draw:offered', onDrawOffered);
      socket.off('draw:declined', onDrawDeclined);
      socket.off('opponent:disconnected', onOppDisc);
      socket.off('opponent:reconnected', onOppRecon);
      socket.off('rematch:offered', onRematchOffered);
      socket.off('game:snapshot', onSnapshot);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, gameId]);

  // Đồng hồ chạy mượt phía client giữa 2 nước đi.
  useEffect(() => {
    if (st.over) return;
    const id = setInterval(() => {
      setSt((s) => {
        if (s.over) return s;
        const clocks = { ...s.clocks };
        clocks[s.turn] = Math.max(0, clocks[s.turn] - 100);
        return { ...s, clocks };
      });
    }, 100);
    return () => clearInterval(id);
  }, [st.over, st.turn]);

  function move(from: string, to: string, promotion: 'q' | 'r' | 'b' | 'n' = 'q'): boolean {
    if (st.over || st.turn !== myColor) return false;
    const test = new Chess(st.fen);
    try {
      if (!test.move({ from, to, promotion })) return false;
    } catch {
      return false;
    }
    emitMove(from, to, promotion);
    return true;
  }

  function isPromotion(from: string, to: string): boolean {
    const piece = chessRef.current.get(from as any);
    if (!piece || piece.type !== 'p') return false;
    const rank = to[1];
    return (piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1');
  }
  function legalMoves(square: string): string[] {
    if (st.turn !== myColor) return [];
    const moves = chessRef.current.moves({ square: square as any, verbose: true });
    return moves.map((m: any) => m.to);
  }
  function ownPieceAt(square: string): boolean {
    const p = chessRef.current.get(square as any);
    return !!p && p.color === (myColor === 'white' ? 'w' : 'b');
  }
  function setPremove(from: string, to: string) {
    premoveRef.current = { from, to };
    setSt((s) => ({ ...s, premove: { from, to } }));
  }
  function clearPremove() {
    premoveRef.current = null;
    setSt((s) => ({ ...s, premove: null }));
  }

  const resign = () => socket.emit('game:resign', gameId);
  const offerDraw = () => {
    socket.emit('draw:offer', gameId);
    setSt((s) => ({ ...s, drawSent: true }));
  };
  const respondDraw = (accept: boolean) => {
    socket.emit('draw:respond', gameId, accept);
    setSt((s) => ({ ...s, drawOffered: false }));
  };
  const claimDraw = () => socket.emit('draw:claim', gameId);
  const offerRematch = () => {
    socket.emit('rematch:offer', gameId);
    setSt((s) => ({ ...s, rematchSent: true }));
  };
  const respondRematch = (accept: boolean) => {
    socket.emit('rematch:respond', gameId, accept);
    setSt((s) => ({ ...s, rematchOffered: false }));
  };

  return {
    st,
    myColor,
    move,
    isPromotion,
    legalMoves,
    ownPieceAt,
    setPremove,
    clearPremove,
    resign,
    offerDraw,
    respondDraw,
    claimDraw,
    offerRematch,
    respondRematch,
  };
}
