const PROJECT_ID = import.meta.env.VITE_PROJECT_ID || 'culturalapp-fb9b0';

/** Fallback SSR/build quando não há `window` nem `VITE_PUBLIC_APP_URL`. */
export const DEFAULT_PUBLIC_APP_ORIGIN = `https://${PROJECT_ID}.web.app`;

export function resolvePublicAppOrigin(): string {
  const envOrigin = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  if (envOrigin) return envOrigin.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return DEFAULT_PUBLIC_APP_ORIGIN;
}
