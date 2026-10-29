/** 
 * Plano gratuito Starter (Freemium): avaliação + uso de créditos no Módulo 2
 * 
 * This module now re-exports from the unified entitlements model for backward compatibility.
 */

import { hasPaidPlan as hasPaidPlanEntitlements, isStarterPlan as isStarterPlanEntitlements, type UserEntitlementsData } from './entitlements';

export const STARTER_CREDITS_ON_SIGNUP = 30;

/** Índices das etapas do fluxo (0=Criar … 8=Anexos). Starter navega até Criar Orçamento (5). */
export const STARTER_MAX_STEP_INDEX = 5;

/** Equipe, documentos e anexos exigem plano pago. */
export const STARTER_PREMIUM_ONLY_STEP_INDEX = 6;

export const CREDITOS_ANALISE = 5;
export const CREDITOS_GERAR_TEXTO = 1;
export const CREDITOS_CRONOGRAMA = 3;
export const CREDITOS_ORCAMENTO = 3;

/** Custo em créditos por índice de etapa (quando aplicável). */
export const PROJECT_STEP_CREDIT_COST: Partial<Record<number, number>> = {
  1: CREDITOS_ANALISE,
  3: CREDITOS_GERAR_TEXTO,
  4: CREDITOS_CRONOGRAMA,
  5: CREDITOS_ORCAMENTO,
};

export type UserPlanFields = UserEntitlementsData;

/**
 * Re-export from entitlements with backward-compatible signature
 */
export function hasPaidPlan(data: UserPlanFields | null | undefined): boolean {
  return hasPaidPlanEntitlements(data);
}

export function isStarterPlan(data: UserPlanFields | null | undefined): boolean {
  return isStarterPlanEntitlements(data);
}

export function starterPaywallUrl(motivo: 'starter_modulo2' | 'creditos_insuficientes' = 'starter_modulo2'): string {
  return `/cadastro-premium?motivo=${motivo}`;
}

export function canAccessProjectStepIndex(
  stepIndex: number,
  data: UserPlanFields | null | undefined,
): boolean {
  if (hasPaidPlan(data)) return true;
  return stepIndex < STARTER_PREMIUM_ONLY_STEP_INDEX;
}

export function starterHasCreditsFor(cost: number, creditos: number | null | undefined): boolean {
  return (creditos ?? 0) >= cost;
}

export function starterProjectLimit(): number {
  return 1;
}
