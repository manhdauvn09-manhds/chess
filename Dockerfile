# ---------- Build ----------
FROM node:20-bookworm AS build
WORKDIR /app

# Cài deps trước để tận dụng cache layer.
COPY package.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY scripts ./scripts
# postinstall sẽ tải Stockfish vào client/public/stockfish
RUN npm install

# Copy mã nguồn rồi build cả client + server.
COPY . .
RUN npm run build

# ---------- Run ----------
FROM node:20-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

# Non-root runtime user (Ops security review 2026-10-08).
# Thư mục lưu SQLite (mount volume để giữ dữ liệu) — user app cần quyền ghi.
RUN useradd -u 10001 app && mkdir -p /app/server/data && chown -R 10001:10001 /app/server/data
VOLUME ["/app/server/data"]

USER 10001
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
