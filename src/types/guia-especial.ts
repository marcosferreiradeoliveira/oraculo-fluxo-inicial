/**
 * Campos de guia especial (CMS conversão) — Blocos 1–7.
 * Todos opcionais; exibição condicional na landing.
 */

/** BLOCO 1 — Proposta de Valor (Above the Fold) */
export interface GuiaEspecialBloco1 {
  subtituloImpacto?: string;
  promessaPrincipal?: string;
  beneficiosChave?: string[];
  etiquetaPosicionamento?: string;
}

/** BLOCO 2 — Dor, Identificação e Urgência */
export interface GuiaEspecialBloco2 {
  blocoVoceJaPassou?: string;
  listaDores?: string[];
  consequenciaNaoResolver?: string;
  blocoUrgenciaContextual?: string;
}

/** BLOCO 3 — Autoridade & Prova Social */
export interface GuiaEspecialBloco3 {
  autorNome?: string;
  autorBio?: string;
  provaSocial1?: string;
  provaSocial2Nome?: string;
  provaSocial2Perfil?: string;
  provaSocial2Texto?: string;
  provaSocial3?: string;
}

/** BLOCO 4 — Conteúdo & Transformação */
export interface GuiaEspecialBloco4 {
  oQueSeraCapaz?: string[];
  antesDepoisAntes?: string;
  antesDepoisDepois?: string;
}

/** BLOCO 5 — Oferta & Ancoragem de Preço */
export interface GuiaEspecialBloco5 {
  valorOriginal?: number;
  valorPromocional?: number;
  textoAncoragemValor?: string;
  beneficioEconomico?: string;
  badgeRiscoBaixo?: string[];
}

/** BLOCO 6 — Redução de Objeções */
export interface GuiaEspecialBloco6 {
  paraQuemEh?: string;
  paraQuemNaoEh?: string;
  faq1Pergunta?: string;
  faq1Resposta?: string;
  faq2Pergunta?: string;
  faq2Resposta?: string;
  faq3Pergunta?: string;
  faq3Resposta?: string;
}

/** BLOCO 7 — CTA */
export interface GuiaEspecialBloco7 {
  ctaTextoPrincipal?: string;
  ctaTextoSecundario?: string;
  microcopySeguranca?: string[];
}

export type GuiaEspecialCampos = GuiaEspecialBloco1 &
  GuiaEspecialBloco2 &
  GuiaEspecialBloco3 &
  GuiaEspecialBloco4 &
  GuiaEspecialBloco5 &
  GuiaEspecialBloco6 &
  GuiaEspecialBloco7;

export function parseLines(s: string): string[] {
  if (!s || typeof s !== 'string') return [];
  return s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function formatLines(arr: string[] | undefined): string {
  if (!arr || !Array.isArray(arr)) return '';
  return arr.filter(Boolean).join('\n');
}
