# ♟ Cờ Vua Online

Web chơi cờ vua: **Online** (ghép trận theo Elo + phòng riêng), **chơi với Máy** (Stockfish, 7 cấp độ), và **Offline** (2 người 1 máy). Có hệ thống **Elo chuẩn** tính ở server.

## Công nghệ
- **Client:** React + TypeScript + Vite, `chess.js`, `react-chessboard`, `socket.io-client`.
- **Bot:** Stockfish 16 (WASM, chạy trong trình duyệt) — có engine JS dự phòng nếu không tải được.
- **Server:** Node + Express + Socket.IO, SQLite (`better-sqlite3`), JWT auth.

## Chạy ở máy dev
```bash
npm install          # tự tải Stockfish vào client/public/stockfish
npm run dev          # client: http://localhost:5173, server: http://localhost:3001
```
Mở http://localhost:5173.

## Build production (không Docker)
```bash
npm install
npm run build        # build client (dist) + server (dist)
npm start            # server chạy ở :3001 và serve luôn giao diện
```
Mở http://localhost:3001.

## Deploy bằng Docker (khuyến nghị)
```bash
# Đặt secret cho JWT (tuỳ chọn nhưng nên có)
export JWT_SECRET="chuoi-bi-mat-cua-ban"

docker compose up -d --build
```
Truy cập http://SERVER_IP:3001. Dữ liệu Elo lưu ở volume `chess-data`.

### Reverse proxy + HTTPS (tuỳ chọn)
Trỏ Nginx/Caddy về `http://127.0.0.1:3001`, nhớ bật **WebSocket upgrade** cho `/socket.io`.

Ví dụ Nginx:
```nginx
location / {
  proxy_pass http://127.0.0.1:3001;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
}
```

## Cách chơi
- **Online:** Trang chủ → *Chơi Online* → chọn thời gian → **Tìm trận nhanh** (tự ghép theo Elo), hoặc **Tạo phòng** rồi gửi mã cho bạn.
- **Với máy:** chọn 1 trong 7 cấp độ (≈800 → Stockfish full), chọn màu quân.
- **Offline:** 2 người đánh trên cùng máy, bàn cờ tự lật theo lượt.

## Kiểm thử
```bash
npm test          # unit test: Elo, luật cờ, opening book, tiện ích (node:test)
npm run typecheck # kiểm tra kiểu TypeScript cả client + server
```
33 test bao phủ: công thức/K-factor Elo & zero-sum, chiếu hết/bí/thiếu quân, hoà-khi-hết-giờ-thiếu-quân, claim threefold/50-nước, opening book.

## Vận hành (production)
- **Tắt êm:** server bắt `SIGTERM`/`SIGINT` (Docker `stop` gửi SIGTERM) → lưu ngay các ván đang chơi vào `server/data/active-games.json` rồi mới thoát. Khởi động lại sẽ **khôi phục ván** (người chơi vào lại bằng reconnect).
- **Health check:** `GET /healthz` → `{ ok: true }` (dùng cho Docker healthcheck / uptime monitor).
- **Bảo mật:** rate-limit đăng nhập/đăng ký + throttle nước đi; security headers; bắt buộc `JWT_SECRET` khi `NODE_ENV=production`.

## Mở rộng nhiều instance (khi cần)
Mặc định chạy **1 instance** là quá đủ cho 1 VPS. Trạng thái ván giữ in-memory (kèm snapshot ra đĩa). Để scale ngang về sau cần 2 bước:
1. **Sticky sessions theo `gameId`** (định tuyến cùng người chơi 1 ván về cùng instance) + `@socket.io/redis-adapter` để phát sự kiện chéo instance.
2. **Tách trạng thái ván & hàng đợi sang Redis**, và đổi lớp lưu trữ `server/src/db.ts` sang Postgres (API `queries` đã được tách riêng để dễ thay; chỉ cần chuyển các lời gọi sang async).

## Elo
- Mặc định 1200. Công thức chuẩn: `R' = R + K·(S − E)`, K = 40 (<30 trận) / 20 / 10 (≥2400).
- **Chỉ tính Elo khi cả hai người đã đăng nhập** (không phải khách). Tính & lưu hoàn toàn ở server.

## Cấu trúc
```
client/   # Giao diện React
server/   # API + realtime + Elo + SQLite
scripts/  # Tải Stockfish
```
