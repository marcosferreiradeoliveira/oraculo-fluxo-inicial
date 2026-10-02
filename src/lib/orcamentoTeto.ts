/** Cooldown da Cloud Function gerarTextosProjeto (30s) + margem. */
export const ORCAMENTO_COOLDOWN_ENTRE_TENTATIVAS_SEC = 33;

export function checklistRubricasDetalhadas(): string {
  return [
    'Inclua linhas SEPARADAS (exemplos): cachê/artistas por função, regência/músicos, equipe técnica (som, luz, vídeo), locação de espaço, equipamentos, cenografia/materiais, figurino, transporte, hospedagem/alimentação, divulgação e assessoria de imprensa, design/gráfica/redes, ECAD/licenças/alvarás, seguros, contabilidade/administração, acessibilidade (Libras etc.).',
  ].join(' ');
}

/** Mínimo de linhas de rubrica esperado (orçamento de edital, não 3 verbas genéricas). */
export function minimoRubricasOrcamento(teto: number): number {
  if (!teto || teto <= 0) return 15;
  if (teto <= 10_000) return 8;
  if (teto <= 50_000) return 12;
  if (teto <= 150_000) return 15;
  return 18;
}

export function instrucoesQuantidadeRubricas(teto: number): string {
  const min = minimoRubricasOrcamento(teto);
  const maxPorLinha = teto > 0 ? Math.round(teto * 0.2) : 0;
  return [
    `QUANTIDADE MÍNIMA: ${min} rubricas (linhas) — obrigatório.`,
    `PROIBIDO entregar só 3–5 verbas genéricas (ex.: apenas "Direção Artística", "Direção de Produção", "Produção Executiva").`,
    checklistRubricasDetalhadas(),
    teto > 0
      ? `Nenhuma rubrica sozinha acima de ~20% do teto (≈ R$ ${maxPorLinha.toLocaleString('pt-BR')}); decomponha em itens específicos.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Parse "4.000,00" ou "4000" → número. */
export function parseValorMonetarioBr(raw: string): number {
  const t = String(raw).trim();
  if (!t) return NaN;
  if (t.includes(',')) {
    return parseFloat(t.replace(/\./g, '').replace(',', '.'));
  }
  const soPontos = t.replace(/\./g, '');
  if (/^\d+$/.test(soPontos) && t.includes('.')) {
    const partes = t.split('.');
    if (partes.length === 2 && partes[1].length === 3) {
      return parseFloat(soPontos);
    }
  }
  return parseFloat(t.replace(/\./g, '').replace(',', '.'));
}

/** Último valor R$ da linha (total da rubrica quando há unitário × quantidade). */
export function extrairValorRsUltimoDaLinha(linha: string): number | null {
  const matches = [...linha.matchAll(/R\$\s*([\d.]+(?:,\d{1,2})?)/gi)];
  if (!matches.length) return null;
  const v = parseValorMonetarioBr(matches[matches.length - 1][1]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

export function linhaIgnoradaNoOrcamento(linhaLimpa: string): boolean {
  const linhaLower = linhaLimpa.toLowerCase();
  if (
    linhaLower.includes('teto') &&
    (linhaLower.includes('máximo') ||
      linhaLower.includes('maximo') ||
      linhaLower.includes('orçamento') ||
      linhaLower.includes('orcamento'))
  ) {
    return true;
  }
  if (
    linhaLower.includes('total') ||
    linhaLower.includes('soma') ||
    linhaLower.includes('subtotal') ||
    linhaLower.includes('total do orçamento') ||
    linhaLower.includes('total geral') ||
    linhaLower === 'total:' ||
    linhaLower.startsWith('total ') ||
    linhaLower.includes('valor total') ||
    linhaLower.includes('totalizador')
  ) {
    return true;
  }
  if (!linhaLimpa.match(/R\$\s*[\d.,]+/i)) {
    if (
      linhaLower.startsWith('justificativa') ||
      linhaLower.startsWith('observ') ||
      linhaLower.startsWith('nota:') ||
      linhaLower.startsWith('nota ') ||
      linhaLower.startsWith('explica') ||
      linhaLower.startsWith('descri') ||
      linhaLower.length > 100
    ) {
      return true;
    }
  }
  return false;
}

export function arredondarValorOrcamento(valor: number, teto: number): number {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  if (teto <= 500) return Math.round(valor / 5) * 5;
  if (teto <= 5_000) return Math.round(valor / 10) * 10;
  if (teto <= 50_000) return Math.round(valor / 50) * 50;
  if (teto <= 200_000) return Math.round(valor / 100) * 100;
  return Math.round(valor / 1000) * 1000;
}

export type RubricaComTotal = {
  total: number;
  valorUnitario?: number;
  quantidade?: number;
  quantidadeUnidade?: number;
  unidade?: string;
};

/** Extrai quantidade de meses explícita na linha gerada pela IA. */
export function extrairQuantidadeMesesDaLinha(linha: string): number | null {
  const s = linha.trim();
  const patterns = [
    /quantidade\s*:\s*(\d+)\s*(?:\)|,|$)/i,
    /(\d+)\s*(?:x\s*)?m[eê]s(?:es)?/i,
    /por\s+(\d+)\s*m[eê]s(?:es)?/i,
    /\/\s*m[eê]s\s*[×x]\s*(\d+)/i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 120) return n;
    }
  }
  return null;
}

export function unidadeEhMes(unidade?: string): boolean {
  const u = (unidade || '').toLowerCase().trim();
  return u === 'mês' || u === 'mes' || u === 'meses';
}

/** Após ajuste ao teto, recalcula valor unitário a partir de qtd × qtd.un. × unit. = total. */
export function repartirValorUnitarioNasRubricas<T extends RubricaComTotal>(
  rubricas: T[],
  teto: number
): T[] {
  return rubricas.map((r) => {
    const q = r.quantidade ?? 1;
    const qu = r.quantidadeUnidade ?? 1;
    const denom = q * qu;
    if (!Number.isFinite(r.total) || r.total <= 0 || denom <= 0) {
      return { ...r, valorUnitario: r.valorUnitario ?? r.total };
    }
    const vu = arredondarValorOrcamento(r.total / denom, teto);
    return { ...r, valorUnitario: vu };
  });
}

/**
 * Rubricas mensais: quantidadeUnidade = meses (cronograma ou explícito na linha).
 */
export function aplicarMesesCronogramaNasRubricas<T extends RubricaComTotal>(
  rubricas: T[],
  duracaoMeses: number,
  teto: number
): T[] {
  const maxMeses = Math.max(1, Math.min(120, duracaoMeses));
  return rubricas.map((r) => {
    if (!unidadeEhMes(r.unidade)) return r;
    let meses = r.quantidadeUnidade ?? 1;
    if (meses <= 1) meses = maxMeses;
    meses = Math.max(1, Math.min(maxMeses, Math.round(meses)));
    const q = r.quantidade ?? 1;
    return repartirValorUnitarioNasRubricas(
      [{ ...r, quantidadeUnidade: meses, quantidade: q }],
      teto
    )[0];
  });
}

export function posProcessarRubricasGeradas<T extends RubricaComTotal>(
  rubricas: T[],
  teto: number,
  duracaoMeses: number,
  opts?: { usarValorCheio?: boolean }
): T[] {
  let items = aplicarMesesCronogramaNasRubricas(rubricas, duracaoMeses, teto);
  items = ajustarRubricasAoTeto(items, teto, opts);
  return repartirValorUnitarioNasRubricas(items, teto);
}

/**
 * Ajusta rubricas para o teto: reduz se passou; opcionalmente preenche até o valor cheio do teto.
 */
export function ajustarRubricasAoTeto<T extends RubricaComTotal>(
  rubricas: T[],
  teto: number,
  opts?: { usarValorCheio?: boolean }
): T[] {
  if (!teto || teto <= 0 || rubricas.length === 0) return rubricas;

  const usarValorCheio = opts?.usarValorCheio ?? true;
  let items = rubricas.map((r) => ({ ...r }));
  let total = items.reduce((s, r) => s + (r.total || 0), 0);
  if (total <= 0) return items;

  const precisaReduzir = total > teto + 0.01;
  const precisaPreencher = usarValorCheio && total < teto - 0.01;

  if (!precisaReduzir && !precisaPreencher) return items;

  const fator = teto / total;
  items = items.map((r) => {
    const v = arredondarValorOrcamento(r.total * fator, teto);
    return { ...r, total: v, valorUnitario: v };
  });

  total = items.reduce((s, r) => s + r.total, 0);
  let diff = Math.round((teto - total) * 100) / 100;
  if (Math.abs(diff) >= 0.01 && items.length > 0) {
    let idx = 0;
    for (let i = 1; i < items.length; i++) {
      if (items[i].total > items[idx].total) idx = i;
    }
    const novo = Math.max(0, arredondarValorOrcamento(items[idx].total + diff, teto));
    items[idx] = { ...items[idx], total: novo, valorUnitario: novo };
  }

  total = items.reduce((s, r) => s + r.total, 0);
  if (total > teto + 0.01) {
    const f2 = teto / total;
    items = items.map((r) => {
      const v = arredondarValorOrcamento(r.total * f2, teto);
      return { ...r, total: v, valorUnitario: v };
    });
    total = items.reduce((s, r) => s + r.total, 0);
    diff = Math.round((teto - total) * 100) / 100;
    if (Math.abs(diff) >= 0.01 && items.length > 0) {
      let idx = 0;
      for (let i = 1; i < items.length; i++) {
        if (items[i].total > items[idx].total) idx = i;
      }
      const novo = Math.max(0, items[idx].total + diff);
      items[idx] = { ...items[idx], total: novo, valorUnitario: novo };
    }
  }

  return items;
}
