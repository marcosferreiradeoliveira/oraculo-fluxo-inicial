type EditalLike = Record<string, unknown>;

export function parseEditalEncerramento(edital: EditalLike): Date | null {
  const now = new Date();
  const tryField = (value: unknown): Date | null => {
    if (!value) return null;
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
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
  };

  let dataEncerramento =
    tryField(edital.data_encerramento) ||
    tryField(edital.dataEncerramento) ||
    tryField(edital.deadline);

  if (!dataEncerramento || isNaN(dataEncerramento.getTime())) return null;
  if (dataEncerramento <= now) return null;
  return dataEncerramento;
}

export function editalDisplayName(edital: EditalLike): string {
  const nome = edital.nome ?? edital.titulo ?? edital.name;
  if (typeof nome === 'string' && nome.trim()) return nome.trim();
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
  return editais.filter((e) => parseEditalEncerramento(e) !== null);
}
