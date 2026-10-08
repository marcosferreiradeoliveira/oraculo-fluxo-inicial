import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const PORTFOLIOS_COLLECTION = 'portfolios';

export type PortfolioItemDoc = {
  id: string;
  userId: string;
  empresaId?: string;
  ano: string;
  descricao: string;
  fotoUrl?: string;
  fotoPath?: string;
  clippingUrl?: string;
  clippingPath?: string;
  criadoEm?: unknown;
  atualizadoEm?: unknown;
};

function mapPortfolioDoc(id: string, data: DocumentData): PortfolioItemDoc {
  return {
    id,
    userId: typeof data.userId === 'string' ? data.userId : '',
    empresaId: typeof data.empresaId === 'string' ? data.empresaId : undefined,
    ano: typeof data.ano === 'string' ? data.ano : String(data.ano ?? ''),
    descricao: typeof data.descricao === 'string' ? data.descricao : '',
    fotoUrl: typeof data.fotoUrl === 'string' ? data.fotoUrl : undefined,
    fotoPath: typeof data.fotoPath === 'string' ? data.fotoPath : undefined,
    clippingUrl: typeof data.clippingUrl === 'string' ? data.clippingUrl : undefined,
    clippingPath: typeof data.clippingPath === 'string' ? data.clippingPath : undefined,
    criadoEm: data.criadoEm,
    atualizadoEm: data.atualizadoEm,
  };
}

/** Itens da galeria vinculados à empresa (+ legado do usuário sem empresaId, migrado sob demanda). */
export async function listPortfoliosDaEmpresa(
  empresaId: string,
  userId: string
): Promise<PortfolioItemDoc[]> {
  const ref = collection(db, PORTFOLIOS_COLLECTION);
  const byId = new Map<string, PortfolioItemDoc>();

  // Query por userId — compatível com regras legadas e evita falha se membros ainda não existir
  const ownSnap = await getDocs(query(ref, where('userId', '==', userId)));
  for (const d of ownSnap.docs) {
    const data = d.data();
    const existingEmpresaId =
      typeof data.empresaId === 'string' ? data.empresaId : undefined;
    if (existingEmpresaId && existingEmpresaId !== empresaId) continue;
    if (!existingEmpresaId) {
      await updateDoc(doc(db, PORTFOLIOS_COLLECTION, d.id), { empresaId }).catch(() => {});
    }
    byId.set(d.id, mapPortfolioDoc(d.id, { ...data, empresaId: existingEmpresaId || empresaId }));
  }

  // Itens de outros membros da mesma empresa (requer rules com canAccessPortfolioEmpresa)
  try {
    const teamSnap = await getDocs(query(ref, where('empresaId', '==', empresaId)));
    for (const d of teamSnap.docs) {
      byId.set(d.id, mapPortfolioDoc(d.id, d.data()));
    }
  } catch {
    // Ignora se rules ainda não deployadas ou query bloqueada
  }

  const merged = [...byId.values()];
  merged.sort((a, b) => parseInt(b.ano, 10) - parseInt(a.ano, 10));
  return merged;
}

export function normalizarUrlMedia(url: string): string {
  return url.trim();
}

/** @deprecated use normalizarUrlMedia */
export const normalizarUrlPdf = normalizarUrlMedia;

export function urlHttpValida(url: string): boolean {
  const u = normalizarUrlMedia(url);
  if (!u) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** @deprecated use urlHttpValida */
export const urlPdfValida = urlHttpValida;

export function portfolioItemsParaTexto(items: PortfolioItemDoc[]): string {
  if (items.length === 0) return '';
  const sorted = [...items].sort((a, b) => parseInt(b.ano, 10) - parseInt(a.ano, 10));
  return sorted
    .map((item) => {
      const lines = [`Ano ${item.ano}: ${item.descricao.trim()}`];
      if (item.fotoUrl) lines.push(`Imagem: ${item.fotoUrl}`);
      if (item.clippingUrl) lines.push(`Clipping: ${item.clippingUrl}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

export type PortfolioItemInput = {
  ano: string;
  descricao: string;
  fotoUrl: string;
  clippingUrl?: string;
};

export async function createPortfolioItem(
  userId: string,
  empresaId: string,
  input: PortfolioItemInput
): Promise<string> {
  const ref = await addDoc(collection(db, PORTFOLIOS_COLLECTION), {
    userId,
    empresaId,
    ano: input.ano.trim(),
    descricao: input.descricao.trim(),
    fotoUrl: normalizarUrlMedia(input.fotoUrl),
    fotoPath: null,
    clippingUrl: input.clippingUrl ? normalizarUrlMedia(input.clippingUrl) : null,
    clippingPath: null,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePortfolioItem(
  portfolioId: string,
  userId: string,
  empresaId: string,
  input: PortfolioItemInput,
  criadoEm?: unknown
): Promise<void> {
  await updateDoc(doc(db, PORTFOLIOS_COLLECTION, portfolioId), {
    userId,
    empresaId,
    ano: input.ano.trim(),
    descricao: input.descricao.trim(),
    fotoUrl: normalizarUrlMedia(input.fotoUrl),
    fotoPath: null,
    clippingUrl: input.clippingUrl ? normalizarUrlMedia(input.clippingUrl) : null,
    clippingPath: null,
    criadoEm: criadoEm ?? serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
}

export async function deletePortfolioItem(portfolioId: string): Promise<void> {
  await deleteDoc(doc(db, PORTFOLIOS_COLLECTION, portfolioId));
}

/**
 * Texto de portfólio para IA: resumo em `usuarios.portfolio` + itens da galeria da empresa ativa.
 * (Dreams-orchestrator / Módulo Criação.)
 */
export async function buscarPortfolioParaIA(authUid: string): Promise<string> {
  try {
    const snap = await getDoc(doc(db, 'usuarios', authUid));
    if (!snap.exists()) return '';

    const data = snap.data();
    const textoPerfil = typeof data.portfolio === 'string' ? data.portfolio.trim() : '';
    const empresaId = typeof data.defaultEmpresaId === 'string' ? data.defaultEmpresaId.trim() : '';
    if (!empresaId || empresaId === authUid) {
      return textoPerfil;
    }

    const galeria = portfolioItemsParaTexto(await listPortfoliosDaEmpresa(empresaId, authUid));
    return [textoPerfil, galeria].filter(Boolean).join('\n\n');
  } catch {
    return '';
  }
}
