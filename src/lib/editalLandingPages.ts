import { diasRestantes, parseEditalEncerramento } from '@/lib/editalDates';

export type EditalLandingCriterio = {
  nome: string;
  peso: string;
};

export type EditalLandingDemoIA = {
  notaOriginal: number;
  notaOtimizada: number;
  textoOriginal: string;
  textoOtimizado: string;
  criterioDestaque: string;
};

export type EditalLandingConfig = {
  slug: string;
  kicker: string;
  titulo: string;
  proponente: string;
  /** ISO date YYYY-MM-DD for countdown */
  dataEncerramentoIso: string;
  valorGlobal: string;
  pdfUrl?: string;
  linkEdital?: string;
  resumoEscopo: string;
  criterios: EditalLandingCriterio[];
  categorias: string[];
  textosExigidos: string[];
  documentacao: string[];
  cardTitulo: string;
  cardSubtitulo: string;
  demoIA: EditalLandingDemoIA;
  /** Query ?editalNome= for AvaliarProjeto resolver */
  editalNomeParam: string;
  firestoreEditalId?: string;
  /** Capa/ilustrativa (Firestore `thumbnail` ou URL estática) */
  thumbnailUrl?: string;
};

const AMBEV: EditalLandingConfig = {
  slug: 'ambev-brasilidades-2026',
  kicker: 'EDITAL PÚBLICO MAPEADO POR IA',
  titulo: 'AMBEV BRASILIDADES 2026',
  proponente: 'AMBEV S.A. | Fomento à Cultura e Economia Criativa',
  dataEncerramentoIso: '2026-09-29',
  valorGlobal: 'R$ 67.000.000,00',
  linkEdital: 'https://www.ambev.com.br',
  resumoEscopo:
    'A Ambev busca reforçar os investimentos e democratizar o acesso a recursos para projetos que celebrem as brasilidades e a identidade nacional, com foco em diversidade cultural, inclusão e circulação em territórios periféricos e interior.',
  criterios: [
    { nome: 'Relevância artístico-cultural', peso: '30%' },
    { nome: 'Capacidade técnica do proponente', peso: '25%' },
    { nome: 'Exequibilidade orçamentária', peso: '25%' },
    { nome: 'Democratização e acesso', peso: '20%' },
  ],
  categorias: ['Gastronomia', 'Festivais de Música', 'Teatro', 'Moda', 'Cinema', 'Artes Visuais'],
  textosExigidos: ['Descritivo do projeto', 'Justificativa', 'Portfólio', 'Cronograma', 'Plano de mídia'],
  documentacao: [
    'Certidão negativa de débitos (CND)',
    'Certificado de regularidade do FGTS',
    'Comprovante de inscrição no CADASTUR (quando aplicável)',
    'Anexo de autoria e direitos',
    'Declaração de veracidade das informações',
  ],
  cardTitulo: 'Veja como o parecerista da AMBEV vai avaliar seu projeto',
  cardSubtitulo:
    'Nossa IA lê as exigências deste edital e simula a nota da banca antes de você enviar a versão final.',
  demoIA: {
    notaOriginal: 6.5,
    notaOtimizada: 9.8,
    textoOriginal:
      'Festival gratuito com 4 apresentações em praça pública. Objetivo de valorizar artistas locais e ampliar o acesso à cultura.',
    textoOtimizado:
      'Festival gratuito com 8 apresentações, mediação cultural, Libras e audiodescrição em 50% dos atos, metas de público por território e plano de divulgação em rádios comunitárias — alinhado ao critério de democratização da AMBEV.',
    criterioDestaque: 'Democratização e acesso',
  },
  editalNomeParam: 'ambev',
  firestoreEditalId: undefined,
};

const PNAB: EditalLandingConfig = {
  slug: 'pnab-2026',
  kicker: 'EDITAL PÚBLICO MAPEADO POR IA',
  titulo: 'PNAB 2026',
  proponente: 'Ministério da Cultura | Política Nacional Aldir Blanc',
  dataEncerramentoIso: '2026-10-15',
  valorGlobal: 'R$ 3.800.000.000,00',
  resumoEscopo:
    'A PNAB 2026 destina recursos para ações culturais em todo o território nacional, com prioridade para diversidade, equidade racial, acessibilidade, mulheres, LGBTQIA+, povos indígenas e comunidades tradicionais.',
  criterios: [
    { nome: 'Adequação ao objeto da PNAB', peso: '30%' },
    { nome: 'Relevância e impacto cultural', peso: '25%' },
    { nome: 'Viabilidade técnica e orçamentária', peso: '25%' },
    { nome: 'Democratização e acessibilidade', peso: '20%' },
  ],
  categorias: ['Música', 'Teatro', 'Dança', 'Audiovisual', 'Patrimônio', 'Literatura', 'Circo'],
  textosExigidos: ['Projeto cultural', 'Justificativa', 'Metodologia', 'Cronograma', 'Orçamento detalhado'],
  documentacao: [
    'Certidões negativas (Federal, Estadual, Municipal)',
    'Regularidade FGTS',
    'Documentos de habilitação jurídica',
    'Comprovante de conta bancária',
    'Declarações exigidas no anexo do edital',
  ],
  cardTitulo: 'Veja como a banca da PNAB pode pontuar seu projeto',
  cardSubtitulo:
    'Simule a nota com base nos critérios oficiais antes de submeter a proposta final no sistema do MinC.',
  demoIA: {
    notaOriginal: 6.2,
    notaOtimizada: 9.4,
    textoOriginal:
      'Projeto de oficinas culturais para jovens com 20 vagas e encerramento em formato de mostra.',
    textoOtimizado:
      'Projeto com 40 vagas, cotas para mulheres e pessoas negras, acessibilidade arquitetônica e comunicacional, indicadores de impacto por território e parcerias com equipamentos públicos — alinhado à transversalidade da PNAB.',
    criterioDestaque: 'Democratização e acessibilidade',
  },
  editalNomeParam: 'pnab 2026',
};

const LEI_ROUANET: EditalLandingConfig = {
  slug: 'lei-rouanet',
  kicker: 'EDITAL PÚBLICO MAPEADO POR IA',
  titulo: 'LEI FEDERAL DE INCENTIVO À CULTURA',
  proponente: 'Ministério da Cultura | Lei Rouanet (Lei 8.313/91)',
  dataEncerramentoIso: '2026-12-31',
  valorGlobal: 'Incentivo via renúncia fiscal (sem teto único)',
  resumoEscopo:
    'Mecanismo de fomento via incentivo fiscal para projetos culturais aprovados pelo Ministério da Cultura, com captação junto a empresas incentivadoras após aprovação do projeto.',
  criterios: [
    { nome: 'Mérito artístico-cultural', peso: '35%' },
    { nome: 'Interesse público e relevância', peso: '25%' },
    { nome: 'Viabilidade técnica e orçamentária', peso: '25%' },
    { nome: 'Acessibilidade e democratização', peso: '15%' },
  ],
  categorias: ['Artes cênicas', 'Música', 'Artes visuais', 'Audiovisual', 'Livro', 'Patrimônio', 'Hibridação digital'],
  textosExigidos: ['Projeto resumido', 'Projeto detalhado', 'Orçamento', 'Cronograma de execução', 'Plano de divulgação'],
  documentacao: [
    'Certidões negativas',
    'Regularidade FGTS',
    'Documentação do proponente (PF ou PJ)',
    'Comprovante de domicílio bancário',
    'Autorização de uso de imagem e direitos autorais',
  ],
  cardTitulo: 'Antecipe a leitura do parecer do MinC sobre seu projeto',
  cardSubtitulo:
    'A IA do Oráculo cruza seu texto com os critérios de mérito e acessibilidade antes da submissão no Salic.',
  demoIA: {
    notaOriginal: 7.0,
    notaOtimizada: 9.6,
    textoOriginal:
      'Espetáculo itinerante com 6 apresentações e divulgação em redes sociais.',
    textoOtimizado:
      'Espetáculo itinerante com 12 apresentações, sessões acessíveis (Libras e audiodescrição), contrapartida social documentada e plano de circulação em cidades de médio porte — reforçando interesse público e democratização.',
    criterioDestaque: 'Acessibilidade e democratização',
  },
  editalNomeParam: 'lei rouanet',
};

export const EDITAL_LANDING_PAGES: Record<string, EditalLandingConfig> = {
  [AMBEV.slug]: AMBEV,
  [PNAB.slug]: PNAB,
  [LEI_ROUANET.slug]: LEI_ROUANET,
};

export const EDITAL_LANDING_SLUGS = Object.keys(EDITAL_LANDING_PAGES);

export function getEditalLandingConfig(slug: string): EditalLandingConfig | null {
  return EDITAL_LANDING_PAGES[slug] ?? null;
}

/** Slugs com template estático no código (legado). Landings dinâmicas usam `landing_slug` no Firestore. */
export function hasStaticEditalLandingTemplate(slug: string): boolean {
  return slug in EDITAL_LANDING_PAGES;
}

export function formatEncerramentoDisplay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function countdownDias(iso: string): number {
  const d = new Date(`${iso}T23:59:59`);
  return diasRestantes(d);
}

/** Mescla dados do Firestore sobre o config estático (quando houver edital cadastrado). */
export function mergeEditalLandingWithFirestore(
  base: EditalLandingConfig,
  data: Record<string, unknown> | null,
  editalId?: string
): EditalLandingConfig {
  if (!data) return base;
  const merged = { ...base, ...(editalId ? { firestoreEditalId: editalId } : {}) };

  const nome = data.nome;
  if (typeof nome === 'string' && nome.trim()) merged.titulo = nome.trim().toUpperCase();

  const proponente = data.proponente ?? data.orgao;
  if (typeof proponente === 'string' && proponente.trim()) merged.proponente = proponente.trim();

  const valor = data.valor_maximo_premiacao;
  if (typeof valor === 'string' && valor.trim()) merged.valorGlobal = valor.trim();

  const encerramento = parseEditalEncerramento(data);
  if (encerramento) {
    merged.dataEncerramentoIso = encerramento.toISOString().slice(0, 10);
  }

  const escopo = data.escopo ?? data.descricao;
  if (typeof escopo === 'string' && escopo.trim()) merged.resumoEscopo = escopo.trim();

  const pdf = data.pdf_url ?? data.link_edital;
  if (typeof pdf === 'string' && pdf.trim()) {
    merged.pdfUrl = pdf.trim();
    if (!merged.linkEdital) merged.linkEdital = pdf.trim();
  }

  const thumb = data.thumbnail ?? data.imagem ?? data.imagem_url;
  if (typeof thumb === 'string' && thumb.trim()) merged.thumbnailUrl = thumb.trim();

  const cats = data.categorias;
  if (Array.isArray(cats) && cats.length > 0) {
    merged.categorias = cats.filter((c): c is string => typeof c === 'string');
  }

  const textos = data.textos_exigidos;
  if (Array.isArray(textos) && textos.length > 0) {
    merged.textosExigidos = textos.filter((t): t is string => typeof t === 'string');
  }

  const docs = data.documentacao_exigida;
  if (Array.isArray(docs) && docs.length > 0) {
    merged.documentacao = docs
      .map((d) => (typeof d === 'object' && d && 'nome' in d ? String((d as { nome: string }).nome) : null))
      .filter(Boolean) as string[];
  }

  const criteriosRaw = data.criterios;
  if (typeof criteriosRaw === 'string' && criteriosRaw.trim().length > 40) {
    const linhas = criteriosRaw
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 6);
    if (linhas.length >= 2) {
      merged.criterios = linhas.map((linha, i) => ({
        nome: linha.replace(/^\d+[\).\s-]+/, '').slice(0, 80),
        peso: `${Math.max(10, 30 - i * 5)}%`,
      }));
    }
  }

  return merged;
}
