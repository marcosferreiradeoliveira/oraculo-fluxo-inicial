const STORAGE_NOME = 'oraculo_landing_nome_projeto';
const STORAGE_EMAIL = 'oraculo_landing_email';
const DRAFT_KEY = 'oraculo_criar_projeto_draft';

export type CriarProjetoDraft = {
  nome: string;
  descricao: string;
  editalAssociado: string;
  editalId?: string;
  updatedAt: number;
};

export function stashLandingLeadForCriarProjeto(nomeProjeto: string, email: string) {
  sessionStorage.setItem(STORAGE_NOME, nomeProjeto.trim());
  sessionStorage.setItem(STORAGE_EMAIL, email.trim().toLowerCase());
}

export function readLandingNomeProjeto(): string {
  return sessionStorage.getItem(STORAGE_NOME)?.trim() || '';
}

export function readCriarProjetoDraft(): CriarProjetoDraft | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CriarProjetoDraft;
    if (!parsed || typeof parsed.nome !== 'string') return null;
    return {
      nome: parsed.nome || '',
      descricao: typeof parsed.descricao === 'string' ? parsed.descricao : '',
      editalAssociado: typeof parsed.editalAssociado === 'string' ? parsed.editalAssociado : '',
      editalId: typeof parsed.editalId === 'string' ? parsed.editalId : undefined,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveCriarProjetoDraft(
  partial: Omit<CriarProjetoDraft, 'updatedAt'> & { updatedAt?: number }
) {
  if (typeof localStorage === 'undefined') return;
  const draft: CriarProjetoDraft = {
    nome: partial.nome,
    descricao: partial.descricao,
    editalAssociado: partial.editalAssociado,
    editalId: partial.editalId,
    updatedAt: partial.updatedAt ?? Date.now(),
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearCriarProjetoDraft() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(DRAFT_KEY);
}

export function buildCriarProjetoFromLandingQuery(opts: {
  nomeProjeto: string;
  firestoreEditalId?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set('nome', opts.nomeProjeto.trim());
  params.set('origem', 'landing');
  if (opts.firestoreEditalId?.trim()) {
    params.set('edital', opts.firestoreEditalId.trim());
  }
  return `/criar-projeto?${params.toString()}`;
}

export function buildCadastroRedirectToCriarProjeto(criarProjetoPath: string): string {
  return `/cadastro?redirect=${encodeURIComponent(criarProjetoPath)}&continuar=true`;
}
