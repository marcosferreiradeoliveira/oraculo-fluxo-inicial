const PALAVRAS_MINUSCULAS = new Set([
  'a',
  'o',
  'as',
  'os',
  'e',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'em',
  'na',
  'no',
  'nas',
  'nos',
  'para',
  'com',
  'por',
  'ao',
  'aos',
  'à',
  'às',
]);

/** Título de edital legível: "Lei Rouanet", "Fundo da Criança" (não tudo minúsculo). */
export function formatEditalTitulo(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return 'Edital sem nome';
  const trimmed = raw.trim();
  if (!trimmed) return 'Edital sem nome';

  return trimmed
    .split(/\s+/)
    .map((word, index) => {
      if (!word) return word;
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      const lower = word.toLowerCase();
      if (index > 0 && PALAVRAS_MINUSCULAS.has(lower)) return lower;
      const chunk = lower.split('-').map((part, i) => {
        if (!part) return part;
        if (i > 0 && PALAVRAS_MINUSCULAS.has(part)) return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
      });
      return chunk.join('-');
    })
    .join(' ');
}

export function formatEditalOrgao(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return 'Órgão não informado';
  return formatEditalTitulo(raw);
}

export function editalIniciais(nome: string | undefined | null): string {
  if (!nome?.trim()) return 'ED';
  const words = nome.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
}
