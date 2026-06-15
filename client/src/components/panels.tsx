import { useEffect, useRef } from 'react';
import type { Color, EndReason, GameOverPayload, GameResultType } from '../types';

// ---------- Đồng hồ ----------
export function Clock({ ms, active }: { ms: number; active: boolean }) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const low = ms < 20000;
  return (
    <div className={`clock ${active ? 'clock-active' : ''} ${low ? 'clock-low' : ''}`}>
      {m}:{s.toString().padStart(2, '0')}
    </div>
  );
}

// ---------- Thanh đánh giá thế cờ ----------
export function EvalBar({ pawns, orientation }: { pawns: number; orientation: Color }) {
  const clamp = Math.max(-8, Math.min(8, pawns));
  // Tỉ lệ phần Trắng (0..100).
  const whitePct = 50 + (clamp / 8) * 50;
  // Khi xoay bàn theo quân Đen, đảo hướng để khớp trực giác.
  const flip = orientation === 'black';
  const label = (pawns >= 0 ? '+' : '') + pawns.toFixed(1);
  return (
    <div className={`eval-bar ${flip ? 'eval-flip' : ''}`} title={`Đánh giá: ${label}`}>
      <div className="eval-white" style={{ height: `${whitePct}%` }} />
      <span className="eval-label">{label}</span>
    </div>
  );
}

// ---------- Thanh người chơi ----------
export function PlayerBar({
  name,
  rating,
  captured,
  advantage,
}: {
  name: string;
  rating?: number;
  captured: string[];
  advantage: number;
}) {
  return (
    <div className="player-bar">
      <div className="player-id">
        <span className="player-name">{name}</span>
        {rating != null && <span className="player-rating">{rating}</span>}
      </div>
      <div className="captured">
        {captured.map((p, i) => (
          <span key={i} className="cap-piece">
            {p}
          </span>
        ))}
        {advantage > 0 && <span className="advantage">+{advantage}</span>}
      </div>
    </div>
  );
}

// ---------- Danh sách nước đi (click để xem lại) ----------
export function MoveList({
  history,
  currentPly,
  onSelect,
}: {
  history: string[];
  currentPly?: number; // ply đang xem (0-based). Mặc định = nước cuối.
  onSelect?: (ply: number) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const cur = currentPly ?? history.length - 1;

  useEffect(() => {
    // Tự cuộn xuống nước mới nhất.
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length]);

  const rows: { no: number; w?: string; b?: string; wPly: number; bPly: number }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push({ no: i / 2 + 1, w: history[i], b: history[i + 1], wPly: i, bPly: i + 1 });
  }

  const cell = (san: string | undefined, ply: number) =>
    san ? (
      <span
        className={`move-san ${onSelect ? 'move-clickable' : ''} ${ply === cur ? 'move-current' : ''}`}
        onClick={() => onSelect?.(ply)}
      >
        {san}
      </span>
    ) : (
      <span className="move-san" />
    );

  return (
    <div className="movelist">
      <div className="movelist-head">Nước đi</div>
      <div className="movelist-body" ref={bodyRef}>
        {rows.length === 0 && <div className="movelist-empty">Chưa có nước đi nào</div>}
        {rows.map((r) => (
          <div className="move-row" key={r.no}>
            <span className="move-no">{r.no}.</span>
            {cell(r.w, r.wPly)}
            {cell(r.b, r.bPly)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Modal kết quả ----------
const REASON_TEXT: Record<EndReason, string> = {
  checkmate: 'Chiếu hết',
  resign: 'Đầu hàng',
  timeout: 'Hết giờ',
  stalemate: 'Hết nước (stalemate)',
  insufficient: 'Không đủ quân chiếu hết',
  threefold: 'Lặp 3 lần',
  fiftymove: 'Luật 50 nước',
  agreement: 'Đồng ý hòa',
  abort: 'Đối thủ rời trận',
};

export interface RematchControl {
  offeredByOpponent: boolean;
  pending: boolean; // mình đã gửi lời mời, chờ đối thủ
  onOffer: () => void;
  onAccept: () => void;
  onDecline: () => void;
}

export function ResultModal({
  result,
  reason,
  myColor,
  elo,
  onRematch,
  onHome,
  rematchLabel = 'Chơi lại',
  rematch,
}: {
  result: GameResultType;
  reason: EndReason;
  myColor: Color;
  elo?: GameOverPayload['elo'];
  onRematch?: () => void;
  onHome: () => void;
  rematchLabel?: string;
  rematch?: RematchControl;
}) {
  const won = result !== 'draw' && result === myColor;
  const draw = result === 'draw';
  const title = draw ? 'Hòa' : won ? 'Bạn thắng! 🎉' : 'Bạn thua';
  const cls = draw ? 'res-draw' : won ? 'res-win' : 'res-loss';

  const myElo = elo ? (myColor === 'white' ? elo.white : elo.black) : null;

  return (
    <div className="modal-overlay">
      <div className={`modal-card ${cls}`}>
        <div className="modal-title">{title}</div>
        <div className="modal-reason">{REASON_TEXT[reason]}</div>
        {myElo && (
          <div className="modal-elo">
            <span>Elo: {myElo.before}</span>
            <span className={myElo.delta >= 0 ? 'delta-up' : 'delta-down'}>
              {myElo.delta >= 0 ? '+' : ''}
              {myElo.delta}
            </span>
            <span className="elo-after">→ {myElo.after}</span>
          </div>
        )}
        <div className="modal-actions">
          {rematch ? (
            rematch.offeredByOpponent ? (
              <div className="rematch-offer">
                <span>Đối thủ muốn đấu lại</span>
                <div className="draw-actions">
                  <button className="btn btn-sm btn-primary" onClick={rematch.onAccept}>
                    Đồng ý
                  </button>
                  <button className="btn btn-sm" onClick={rematch.onDecline}>
                    Từ chối
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn btn-primary" onClick={rematch.onOffer} disabled={rematch.pending}>
                {rematch.pending ? 'Đang chờ đối thủ…' : '🔄 Đấu lại'}
              </button>
            )
          ) : (
            onRematch && (
              <button className="btn btn-primary" onClick={onRematch}>
                {rematchLabel}
              </button>
            )
          )}
          <button className="btn btn-ghost" onClick={onHome}>
            Về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Tính quân bị bắt + ưu thế vật chất ----------
const UNICODE: Record<string, string> = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛',
};
const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const START: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };

export function capturedFromFen(fen: string) {
  const board = fen.split(' ')[0];
  const count: Record<string, number> = {};
  for (const ch of board) {
    if (/[pnbrqPNBRQ]/.test(ch)) count[ch] = (count[ch] || 0) + 1;
  }
  const captured = (color: 'w' | 'b') => {
    const arr: string[] = [];
    let score = 0;
    for (const t of ['q', 'r', 'b', 'n', 'p'] as const) {
      const letter = color === 'w' ? t.toUpperCase() : t;
      const missing = START[t] - (count[letter] || 0);
      for (let i = 0; i < missing; i++) arr.push(UNICODE[(color === 'w' ? 'w' : 'b') + t]);
      score += Math.max(0, missing) * VAL[t];
    }
    return { arr, score };
  };
  // Quân Trắng bị bắt -> hiển thị ở phía Đen, và ngược lại.
  const whiteLost = captured('w');
  const blackLost = captured('b');
  return {
    capturedByWhite: blackLost.arr, // quân đen mà trắng đã ăn
    capturedByBlack: whiteLost.arr,
    whiteAdv: Math.max(0, blackLost.score - whiteLost.score),
    blackAdv: Math.max(0, whiteLost.score - blackLost.score),
  };
}
