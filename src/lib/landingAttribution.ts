const UTM_STORAGE_KEY = 'oraculo_landing_utms';
const FUNNEL_FLAG_KEY = 'oraculo_landing_funnel';
const RESUME_MSG_KEY = 'oraculo_landing_resume_msg';

export type LandingUtmPayload = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  origem?: string;
  capturedAt: number;
};

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'origem'] as const;

export function captureLandingAttributionFromSearchParams(params: URLSearchParams): void {
  if (typeof window === 'undefined') return;
  const partial: Partial<LandingUtmPayload> = {};
  let hasAny = false;
  for (const key of UTM_KEYS) {
    const v = params.get(key)?.trim();
    if (v) {
      (partial as Record<string, string>)[key] = v;
      hasAny = true;
    }
  }
  if (!hasAny) return;
  try {
    const prev = readLandingAttribution();
    const merged: LandingUtmPayload = {
      ...prev,
      ...partial,
      capturedAt: Date.now(),
    };
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(merged));
    if (partial.origem === 'landing-ads' || params.get('continuar')) {
      sessionStorage.setItem(FUNNEL_FLAG_KEY, '1');
    }
  } catch {
    /* ignore */
  }
}

export function readLandingAttribution(): LandingUtmPayload | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LandingUtmPayload;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function landingAttributionForFirestore(): Record<string, string> {
  const utm = readLandingAttribution();
  if (!utm) return {};
  const out: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const v = utm[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim();
  }
  return out;
}

export function isCadastroFunnelContext(searchParams: URLSearchParams, redirect?: string | null): boolean {
  try {
    if (sessionStorage.getItem(FUNNEL_FLAG_KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  const origem = searchParams.get('origem')?.trim();
  if (origem === 'landing-ads') return true;
  const red = redirect?.trim() || searchParams.get('redirect')?.trim() || '';
  if (red.includes('criar-projeto') && (red.includes('continuar') || red.includes('origem=landing'))) {
    return true;
  }
  if (searchParams.get('continuar')) return true;
  return false;
}

export function markLandingResumeMessage(message: string): void {
  try {
    sessionStorage.setItem(RESUME_MSG_KEY, message);
  } catch {
    /* ignore */
  }
}

export function consumeLandingResumeMessage(): string | null {
  try {
    const msg = sessionStorage.getItem(RESUME_MSG_KEY)?.trim();
    if (msg) sessionStorage.removeItem(RESUME_MSG_KEY);
    return msg || null;
  } catch {
    return null;
  }
}
