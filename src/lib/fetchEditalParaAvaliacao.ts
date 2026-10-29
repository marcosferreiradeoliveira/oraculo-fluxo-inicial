import { collection, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { findEditalNomeByHint } from '@/lib/editalLanding';
import type { EditalLandingCriterio } from '@/lib/editalLandingPages';

export type EditalAvaliacaoData = {
  nomeEdital: string;
  criterios: string;
  texto_edital: string;
  texto_selecionados: string;
  editalId: string | null;
};

function mapEditalDoc(id: string, data: Record<string, unknown>): EditalAvaliacaoData {
  const nome = String(data.nome ?? data.titulo ?? 'Edital').trim();
  return {
    editalId: id,
    nomeEdital: nome,
    criterios: typeof data.criterios === 'string' ? data.criterios : '',
    texto_edital: typeof data.texto_edital === 'string' ? data.texto_edital : '',
    texto_selecionados: typeof data.texto_selecionados === 'string' ? data.texto_selecionados : '',
  };
}

export function criteriosTextoFromLanding(criterios: EditalLandingCriterio[]): string {
  if (!criterios.length) return '';
  return criterios.map((c, i) => `${i + 1}. ${c.nome} — peso ${c.peso}`).join('\n');
}

/** Carrega edital no Firestore por id, hint ou nome; critérios da landing se faltar no banco. */
export async function fetchEditalParaAvaliacao(opts: {
  editalId?: string | null;
  nomeHint?: string;
  tituloFallback?: string;
  criteriosLanding?: EditalLandingCriterio[];
}): Promise<EditalAvaliacaoData> {
  const db = getFirestore();
  const empty: EditalAvaliacaoData = {
    editalId: null,
    nomeEdital: opts.tituloFallback?.trim() || opts.nomeHint?.trim() || 'Edital',
    criterios: '',
    texto_edital: '',
    texto_selecionados: '',
  };

  if (opts.editalId) {
    const snap = await getDoc(doc(db, 'editais', opts.editalId));
    if (snap.exists()) {
      const mapped = mapEditalDoc(snap.id, snap.data() as Record<string, unknown>);
      if (!mapped.criterios.trim() && opts.criteriosLanding?.length) {
        mapped.criterios = criteriosTextoFromLanding(opts.criteriosLanding);
      }
      return mapped;
    }
  }

  const hints = [opts.nomeHint, opts.tituloFallback].filter(Boolean) as string[];
  for (const hint of hints) {
    const resolved = await findEditalNomeByHint(hint);
    const nomeBusca = resolved || hint.trim();
    if (!nomeBusca) continue;
    const snap = await getDocs(query(collection(db, 'editais'), where('nome', '==', nomeBusca)));
    if (!snap.empty) {
      const mapped = mapEditalDoc(snap.docs[0].id, snap.docs[0].data() as Record<string, unknown>);
      if (!mapped.criterios.trim() && opts.criteriosLanding?.length) {
        mapped.criterios = criteriosTextoFromLanding(opts.criteriosLanding);
      }
      return mapped;
    }
  }

  if (opts.criteriosLanding?.length) {
    empty.criterios = criteriosTextoFromLanding(opts.criteriosLanding);
  }
  return empty;
}
