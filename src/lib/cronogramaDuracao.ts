export interface EtapaCronogramaLike {
  etapa?: string;
  inicio?: string;
  fim?: string;
  rubricasAssociadas?: string[];
}

export interface CronogramaLike {
  duracaoMeses?: number;
  etapas?: EtapaCronogramaLike[];
}

/** Duração do projeto em meses a partir do cronograma salvo. */
export function inferirDuracaoMesesCronograma(cronograma?: CronogramaLike | null): number {
  if (!cronograma) return 6;
  const d = cronograma.duracaoMeses;
  if (typeof d === 'number' && d >= 1) return Math.min(120, Math.floor(d));

  const etapas = cronograma.etapas;
  if (!Array.isArray(etapas) || etapas.length === 0) return 6;

  let minMs: number | null = null;
  let maxMs: number | null = null;
  for (const e of etapas) {
    const ini = parseDataIso(e.inicio);
    const fim = parseDataIso(e.fim);
    if (ini != null && (minMs == null || ini < minMs)) minMs = ini;
    if (fim != null && (maxMs == null || fim > maxMs)) maxMs = fim;
  }
  if (minMs != null && maxMs != null && maxMs >= minMs) {
    const a = new Date(minMs);
    const b = new Date(maxMs);
    const meses =
      (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
    return Math.max(1, Math.min(120, meses));
  }
  return 6;
}

function parseDataIso(raw?: string): number | null {
  if (!raw || typeof raw !== 'string') return null;
  const d = new Date(raw.slice(0, 10));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function normalizarNomeVinculo(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nomesCoincidemRubricaEtapa(rubrica: string, etapa: string): boolean {
  const r = normalizarNomeVinculo(rubrica);
  const e = normalizarNomeVinculo(etapa);
  if (!r || !e) return false;
  if (e.includes(r) || r.includes(e)) return true;
  const stop = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'por', 'a', 'o']);
  const tokens = (s: string) =>
    normalizarNomeVinculo(s)
      .split(' ')
      .filter((w) => w.length >= 4 && !stop.has(w));
  const tr = tokens(rubrica);
  const te = tokens(etapa);
  return tr.some((t) => te.some((u) => u.includes(t) || t.includes(u)));
}

function mesesCoberturaEtapas(etapas: EtapaCronogramaLike[]): number {
  let minMs: number | null = null;
  let maxMs: number | null = null;
  for (const e of etapas) {
    const ini = parseDataIso(e.inicio);
    const fim = parseDataIso(e.fim);
    if (ini != null && (minMs == null || ini < minMs)) minMs = ini;
    if (fim != null && (maxMs == null || fim > maxMs)) maxMs = fim;
  }
  if (minMs == null || maxMs == null) return 0;
  const a = new Date(minMs);
  const b = new Date(maxMs);
  const meses =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
  return Math.max(1, Math.min(120, meses));
}

/** Meses de execução da rubrica conforme etapas do cronograma (vínculo ou nome). */
export function inferirMesesRubricaNoCronograma(
  nomeRubrica: string,
  cronograma?: CronogramaLike | null
): number | null {
  const etapas = cronograma?.etapas;
  if (!Array.isArray(etapas) || !nomeRubrica.trim()) return null;
  const nome = nomeRubrica.trim();
  const matched: EtapaCronogramaLike[] = [];

  for (const e of etapas) {
    const assoc = e.rubricasAssociadas || [];
    if (assoc.some((a) => a.trim() === nome)) matched.push(e);
  }

  if (matched.length === 0) {
    for (const e of etapas) {
      const titulo = (e.etapa || '').trim();
      if (titulo && nomesCoincidemRubricaEtapa(nome, titulo)) matched.push(e);
    }
  }

  if (matched.length === 0) return null;
  const meses = mesesCoberturaEtapas(matched);
  return meses > 0 ? meses : null;
}

export function formatarIntervaloCronograma(cronograma?: CronogramaLike | null): string {
  const etapas = cronograma?.etapas;
  if (!Array.isArray(etapas) || etapas.length === 0) return '';
  let minMs: number | null = null;
  let maxMs: number | null = null;
  for (const e of etapas) {
    const ini = parseDataIso(e.inicio);
    const fim = parseDataIso(e.fim);
    if (ini != null && (minMs == null || ini < minMs)) minMs = ini;
    if (fim != null && (maxMs == null || fim > maxMs)) maxMs = fim;
  }
  if (minMs == null || maxMs == null) return '';
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${fmt(minMs)} a ${fmt(maxMs)}`;
}

/** Resumo compacto do cronograma para prompts de orçamento. */
export function resumoCronogramaParaOrcamento(cronograma?: CronogramaLike | null): string {
  const etapas = cronograma?.etapas;
  if (!Array.isArray(etapas) || etapas.length === 0) return '';
  const duracao = inferirDuracaoMesesCronograma(cronograma);
  const intervalo = formatarIntervaloCronograma(cronograma);
  const linhas = etapas.slice(0, 25).map((e) => {
    const nome = (e.etapa || '').trim() || 'Etapa';
    const ini = (e.inicio || '').slice(0, 10);
    const fim = (e.fim || '').slice(0, 10);
    const rub = Array.isArray(e.rubricasAssociadas) && e.rubricasAssociadas.length
      ? ` [rubricas: ${e.rubricasAssociadas.join(', ')}]`
      : '';
    return `- ${nome} (${ini} → ${fim})${rub}`;
  });
  const mais = etapas.length > 25 ? `\n(... mais ${etapas.length - 25} etapas)` : '';
  return [
    `Duração do projeto no cronograma: ${duracao} mês(es)${intervalo ? ` (${intervalo})` : ''}.`,
    'Etapas:',
    ...linhas,
    mais,
  ]
    .filter(Boolean)
    .join('\n');
}

export function instrucoesOrcamentoAlinhadoCronograma(duracaoMeses: number): string {
  return [
    `CRONOGRAMA: o projeto tem ${duracaoMeses} mês(es) de execução. O orçamento DEVE ser coerente com esse prazo.`,
    `Profissionais (direção, produção, técnicos, artistas em regime mensal): linha com R$ = TOTAL já multiplicado (qtd pessoas × meses × valor/mês). Ex.: 1 produtor × ${duracaoMeses} meses × R$ 4.000/mês → "Produtor executivo (unidade: mês, quantidade: ${duracaoMeses}): R$ ${(4000 * duracaoMeses).toLocaleString('pt-BR')},00".`,
    `Rubricas por MÊS (locação, aluguel, mensalidades): unidade "mês" e quantidade = meses cobertos.`,
    `Formato: "Nome (unidade: mês, quantidade: N): R$ TOTAL" — N = meses; R$ = total da linha (N × valor unitário mensal × qtd pessoas).`,
    `Ex.: "Locação de som (unidade: mês, quantidade: ${duracaoMeses}): R$ 12.000,00" = ${duracaoMeses} meses, total R$ 12.000,00 (valor unit. mensal = total ÷ ${duracaoMeses}).`,
    `Não use quantidade 1 mês se a rubrica cobre todo o cronograma (${duracaoMeses} meses).`,
  ].join(' ');
}
