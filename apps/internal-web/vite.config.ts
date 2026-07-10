import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4001',
    },
  },
  preview: {
    port: 3001,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
  },
});
