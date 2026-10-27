type EditalLike = Record<string, unknown>;

/** Anos sentinelas usados no catálogo para editais sem data fim (ex.: Lei Rouanet). */
const PLACEHOLDER_YEAR_MIN = 2090;

function tryParseEditalDateValue(value: unknown): Date | null {
  if (!value) return null;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Data bruta do edital, sem filtrar vencidos ou placeholders. */
export function rawEditalEncerramentoDate(edital: EditalLike): Date | null {
  const dataEncerramento =
    tryParseEditalDateValue(edital.data_encerramento) ||
    tryParseEditalDateValue(edital.dataEncerramento) ||
    tryParseEditalDateValue(edital.deadline);
  if (!dataEncerramento || isNaN(dataEncerramento.getTime())) return null;
  return dataEncerramento;
}

export function isPlaceholderEncerramentoDate(d: Date): boolean {
  return d.getFullYear() >= PLACEHOLDER_YEAR_MIN;
}

export type EditalPrazoDisplay = {
  show: boolean;
  label: string;
  continuo: boolean;
};

/** Rótulo para cards e listagens (oculta linha quando não há dado). */
export function getEditalPrazoDisplay(edital: EditalLike): EditalPrazoDisplay {
  const d = rawEditalEncerramentoDate(edital);
  if (!d) {
    return { show: false, label: '', continuo: false };
  }
  if (isPlaceholderEncerramentoDate(d)) {
    return { show: true, label: 'Fluxo contínuo', continuo: true };
  }
  if (d <= new Date()) {
    return { show: true, label: 'Prazo encerrado', continuo: false };
  }
  return {
    show: true,
    label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    continuo: false,
  };
}

/** Página de detalhes — texto mais descritivo. */
export function formatEditalEncerramentoLongo(edital: EditalLike): string {
  const d = rawEditalEncerramentoDate(edital);
  if (!d) return 'Sem prazo definido';
  if (isPlaceholderEncerramentoDate(d)) return 'Fluxo contínuo';
  if (d <= new Date()) return 'Prazo encerrado';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

const VALOR_VAZIO = /^n[aã]o\s*(especificado|informado)$/i;

/** Retorna null para ocultar o campo na UI. */
export function formatEditalValorPremiacao(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || VALOR_VAZIO.test(s)) return null;
  return s;
}

/** Prazo real (contagem, urgência) — ignora placeholders e editais vencidos. */
export function parseEditalEncerramento(edital: EditalLike): Date | null {
  const d = rawEditalEncerramentoDate(edital);
  if (!d) return null;
  if (isPlaceholderEncerramentoDate(d)) return null;
  if (d <= new Date()) return null;
  return d;
}

/** Listagens “abertos”: inclui fluxo contínuo e editais sem data; exclui só vencidos com data real. */
export function isEditalVisivelComoAberto(edital: EditalLike): boolean {
  const d = rawEditalEncerramentoDate(edital);
  if (!d) return true;
  if (isPlaceholderEncerramentoDate(d)) return true;
  return d > new Date();
}

export function editalDisplayName(edital: EditalLike): string {
  const nome = edital.nome ?? edital.titulo ?? edital.name;
  if (typeof nome === 'string' && nome.trim()) {
    // Lazy import avoided — keep raw name here; UI uses formatEditalTitulo
    return nome.trim();
  }
  return 'Edital cultural';
}

export function diasRestantes(data: Date): number {
  const ms = data.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export type EditalUrgenteInfo = {
  id: string;
  titulo: string;
  dataEncerramento: Date;
  diasRestantes: number;
};

export function findEditalMaisUrgente(editais: (EditalLike & { id?: string })[]): EditalUrgenteInfo | null {
  const abertos = editais
    .map((e) => {
      const data = parseEditalEncerramento(e);
      if (!data || !e.id) return null;
      return {
        id: e.id,
        titulo: editalDisplayName(e),
        dataEncerramento: data,
        diasRestantes: diasRestantes(data),
      };
    })
    .filter(Boolean) as EditalUrgenteInfo[];

  if (abertos.length === 0) return null;
  abertos.sort((a, b) => a.dataEncerramento.getTime() - b.dataEncerramento.getTime());
  return abertos[0];
}

export function filterEditaisAbertos<T extends EditalLike>(editais: T[]): T[] {
  return editais.filter(isEditalVisivelComoAberto);
}
