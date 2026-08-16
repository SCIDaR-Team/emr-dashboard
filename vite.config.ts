import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    // Honour an assigned PORT so this can run alongside the other dashboards,
    // several of which also default to 5173.
    port: Number(process.env.PORT) || 5173,
  },
  build: {
    // The explorer cube and facility detail are large; keep chunks legible
    // rather than letting Rollup emit one monolith.
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts', 'echarts-for-react'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
