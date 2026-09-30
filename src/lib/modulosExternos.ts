/** Módulo 2 — Operações / EAP (app separado). Configure via VITE_MODULO_EAP_URL. */
export const MODULO_EAP_URL =
  (import.meta.env.VITE_MODULO_EAP_URL as string | undefined)?.trim() ||
  'https://oraculo-is.web.app/';

/** Módulo 3 — Compliance fiscal / NFs. */
export const MODULO_PRESTACAO_URL =
  (import.meta.env.VITE_MODULO_PRESTACAO_URL as string | undefined)?.trim() ||
  'https://execucaofinanceira.web.app/';

/** Gerenciador de projetos (Instituto dos Sonhos). */
export const MODULO_GERENCIADOR_PROJETOS_URL =
  (import.meta.env.VITE_MODULO_GERENCIADOR_PROJETOS_URL as string | undefined)?.trim() ||
  'https://gerenciadeprojeto.web.app/';

export function openModuloExterno(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
