import { useState, type ReactNode } from 'react';
import { Clock, MoveList, PlayerBar } from './panels';
import { isMuted, setMuted } from '../sound';

export interface SideInfo {
  name: string;
  rating?: number;
  clockMs?: number;
  active?: boolean;
  captured: string[];
  advantage: number;
}

interface ReviewControls {
  isLive: boolean;
  prev: () => void;
  next: () => void;
  toStart: () => void;
  toLive: () => void;
}

export default function GameLayout({
  board,
  top,
  bottom,
  history,
  controls,
  statusText,
  modal,
  currentPly,
  onSelectPly,
  reviewControls,
}: {
  board: ReactNode;
  top: SideInfo;
  bottom: SideInfo;
  history: string[];
  controls: ReactNode;
  statusText?: string;
  modal?: ReactNode;
  currentPly?: number;
  onSelectPly?: (ply: number) => void;
  reviewControls?: ReviewControls;
}) {
  return (
    <div className="game-screen">
      <div className="game-main">
        <PlayerRow info={top} />
        <div className="board-area">{board}</div>
        <PlayerRow info={bottom} />
      </div>

      <aside className="game-side">
        <div className="side-top">
          {statusText ? <div className="status-banner">{statusText}</div> : <span />}
          <MuteButton />
        </div>
        <MoveList history={history} currentPly={currentPly} onSelect={onSelectPly} />
        {reviewControls && history.length > 0 && (
          <div className="review-nav">
            <button className="btn btn-sm" onClick={reviewControls.toStart} title="Về đầu ván">
              ⏮
            </button>
            <button className="btn btn-sm" onClick={reviewControls.prev} title="Nước trước (←)">
              ◀
            </button>
            <button className="btn btn-sm" onClick={reviewControls.next} title="Nước sau (→)">
              ▶
            </button>
            <button
              className={`btn btn-sm ${reviewControls.isLive ? 'live-on' : ''}`}
              onClick={reviewControls.toLive}
              title="Về thế cờ hiện tại"
            >
              {reviewControls.isLive ? '● Live' : 'Live'}
            </button>
          </div>
        )}
        <div className="controls">{controls}</div>
      </aside>

      {modal}
    </div>
  );
}

function MuteButton() {
  const [muted, setM] = useState(isMuted());
  return (
    <button
      className="mute-btn"
      title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setM(next);
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

function PlayerRow({ info }: { info: SideInfo }) {
  return (
    <div className="player-row">
      <PlayerBar
        name={info.name}
        rating={info.rating}
        captured={info.captured}
        advantage={info.advantage}
      />
      {info.clockMs != null && <Clock ms={info.clockMs} active={!!info.active} />}
    </div>
  );
}
