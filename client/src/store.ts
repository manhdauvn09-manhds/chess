import { create } from 'zustand';

export interface User {
  id: string;
  username: string;
  rating: number;
  peakRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
  loadMe: () => Promise<void>;
}

const TOKEN_KEY = 'chess_token';

export const useAuth = create<AuthState>((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({ token, user });
  },
  setUser: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null });
  },
  loadMe: async () => {
    const token = get().token;
    if (!token) return;
    try {
      const res = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      set({ user: data.user });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      set({ token: null, user: null });
    }
  },
}));

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra');
  return data as T;
}
