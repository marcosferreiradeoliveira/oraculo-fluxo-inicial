/** Duração e resumo do cronograma (espelho de src/lib/cronogramaDuracao.ts). */

function parseDataIso(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const d = new Date(raw.slice(0, 10));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function inferirDuracaoMesesCronograma(cronograma) {
  if (!cronograma) return 6;
  const d = cronograma.duracaoMeses;
  if (typeof d === 'number' && d >= 1) return Math.min(120, Math.floor(d));

  const etapas = cronograma.etapas;
  if (!Array.isArray(etapas) || etapas.length === 0) return 6;

  let minMs = null;
  let maxMs = null;
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

function formatarIntervaloCronograma(cronograma) {
  const etapas = cronograma?.etapas;
  if (!Array.isArray(etapas) || etapas.length === 0) return '';
  let minMs = null;
  let maxMs = null;
  for (const e of etapas) {
    const ini = parseDataIso(e.inicio);
    const fim = parseDataIso(e.fim);
    if (ini != null && (minMs == null || ini < minMs)) minMs = ini;
    if (fim != null && (maxMs == null || fim > maxMs)) maxMs = fim;
  }
  if (minMs == null || maxMs == null) return '';
  const fmt = (ms) =>
    new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${fmt(minMs)} a ${fmt(maxMs)}`;
}

function resumoCronogramaParaOrcamento(cronograma) {
  const etapas = cronograma?.etapas;
  if (!Array.isArray(etapas) || etapas.length === 0) return '';
  const duracao = inferirDuracaoMesesCronograma(cronograma);
  const intervalo = formatarIntervaloCronograma(cronograma);
  const linhas = etapas.slice(0, 25).map((e) => {
    const nome = (e.etapa || '').trim() || 'Etapa';
    const ini = (e.inicio || '').slice(0, 10);
    const fim = (e.fim || '').slice(0, 10);
    const rub =
      Array.isArray(e.rubricasAssociadas) && e.rubricasAssociadas.length
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

function instrucoesOrcamentoAlinhadoCronograma(duracaoMeses) {
  return [
    `CRONOGRAMA: o projeto tem ${duracaoMeses} mês(es) de execução. O orçamento DEVE ser coerente com esse prazo.`,
    'Rubricas por MÊS (locação, aluguel, mensalidades): use "(unidade: mês, quantidade: N)" na linha; N = meses cobertos; R$ = TOTAL da linha.',
    `Locações/alugueis que cobrem todo o projeto devem usar quantidade ${duracaoMeses} (não 1 mês).`,
  ].join(' ');
}

module.exports = {
  inferirDuracaoMesesCronograma,
  resumoCronogramaParaOrcamento,
  instrucoesOrcamentoAlinhadoCronograma,
};
