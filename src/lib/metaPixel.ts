import { getFunctionsBaseUrl } from '@/lib/functionsUrl';

export const META_PIXEL_ID = '642831091634391';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
  }
}

let pixelBootstrapped = false;

/** Garante o snippet do Pixel (landing); no app principal o index.html já inicializa. */
export function ensureMetaPixelLoaded(pixelId: string = META_PIXEL_ID): void {
  if (typeof window === 'undefined' || pixelBootstrapped) return;
  if (window.fbq) {
    pixelBootstrapped = true;
    return;
  }

  (function (f: Window, b: Document, e: string, v: string) {
    const w = f as Window & { _fbq?: typeof window.fbq; fbq?: typeof window.fbq };
    if (w.fbq) return;
    const n = function (...args: unknown[]) {
      const fn = n as typeof n & {
        callMethod?: (...a: unknown[]) => void;
        queue?: unknown[][];
      };
      if (fn.callMethod) fn.callMethod(...args);
      else fn.queue?.push(args);
    } as NonNullable<typeof window.fbq> & { queue?: unknown[][]; loaded?: boolean; version?: string };
    w.fbq = n;
    if (!w._fbq) w._fbq = n;
    n.queue = [];
    n.loaded = true;
    n.version = '2.0';
    const t = b.createElement(e);
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s?.parentNode?.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq?.('init', pixelId);
  pixelBootstrapped = true;
}

export function generateMetaEventId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function getMetaConversionUrl(): string {
  if (import.meta.env.DEV && !import.meta.env.VITE_FUNCTIONS_BASE_URL) {
    return '/api/meta-conversion';
  }
  return `${getFunctionsBaseUrl()}/enviarEventoMeta`;
}

type TrackMetaOptions = {
  email?: string;
  customData?: Record<string, unknown>;
  eventId?: string;
};

export async function sendMetaEventServerSide(payload: {
  eventName: string;
  eventId: string;
  email?: string;
  customData?: Record<string, unknown>;
}): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const res = await fetch(getMetaConversionUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: payload.eventName,
        eventId: payload.eventId,
        eventSourceUrl: window.location.href,
        email: payload.email,
        fbp: getCookie('_fbp'),
        fbc: getCookie('_fbc'),
        customData: payload.customData,
        pixelId: META_PIXEL_ID,
      }),
      keepalive: true,
    });
    return res.ok;
  } catch (err) {
    console.warn('[Meta Pixel] CAPI falhou (browser segue ok):', err);
    return false;
  }
}

export function trackMetaEvent(
  eventName: string,
  params: Record<string, unknown> = {},
  options: TrackMetaOptions = {},
): string {
  const eventId = options.eventId ?? generateMetaEventId();

  if (typeof window !== 'undefined') {
    ensureMetaPixelLoaded();
    window.fbq?.('track', eventName, params, { eventID: eventId });
  }

  void sendMetaEventServerSide({
    eventName,
    eventId,
    email: options.email,
    customData: { ...params, ...(options.customData ?? {}) },
  });

  return eventId;
}

export function trackMetaLeadVerExemplo(params: { edital: string; origem?: string }): string {
  return trackMetaEvent('Lead', {
    content_name: 'landing_ver_exemplo',
    content_category: params.edital,
    origem: params.origem ?? 'landing-ads',
  });
}

export function metaCompleteRegistrationEventId(uid: string): string {
  return `complete-reg-${uid}`;
}

export function trackMetaCompleteRegistration(email?: string, uid?: string): string {
  const eventId = uid ? metaCompleteRegistrationEventId(uid) : generateMetaEventId();
  return trackMetaEvent(
    'CompleteRegistration',
    { status: 'completed' },
    { email, eventId },
  );
}

/** Aguarda CAPI antes de navegar (ex.: login Google). */
export async function trackMetaCompleteRegistrationAndWait(
  email?: string,
  uid?: string,
): Promise<void> {
  const eventId = uid ? metaCompleteRegistrationEventId(uid) : generateMetaEventId();
  ensureMetaPixelLoaded();
  window.fbq?.('track', 'CompleteRegistration', { status: 'completed' }, { eventID: eventId });
  await sendMetaEventServerSide({
    eventName: 'CompleteRegistration',
    eventId,
    email,
    customData: { status: 'completed' },
  });
}
