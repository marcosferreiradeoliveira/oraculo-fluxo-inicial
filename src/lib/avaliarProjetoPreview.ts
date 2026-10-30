import { getFunctionsBaseUrl } from '@/lib/functionsUrl';
import { getIaAuthHeaders, handleIaHttpStatus } from '@/lib/iaAuthenticatedFetch';
import { getPreviewFingerprint } from '@/lib/landingPreviewLimit';

const FUNCTIONS_BASE = getFunctionsBaseUrl();
export const AVALIAR_PROJETO_IA_URL = `${FUNCTIONS_BASE}/avaliarProjetoIA`;
export const AVALIAR_PROJETO_PREVIEW_LANDING_URL = `${FUNCTIONS_BASE}/avaliarProjetoPreviewLanding`;

export type LandingPreviewAvaliacao = {
  notaGlobal: number;
  notaMaximaTotal: number;
  pontosAtencao: string[];
};

export type NotaResumo = { notaGlobal: number; notaMaximaTotal: number };

const limparMarkdownInline = (texto: string): string =>
  texto
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .trim();

/** Texto legível do parecer para exibir (com quebras). */
export function formatarCorpoParecerParaUi(analiseConteudo: string, maxChars = 2400): string {
  if (!analiseConteudo?.trim()) return '';
  return analiseConteudo
    .replace(/\r/g, '')
    .replace(/#{1,4}\s*/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .trim()
    .slice(0, maxChars);
}

/** Itens da seção “Pontos fracos” para a prévia visitante (landing / anônimo). */
export function extrairPontosFracosPreview(analiseConteudo: string, maxItems = 2): string[] {
  if (!analiseConteudo?.trim()) return [];
  const texto = analiseConteudo.replace(/\r/g, '');
  const secao = texto.match(
    /(?:^|\n)\s*3\.?\s*PONTOS\s+FRACOS[^\n]*\n([\s\S]*?)(?=\n\s*4\.?\s|$)/i,
  );
  let body: string | null = secao?.[1]?.trim() ?? null;
  if (!body) {
    const alt = texto.match(/PONTOS\s+FRACOS[^\n]*\n([\s\S]*?)(?=\n\s*4\.?\s|SUGESTÕES|$)/i);
    body = alt?.[1]?.trim() ?? null;
  }
  if (!body) return [];

  const items: string[] = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*(?:\d+[.)]\s*|[-•*]\s+)(.+)/);
    if (m?.[1]) {
      const t = limparMarkdownInline(m[1]);
      if (t.length > 12) items.push(t);
    }
    if (items.length >= maxItems) break;
  }
  if (items.length === 0) {
    const par = body
      .split(/\n\n+/)
      .map((p) => limparMarkdownInline(p))
      .find((p) => p.length > 40);
    if (par) items.push(par.slice(0, 520));
  }
  return items.slice(0, maxItems);
}

/** Vários itens da seção “Pontos fortes” para a prévia visitante. */
export function extrairPontosFortesPreview(analiseConteudo: string, maxItems = 5): string[] {
  if (!analiseConteudo?.trim()) return [];
  const texto = analiseConteudo.replace(/\r/g, '');
  const secao = texto.match(
    /(?:^|\n)\s*2\.?\s*PONTOS\s+FORTES[^\n]*\n([\s\S]*?)(?=\n\s*3\.?\s|$)/i,
  );
  let body: string | null = secao?.[1]?.trim() ?? null;
  if (!body) {
    const alt = texto.match(/PONTOS\s+FORTES[^\n]*\n([\s\S]*?)(?=\n\s*3\.?\s|PONTOS\s+FRACOS|$)/i);
    body = alt?.[1]?.trim() ?? null;
  }
  if (!body) return [];

  const items: string[] = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*(?:\d+[.)]\s*|[-•*]\s+)(.+)/);
    if (m?.[1]) {
      const t = limparMarkdownInline(m[1]);
      if (t.length > 12) items.push(t);
    }
    if (items.length >= maxItems) break;
  }
  if (items.length === 0) {
    const par = body
      .split(/\n\n+/)
      .map((p) => limparMarkdownInline(p))
      .find((p) => p.length > 40);
    if (par) items.push(par.slice(0, 520));
  }
  return items;
}

/** Trecho da seção 1 (adequação / visão geral) — legível na prévia. */
export function extrairResumoAdequacaoPreview(analiseConteudo: string, maxChars = 1100): string | null {
  if (!analiseConteudo?.trim()) return null;
  const texto = analiseConteudo.replace(/\r/g, '');
  const secao = texto.match(
    /(?:^|\n)\s*1\.?\s*[^\n]*\n([\s\S]*?)(?=\n\s*2\.?\s|PONTOS\s+FORTES|$)/i,
  );
  let body = secao?.[1]?.trim();
  if (!body || body.length < 40) {
    const alt = texto.match(/(?:^|\n)\s*1\.?\s*ADEQUA[^\n]*\n([\s\S]*?)(?=\n\s*2\.?\s|$)/i);
    body = alt?.[1]?.trim();
  }
  if (!body) return null;
  const limpo = body
    .replace(/#{1,4}\s*/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .trim();
  return limpo.length > 30 ? limpo.slice(0, maxChars) : null;
}

/** Primeiro parágrafo útil quando nota/pontos ainda não parseiam. */
export function extrairTrechoAbertoPreview(analiseConteudo: string, max = 720): string {
  const limpo = formatarCorpoParecerParaUi(analiseConteudo, 8000);
  const semSugestoes = limpo.replace(/4\.\s*SUGESTÕES[\s\S]*$/i, '').trim();
  const blocos = semSugestoes
    .split(/\n(?=\d+\.\s)/)
    .map((b) => b.trim())
    .filter(Boolean);
  const corpo = blocos.length > 1 ? blocos.slice(1).join('\n\n') : semSugestoes;
  const paragrafos = corpo
    .split(/\n\n+/)
    .map((p) => limparMarkdownInline(p.replace(/^[-•*]\s*/, '')))
    .filter((p) => p.length > 30 && !/^nota estimada/i.test(p));
  if (paragrafos[0]) return paragrafos[0].slice(0, max);
  return limparMarkdownInline(semSugestoes).slice(0, max);
}

/** Extrai nota global do texto do parecer (mesma lógica da UI do projeto). */
export function calcularNotaGlobalAnalise(analiseConteudo: string): NotaResumo | null {
  if (!analiseConteudo?.trim()) return null;

  const notaPattern = /Nota:\s*(\d+)\/(\d+)\.?/gi;
  const notas: Array<{ obtida: number; maxima: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = notaPattern.exec(analiseConteudo)) !== null) {
    const obtida = parseInt(match[1], 10);
    const maxima = parseInt(match[2], 10);
    if (!isNaN(obtida) && !isNaN(maxima) && maxima > 0) {
      notas.push({ obtida, maxima });
    }
  }

  if (notas.length > 0) {
    const somaObtidas = notas.reduce((acc, n) => acc + n.obtida, 0);
    const somaMaximas = notas.reduce((acc, n) => acc + n.maxima, 0);
    return {
      notaGlobal: Math.round((somaObtidas / somaMaximas) * 100),
      notaMaximaTotal: somaMaximas,
    };
  }

  const notaSection = analiseConteudo.match(/5\.\s*\*\*Nota estimada.*?:\*\*\s*(\d+)/i);
  if (notaSection?.[1]) {
    const notaGlobal = parseInt(notaSection[1], 10);
    if (!isNaN(notaGlobal)) return { notaGlobal, notaMaximaTotal: 100 };
  }

  const patterns = [
    /Nota estimada.*?:\s*(\d+)/i,
    /Nota estimada.*?\):\s*(\d+)/i,
    /Nota estimada[^\d]{0,40}(\d{1,3})\s*\/\s*100/i,
    /(\d{1,3})\s*\/\s*100\s*pontos/i,
  ];
  for (const pattern of patterns) {
    const m = analiseConteudo.match(pattern);
    if (m?.[1]) {
      const notaGlobal = parseInt(m[1], 10);
      if (notaGlobal >= 0 && notaGlobal <= 100) {
        return { notaGlobal, notaMaximaTotal: 100 };
      }
    }
  }

  return null;
}

/** Primeiro item ou parágrafo da seção “Pontos fortes”. */
export function extrairPrimeiroPontoForte(analiseConteudo: string): string | null {
  if (!analiseConteudo?.trim()) return null;
  const texto = analiseConteudo.replace(/\r/g, '');
  const secao = texto.match(
    /(?:^|\n)\s*2\.?\s*PONTOS\s+FORTES[^\n]*\n([\s\S]*?)(?=\n\s*3\.?\s|$)/i,
  );
  let body: string | null = secao?.[1]?.trim() ?? null;
  if (!body) {
    const alt = texto.match(/PONTOS\s+FORTES[^\n]*\n([\s\S]*?)(?=\n\s*3\.?\s|PONTOS\s+FRACOS|$)/i);
    body = alt?.[1]?.trim() ?? null;
  }
  if (!body) return null;
  const itemLista = body.match(/(?:^|\n)\s*[-•*]\s*(.+)/);
  if (itemLista?.[1]) {
    const t = limparMarkdownInline(itemLista[1]);
    return t.length > 8 ? t : null;
  }
  const linha = body
    .split('\n')
    .map((l) => limparMarkdownInline(l))
    .find((l) => l.length > 24 && !/^pontos?\s+fortes/i.test(l));
  return linha ?? null;
}

export type AvaliarProjetoPayload = {
  projetoId: null;
  textoProjeto: string;
  nomeProjeto: string;
  nomeEdital: string;
  criteriosEdital: string;
  textoEdital: string;
  portfolio: string;
  projetosSelecionados: string;
  stream: true;
};

export async function fetchAvaliarProjetoPreviewLanding(body: {
  textoProjeto: string;
  nomeProjeto: string;
  nomeEdital: string;
  criteriosEdital: string;
}): Promise<LandingPreviewAvaliacao> {
  const fingerprint = getPreviewFingerprint();
  const response = await fetch(AVALIAR_PROJETO_PREVIEW_LANDING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Preview-Fingerprint': fingerprint,
    },
    body: JSON.stringify({ ...body, previewFingerprint: fingerprint }),
  });
  const errText = await response.text();
  if (!response.ok) {
    let message = errText.slice(0, 300);
    try {
      const data = JSON.parse(errText);
      message = data.message || data.error || message;
    } catch {
      /* keep */
    }
    throw new Error(message);
  }
  return JSON.parse(errText) as LandingPreviewAvaliacao;
}

export async function streamAvaliarProjetoIA(
  payload: AvaliarProjetoPayload & { projetoId?: string | null; userId?: string },
  onPartial: (fullContent: string) => void,
  options?: { navigate?: (path: string) => void },
): Promise<string> {
  const { userId: _omit, ...body } = payload;
  const headers = await getIaAuthHeaders({
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  });
  const response = await fetch(AVALIAR_PROJETO_IA_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 401 || response.status === 402) {
      handleIaHttpStatus(response.status, options?.navigate);
    }
    if (response.status === 429) {
      let msg = 'Aguarde alguns segundos antes de solicitar uma nova análise.';
      try {
        const data = JSON.parse(errText);
        if (data.message) msg = data.message;
      } catch {
        /* default */
      }
      const err = new Error(msg) as Error & { status?: number };
      err.status = 429;
      throw err;
    }
    throw new Error(`Erro ${response.status}: ${errText.slice(0, 300)}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  if (!reader) {
    throw new Error('Resposta do servidor sem conteúdo. Tente novamente.');
  }

  let streamDone = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      streamDone = true;
      if (buffer.trim()) {
        for (const line of buffer.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) fullContent += data.content;
            if (data.done && data.fullContent) fullContent = data.fullContent;
          } catch {
            /* ignore */
          }
        }
      }
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.content) {
          fullContent += data.content;
          onPartial(fullContent);
        }
        if (data.done) {
          if (data.fullContent) fullContent = data.fullContent;
          onPartial(fullContent);
          streamDone = true;
        }
      } catch {
        /* ignore */
      }
    }
    if (streamDone) break;
  }

  if (fullContent.trim()) onPartial(fullContent);
  return fullContent.trim();
}
