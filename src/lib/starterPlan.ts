/** Plano gratuito Starter (Freemium): Módulo 1 — simulador de avaliação */

import { hasPaidPlan as hasPaidPlanEntitlements, isStarterPlan as isStarterPlanEntitlements, type UserEntitlementsData } from './entitlements';

export const STARTER_CREDITS_ON_SIGNUP = 15;

/** Índices das etapas do fluxo (0=Criar … 7=Anexos). Starter inclui até Alterar com IA. */
export const STARTER_MAX_STEP_INDEX = 2;

export type UserPlanFields = UserEntitlementsData;

/**
 * Check if user has paid plan using unified entitlements model
 */
export function hasPaidPlan(data: UserPlanFields | null | undefined): boolean {
  return hasPaidPlanEntitlements(data);
}

/**
 * Check if user is on starter/free plan using unified entitlements model
 */
export function isStarterPlan(data: UserPlanFields | null | undefined): boolean {
  return isStarterPlanEntitlements(data);
}

export function starterPaywallUrl(motivo: 'starter_modulo2' | 'creditos_insuficientes' = 'starter_modulo2'): string {
  return `/cadastro-premium?motivo=${motivo}`;
}

export function canAccessProjectStepIndex(
  stepIndex: number,
  data: UserPlanFields | null | undefined
): boolean {
  if (!isStarterPlan(data)) return true;
  return stepIndex <= STARTER_MAX_STEP_INDEX;
}

export function starterProjectLimit(): number {
  return 1;
}
