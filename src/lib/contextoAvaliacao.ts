/** Alinhado a functions/index.js — contexto secundário na avaliação IA */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';

export const MAX_PORTFOLIO_AVALIACAO = 1200;
export const MAX_EQUIPE_AVALIACAO = 600;

export type PortfolioItemResumo = { ano: string; descricao: string };

export function truncarResumoContexto(
  texto: string,
  maxChars: number,
  rotulo: string
): string {
  const t = (texto || '').trim();
  if (!t) return '';
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}\n\n[... ${rotulo} truncado para análise ...]`;
}

/** Heurística: critérios/edital mencionam capacidade de execução, equipe ou histórico? */
export function criteriosPedemExperenciaExecucao(
  criteriosEdital: string,
  textoEdital?: string
): boolean {
  const blob = `${criteriosEdital || ''}\n${textoEdital || ''}`.toLowerCase();
  const patterns = [
    /experi[eê]ncia/,
    /hist[oó]rico/,
    /portf[oó]lio/,
    /curr[ií]culo/,
    /capacidade t[eé]cnica/,
    /capacidade de execu[cç][aã]o/,
    /equipe/,
    /corpo t[eé]cnico/,
    /trajet[oó]ria/,
    /realiza[cç][oõ]es anteriores/,
    /comprova[cç][aã]o/,
    /execut/,
    /habilita[cç][aã]o/,
    /qualifica[cç][aã]o/,
    /proponente/,
    /biograf/,
    /curriculum/,
    /cv\b/,
    /atuac[aã]o pr[eé]via/,
  ];
  return patterns.some((re) => re.test(blob));
}

export function buildEquipeResumoAvaliacao(equipeBio: string): string {
  return truncarResumoContexto(equipeBio, MAX_EQUIPE_AVALIACAO, 'equipe/bio');
}

export function buildPortfolioResumoAvaliacao(
  portfolioConta: string,
  itensPortfolio: PortfolioItemResumo[] = []
): string {
  const linhas: string[] = [];
  const sorted = [...itensPortfolio].sort(
    (a, b) => parseInt(b.ano || '0', 10) - parseInt(a.ano || '0', 10)
  );

  for (const item of sorted.slice(0, 8)) {
    const ano = (item.ano || '').trim();
    const desc = (item.descricao || '').trim().replace(/\s+/g, ' ');
    if (!desc) continue;
    linhas.push(ano ? `• ${ano}: ${desc}` : `• ${desc}`);
  }

  let composto = linhas.join('\n');
  const conta = (portfolioConta || '').trim();
  if (conta) {
    composto = composto
      ? `${composto}\n\nResumo cadastro:\n${conta}`
      : conta;
  }

  return truncarResumoContexto(composto, MAX_PORTFOLIO_AVALIACAO, 'portfolio');
}

export async function fetchPortfolioItensForUser(
  db: Firestore,
  userId: string
): Promise<PortfolioItemResumo[]> {
  const q = query(collection(db, 'portfolios'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      ano: String(data.ano ?? ''),
      descricao: String(data.descricao ?? ''),
    };
  });
}

/** Atualiza resumos cacheados em usuarios (avaliação IA). */
export async function syncResumosContextoUsuario(
  db: Firestore,
  userId: string,
  opts: { portfolioConta?: string; equipeBio?: string } = {}
): Promise<void> {
  const userRef = doc(db, 'usuarios', userId);
  const userSnap = await getDoc(userRef);
  const existing = userSnap.exists() ? userSnap.data() : {};

  const portfolioConta =
    opts.portfolioConta !== undefined
      ? opts.portfolioConta
      : String(existing.portfolio ?? '');
  const equipeBio =
    opts.equipeBio !== undefined ? opts.equipeBio : String(existing.equipeBio ?? '');

  const itens = await fetchPortfolioItensForUser(db, userId);

  await updateDoc(userRef, {
    portfolioResumoAvaliacao: buildPortfolioResumoAvaliacao(portfolioConta, itens),
    equipeResumoAvaliacao: buildEquipeResumoAvaliacao(equipeBio),
    contextoResumoAtualizadoEm: serverTimestamp(),
  });
}
