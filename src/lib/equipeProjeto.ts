export type AlocacaoEquipe = {
  fornecedorId: string;
  rubricaIds: string[];
  etapaIds: string[];
};

export type EquipeProjetoData = {
  alocacoes: AlocacaoEquipe[];
  atualizado_em?: unknown;
};

function toggleId(ids: string[], id: string, on: boolean): string[] {
  const set = new Set(ids);
  if (on) set.add(id);
  else set.delete(id);
  return [...set];
}

export function alocacaoDeFornecedor(
  alocacoes: AlocacaoEquipe[],
  fornecedorId: string
): AlocacaoEquipe {
  const found = alocacoes.find((a) => a.fornecedorId === fornecedorId);
  return found ?? { fornecedorId, rubricaIds: [], etapaIds: [] };
}

export function upsertAlocacao(
  alocacoes: AlocacaoEquipe[],
  patch: AlocacaoEquipe
): AlocacaoEquipe[] {
  const rest = alocacoes.filter((a) => a.fornecedorId !== patch.fornecedorId);
  const vazia = patch.rubricaIds.length === 0 && patch.etapaIds.length === 0;
  if (vazia) return rest;
  return [...rest, patch];
}

export function setRubricaFornecedor(
  alocacoes: AlocacaoEquipe[],
  fornecedorId: string,
  rubricaId: string,
  associar: boolean
): AlocacaoEquipe[] {
  const cur = alocacaoDeFornecedor(alocacoes, fornecedorId);
  return upsertAlocacao(alocacoes, {
    ...cur,
    rubricaIds: toggleId(cur.rubricaIds, rubricaId, associar),
  });
}

export function setEtapaFornecedor(
  alocacoes: AlocacaoEquipe[],
  fornecedorId: string,
  etapaId: string,
  associar: boolean
): AlocacaoEquipe[] {
  const cur = alocacaoDeFornecedor(alocacoes, fornecedorId);
  return upsertAlocacao(alocacoes, {
    ...cur,
    etapaIds: toggleId(cur.etapaIds, etapaId, associar),
  });
}

export function fornecedoresDaRubrica(alocacoes: AlocacaoEquipe[], rubricaId: string): string[] {
  return alocacoes.filter((a) => a.rubricaIds.includes(rubricaId)).map((a) => a.fornecedorId);
}

/** Define de uma vez quem está vinculado à rubrica (substitui seleção anterior). */
export function setFornecedoresNaRubrica(
  alocacoes: AlocacaoEquipe[],
  rubricaId: string,
  fornecedorIdsSelecionados: string[],
  todosFornecedorIds: string[]
): AlocacaoEquipe[] {
  const sel = new Set(fornecedorIdsSelecionados);
  let next = alocacoes;
  for (const fid of todosFornecedorIds) {
    next = setFornecedorNaRubrica(next, rubricaId, fid, sel.has(fid));
  }
  return next;
}

/** Define de uma vez quem está vinculado à etapa. */
export function setFornecedoresNaEtapa(
  alocacoes: AlocacaoEquipe[],
  etapaId: string,
  fornecedorIdsSelecionados: string[],
  todosFornecedorIds: string[]
): AlocacaoEquipe[] {
  const sel = new Set(fornecedorIdsSelecionados);
  let next = alocacoes;
  for (const fid of todosFornecedorIds) {
    next = setFornecedorNaEtapa(next, etapaId, fid, sel.has(fid));
  }
  return next;
}

export function fornecedoresDaEtapa(alocacoes: AlocacaoEquipe[], etapaId: string): string[] {
  return alocacoes.filter((a) => a.etapaIds.includes(etapaId)).map((a) => a.fornecedorId);
}

export function setFornecedorNaRubrica(
  alocacoes: AlocacaoEquipe[],
  rubricaId: string,
  fornecedorId: string,
  associar: boolean
): AlocacaoEquipe[] {
  return setRubricaFornecedor(alocacoes, fornecedorId, rubricaId, associar);
}

export function setFornecedorNaEtapa(
  alocacoes: AlocacaoEquipe[],
  etapaId: string,
  fornecedorId: string,
  associar: boolean
): AlocacaoEquipe[] {
  return setEtapaFornecedor(alocacoes, fornecedorId, etapaId, associar);
}

export function limparIdsOrfaos(
  alocacoes: AlocacaoEquipe[],
  rubricaIds: Set<string>,
  etapaIds: Set<string>,
  fornecedorIds: Set<string>
): AlocacaoEquipe[] {
  return alocacoes
    .filter((a) => fornecedorIds.has(a.fornecedorId))
    .map((a) => ({
      ...a,
      rubricaIds: a.rubricaIds.filter((id) => rubricaIds.has(id)),
      etapaIds: a.etapaIds.filter((id) => etapaIds.has(id)),
    }))
    .filter((a) => a.rubricaIds.length > 0 || a.etapaIds.length > 0);
}
