import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents } from '../types';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;
let helloDone = false;

export function getSocket(): GameSocket {
  if (!socket) {
    // Cùng origin trong production; dev dùng proxy của Vite.
    socket = io('/', { autoConnect: true });
  }
  return socket;
}

// Gửi auth:hello (token hoặc null cho khách) và nhận PlayerInfo.
export function authenticate(token: string | null): Promise<PlayerInfo> {
  const s = getSocket();
  return new Promise((resolve) => {
    const doHello = () => {
      s.emit('auth:hello', token, (info) => {
        helloDone = true;
        resolve(info);
      });
    };
    if (s.connected) doHello();
    else s.once('connect', doHello);
  });
}

export function isAuthed() {
  return helloDone;
}
