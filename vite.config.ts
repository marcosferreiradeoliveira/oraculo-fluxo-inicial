import { defineConfig } from "vite";
import react from '@vitejs/plugin-react';
import path from "path";


// https://vitejs.dev/config/
const FIREBASE_PROJECT = process.env.VITE_PROJECT_ID || 'oraculo-is';
// Cronograma em dev: por padrão usa o emulador (evita 503 da função em produção).
// Terminal 1: cd functions && npm run serve   Terminal 2: npm run dev
// Para usar a função em produção em dev: VITE_CRONOGRAMA_USE_PROD=1 npm run dev
const CRONOGRAMA_PROJECT = FIREBASE_PROJECT;
const CRONOGRAMA_REGION = 'us-central1';
const CRONOGRAMA_PROD = `https://us-central1-${FIREBASE_PROJECT}.cloudfunctions.net/gerarCronogramaIA`;
const CRONOGRAMA_EMULATOR_BASE = 'http://127.0.0.1:5001';
const useCronogramaProd = process.env.VITE_CRONOGRAMA_USE_PROD === '1';

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api/gerarCronogramaIA': {
        target: useCronogramaProd ? CRONOGRAMA_PROD : CRONOGRAMA_EMULATOR_BASE,
        changeOrigin: true,
        rewrite: () =>
          useCronogramaProd ? '/' : `/${CRONOGRAMA_PROJECT}/${CRONOGRAMA_REGION}/gerarCronogramaIA`,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
