/**
 * Normaliza markdown gerado pela IA para renderização consistente (react-markdown + GFM).
 */
export function normalizarMarkdownAnalise(texto: string): string {
  if (!texto?.trim()) return '';

  let t = texto.replace(/\r\n/g, '\n');

  t = t.replace(/Avaliação:\*/gi, '**Avaliação:**');
  t = t.replace(/(\n|\s)\*(\s*Avaliação:)/gi, '$1**Avaliação:**');

  t = t.replace(/^\s*---\s*$/gm, '\n---\n');

  const secoesPrincipais = [
    'ADEQUAÇÃO AOS CRITÉRIOS DO EDITAL',
    'PONTOS FORTES DO PROJETO',
    'PONTOS FRACOS E GAPS',
    'SUGESTÕES DE MELHORIA',
    'NOTA ESTIMADA',
  ];
  for (const titulo of secoesPrincipais) {
    const re = new RegExp(`^(\\d+\\.\\s*)?(${titulo})\\s*:?\\s*$`, 'gim');
    t = t.replace(re, '## $1$2');
  }

  t = t.replace(/^\*\s+(\d+\.\s+[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][^\n*]+)$/gm, '### $1');

  t = t.replace(/^(NOTA FINAL:\s*.+)$/gim, '## $1');

  t = t.replace(/^Conclusão da Avaliação:?\s*$/gim, '## Conclusão da Avaliação\n');

  t = t.replace(/(##[^\n]+)\n(\*{1,2}|\d+\.|- )/g, '$1\n\n$2');
  t = t.replace(/(###[^\n]+)\n(\*\*Avaliação|[A-ZÁÉÍÓÚ])/g, '$1\n\n$2');

  t = t.replace(/\n{4,}/g, '\n\n\n');

  return t.trim();
}
