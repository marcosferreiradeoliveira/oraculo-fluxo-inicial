/** Etapa mínima para vínculo rubrica ↔ cronograma (nomes de rubricas na etapa). */
export type EtapaVinculo = {
  id: string;
  etapa: string;
  inicio?: string;
  fim?: string;
  rubricasAssociadas?: string[];
};

export type RubricaVinculo = {
  id: string;
  nome: string;
};

function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensSignificativos(s: string): string[] {
  const stop = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'por', 'a', 'o']);
  return normalizarTexto(s)
    .split(' ')
    .filter((w) => w.length >= 4 && !stop.has(w));
}

function nomesCoincidem(rubrica: string, etapa: string): boolean {
  const r = normalizarTexto(rubrica);
  const e = normalizarTexto(etapa);
  if (!r || !e) return false;
  if (e.includes(r) || r.includes(e)) return true;
  const tr = tokensSignificativos(rubrica);
  const te = tokensSignificativos(etapa);
  return tr.some((t) => te.some((u) => u.includes(t) || t.includes(u)));
}

export function setRubricaNaEtapa(
  etapas: EtapaVinculo[],
  etapaId: string,
  rubricaNome: string,
  associar: boolean
): EtapaVinculo[] {
  const nome = rubricaNome.trim();
  if (!nome) return etapas;
  return etapas.map((e) => {
    if (e.id !== etapaId) return e;
    const cur = e.rubricasAssociadas || [];
    if (associar) {
      if (cur.includes(nome)) return e;
      return { ...e, rubricasAssociadas: [...cur, nome] };
    }
    return { ...e, rubricasAssociadas: cur.filter((n) => n !== nome) };
  });
}

export function limparRubricasOrfas(
  etapas: EtapaVinculo[],
  nomesValidos: Set<string>
): EtapaVinculo[] {
  return etapas.map((e) => ({
    ...e,
    rubricasAssociadas: (e.rubricasAssociadas || []).filter((n) => nomesValidos.has(n.trim())),
  }));
}

/** Heurística: associa rubricas a etapas pelo nome (após gerar orçamento). */
export function sugerirVinculosRubricasEtapas(
  etapas: EtapaVinculo[],
  rubricas: RubricaVinculo[]
): EtapaVinculo[] {
  const nomes = rubricas.map((r) => r.nome.trim()).filter(Boolean);
  if (!nomes.length || !etapas.length) return etapas;

  let out = etapas.map((e) => ({
    ...e,
    rubricasAssociadas: [...(e.rubricasAssociadas || [])],
  }));

  for (const nome of nomes) {
    let ligou = false;
    for (const e of out) {
      if (nomesCoincidem(nome, e.etapa || '')) {
        if (!(e.rubricasAssociadas || []).includes(nome)) {
          e.rubricasAssociadas = [...(e.rubricasAssociadas || []), nome];
        }
        ligou = true;
      }
    }
    if (!ligou) {
      const palavras = tokensSignificativos(nome);
      for (const e of out) {
        const te = tokensSignificativos(e.etapa || '');
        if (palavras.some((p) => te.some((t) => t.includes(p) || p.includes(t)))) {
          if (!(e.rubricasAssociadas || []).includes(nome)) {
            e.rubricasAssociadas = [...(e.rubricasAssociadas || []), nome];
          }
        }
      }
    }
  }
  return out;
}

export function resumoVinculos(etapas: EtapaVinculo[], rubricas: RubricaVinculo[]) {
  const nomes = rubricas.map((r) => r.nome.trim()).filter(Boolean);
  const comEtapa = new Set<string>();
  for (const e of etapas) {
    for (const n of e.rubricasAssociadas || []) comEtapa.add(n);
  }
  const semEtapa = nomes.filter((n) => !comEtapa.has(n));
  const etapasSemRubrica = etapas.filter(
    (e) => (e.etapa || '').trim() && !(e.rubricasAssociadas || []).length
  ).length;
  return { semEtapa, etapasSemRubrica, totalRubricas: nomes.length };
}
