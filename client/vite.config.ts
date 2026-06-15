import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Trong dev: proxy /api và /socket.io sang server Node ở cổng 3001.
// Trong production: server Node serve luôn thư mục dist này.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  // Stockfish wasm cần được giữ nguyên trong public/ -> không bundle.
  optimizeDeps: {
    exclude: ['stockfish'],
  },
});
