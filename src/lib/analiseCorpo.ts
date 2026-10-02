/** Remove sugestões e blocos repetidos do corpo da análise (ficam só nos cards "Aplicar"). */
export function prepararCorpoAnaliseParaExibicao(texto: string): string {
  if (!texto?.trim()) return '';

  let t = texto.replace(/\r\n/g, '\n');

  t = t.replace(
    /\n?\d+\.\s*SUGEST[ÕO]ES\s+DE\s+MELHORIA[\s\S]*?(?=\n---|\n\d+\.\s*NOTA|\nNOTA FINAL|\nA pontuação total|\n##\s*NOTA|\nConclusão da Avaliação)/i,
    ''
  );

  t = t.replace(
    /(?:^|\n)---\s*\n([\s\S]*?)(?=\n---|\nNOTA FINAL|\nA pontuação total|\nConclusão da Avaliação|\n\d+\.\s)/gi,
    (full, inner) => (/Sugestão:/i.test(inner) ? '\n' : full)
  );

  const linhas = t.split('\n');
  const filtradas = linhas.filter((linha) => {
    const trimmed = linha.trim();
    if (!trimmed) return true;
    if (/^[\*\-•]\s*Sugestão:/i.test(trimmed)) return false;
    if (/^Sugestão:/i.test(trimmed)) return false;
    if (/^\d+[\.)]\s*Sugestão:/i.test(trimmed)) return false;
    if (/sugest[õo]es?\s+de\s+melhoria/i.test(trimmed)) return false;
    return true;
  });
  t = filtradas.join('\n');

  t = t.replace(/\nA pontuação total de 100[\s\S]*?(?=NOTA FINAL:|Conclusão da Avaliação)/i, '\n');

  t = t.replace(/\nNOTA FINAL:\s*[\d.]+\s*\/\s*[\d.]+\s*\n?/i, '\n');

  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}
