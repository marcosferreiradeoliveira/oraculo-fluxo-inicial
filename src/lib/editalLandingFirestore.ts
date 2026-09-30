import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  getEditalLandingConfig,
  mergeEditalLandingWithFirestore,
  type EditalLandingConfig,
  type EditalLandingCriterio,
  type EditalLandingDemoIA,
} from '@/lib/editalLandingPages';
import { parseEditalEncerramento } from '@/lib/editalDates';

const DEFAULT_CRITERIOS: EditalLandingCriterio[] = [
  { nome: 'Relevância artístico-cultural', peso: '30%' },
  { nome: 'Capacidade técnica do proponente', peso: '25%' },
  { nome: 'Exequibilidade orçamentária', peso: '25%' },
  { nome: 'Democratização e acesso', peso: '20%' },
];

const DEFAULT_DEMO_IA: EditalLandingDemoIA = {
  notaOriginal: 6.5,
  notaOtimizada: 9.2,
  textoOriginal:
    'Projeto cultural com objetivos genéricos, pouco detalhamento de público, acessibilidade e indicadores mensuráveis.',
  textoOtimizado:
    'Projeto com metas claras de público, plano de acessibilidade (Libras e audiodescrição), cronograma viável e orçamento coerente com as rubricas — alinhado aos critérios do edital.',
  criterioDestaque: 'Democratização e acesso',
};

/** Slug para URL: minúsculas, hífens, sem caracteres especiais */
export function normalizeLandingSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function isLandingSlugValid(slug: string): boolean {
  return slug.length >= 2 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function parseCriteriosFromFirestore(criteriosRaw: unknown): EditalLandingCriterio[] {
  if (typeof criteriosRaw !== 'string' || criteriosRaw.trim().length < 20) {
    return DEFAULT_CRITERIOS;
  }
  const linhas = criteriosRaw
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (linhas.length < 2) return DEFAULT_CRITERIOS;
  const pesos = [30, 25, 25, 20, 15, 10];
  return linhas.map((linha, i) => ({
    nome: linha.replace(/^\d+[\).\s-]+/, '').slice(0, 100),
    peso: `${pesos[i] ?? 10}%`,
  }));
}

function defaultEncerramentoIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

/** Monta landing só com dados do Firestore (sem template estático). */
export function buildEditalLandingFromFirestore(
  slug: string,
  editalId: string,
  data: Record<string, unknown>
): EditalLandingConfig {
  const nome = typeof data.nome === 'string' && data.nome.trim() ? data.nome.trim() : 'Edital cultural';
  const proponenteRaw = data.proponente ?? data.orgao;
  const proponente =
    typeof proponenteRaw === 'string' && proponenteRaw.trim() ? proponenteRaw.trim() : 'Proponente do edital';

  const encerramento = parseEditalEncerramento(data);
  const valorRaw = data.valor_maximo_premiacao;
  const escopoRaw = data.escopo ?? data.descricao;

  const pdf = data.pdf_url ?? data.link_edital;
  const pdfUrl = typeof pdf === 'string' && pdf.trim() ? pdf.trim() : undefined;

  const cats = data.categorias;
  const categorias =
    Array.isArray(cats) && cats.length > 0
      ? cats.filter((c): c is string => typeof c === 'string')
      : ['Música', 'Teatro', 'Dança', 'Audiovisual', 'Artes visuais'];

  const textos = data.textos_exigidos;
  const textosExigidos =
    Array.isArray(textos) && textos.length > 0
      ? textos.filter((t): t is string => typeof t === 'string')
      : ['Descritivo do projeto', 'Justificativa', 'Cronograma', 'Orçamento'];

  const docs = data.documentacao_exigida;
  const documentacao =
    Array.isArray(docs) && docs.length > 0
      ? docs
          .map((d) =>
            typeof d === 'object' && d && 'nome' in d ? String((d as { nome: string }).nome) : null
          )
          .filter(Boolean)
      : ['Certidões negativas', 'Regularidade FGTS', 'Documentos de habilitação jurídica'];

  const thumb = data.thumbnail ?? data.imagem ?? data.imagem_url;
  const thumbnailUrl = typeof thumb === 'string' && thumb.trim() ? thumb.trim() : undefined;

  const criterios = parseCriteriosFromFirestore(data.criterios);
  const orgaoCurto = proponente.split('|')[0]?.trim() || 'edital';

  return {
    slug,
    kicker: 'EDITAL PÚBLICO MAPEADO POR IA',
    titulo: nome.toUpperCase(),
    proponente,
    dataEncerramentoIso: encerramento ? encerramento.toISOString().slice(0, 10) : defaultEncerramentoIso(),
    valorGlobal:
      typeof valorRaw === 'string' && valorRaw.trim() ? valorRaw.trim() : 'Consulte o valor no edital oficial',
    pdfUrl,
    linkEdital: pdfUrl,
    resumoEscopo:
      typeof escopoRaw === 'string' && escopoRaw.trim()
        ? escopoRaw.trim().slice(0, 600)
        : `O edital ${nome} recebe propostas culturais alinhadas ao seu regulamento. Use o Oráculo para simular a nota do parecerista antes do envio oficial.`,
    criterios,
    categorias,
    textosExigidos,
    documentacao: documentacao as string[],
    cardTitulo: `Veja como o parecerista do ${orgaoCurto} pode avaliar seu projeto`,
    cardSubtitulo:
      'Nossa IA lê as exigências deste edital e simula a nota da banca antes de você enviar a versão final.',
    demoIA: { ...DEFAULT_DEMO_IA, criterioDestaque: criterios[0]?.nome ?? DEFAULT_DEMO_IA.criterioDestaque },
    editalNomeParam: nome,
    firestoreEditalId: editalId,
    thumbnailUrl,
  };
}

async function slugExistsInFirestore(slug: string): Promise<boolean> {
  const q = query(collection(db, 'editais'), where('landing_slug', '==', slug), limit(1));
  const snap = await getDocs(q);
  return !snap.empty;
}

/** Gera slug único a partir do nome do edital (cadastro automático da landing). */
export async function generateUniqueLandingSlug(nome: string): Promise<string> {
  let base = normalizeLandingSlug(nome);
  if (!base || !isLandingSlugValid(base)) {
    base = `edital-${Date.now().toString(36)}`;
  }
  let candidate = base;
  let suffix = 0;
  while (await slugExistsInFirestore(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

/** Preenche landing_slug + landing_ativa ao criar edital no Firestore. */
export async function assignLandingFieldsForNewEdital(editalData: Record<string, unknown>): Promise<string> {
  const nome = typeof editalData.nome === 'string' ? editalData.nome : '';
  const landing_slug = await generateUniqueLandingSlug(nome || 'edital');
  editalData.landing_slug = landing_slug;
  editalData.landing_ativa = true;
  return landing_slug;
}

async function fetchEditalDocByLandingSlug(slug: string): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const q = query(collection(db, 'editais'), where('landing_slug', '==', slug), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data() as Record<string, unknown>;
  if (data.landing_ativa === false) return null;
  return { id: d.id, data };
}

/**
 * Carrega config da landing: template estático (se existir) + merge Firestore,
 * ou edital dinâmico com landing_slug + landing_ativa !== false.
 */
export async function resolveEditalLandingConfig(slug: string): Promise<EditalLandingConfig | null> {
  const normalized = normalizeLandingSlug(slug);
  if (!isLandingSlugValid(normalized)) return null;

  const firestoreHit = await fetchEditalDocByLandingSlug(normalized);
  const staticBase = getEditalLandingConfig(normalized);

  if (firestoreHit) {
    if (staticBase) {
      return mergeEditalLandingWithFirestore(staticBase, firestoreHit.data, firestoreHit.id);
    }
    return buildEditalLandingFromFirestore(normalized, firestoreHit.id, firestoreHit.data);
  }

  if (staticBase) {
    return staticBase;
  }

  return null;
}

const DEFAULT_PUBLIC_APP_ORIGIN = 'https://oraculo-is.web.app';

/** URL pública da landing de campanha (`/{landing_slug}`). */
export function getEditalLandingPublicUrl(slug: string): string {
  const normalized = normalizeLandingSlug(slug);
  const envOrigin = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  const origin =
    envOrigin ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : DEFAULT_PUBLIC_APP_ORIGIN);
  return `${origin.replace(/\/$/, '')}/${normalized}`;
}
