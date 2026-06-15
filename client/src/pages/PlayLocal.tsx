import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Board from '../components/Board';
import GameLayout from '../components/GameLayout';
import { ResultModal, capturedFromFen } from '../components/panels';
import { useChessGame } from '../game/useChessGame';
import { useMoveSounds } from '../game/useMoveSounds';
import { useReview } from '../game/review';
import { findKing } from '../game/boardUtils';
import type { Color } from '../types';

export default function PlayLocal() {
  const nav = useNavigate();
  const game = useChessGame();
  const [orientation, setOrientation] = useState<Color>('white');
  const [autoFlip, setAutoFlip] = useState(true);
  const { state } = game;
  useMoveSounds(state.history, state.status.over);
  const review = useReview(state.history, state.fen);

  const view: Color = autoFlip ? state.turn : orientation;
  const cap = capturedFromFen(review.displayFen);
  const checkSquare = review.isLive && state.inCheck ? findKing(state.fen, state.turn) : null;

  const topColor: Color = view === 'white' ? 'black' : 'white';
  const bottomColor: Color = view;

  function sideInfo(color: Color) {
    return {
      name: color === 'white' ? 'Trắng' : 'Đen',
      captured: color === 'white' ? cap.capturedByWhite : cap.capturedByBlack,
      advantage: color === 'white' ? cap.whiteAdv : cap.blackAdv,
      active: state.turn === color && !state.status.over,
    };
  }

  const statusText = !review.isLive
    ? '⏪ Đang xem lại — bấm Live để quay lại'
    : state.status.over
      ? undefined
      : `Lượt: ${state.turn === 'white' ? 'Trắng' : 'Đen'}`;

  return (
    <GameLayout
      top={sideInfo(topColor)}
      bottom={sideInfo(bottomColor)}
      history={state.history}
      currentPly={review.currentPly}
      onSelectPly={review.goto}
      reviewControls={{ ...review }}
      statusText={statusText}
      board={
        <Board
          position={review.displayFen}
          orientation={view}
          interactive={!state.status.over && review.isLive}
          onMove={game.move}
          getLegalMoves={game.legalMoves}
          isPromotion={game.needsPromotion}
          lastMove={review.isLive ? state.lastMove : null}
          checkSquare={checkSquare}
          arrows={review.arrow ? [review.arrow] : []}
        />
      }
      controls={
        <>
          <button className="btn" onClick={() => setAutoFlip((v) => !v)}>
            Tự lật bàn: {autoFlip ? 'BẬT' : 'TẮT'}
          </button>
          {!autoFlip && (
            <button
              className="btn"
              onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
            >
              Lật bàn cờ
            </button>
          )}
          <button className="btn" onClick={() => game.undo()} disabled={state.history.length === 0}>
            Đi lại (undo)
          </button>
          <button className="btn btn-danger" onClick={() => game.reset()}>
            Ván mới
          </button>
          <button className="btn btn-ghost" onClick={() => nav('/')}>
            Thoát
          </button>
        </>
      }
      modal={
        state.status.over && state.status.result ? (
          <ResultModal
            result={state.status.result}
            reason={state.status.reason!}
            myColor={state.status.result === 'draw' ? 'white' : state.status.result}
            onRematch={() => game.reset()}
            onHome={() => nav('/')}
            rematchLabel="Ván mới"
          />
        ) : null
      }
    />
  );
}
