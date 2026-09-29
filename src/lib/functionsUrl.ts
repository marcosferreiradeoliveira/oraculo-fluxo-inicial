const PROJECT_ID = import.meta.env.VITE_PROJECT_ID || 'culturalapp-fb9b0';

/** Base URL das Cloud Functions (produção). Emulador: use VITE_FUNCTIONS_BASE_URL. */
export const PRODUCTION_FUNCTIONS = `https://us-central1-${PROJECT_ID}.cloudfunctions.net`;

/**
 * Em desenvolvimento, se VITE_FUNCTIONS_BASE_URL estiver setado, usa o emulador.
 * Em produção (build), sempre usa PRODUCTION_FUNCTIONS.
 */
export function getFunctionsBaseUrl(): string {
  const emulator = import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined;
  if (import.meta.env.DEV && emulator) {
    return emulator.replace(/\/$/, '');
  }
  return PRODUCTION_FUNCTIONS;
}
