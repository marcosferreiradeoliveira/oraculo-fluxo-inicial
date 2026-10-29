/**
 * Unified entitlements model for Criação (oraculo-fluxo-inicial)
 * 
 * Shared Firebase project culturalapp-fb9b0, collection usuarios/{uid}.
 * This is a local copy of the entitlements helper with identical logic across all apps.
 */

export type PlanId = 'free' | 'proponente' | 'produtora' | 'institucional';

export type PlanStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

export type Entitlements = {
  criacao: boolean;
  finance: boolean;
  gestor: boolean;
  maxUsuarios: number;
  maxProjetosAno: number | null; // null = unlimited
  creditosMensais: number;
};

export type UserEntitlementsData = {
  plan?: PlanId;
  planStatus?: PlanStatus;
  entitlements?: Entitlements;
  // Legacy fields
  isPremium?: boolean;
  planType?: string | null;
  isAdmin?: boolean;
};

/**
 * Default entitlements per plan
 */
const PLAN_ENTITLEMENTS: Record<PlanId, Entitlements> = {
  free: {
    criacao: false,
    finance: false,
    gestor: false,
    maxUsuarios: 1,
    maxProjetosAno: 1,
    creditosMensais: 30,
  },
  proponente: {
    criacao: true,
    finance: true,
    gestor: false,
    maxUsuarios: 1,
    maxProjetosAno: 3,
    creditosMensais: 0, // unlimited for paid plans
  },
  produtora: {
    criacao: true,
    finance: true,
    gestor: true,
    maxUsuarios: 5,
    maxProjetosAno: null, // unlimited
    creditosMensais: 0,
  },
  institucional: {
    criacao: true,
    finance: true,
    gestor: true,
    maxUsuarios: 999, // configurable, but high default
    maxProjetosAno: null,
    creditosMensais: 0,
  },
};

/**
 * Legacy mapping: old planType values to new PlanId
 */
const LEGACY_PLAN_MAP: Record<string, PlanId> = {
  basico: 'proponente',
  essencial: 'produtora',
  intermediario: 'produtora',
  premium: 'institucional',
  avancado: 'institucional',
};

/**
 * Derive entitlements from user data with legacy fallback
 * 
 * If entitlements field exists, use it directly.
 * Otherwise, derive from isPremium/planType (legacy mode):
 * - Gestor access only if planType==='gestor_pro' or plan in (produtora, institucional, gestor_pro) or isAdmin
 * - NEVER from isPremium alone (fixes cross-unlock bug)
 */
export function deriveEntitlements(data: UserEntitlementsData | null | undefined): Entitlements {
  if (!data) {
    return PLAN_ENTITLEMENTS.free;
  }

  // If new entitlements field exists, use it
  if (data.entitlements) {
    return data.entitlements;
  }

  // Legacy fallback: derive from isPremium/planType
  const planType = (data.planType || '').toString().toLowerCase();
  const isPremium = data.isPremium === true;
  const isAdmin = data.isAdmin === true;

  // Map legacy planType to new PlanId
  let planId: PlanId = 'free';
  
  if (planType && LEGACY_PLAN_MAP[planType]) {
    planId = LEGACY_PLAN_MAP[planType];
  } else if (isPremium) {
    // If isPremium but no recognized planType, treat as proponente (basic paid)
    planId = 'proponente';
  }

  // Get base entitlements for the plan
  const baseEntitlements = { ...PLAN_ENTITLEMENTS[planId] };

  // IMPORTANT: Override gestor access based on explicit rules
  // Gestor access only if:
  // 1. plan is produtora or institucional, OR
  // 2. isAdmin
  const hasGestorAccess =
    isAdmin ||
    planId === 'produtora' ||
    planId === 'institucional';

  baseEntitlements.gestor = hasGestorAccess;

  return baseEntitlements;
}

/**
 * Check if user has access to Criação module (captação/creation)
 */
export function hasCriacaoAccess(data: UserEntitlementsData | null | undefined): boolean {
  const entitlements = deriveEntitlements(data);
  return entitlements.criacao;
}

/**
 * Check if user has access to Finance module
 */
export function hasFinanceAccess(data: UserEntitlementsData | null | undefined): boolean {
  const entitlements = deriveEntitlements(data);
  return entitlements.finance;
}

/**
 * Check if user has access to Gestor module
 */
export function hasGestorAccess(data: UserEntitlementsData | null | undefined): boolean {
  const entitlements = deriveEntitlements(data);
  return entitlements.gestor;
}

/**
 * Check if user has any paid plan (criacao OR finance OR gestor)
 */
export function hasPaidPlan(data: UserEntitlementsData | null | undefined): boolean {
  const entitlements = deriveEntitlements(data);
  return entitlements.criacao || entitlements.finance || entitlements.gestor;
}

/**
 * Check if user is on free/starter plan
 */
export function isStarterPlan(data: UserEntitlementsData | null | undefined): boolean {
  return !hasPaidPlan(data);
}

/**
 * Get maximum number of projects per year for the user (null = unlimited)
 */
export function getMaxProjetosAno(data: UserEntitlementsData | null | undefined): number | null {
  const entitlements = deriveEntitlements(data);
  return entitlements.maxProjetosAno;
}

/**
 * Check if user can create a new project based on current count
 */
export function canCreateProject(
  data: UserEntitlementsData | null | undefined,
  currentProjectCount: number
): boolean {
  const maxProjects = getMaxProjetosAno(data);
  if (maxProjects === null) {
    return true; // unlimited
  }
  return currentProjectCount < maxProjects;
}

/**
 * Check if user has unlimited credits (paid plan)
 */
export function hasUnlimitedCredits(data: UserEntitlementsData | null | undefined): boolean {
  return hasPaidPlan(data);
}
