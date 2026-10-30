const PREVIEW_USED_KEY = 'oraculo_landing_preview_used_v1';
const PREVIEW_FP_KEY = 'oraculo_preview_fingerprint_v1';

export function getPreviewFingerprint(): string {
  try {
    const existing = localStorage.getItem(PREVIEW_FP_KEY);
    if (existing && existing.length >= 8) return existing;
    const fp =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `fp_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(PREVIEW_FP_KEY, fp);
    return fp;
  } catch {
    return `fp_${Date.now()}`;
  }
}

export function hasUsedLandingPreview(): boolean {
  try {
    return localStorage.getItem(PREVIEW_USED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markLandingPreviewUsed(): void {
  try {
    localStorage.setItem(PREVIEW_USED_KEY, '1');
  } catch {
    /* ignore */
  }
}
