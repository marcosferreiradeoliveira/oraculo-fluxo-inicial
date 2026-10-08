/** Normaliza entrada de data de cronograma para YYYY-MM-DD (somente calendário). */
export function normalizarDataCronograma(raw?: string): string {
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

function utcMsFromYmd(ymd: string): number | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return Date.UTC(y, mo - 1, d);
}

/** Corrige início/fim invertidos (comum na IA). Troca se o swap ficar válido; senão fim = início. */
export function corrigirInicioFimCronograma(
  inicio: string,
  fim: string,
): { inicio: string; fim: string } {
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

/** Retorna true se fim é estritamente anterior a início (mesmo dia = válido). */
export function fimAntesDoInicioCronograma(inicio: string, fim: string): boolean {
  const ini = normalizarDataCronograma(inicio);
  const f = normalizarDataCronograma(fim);
  if (!ini || !f) return false;
  const a = utcMsFromYmd(ini);
  const b = utcMsFromYmd(f);
  if (a == null || b == null) return false;
  return b < a;
}

export function formatarDataPtBrDeIso(iso: string): string {
  const n = normalizarDataCronograma(iso);
  if (!n) return iso;
  const [y, m, d] = n.split('-');
  return `${d}/${m}/${y}`;
}
