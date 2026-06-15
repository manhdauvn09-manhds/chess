import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store';

interface Row {
  username: string;
  rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
}

export default function Leaderboard() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((d) => setRows(d.players))
      .catch(() => setErr('Không tải được bảng xếp hạng'));
  }, []);

  return (
    <div className="setup-screen">
      <div className="setup-card lb-card">
        <h2>🏆 Bảng xếp hạng</h2>
        <p className="muted">Top người chơi theo Elo</p>

        {err && <div className="error-banner">{err}</div>}

        {!rows && !err && (
          <div className="searching">
            <div className="spinner" />
          </div>
        )}

        {rows && rows.length === 0 && (
          <p className="muted" style={{ margin: '24px 0' }}>
            Chưa có người chơi nào được xếp hạng. Hãy đăng nhập và chơi online để có Elo!
          </p>
        )}

        {rows && rows.length > 0 && (
          <div className="lb-table">
            <div className="lb-row lb-head">
              <span>#</span>
              <span>Người chơi</span>
              <span className="lb-num">Elo</span>
              <span className="lb-num lb-hide">Trận</span>
              <span className="lb-num lb-hide">T/H/B</span>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.username}
                className={`lb-row ${user?.username === r.username ? 'lb-me' : ''}`}
              >
                <span className={`lb-rank rank-${i + 1}`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </span>
                <span className="lb-name">{r.username}</span>
                <span className="lb-num lb-elo">{r.rating}</span>
                <span className="lb-num lb-hide">{r.games_played}</span>
                <span className="lb-num lb-hide">
                  {r.wins}/{r.draws}/{r.losses}
                </span>
              </div>
            ))}
          </div>
        )}

        <button className="btn btn-ghost" onClick={() => nav('/')} style={{ marginTop: 18 }}>
          Về trang chủ
        </button>
      </div>
    </div>
  );
}
