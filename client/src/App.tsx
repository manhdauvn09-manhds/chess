import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import PlayBot from './pages/PlayBot';
import PlayLocal from './pages/PlayLocal';
import PlayOnline from './pages/PlayOnline';
import Leaderboard from './pages/Leaderboard';
import { useAuth } from './store';

export default function App() {
  const loadMe = useAuth((s) => s.loadMe);
  useEffect(() => {
    loadMe();
  }, [loadMe]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/online" element={<PlayOnline />} />
        <Route path="/bot" element={<PlayBot />} />
        <Route path="/local" element={<PlayLocal />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
