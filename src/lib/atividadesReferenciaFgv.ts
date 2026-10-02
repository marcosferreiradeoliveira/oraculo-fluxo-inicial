import csvRaw from '@/assets/rj_2012_corrigido_ipca_2026.csv?raw';

export type AtividadeReferenciaFgv = {
  id: string;
  descricao: string;
  unidade: string;
  valorRj2012: number;
  valorRj2026: number;
};

export type TipoAtividadeFornecedor = 'fgv_referencia' | 'personalizada';

/** Vínculo do fornecedor à nomenclatura da tabela — sem valores monetários. */
export type AtividadeFornecedorFgv = {
  tipo: 'fgv_referencia';
  referenciaId: string;
  descricao: string;
};

export type AtividadeFornecedorPersonalizada = {
  tipo: 'personalizada';
  nome: string;
};

export type AtividadeFornecedor = AtividadeFornecedorFgv | AtividadeFornecedorPersonalizada;

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  }
  return rows;
}

function parseNumero(raw: string): number {
  const n = parseFloat(String(raw || '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function normalizarBusca(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function carregarAtividades(): AtividadeReferenciaFgv[] {
  const rows = parseCsvRows(csvRaw);
  if (rows.length < 2) return [];

  const out: AtividadeReferenciaFgv[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const descricao = (cells[0] ?? '').trim();
    const unidade = (cells[1] ?? '').trim();
    const valorRj2012 = parseNumero(cells[2] ?? '');
    const valorRj2026 = parseNumero(cells[3] ?? '');
    if (!descricao || descricao.length < 2) continue;
    out.push({
      id: `fgv-${i}`,
      descricao,
      unidade: unidade || '—',
      valorRj2012,
      valorRj2026,
    });
  }
  return out;
}

/** Lista de referência FGV/RJ 2012 (planilha inclui valores; no cadastro de fornecedor usa-se só a função). */
export const ATIVIDADES_REFERENCIA_FGV: AtividadeReferenciaFgv[] = carregarAtividades();

export function buscarAtividadesReferenciaFgv(termo: string, limite = 40): AtividadeReferenciaFgv[] {
  const q = normalizarBusca(termo);
  if (!q) {
    return ATIVIDADES_REFERENCIA_FGV.slice(0, limite);
  }
  const matches: AtividadeReferenciaFgv[] = [];
  for (const a of ATIVIDADES_REFERENCIA_FGV) {
    const hay = normalizarBusca(`${a.descricao} ${a.unidade}`);
    if (hay.includes(q)) {
      matches.push(a);
      if (matches.length >= limite) break;
    }
  }
  return matches;
}

export function atividadeReferenciaPorId(id: string): AtividadeReferenciaFgv | undefined {
  return ATIVIDADES_REFERENCIA_FGV.find((a) => a.id === id);
}

export function formatarValorReferenciaFgv(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function rotuloAtividadeFornecedor(atividade?: AtividadeFornecedor | null): string {
  if (!atividade) return '';
  if (atividade.tipo === 'personalizada') return atividade.nome.trim();
  return atividade.descricao.trim();
}

export function atividadeFornecedorFromFirestore(data: unknown): AtividadeFornecedor | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const o = data as Record<string, unknown>;
  const tipo = o.tipo as string | undefined;
  if (tipo === 'personalizada' && typeof o.nome === 'string' && o.nome.trim()) {
    return { tipo: 'personalizada', nome: o.nome.trim() };
  }
  if (tipo === 'fgv_referencia' && typeof o.descricao === 'string') {
    return {
      tipo: 'fgv_referencia',
      referenciaId: String(o.referenciaId ?? ''),
      descricao: o.descricao.trim(),
    };
  }
  return undefined;
}
