import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    root: 'client',
    // Rahasia .env hanya dibaca konfigurasi server, tidak diteruskan ke browser.
    envDir: process.cwd(),
    build: { outDir: '../dist/client', emptyOutDir: true },
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': `http://127.0.0.1:${process.env.PORT || env.PORT || '3001'}` },
    },
  };
});
