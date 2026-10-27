/** Remove tags HTML e normaliza espaços para previews em cards. */
export function stripHtmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<\/li>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Encurta no limite de palavra (evita “Comparar.” cortado no meio). */
export function excerptPlainText(text: string, maxChars = 180): string {
  const t = text.trim();
  if (!t) return '';
  if (t.length <= maxChars) return t;
  const slice = t.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxChars * 0.45 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trim()}…`;
}

export function contentCardDescription(htmlOrText: string | undefined | null, maxChars = 180): string {
  const plain = stripHtmlToText(htmlOrText || '');
  if (!plain) return '';
  return excerptPlainText(plain, maxChars);
}
