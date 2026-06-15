import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Board from '../components/Board';
import GameLayout from '../components/GameLayout';
import { EvalBar, ResultModal, capturedFromFen } from '../components/panels';
import { useChessGame } from '../game/useChessGame';
import { useMoveSounds } from '../game/useMoveSounds';
import { useReview } from '../game/review';
import { findKing } from '../game/boardUtils';
import { ChessEngine } from '../engine/stockfish';
import { bookMove } from '../engine/openingBook';
import { staticEval } from '../engine/fallbackEngine';
import { BOT_LEVELS, type BotLevel, type Color } from '../types';

type ColorChoice = 'white' | 'black' | 'random';

export default function PlayBot() {
  const nav = useNavigate();
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState<BotLevel>(BOT_LEVELS[2]);
  const [colorChoice, setColorChoice] = useState<ColorChoice>('white');
  const [myColor, setMyColor] = useState<Color>('white');

  if (!started) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <h2>Chơi với Máy</h2>

          <div className="setup-section">
            <label>Độ khó</label>
            <div className="level-grid">
              {BOT_LEVELS.map((l) => (
                <button
                  key={l.elo}
                  className={`level-btn ${level.elo === l.elo ? 'active' : ''}`}
                  onClick={() => setLevel(l)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="setup-section">
            <label>Bạn cầm quân</label>
            <div className="color-choice">
              {(['white', 'black', 'random'] as ColorChoice[]).map((c) => (
                <button
                  key={c}
                  className={`level-btn ${colorChoice === c ? 'active' : ''}`}
                  onClick={() => setColorChoice(c)}
                >
                  {c === 'white' ? '♔ Trắng' : c === 'black' ? '♚ Đen' : '🎲 Ngẫu nhiên'}
                </button>
              ))}
            </div>
          </div>

          <div className="setup-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => {
                const color: Color =
                  colorChoice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : colorChoice;
                setMyColor(color);
                setStarted(true);
              }}
            >
              Bắt đầu
            </button>
            <button className="btn btn-ghost" onClick={() => nav('/')}>
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <BotGame initialLevel={level} myColor={myColor} onExit={() => setStarted(false)} />;
}

function BotGame({
  initialLevel,
  myColor,
  onExit,
}: {
  initialLevel: BotLevel;
  myColor: Color;
  onExit: () => void;
}) {
  const nav = useNavigate();
  const game = useChessGame();
  const engineRef = useRef<ChessEngine | null>(null);
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [level, setLevel] = useState<BotLevel>(initialLevel);
  const { state } = game;
  useMoveSounds(state.history, state.status.over);
  const review = useReview(state.history, state.fen);
  const botColor: Color = myColor === 'white' ? 'black' : 'white';

  useEffect(() => {
    const eng = new ChessEngine();
    engineRef.current = eng;
    return () => eng.dispose();
  }, []);

  // Khi tới lượt bot -> opening book (đa dạng khai cuộc) hoặc engine.
  useEffect(() => {
    if (state.status.over || state.turn !== botColor) return;
    let cancelled = false;
    setThinking(true);
    (async () => {
      const eng = engineRef.current!;
      const uciHist = (game.chess.history({ verbose: true }) as any[]).map(
        (m) => m.from + m.to + (m.promotion || '')
      );
      let best: string | null = null;
      if (uciHist.length < 12 && Math.random() < 0.85) best = bookMove(uciHist);
      if (!best) best = await eng.getBestMove(state.fen, level);
      if (cancelled || !best) return;
      game.move(best.slice(0, 2), best.slice(2, 4), (best[4] as any) || 'q');
      setThinking(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.fen, state.turn, state.status.over]);

  async function showHint() {
    const eng = engineRef.current;
    if (!eng || state.turn !== myColor) return;
    const best = await eng.getBestMove(state.fen, BOT_LEVELS[BOT_LEVELS.length - 1]);
    if (best) setHint(`${best.slice(0, 2)} → ${best.slice(2, 4)}`);
  }

  function takeback() {
    if (thinking || state.turn !== myColor || state.history.length < 2) return;
    game.undo();
    game.undo(); // lùi cả nước của bạn lẫn của máy
    setHint(null);
  }

  const cap = capturedFromFen(review.displayFen);
  const myTurnLive = !state.status.over && state.turn === myColor && !thinking && review.isLive;
  const checkSquare = review.isLive && state.inCheck ? findKing(state.fen, state.turn) : null;
  const evalPawns = staticEval(review.displayFen) / 100;

  function sideInfo(color: Color) {
    const isMe = color === myColor;
    return {
      name: isMe ? 'Bạn' : `Máy (${level.label})`,
      captured: color === 'white' ? cap.capturedByWhite : cap.capturedByBlack,
      advantage: color === 'white' ? cap.whiteAdv : cap.blackAdv,
      active: state.turn === color && !state.status.over,
    };
  }

  let status: string | undefined;
  if (!review.isLive) status = '⏪ Đang xem lại — bấm Live để quay lại';
  else if (!state.status.over) {
    if (thinking) status = 'Máy đang suy nghĩ…';
    else if (state.turn === myColor) status = hint ? `Gợi ý: ${hint}` : 'Tới lượt bạn';
  }

  return (
    <GameLayout
      top={sideInfo(botColor)}
      bottom={sideInfo(myColor)}
      history={state.history}
      currentPly={review.currentPly}
      onSelectPly={review.goto}
      reviewControls={{ ...review }}
      statusText={status}
      board={
        <div className="board-with-eval">
          <EvalBar pawns={evalPawns} orientation={myColor} />
          <Board
            position={review.displayFen}
            orientation={myColor}
            interactive={myTurnLive}
            onMove={(f, t, p) => {
              setHint(null);
              return game.move(f, t, p);
            }}
            getLegalMoves={game.legalMoves}
            isPromotion={game.needsPromotion}
            lastMove={review.isLive ? state.lastMove : null}
            checkSquare={checkSquare}
            arrows={review.arrow ? [review.arrow] : []}
          />
        </div>
      }
      controls={
        <>
          <div className="bot-level-row">
            <label>Độ khó</label>
            <select
              value={level.elo}
              onChange={(e) => setLevel(BOT_LEVELS.find((l) => l.elo === Number(e.target.value))!)}
            >
              {BOT_LEVELS.map((l) => (
                <option key={l.elo} value={l.elo}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <button className="btn" onClick={showHint} disabled={state.turn !== myColor || thinking}>
            💡 Gợi ý
          </button>
          <button
            className="btn"
            onClick={takeback}
            disabled={thinking || state.turn !== myColor || state.history.length < 2}
          >
            ↩ Đi lại (takeback)
          </button>
          <button className="btn btn-danger" onClick={() => game.resign(myColor)} disabled={state.status.over}>
            🏳 Đầu hàng
          </button>
          <button className="btn" onClick={onExit}>
            Đổi cấp độ
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
            myColor={myColor}
            onRematch={() => game.reset()}
            onHome={() => nav('/')}
            rematchLabel="Ván mới"
          />
        ) : null
      }
    />
  );
}
