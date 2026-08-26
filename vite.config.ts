import { defineConfig } from "vite";
import react from '@vitejs/plugin-react';
import path from "path";


// https://vitejs.dev/config/
const GUIA_CHECKOUT_FN = 'https://us-central1-culturalapp-fb9b0.cloudfunctions.net';
// Cronograma em dev: por padrão usa o emulador (evita 503 da função em produção).
// Terminal 1: cd functions && npm run serve   Terminal 2: npm run dev
// Para usar a função em produção em dev: VITE_CRONOGRAMA_USE_PROD=1 npm run dev
const CRONOGRAMA_PROJECT = 'culturalapp-fb9b0';
const CRONOGRAMA_REGION = 'us-central1';
const CRONOGRAMA_PROD = 'https://gerarcronogramaia-v3odkawqzq-uc.a.run.app';
const CRONOGRAMA_EMULATOR_BASE = 'http://127.0.0.1:5001';
const useCronogramaProd = process.env.VITE_CRONOGRAMA_USE_PROD === '1';

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api/checkout-guia-stripe': {
        target: GUIA_CHECKOUT_FN,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/checkout-guia-stripe/, '/criarCheckoutGuiaStripe'),
      },
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
