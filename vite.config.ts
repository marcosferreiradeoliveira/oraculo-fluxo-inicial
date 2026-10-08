import { defineConfig } from "vite";
import react from '@vitejs/plugin-react';
import path from "path";


// https://vitejs.dev/config/
const FIREBASE_PROJECT = process.env.VITE_PROJECT_ID || 'oraculo-is';
// Cronograma em dev: padrão = função publicada (VITE_CRONOGRAMA_USE_PROD=1 em .env.oraculo-is).
// Emulador: VITE_CRONOGRAMA_USE_PROD=0 + cd functions && npm run serve
const CRONOGRAMA_PROJECT = FIREBASE_PROJECT;
const CRONOGRAMA_REGION = 'us-central1';
const CRONOGRAMA_PROD_BASE = `https://us-central1-${FIREBASE_PROJECT}.cloudfunctions.net`;
const CRONOGRAMA_EMULATOR_BASE = 'http://127.0.0.1:5001';
const useCronogramaProd = process.env.VITE_CRONOGRAMA_USE_PROD !== '0';
const cronogramaProxyTarget =
  process.env.VITE_CRONOGRAMA_PROXY_TARGET?.trim() ||
  (useCronogramaProd ? CRONOGRAMA_PROD_BASE : CRONOGRAMA_EMULATOR_BASE);

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api/gerarCronogramaIA': {
        target: cronogramaProxyTarget,
        changeOrigin: true,
        rewrite: () =>
          useCronogramaProd && !process.env.VITE_CRONOGRAMA_PROXY_TARGET?.trim()
            ? '/gerarCronogramaIA'
            : `/${CRONOGRAMA_PROJECT}/${CRONOGRAMA_REGION}/gerarCronogramaIA`,
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
