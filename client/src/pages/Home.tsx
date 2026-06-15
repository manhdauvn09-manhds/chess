import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost, useAuth, type User } from '../store';

export default function Home() {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="home">
      <header className="home-header">
        <div className="logo">♟ Cờ Vua</div>
        <div className="header-right">
          <button className="btn btn-sm btn-ghost" onClick={() => nav('/leaderboard')}>
            🏆 Xếp hạng
          </button>
          {user ? (
            <div className="user-chip">
              <span className="user-name">{user.username}</span>
              <span className="user-elo">{user.rating}</span>
              <button className="btn btn-sm btn-ghost" onClick={logout}>
                Đăng xuất
              </button>
            </div>
          ) : (
            <button className="btn btn-sm" onClick={() => setAuthOpen(true)}>
              Đăng nhập
            </button>
          )}
        </div>
      </header>

      <main className="home-main">
        <h1 className="home-title">Chơi cờ vua ngay</h1>
        <p className="home-sub">Online · Với máy · 2 người trên 1 máy</p>

        <div className="mode-grid">
          <ModeCard
            icon="🌐"
            title="Chơi Online"
            desc="Tìm trận nhanh theo Elo hoặc mời bạn bè qua mã phòng."
            accent="online"
            onClick={() => nav('/online')}
          />
          <ModeCard
            icon="🤖"
            title="Chơi với Máy"
            desc="7 cấp độ từ người mới đến Stockfish full sức mạnh."
            accent="bot"
            onClick={() => nav('/bot')}
          />
          <ModeCard
            icon="👥"
            title="2 người (Offline)"
            desc="Chơi cùng bạn trên cùng một thiết bị."
            accent="local"
            onClick={() => nav('/local')}
          />
        </div>

        {!user && (
          <p className="home-hint">
            💡 Đăng nhập để được <b>tính Elo</b> và lưu lịch sử khi chơi online.
          </p>
        )}
      </main>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}

function ModeCard({
  icon,
  title,
  desc,
  accent,
  onClick,
}: {
  icon: string;
  title: string;
  desc: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button className={`mode-card mode-${accent}`} onClick={onClick}>
      <div className="mode-icon">{icon}</div>
      <div className="mode-title">{title}</div>
      <div className="mode-desc">{desc}</div>
    </button>
  );
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const { setAuth } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setErr('');
    setLoading(true);
    try {
      const path = tab === 'login' ? '/api/login' : '/api/register';
      const data = await apiPost<{ token: string; user: User }>(path, { username, password });
      setAuth(data.token, data.user);
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <div className="auth-tabs">
          <button className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>
            Đăng nhập
          </button>
          <button className={tab === 'register' ? 'active' : ''} onClick={() => setTab('register')}>
            Đăng ký
          </button>
        </div>
        {err && <div className="error-banner">{err}</div>}
        <input
          placeholder="Tên đăng nhập"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="btn btn-primary btn-lg" onClick={submit} disabled={loading}>
          {loading ? 'Đang xử lý…' : tab === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          Đóng
        </button>
      </div>
    </div>
  );
}
