/**
 * Contrato compartilhado (Gestor ↔ Criação ↔ Financeiro).
 * Ver dreams-orchestrator/docs/auth-acesso-ecossistema.md
 */

export const APP_IDS = ["criacao", "gestor", "financeiro"] as const;
export type AppId = (typeof APP_IDS)[number];

export const PAPEL_APP = ["none", "leitor", "editor", "gestor", "admin"] as const;
export type PapelApp = (typeof PAPEL_APP)[number];

export type AppsMembro = Partial<Record<AppId, PapelApp>>;

export const ORG_ID_IS = "instituto-dos-sonhos";
