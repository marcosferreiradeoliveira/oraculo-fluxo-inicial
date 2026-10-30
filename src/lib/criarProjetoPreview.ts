const PENDING_KEY = 'oraculo_criar_projeto_pending_analise';
const PENDING_LOCAL_KEY = 'oraculo_criar_projeto_pending_analise_ls';

export type CriarProjetoPendingAnalise = {
  analiseConteudo: string;
  nome: string;
  descricao: string;
  editalAssociado: string;
  editalId?: string;
};

export function savePendingAnalisePreview(data: CriarProjetoPendingAnalise): void {
  const serialized = JSON.stringify(data);
  try {
    sessionStorage.setItem(PENDING_KEY, serialized);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(PENDING_LOCAL_KEY, serialized);
  } catch {
    /* ignore */
  }
}

export function readPendingAnalisePreview(): CriarProjetoPendingAnalise | null {
  const parse = (raw: string | null): CriarProjetoPendingAnalise | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as CriarProjetoPendingAnalise;
      if (!parsed?.analiseConteudo?.trim()) return null;
      return parsed;
    } catch {
      return null;
    }
  };
  try {
    const fromSession = parse(sessionStorage.getItem(PENDING_KEY));
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  try {
    const fromLocal = parse(localStorage.getItem(PENDING_LOCAL_KEY));
    if (fromLocal) {
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(fromLocal));
      } catch {
        /* ignore */
      }
      return fromLocal;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function clearPendingAnalisePreview(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(PENDING_LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

/** Compara rascunho com a prévia visitante (tolera pequenas diferenças na descrição). */
export function pendingAnaliseMatchesForm(
  pending: CriarProjetoPendingAnalise | null,
  nome: string,
  descricao: string,
): boolean {
  if (!pending?.analiseConteudo?.trim()) return false;
  if (pending.nome.trim() !== nome.trim()) return false;
  const pd = pending.descricao.trim();
  const d = descricao.trim();
  if (!pd || !d) return pd === d;
  if (pd === d) return true;
  const sliceLen = Math.min(400, pd.length, d.length);
  if (sliceLen >= 80 && pd.slice(0, sliceLen) === d.slice(0, sliceLen)) return true;
  return pd.includes(d.slice(0, Math.min(200, d.length))) || d.includes(pd.slice(0, Math.min(200, pd.length)));
}

export function pendingAnaliseMatchesNome(
  pending: CriarProjetoPendingAnalise | null,
  nome: string,
): boolean {
  return Boolean(pending?.analiseConteudo?.trim() && pending.nome.trim() === nome.trim());
}
