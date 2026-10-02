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
    `Rubricas por MÊS (locação, aluguel, mensalidades, equipe mensal etc.): use unidade "mês" e indique a quantidade de meses na linha.`,
    `Formato preferido: "Nome (unidade: mês, quantidade: N): R$ TOTAL" — N = meses cobertos (máx. ${duracaoMeses} salvo parcela menor justificada); R$ = valor TOTAL da linha.`,
    `Ex.: "Locação de equipamento de som (unidade: mês, quantidade: ${duracaoMeses}): R$ 12.000,00" significa ${duracaoMeses} meses e total R$ 12.000,00.`,
    `Não use quantidade 1 mês para locações que cobrem todo o projeto se o cronograma dura ${duracaoMeses} meses.`,
  ].join(' ');
}
