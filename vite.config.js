// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Важно для Electron, чтобы пути были относительными
  resolve: {
    alias: {
      // Это позволит использовать абсолютные импорты из папки src
      // Например: import { getMonthName } from '/utils.js';
      // Или относительно: import { getMonthName } from './utils.js';
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },

  server: {
    port: 3000,
    open: false,
  },
});
