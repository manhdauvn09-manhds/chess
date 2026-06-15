import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Board from '../components/Board';
import GameLayout from '../components/GameLayout';
import { ResultModal, capturedFromFen } from '../components/panels';
import { findKing } from '../game/boardUtils';
import { authenticate, getSocket } from '../game/socket';
import { useOnlineGame } from '../game/useOnlineGame';
import { useMoveSounds } from '../game/useMoveSounds';
import { useReview } from '../game/review';
import { useAuth } from '../store';
import { TIME_CONTROLS, type GameSnapshot, type TimeControl } from '../types';

type Phase = 'lobby' | 'searching' | 'roomWait' | 'game';

export default function PlayOnline() {
  const nav = useNavigate();
  const { token, loadMe, user } = useAuth();
  const [phase, setPhase] = useState<Phase>('lobby');
  const [tc, setTc] = useState<TimeControl>(TIME_CONTROLS[4].tc); // 5+0
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [err, setErr] = useState('');
  const socketRef = useRef(getSocket());

  useEffect(() => {
    authenticate(token);
  }, [token]);

  useEffect(() => {
    const s = socketRef.current;
    const onMatch = (snap: GameSnapshot) => {
      setSnapshot(snap);
      setPhase('game');
    };
    const onRematch = (snap: GameSnapshot) => {
      setSnapshot(snap); // đấu lại: thay ván mới, OnlineGame remount theo gameId
      setPhase('game');
    };
    const onErr = (m: string) => setErr(m);
    s.on('match:found', onMatch);
    s.on('rematch:start', onRematch);
    s.on('error:msg', onErr);
    return () => {
      s.off('match:found', onMatch);
      s.off('rematch:start', onRematch);
      s.off('error:msg', onErr);
    };
  }, []);

  function quickMatch() {
    setErr('');
    socketRef.current.emit('queue:join', tc);
    setPhase('searching');
  }
  function cancelSearch() {
    socketRef.current.emit('queue:leave');
    setPhase('lobby');
  }
  function createRoom() {
    setErr('');
    socketRef.current.emit('room:create', tc, (code) => {
      setRoomCode(code);
      setPhase('roomWait');
    });
  }
  function joinRoom() {
    setErr('');
    socketRef.current.emit('room:join', joinCode.toUpperCase().trim(), (ok, e) => {
      if (!ok) setErr(e || 'Không vào được phòng');
    });
  }

  if (phase === 'game' && snapshot) {
    return (
      <OnlineGame
        key={snapshot.gameId}
        snapshot={snapshot}
        onLeave={() => {
          setSnapshot(null);
          setPhase('lobby');
          loadMe();
        }}
      />
    );
  }

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h2>Chơi Online</h2>
        {user ? (
          <p className="muted">
            {user.username} · Elo {user.rating}
          </p>
        ) : (
          <p className="muted">Bạn đang chơi với tư cách Khách (Elo không được lưu).</p>
        )}

        {err && <div className="error-banner">{err}</div>}

        {phase === 'lobby' && (
          <>
            <div className="setup-section">
              <label>Chọn thời gian</label>
              <div className="tc-grid">
                {TIME_CONTROLS.map((t) => (
                  <button
                    key={t.label}
                    className={`level-btn ${tc.base === t.tc.base && tc.inc === t.tc.inc ? 'active' : ''}`}
                    onClick={() => setTc(t.tc)}
                  >
                    <span className="tc-label">{t.label}</span>
                    <span className="tc-cat">{t.cat}</span>
                  </button>
                ))}
              </div>
            </div>

            <button className="btn btn-primary btn-lg" onClick={quickMatch}>
              ⚡ Tìm trận nhanh
            </button>

            <div className="divider">hoặc chơi với bạn bè</div>
            <div className="room-row">
              <button className="btn" onClick={createRoom}>
                Tạo phòng
              </button>
              <div className="join-box">
                <input
                  placeholder="Nhập mã phòng"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  maxLength={5}
                />
                <button className="btn" onClick={joinRoom} disabled={!joinCode.trim()}>
                  Vào
                </button>
              </div>
            </div>

            <button className="btn btn-ghost" onClick={() => nav('/')}>
              Về trang chủ
            </button>
          </>
        )}

        {phase === 'searching' && (
          <div className="searching">
            <div className="spinner" />
            <p>Đang tìm đối thủ Elo tương đương…</p>
            <button className="btn btn-danger" onClick={cancelSearch}>
              Huỷ
            </button>
          </div>
        )}

        {phase === 'roomWait' && (
          <div className="searching">
            <p>Gửi mã này cho bạn bè để vào trận:</p>
            <div className="room-code">{roomCode}</div>
            <button
              className="btn"
              onClick={() => navigator.clipboard?.writeText(roomCode)}
            >
              📋 Sao chép mã
            </button>
            <div className="spinner" />
            <p className="muted">Đang chờ đối thủ vào phòng…</p>
            <button className="btn btn-ghost" onClick={() => setPhase('lobby')}>
              Huỷ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function OnlineGame({ snapshot, onLeave }: { snapshot: GameSnapshot; onLeave: () => void }) {
  const socket = getSocket();
  const g = useOnlineGame(socket, snapshot);
  const { st, myColor } = g;
  useMoveSounds(st.history, !!st.over);
  const review = useReview(st.history, st.fen);
  const [confirmResign, setConfirmResign] = useState(false);

  const oppColor = myColor === 'white' ? 'black' : 'white';
  const cap = capturedFromFen(review.displayFen);
  const myTurn = !st.over && st.turn === myColor && review.isLive;
  const checkSquare = review.isLive && st.inCheck ? findKing(st.fen, st.turn) : null;

  function info(color: 'white' | 'black') {
    const p = color === 'white' ? st.snapshot.white : st.snapshot.black;
    return {
      name: p.name,
      rating: p.isGuest ? undefined : p.rating,
      clockMs: st.clocks[color],
      active: st.turn === color && !st.over,
      captured: color === 'white' ? cap.capturedByWhite : cap.capturedByBlack,
      advantage: color === 'white' ? cap.whiteAdv : cap.blackAdv,
    };
  }

  let status: string | undefined;
  if (!review.isLive) status = '⏪ Đang xem lại — bấm nút Live để quay lại';
  else if (st.oppDisconnected) status = 'Đối thủ mất kết nối… (chờ 60s)';
  else if (!st.over) status = st.turn === myColor ? 'Tới lượt bạn' : st.premove ? 'Đã đặt premove…' : 'Lượt đối thủ';

  const drawLabel =
    st.drawAvailable === 'threefold'
      ? 'Claim hoà (lặp 3 lần)'
      : st.drawAvailable === 'fiftymove'
        ? 'Claim hoà (50 nước)'
        : null;

  return (
    <GameLayout
      top={info(oppColor)}
      bottom={info(myColor)}
      history={st.history}
      currentPly={review.currentPly}
      onSelectPly={review.goto}
      reviewControls={{ ...review }}
      statusText={status}
      board={
        <Board
          position={review.displayFen}
          orientation={myColor}
          interactive={myTurn}
          onMove={g.move}
          getLegalMoves={g.legalMoves}
          isPromotion={g.isPromotion}
          lastMove={review.isLive ? st.lastMove : null}
          checkSquare={checkSquare}
          arrows={review.arrow ? [review.arrow] : []}
          allowPremove={!st.over && review.isLive && st.turn !== myColor}
          premove={st.premove}
          onPremoveSet={g.setPremove}
          onPremoveClear={g.clearPremove}
          ownPieceAt={g.ownPieceAt}
        />
      }
      controls={
        <>
          {st.drawOffered && (
            <div className="draw-offer">
              <span>Đối thủ mời hoà</span>
              <div className="draw-actions">
                <button className="btn btn-sm btn-primary" onClick={() => g.respondDraw(true)}>
                  Đồng ý
                </button>
                <button className="btn btn-sm" onClick={() => g.respondDraw(false)}>
                  Từ chối
                </button>
              </div>
            </div>
          )}
          {drawLabel && (
            <button className="btn btn-primary" onClick={g.claimDraw} disabled={!!st.over}>
              ½ {drawLabel}
            </button>
          )}
          {st.premove && (
            <button className="btn" onClick={g.clearPremove}>
              ✖ Huỷ premove
            </button>
          )}
          <button className="btn" onClick={g.offerDraw} disabled={!!st.over || st.drawSent}>
            {st.drawSent ? 'Đã mời hoà…' : '½ Cầu hoà'}
          </button>
          {confirmResign ? (
            <div className="draw-offer">
              <span>Chắc chắn đầu hàng?</span>
              <div className="draw-actions">
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    g.resign();
                    setConfirmResign(false);
                  }}
                >
                  Đầu hàng
                </button>
                <button className="btn btn-sm" onClick={() => setConfirmResign(false)}>
                  Huỷ
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn-danger" onClick={() => setConfirmResign(true)} disabled={!!st.over}>
              🏳 Đầu hàng
            </button>
          )}
          <button className="btn btn-ghost" onClick={onLeave}>
            Thoát
          </button>
        </>
      }
      modal={
        st.over ? (
          <ResultModal
            result={st.over.result}
            reason={st.over.reason}
            myColor={myColor}
            elo={st.over.elo}
            onHome={onLeave}
            rematch={{
              offeredByOpponent: st.rematchOffered,
              pending: st.rematchSent,
              onOffer: g.offerRematch,
              onAccept: () => g.respondRematch(true),
              onDecline: () => g.respondRematch(false),
            }}
          />
        ) : null
      }
    />
  );
}
