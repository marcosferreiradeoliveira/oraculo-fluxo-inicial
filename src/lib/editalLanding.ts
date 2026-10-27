import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';

function normalizeEditalHint(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Resolve nome exato no Firestore a partir do rótulo da landing (ex.: "Lei Rouanet"). */
export async function findEditalNomeByHint(hint: string): Promise<string | null> {
  const h = normalizeEditalHint(hint);
  if (!h) return null;

  const db = getFirestore();
  const exact = await getDocs(
    query(collection(db, 'editais'), where('nome', '==', hint.trim())),
  );
  if (!exact.empty) {
    const nome = String(exact.docs[0].data().nome ?? exact.docs[0].data().titulo ?? '').trim();
    return nome || null;
  }

  const snap = await getDocs(collection(db, 'editais'));
  let best: { nome: string; score: number } | null = null;

  for (const d of snap.docs) {
    const nome = String(d.data().nome ?? d.data().titulo ?? '').trim();
    if (!nome) continue;
    const n = normalizeEditalHint(nome);
    const hBase = h.split('(')[0]?.trim() ?? h;
    const nBase = n.split('(')[0]?.trim() ?? n;

    if (n === h) return nome;
    if (nBase === hBase || n.startsWith(h) || h.startsWith(nBase)) {
      const score = nBase === hBase ? 3 : n.startsWith(h) ? 2 : 1;
      if (!best || score > best.score) best = { nome, score };
      continue;
    }
    if (n.includes(h) || h.includes(nBase)) {
      if (!best || best.score < 1) best = { nome, score: 1 };
    }
  }

  return best?.nome ?? null;
}
