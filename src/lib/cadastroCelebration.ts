const KEY = 'oraculo_cadastro_celebration';

export type CadastroCelebrationPayload = {
  redirect?: string;
  createdAt: number;
};

export function markCadastroCelebrationPending(redirect?: string): void {
  try {
    const payload: CadastroCelebrationPayload = {
      redirect: redirect?.startsWith('/') ? redirect : undefined,
      createdAt: Date.now(),
    };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function peekCadastroCelebrationPending(): CadastroCelebrationPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CadastroCelebrationPayload;
    if (!parsed?.createdAt) return null;
    if (Date.now() - parsed.createdAt > 1000 * 60 * 60 * 24) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearCadastroCelebrationPending(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
