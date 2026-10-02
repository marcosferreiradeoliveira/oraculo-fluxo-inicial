import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AlocacaoEquipe } from '@/lib/equipeProjeto';

export type ProjetoVinculoFornecedor = {
  id: string;
  nome: string;
  rubricasVinculadas: number;
  etapasVinculadas: number;
};

/** Mapa fornecedorId → projetos em que aparece em `equipe.alocacoes`. */
export async function carregarMapaProjetosPorFornecedor(
  userId: string
): Promise<Map<string, ProjetoVinculoFornecedor[]>> {
  const mapa = new Map<string, ProjetoVinculoFornecedor[]>();
  const q = query(collection(db, 'projetos'), where('user_id', '==', userId));
  const snap = await getDocs(q);

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const nome = (data.nome as string)?.trim() || 'Projeto sem nome';
    const alocacoes = (data.equipe?.alocacoes ?? []) as AlocacaoEquipe[];

    for (const al of alocacoes) {
      const fid = al?.fornecedorId;
      if (!fid) continue;

      const rubricasVinculadas = al.rubricaIds?.length ?? 0;
      const etapasVinculadas = al.etapaIds?.length ?? 0;

      const item: ProjetoVinculoFornecedor = {
        id: docSnap.id,
        nome,
        rubricasVinculadas,
        etapasVinculadas,
      };

      const atual = mapa.get(fid) ?? [];
      if (!atual.some((p) => p.id === item.id)) {
        mapa.set(fid, [...atual, item].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      }
    }
  });

  return mapa;
}
