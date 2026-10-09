/** URL pública do app (links de convite, e-mails). Nunca localhost para convidados. */
export function publicAppOrigin(): string {
  const fromEnv = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  if (typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/$/, '');
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    if (!isLocal) return origin;
  }

  return 'https://criador-is.web.app';
}
