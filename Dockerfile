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

# Thư mục lưu SQLite (mount volume để giữ dữ liệu).
RUN mkdir -p /app/server/data
VOLUME ["/app/server/data"]

EXPOSE 3001
CMD ["node", "server/dist/index.js"]
