import * as XLSX from 'xlsx';
import { parseValorMonetarioBr } from '@/lib/orcamentoTeto';

export type RubricaPlanilhaImportada = {
  nome: string;
  quantidade: number;
  unidade: string;
  quantidadeUnidade: number;
  valorUnitario: number;
  total: number;
};

export type ResultadoImportacaoOrcamento = {
  rubricas: RubricaPlanilhaImportada[];
  tetoDetectado?: number;
  avisos: string[];
};

function normHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function parseNumeroCelula(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const s = String(val ?? '')
    .trim()
    .replace(/^R\$\s*/i, '');
  if (!s) return NaN;
  const br = parseValorMonetarioBr(s);
  if (Number.isFinite(br)) return br;
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function linhaIgnoradaImport(linha: string[]): boolean {
  const j = linha.map((c) => normHeader(String(c ?? ''))).join(' ');
  if (!j.trim()) return true;
  if (j.includes('total geral') || j.includes('diferenca do teto') || j.includes('diferença do teto'))
    return true;
  if (j.startsWith('orcamento ') || j === 'rubricas') return true;
  return false;
}

function indiceColuna(headers: string[], ...aliases: string[]): number {
  for (const alias of aliases) {
    const na = normHeader(alias);
    const idx = headers.findIndex((h) => {
      if (h === na) return true;
      if (h.includes(na) && na.length >= 4) return true;
      return false;
    });
    if (idx >= 0) return idx;
  }
  return -1;
}

function encontrarLinhaCabecalho(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const headers = row.map((c) => normHeader(String(c ?? '')));
    const temNome =
      headers.some((h) => h.includes('nome') && h.includes('rubrica')) ||
      headers.some((h) => h === 'rubrica' || h === 'item' || h === 'descricao');
    const temTotal = headers.some((h) => h.includes('total'));
    if (temNome && (temTotal || headers.some((h) => h.includes('unidade')))) return i;
  }
  return -1;
}

function extrairTetoDasLinhas(rows: unknown[][]): number | undefined {
  for (const row of rows.slice(0, 15)) {
    if (!Array.isArray(row)) continue;
    const texto = row.map((c) => String(c ?? '')).join(' ');
    const lower = normHeader(texto);
    if (!lower.includes('teto')) continue;
    for (let i = row.length - 1; i >= 0; i--) {
      const n = parseNumeroCelula(row[i]);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const m = texto.match(/R\$\s*([\d.,]+)/i);
    if (m) {
      const n = parseNumeroCelula(m[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return undefined;
}

function rubricasDeMatriz(rows: unknown[][]): ResultadoImportacaoOrcamento {
  const avisos: string[] = [];
  const headerIdx = encontrarLinhaCabecalho(rows);
  if (headerIdx < 0) {
    return { rubricas: [], avisos: ['Cabeçalho não encontrado. Use as colunas do modelo exportado pelo Oráculo.'] };
  }

  const headers = (rows[headerIdx] as unknown[]).map((c) => normHeader(String(c ?? '')));
  const iNome = indiceColuna(headers, 'nome da rubrica', 'nome rubrica', 'rubrica', 'item', 'descricao');
  const iQtd = indiceColuna(headers, 'quantidade', 'qtd');
  const iUn = indiceColuna(headers, 'unidade');
  const iQtdUn = indiceColuna(headers, 'qtd. unidade', 'qtd unidade', 'quantidade unidade');
  const iVu = indiceColuna(headers, 'valor unitario', 'valor unitário', 'unitario', 'unit');
  const iTotal = indiceColuna(headers, 'total');

  if (iNome < 0) {
    return { rubricas: [], avisos: ['Coluna "Nome da Rubrica" não encontrada.'] };
  }

  const rubricas: RubricaPlanilhaImportada[] = [];

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const cells = row.map((c) => (c == null ? '' : c));
    if (linhaIgnoradaImport(cells.map(String))) continue;

    const nome = String(cells[iNome] ?? '').trim();
    if (!nome || normHeader(nome).includes('total geral')) continue;

    const quantidade = (() => {
      const n = iQtd >= 0 ? parseNumeroCelula(cells[iQtd]) : NaN;
      return Number.isFinite(n) && n > 0 ? n : 1;
    })();

    let unidade = iUn >= 0 ? String(cells[iUn] ?? '').trim() : 'unidade';
    if (!unidade) unidade = 'unidade';

    const quantidadeUnidade = (() => {
      const n = iQtdUn >= 0 ? parseNumeroCelula(cells[iQtdUn]) : NaN;
      return Number.isFinite(n) && n > 0 ? n : 1;
    })();

    let valorUnitario = iVu >= 0 ? parseNumeroCelula(cells[iVu]) : NaN;
    let total = iTotal >= 0 ? parseNumeroCelula(cells[iTotal]) : NaN;

    if (!Number.isFinite(total) || total <= 0) {
      if (Number.isFinite(valorUnitario) && valorUnitario > 0) {
        total = quantidade * quantidadeUnidade * valorUnitario;
      } else {
        avisos.push(`Linha ignorada (sem total): "${nome}"`);
        continue;
      }
    }

    if (!Number.isFinite(valorUnitario) || valorUnitario <= 0) {
      const denom = quantidade * quantidadeUnidade;
      valorUnitario = denom > 0 ? total / denom : total;
    }

    rubricas.push({
      nome,
      quantidade,
      unidade,
      quantidadeUnidade,
      valorUnitario: Math.round(valorUnitario * 100) / 100,
      total: Math.round(total * 100) / 100,
    });
  }

  const tetoDetectado = extrairTetoDasLinhas(rows);
  if (rubricas.length === 0) {
    avisos.push('Nenhuma rubrica válida encontrada na planilha.');
  }

  return { rubricas, tetoDetectado, avisos };
}

/** Lê .xlsx, .xls ou .csv exportado pelo Oráculo ou planilha compatível. */
export async function importarPlanilhaOrcamento(file: File): Promise<ResultadoImportacaoOrcamento> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', raw: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { rubricas: [], avisos: ['Planilha vazia.'] };
  }
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  return rubricasDeMatriz(rows);
}
