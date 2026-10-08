const PROJECT_ID = import.meta.env.VITE_PROJECT_ID || 'oraculo-is';

/** Base URL das Cloud Functions (produção). Emulador: use VITE_FUNCTIONS_BASE_URL. */
export const PRODUCTION_FUNCTIONS = `https://us-central1-${PROJECT_ID}.cloudfunctions.net`;

/**
 * Dev: produção por padrão (oraculo-is local sem emulador).
 * Emulador só com VITE_FUNCTIONS_USE_EMULATOR=1 + VITE_FUNCTIONS_BASE_URL.
 * Build: sempre produção.
 */
export function getFunctionsBaseUrl(): string {
  if (!import.meta.env.DEV) return PRODUCTION_FUNCTIONS;

  const useEmulator = import.meta.env.VITE_FUNCTIONS_USE_EMULATOR === '1';
  const emulator = (import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined)?.trim();
  if (useEmulator && emulator) {
    return emulator.replace(/\/$/, '');
  }
  return PRODUCTION_FUNCTIONS;
}

export function getAdicionarContatoBrevoUrl(): string {
  return `${getFunctionsBaseUrl()}/adicionarContatoBrevo`;
}
