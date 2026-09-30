import { buildDemoTextosCompletos } from '@/lib/demoTextosPrePreenchidos';

export type AvaliarProjetoDemoSession = {
  nome: string;
  descricao?: string;
  editalAssociado?: string;
  analiseConteudo?: string;
  editalId?: string | null;
  origem?: string;
  email?: string;
  landingSlug?: string;
  textos_gerados?: Record<string, string>;
};

const STORAGE_KEY = 'avaliarProjeto_dados';

export function loadAvaliarProjetoDemoSession(): AvaliarProjetoDemoSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AvaliarProjetoDemoSession;
  } catch {
    return null;
  }
}

export function saveAvaliarProjetoDemoSession(data: AvaliarProjetoDemoSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Persiste projeto + análise demo vindos da landing de edital (sobrevive ao cadastro). */
export function persistEditalLandingDemoSession(params: {
  nome: string;
  descricao: string;
  email: string;
  landingSlug: string;
  editalTitulo: string;
  editalId?: string | null;
  editalNomeParam: string;
  dataEncerramentoIso?: string;
}): void {
  const payload: AvaliarProjetoDemoSession = ensureDemoSessionWithTextos({
    nome: params.nome,
    descricao: params.descricao,
    editalAssociado: params.editalTitulo,
    editalId: params.editalId ?? null,
    analiseConteudo: 'demonstracao-modulo1',
    origem: 'edital_landing',
    email: params.email,
    landingSlug: params.landingSlug,
  });
  saveAvaliarProjetoDemoSession(payload);
  sessionStorage.setItem('oraculo_landing_email', params.email);
  sessionStorage.setItem('oraculo_landing_nome_projeto', params.nome);
  sessionStorage.setItem('oraculo_landing_edital_nome', params.editalNomeParam);
  if (params.dataEncerramentoIso) {
    sessionStorage.setItem('oraculo_landing_data_encerramento', params.dataEncerramentoIso);
    sessionStorage.setItem('oraculo_landing_slug', params.landingSlug);
  }
}

export function ensureDemoSessionWithTextos(base: AvaliarProjetoDemoSession): AvaliarProjetoDemoSession {
  const extras = base.textos_gerados ? Object.keys(base.textos_gerados) : [];
  return {
    ...base,
    textos_gerados: buildDemoTextosCompletos(extras),
  };
}

export function formatDemoDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
