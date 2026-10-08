/** Duração e resumo do cronograma (espelho de src/lib/cronogramaDuracao.ts). */

function normalizarDataCronograma(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';

  const isoPrefix = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoPrefix) {
    const y = isoPrefix[1];
    const m = isoPrefix[2].padStart(2, '0');
    const d = isoPrefix[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (br) {
    const dd = br[1].padStart(2, '0');
    const mm = br[2].padStart(2, '0');
    return `${br[3]}-${mm}-${dd}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

function utcMsFromYmd(ymd) {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return Date.UTC(y, mo - 1, d);
}

/** Corrige pares invertidos (fim antes do início) — comum na saída da IA. */
function corrigirInicioFimCronograma(inicio, fim) {
  let ini = normalizarDataCronograma(inicio);
  let f = normalizarDataCronograma(fim);
  if (!ini && !f) return { inicio: '', fim: '' };
  if (!ini) ini = f;
  if (!f) f = ini;

  let a = utcMsFromYmd(ini);
  let b = utcMsFromYmd(f);
  if (a == null || b == null) return { inicio: ini, fim: f };

  if (b < a) {
    const iniSw = f;
    const fSw = ini;
    const aSw = utcMsFromYmd(iniSw);
    const bSw = utcMsFromYmd(fSw);
    if (aSw != null && bSw != null && bSw >= aSw) {
      return { inicio: iniSw, fim: fSw };
    }
    return { inicio: ini, fim: ini };
  }
  return { inicio: ini, fim: f };
}

function clampParDatasCronograma(inicio, fim, minYmd, maxYmd) {
  const min = normalizarDataCronograma(minYmd);
  const max = normalizarDataCronograma(maxYmd);
  if (!min || !max) return corrigirInicioFimCronograma(inicio, fim);

  let { inicio: ini, fim: f } = corrigirInicioFimCronograma(inicio, fim);
  if (!ini || !f) return { inicio: ini, fim: f };

  const minMs = utcMsFromYmd(min);
  const maxMs = utcMsFromYmd(max);
  let a = utcMsFromYmd(ini);
  let b = utcMsFromYmd(f);
  if (minMs == null || maxMs == null || a == null || b == null) {
    return { inicio: ini, fim: f };
  }

  if (a < minMs) {
    ini = min;
    a = minMs;
  }
  if (b > maxMs) {
    f = max;
    b = maxMs;
  }
  if (b < a) {
    f = ini;
  }
  return { inicio: ini, fim: f };
}

function sanitizarEtapasCronogramaGeradas(etapas, opts = {}) {
  const { minYmd, maxYmd } = opts;
  if (!Array.isArray(etapas)) return [];
  return etapas.map((e) => {
    const par =
      minYmd && maxYmd
        ? clampParDatasCronograma(e.inicio, e.fim, minYmd, maxYmd)
        : corrigirInicioFimCronograma(e.inicio, e.fim);
    return { ...e, inicio: par.inicio, fim: par.fim };
  });
}

function parseDataIso(raw) {
  const n = normalizarDataCronograma(raw);
  if (!n) return null;
  const ms = utcMsFromYmd(n);
  return ms == null ? null : ms;
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
  normalizarDataCronograma,
  corrigirInicioFimCronograma,
  clampParDatasCronograma,
  sanitizarEtapasCronogramaGeradas,
};
