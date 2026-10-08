import * as XLSX from 'xlsx';

export type MacroEtapaImport = 'pre_producao' | 'producao' | 'divulgacao' | 'pos_producao';

export type EtapaPlanilhaImportada = {
  etapa: string;
  inicio: string;
  fim: string;
  macroEtapa?: MacroEtapaImport;
  rubricasAssociadas?: string[];
};

export type ResultadoImportacaoCronograma = {
  etapas: EtapaPlanilhaImportada[];
  avisos: string[];
};

function normHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

const MACRO_POR_LABEL = new Map<string, MacroEtapaImport>([
  [normHeader('Pré-produção'), 'pre_producao'],
  [normHeader('Produção'), 'producao'],
  [normHeader('Divulgação'), 'divulgacao'],
  [normHeader('Pós-produção'), 'pos_producao'],
]);
MACRO_POR_LABEL.set('pre-producao', 'pre_producao');
MACRO_POR_LABEL.set('pos-producao', 'pos_producao');

function parseMacroFase(raw: string): MacroEtapaImport | undefined {
  const n = normHeader(raw);
  if (MACRO_POR_LABEL.has(n)) return MACRO_POR_LABEL.get(n);
  if (n.includes('pre') && n.includes('produc')) return 'pre_producao';
  if (n.includes('pos') && n.includes('produc')) return 'pos_producao';
  if (n.includes('divulg')) return 'divulgacao';
  if (n.includes('produc')) return 'producao';
  return undefined;
}

function excelSerialToIso(n: number): string | null {
  if (!Number.isFinite(n) || n < 1) return null;
  const utc = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseDataCelula(val: unknown): string {
  if (val == null || val === '') return '';
  if (typeof val === 'number') {
    const iso = excelSerialToIso(val);
    if (iso) return iso;
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (br) {
    const dd = br[1].padStart(2, '0');
    const mm = br[2].padStart(2, '0');
    return `${br[3]}-${mm}-${dd}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

function indiceColuna(headers: string[], ...aliases: string[]): number {
  for (const alias of aliases) {
    const na = normHeader(alias);
    const idx = headers.findIndex((h) => h === na || (na.length >= 3 && h.includes(na)));
    if (idx >= 0) return idx;
  }
  return -1;
}

function encontrarLinhaCabecalho(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const headers = row.map((c) => normHeader(String(c ?? '')));
    const temEtapa = headers.some((h) => h === 'etapa' || h.includes('atividade') || h.includes('tarefa'));
    const temInicio = headers.some((h) => h.includes('inicio') || h === 'início');
    const temFim = headers.some((h) => h === 'fim' || h.includes('termino') || h.includes('término'));
    if (temEtapa && (temInicio || temFim)) return i;
  }
  return -1;
}

export async function importarPlanilhaCronograma(file: File): Promise<ResultadoImportacaoCronograma> {
  const avisos: string[] = [];
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) {
    return { etapas: [], avisos: ['Planilha vazia.'] };
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][];
  const headerRow = encontrarLinhaCabecalho(rows);
  if (headerRow < 0) {
    return { etapas: [], avisos: ['Cabeçalho não reconhecido. Use colunas Fase, Etapa, Início e Fim (modelo da exportação XLSX).'] };
  }

  const headers = (rows[headerRow] as unknown[]).map((c) => normHeader(String(c ?? '')));
  const iFase = indiceColuna(headers, 'fase', 'macro etapa', 'macroetapa');
  const iEtapa = indiceColuna(headers, 'etapa', 'atividade', 'tarefa', 'descricao');
  const iInicio = indiceColuna(headers, 'inicio', 'início', 'data inicio', 'data início');
  const iFim = indiceColuna(headers, 'fim', 'termino', 'término', 'data fim');

  if (iEtapa < 0) {
    return { etapas: [], avisos: ['Coluna Etapa não encontrada.'] };
  }

  const etapas: EtapaPlanilhaImportada[] = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const nomeEtapa = String(row[iEtapa] ?? '').trim();
    if (!nomeEtapa) continue;
    const inicio = iInicio >= 0 ? parseDataCelula(row[iInicio]) : '';
    const fim = iFim >= 0 ? parseDataCelula(row[iFim]) : '';
    if (!inicio || !fim) {
      avisos.push(`Linha ignorada (datas inválidas): ${nomeEtapa.slice(0, 40)}`);
      continue;
    }
    const faseRaw = iFase >= 0 ? String(row[iFase] ?? '') : '';
    const macroEtapa = parseMacroFase(faseRaw) ?? 'producao';
    etapas.push({
      etapa: nomeEtapa,
      inicio,
      fim,
      macroEtapa,
      rubricasAssociadas: [],
    });
  }

  if (etapas.length === 0) {
    avisos.push('Nenhuma etapa válida encontrada na planilha.');
  }

  return { etapas, avisos };
}

/** Texto para a IA interpretar planilhas não padronizadas ou CSV bruto. */
export async function planilhaCronogramaComoTexto(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const parts = wb.SheetNames.map((sn) => {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sn]);
      return `--- Aba: ${sn} ---\n${csv}`;
    });
    return parts.join('\n\n').slice(0, 60_000);
  }
  const text = await file.text();
  return text.slice(0, 60_000);
}
