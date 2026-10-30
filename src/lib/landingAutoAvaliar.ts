const AUTO_AVALIAR_KEY = 'oraculo_landing_auto_avaliar';

export function isLandingAutoAvaliarPending(): boolean {
  try {
    if (localStorage.getItem(AUTO_AVALIAR_KEY) === '1') return true;
    if (sessionStorage.getItem(AUTO_AVALIAR_KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function clearLandingAutoAvaliarPending(): void {
  try {
    localStorage.removeItem(AUTO_AVALIAR_KEY);
    sessionStorage.removeItem(AUTO_AVALIAR_KEY);
  } catch {
    /* ignore */
  }
}
