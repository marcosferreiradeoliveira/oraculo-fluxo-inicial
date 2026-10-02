export type NotaCriterio = {
  titulo: string;
  obtida: number;
  maxima: number;
};

export function parseNotaNumero(raw: string): number {
  const n = parseFloat(String(raw).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

export function formatNotaBr(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
  return n.toFixed(1).replace('.', ',');
}

/** Extrai linhas do tipo "1. Critério: 7,0 / 14,3" ou "**1. Critério:** **9 / 20**". */
export function extrairNotasPorCriterio(texto: string): NotaCriterio[] {
  if (!texto?.trim()) return [];

  const results: NotaCriterio[] = [];
  const seen = new Set<string>();

  const add = (titulo: string, obtida: number, maxima: number) => {
    if (maxima <= 0 || !Number.isFinite(obtida) || !Number.isFinite(maxima)) return;
    const clean = titulo.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    if (clean.length < 3) return;
    if (/^(NOTA FINAL|PONTOS FRACOS|PONTOS FORTES|SUGEST)/i.test(clean)) return;
    if (/^ADEQUAÇÃO AOS CRITÉRIOS DO EDITAL$/i.test(clean)) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ titulo: clean, obtida, maxima });
  };

  for (const line of texto.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || !/\d+\s*\/\s*\d+/.test(trimmed)) continue;

    let m = trimmed.match(
      /^[\*\-•]?\s*\d+\.\s*(.+?):\s*([\d]+(?:[.,]\d+)?)\s*\/\s*([\d]+(?:[.,]\d+)?)/i
    );
    if (m) {
      add(m[1], parseNotaNumero(m[2]), parseNotaNumero(m[3]));
      continue;
    }

    m = trimmed.match(
      /^[\*\-•]?\s*\*\*(\d+\.\s*.+?)\*\*:?\s*\*\*([\d,]+(?:[.,]\d+)?)\s*\/\s*([\d,]+(?:[.,]\d+)?)\*\*/i
    );
    if (m) {
      add(m[1], parseNotaNumero(m[2]), parseNotaNumero(m[3]));
      continue;
    }

    m = trimmed.match(/^\d+\.\s*(.+?):\s*([\d]+(?:[.,]\d+)?)\s*\/\s*([\d]+(?:[.,]\d+)?)/i);
    if (m) {
      add(m[1], parseNotaNumero(m[2]), parseNotaNumero(m[3]));
      continue;
    }

    m = trimmed.match(
      /^[\*\-•]?\s*\d+\.\s*(.+?)\s+[—–-]\s*([\d]+(?:[.,]\d+)?)\s*\/\s*([\d]+(?:[.,]\d+)?)/i
    );
    if (m) {
      add(m[1], parseNotaNumero(m[2]), parseNotaNumero(m[3]));
      continue;
    }

    m = trimmed.match(
      /^[\*\-•]?\s*(.+?)\s+Nota:\s*([\d]+(?:[.,]\d+)?)\s*\/\s*([\d]+(?:[.,]\d+)?)/i
    );
    if (m && !/^sugest/i.test(m[1])) {
      add(m[1], parseNotaNumero(m[2]), parseNotaNumero(m[3]));
    }
  }

  if (results.length === 0) {
    const blocoNota = texto.match(
      /(?:5\.\s*NOTA ESTIMADA|NOTA ESTIMADA)[\s\S]*?(?=NOTA FINAL:|Conclusão da Avaliação|$)/i
    );
    if (blocoNota) {
      for (const line of blocoNota[0].split('\n')) {
        const trimmed = line.trim();
        const m = trimmed.match(
          /^[\*\-•]?\s*\d+\.\s*(.+?):\s*([\d]+(?:[.,]\d+)?)\s*\/\s*([\d]+(?:[.,]\d+)?)/i
        );
        if (m) add(m[1], parseNotaNumero(m[2]), parseNotaNumero(m[3]));
      }
    }
  }

  return results;
}

/** Texto passo a passo de como a nota final foi composta. */
export function explicarCalculoNota(resumo: ResumoNotaEstimada): string[] {
  const linhas: string[] = [];
  if (resumo.criterios.length === 0) {
    linhas.push(
      'Esta análise não inclui pontuação numérica por critério. Use “Fazer outra análise” para gerar o detalhamento (a IA passará a registrar cada critério).'
    );
    return linhas;
  }

  resumo.criterios.forEach((c, i) => {
    linhas.push(
      `${i + 1}. ${c.titulo}: ${formatNotaBr(c.obtida)} de ${formatNotaBr(c.maxima)} pts`
    );
  });

  if (resumo.somaObtida == null || resumo.somaMaxima == null) return linhas;

  linhas.push(
    `Soma dos critérios: ${formatNotaBr(resumo.somaObtida)} ÷ ${formatNotaBr(resumo.somaMaxima)} (total possível)`
  );

  const equiv100 =
    resumo.somaMaxima > 0
      ? Math.round((resumo.somaObtida / resumo.somaMaxima) * 1000) / 10
      : 0;

  if (resumo.maximaExibida === 100 && Math.abs(resumo.somaMaxima - 100) > 0.5) {
    linhas.push(
      `Conversão para escala 0–100: (${formatNotaBr(resumo.somaObtida)} ÷ ${formatNotaBr(resumo.somaMaxima)}) × 100 ≈ ${formatNotaBr(equiv100)}`
    );
  }

  linhas.push(
    `NOTA FINAL exibida: ${formatNotaBr(resumo.notaExibida)} / ${formatNotaBr(resumo.maximaExibida)}`
  );

  return linhas;
}

export type ResumoNotaEstimada = {
  notaExibida: number;
  maximaExibida: number;
  percentualBarra: number;
  somaObtida?: number;
  somaMaxima?: number;
  criterios: NotaCriterio[];
};

export type NotaPersistidaFirestore = {
  nota_estimada?: number;
  nota_estimada_max?: number;
  notas_criterios?: NotaCriterio[];
};

/** Localiza NOTA FINAL mesmo com markdown ou variações de formatação. */
export function extrairNotaFinalDoTexto(texto: string): { obtida: number; maxima: number } | null {
  if (!texto?.trim()) return null;

  const patterns = [
    /NOTA\s+FINAL\s*:?\s*(?:\*\*)?\s*([\d]+(?:[.,]\d+)?)\s*(?:\*\*)?\s*\/\s*(?:\*\*)?\s*([\d]+(?:[.,]\d+)?)/i,
    /NOTA\s+FINAL\s*:?\s*([\d]+(?:[.,]\d+)?)\s*(?:de| sobre)\s*([\d]+(?:[.,]\d+)?)/i,
    /\*\*NOTA\s+FINAL\*\*\s*:?\s*([\d]+(?:[.,]\d+)?)\s*\/\s*([\d]+(?:[.,]\d+)?)/i,
  ];

  for (const re of patterns) {
    const m = texto.match(re);
    if (m) {
      const obtida = parseNotaNumero(m[1]);
      const maxima = parseNotaNumero(m[2]);
      if (Number.isFinite(obtida) && Number.isFinite(maxima) && maxima > 0) {
        return { obtida, maxima };
      }
    }
  }
  return null;
}

function montarResumo(
  notaExibida: number,
  maximaExibida: number,
  criterios: NotaCriterio[]
): ResumoNotaEstimada | null {
  if (!Number.isFinite(notaExibida) || !Number.isFinite(maximaExibida) || maximaExibida <= 0) {
    return null;
  }
  const somaObtida = criterios.reduce((a, c) => a + c.obtida, 0);
  const somaMaxima = criterios.reduce((a, c) => a + c.maxima, 0);
  return {
    notaExibida,
    maximaExibida,
    percentualBarra: Math.min(100, Math.round((notaExibida / maximaExibida) * 100)),
    somaObtida: criterios.length ? somaObtida : undefined,
    somaMaxima: criterios.length ? somaMaxima : undefined,
    criterios,
  };
}

/** Campos derivados para gravar junto com analise_ia (nota estável após reload). */
export function camposNotaParaFirestore(texto: string): NotaPersistidaFirestore | null {
  const resumo = resumoNotaEstimada(texto);
  if (!resumo) return null;
  return {
    nota_estimada: resumo.notaExibida,
    nota_estimada_max: resumo.maximaExibida,
    notas_criterios: resumo.criterios,
  };
}

/** Preferência: parse do texto; se falhar, usa campos salvos no Firestore. */
export function resumoNotaParaExibicao(
  analiseTexto: string,
  persistido?: NotaPersistidaFirestore
): ResumoNotaEstimada | null {
  const fromText = resumoNotaEstimada(analiseTexto);
  if (fromText) return fromText;

  if (
    persistido?.nota_estimada != null &&
    persistido?.nota_estimada_max != null &&
    persistido.nota_estimada_max > 0
  ) {
    const criterios = Array.isArray(persistido.notas_criterios) ? persistido.notas_criterios : [];
    return montarResumo(persistido.nota_estimada, persistido.nota_estimada_max, criterios);
  }

  return null;
}

export function resumoNotaEstimada(texto: string): ResumoNotaEstimada | null {
  if (!texto?.trim()) return null;

  const criterios = extrairNotasPorCriterio(texto);

  const notaFinalPar = extrairNotaFinalDoTexto(texto);
  if (notaFinalPar) {
    const { obtida: notaExibida, maxima: maximaExibida } = notaFinalPar;
    return montarResumo(notaExibida, maximaExibida, criterios);
  }

  if (criterios.length > 0) {
    const somaObtida = criterios.reduce((a, c) => a + c.obtida, 0);
    const somaMaxima = criterios.reduce((a, c) => a + c.maxima, 0);
    return montarResumo(
      Math.round(somaObtida * 10) / 10,
      Math.round(somaMaxima * 10) / 10,
      criterios
    );
  }

  const legadoNota = /Nota:\s*([\d,]+(?:[.,]\d+)?)\s*\/\s*([\d,]+(?:[.,]\d+)?)/gi;
  const legado: NotaCriterio[] = [];
  let match;
  while ((match = legadoNota.exec(texto)) !== null) {
    legado.push({
      titulo: `Critério ${legado.length + 1}`,
      obtida: parseNotaNumero(match[1]),
      maxima: parseNotaNumero(match[2]),
    });
  }
  if (legado.length > 0) {
    const somaObtida = legado.reduce((a, c) => a + c.obtida, 0);
    const somaMaxima = legado.reduce((a, c) => a + c.maxima, 0);
    return montarResumo(
      Math.round(somaObtida * 10) / 10,
      Math.round(somaMaxima * 10) / 10,
      legado
    );
  }

  const estimada = texto.match(/(?:Nota estimada|NOTA ESTIMADA)[^:\d]*(\d{1,3})\s*(?:\/\s*100|$)/i);
  if (estimada) {
    const notaExibida = parseInt(estimada[1], 10);
    return montarResumo(notaExibida, 100, []);
  }

  return null;
}
