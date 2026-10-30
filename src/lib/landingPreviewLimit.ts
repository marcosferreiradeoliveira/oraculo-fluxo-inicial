const PREVIEW_USED_KEY = 'oraculo_landing_preview_used_v1';

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
