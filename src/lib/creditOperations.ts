/**
 * Credit operations helper for unified entitlements model
 * 
 * Routes IA credit debits through consumirCreditos callable with NO fallback
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Credit action types - must match server-side plans.ts in cultura-fluxo-finance
 * Costs from spec: análise/avaliação 5, gerar texto 1, cronograma 3, orçamento 3
 */
export type CreditAction = 
  | 'analise_projeto'      // 5 credits
  | 'avaliar_projeto'      // 5 credits (same as analise)
  | 'gerar_texto'          // 1 credit
  | 'gerar_cronograma'     // 3 credits
  | 'gerar_orcamento';     // 3 credits

/**
 * Client-side reference costs (informational only)
 * Server is authoritative - these should match cultura-fluxo-finance plans.ts
 */
const CREDIT_COSTS: Record<CreditAction, number> = {
  analise_projeto: 5,
  avaliar_projeto: 5,
  gerar_texto: 1,
  gerar_cronograma: 3,
  gerar_orcamento: 3,
};

/**
 * Consume credits using the new consumirCreditos callable
 * NO Firestore fallback - new rules forbid clients writing creditos
 */
export async function consumirCreditos(
  userId: string,
  acao: CreditAction,
  options: {
    skipIfPremium?: boolean;
    onCreditsUpdated?: (newBalance: number) => void;
  } = {}
): Promise<{ success: boolean; balance?: number; error?: string }> {
  const { skipIfPremium = true, onCreditsUpdated } = options;

  try {
    // Check if user is premium (has unlimited credits)
    if (skipIfPremium) {
      const userRef = doc(db, 'usuarios', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        // Check both new entitlements and legacy isPremium
        const isPremium = userData.isPremium === true;
        const hasPaidAccess = userData.entitlements?.criacao === true || 
                              userData.entitlements?.finance === true || 
                              userData.entitlements?.gestor === true;
        
        if (isPremium || hasPaidAccess) {
          console.log('[creditOperations] Usuário premium, créditos ilimitados');
          return { success: true, balance: -1 }; // -1 indicates unlimited
        }
      }
    }

    // Call consumirCreditos callable
    try {
      console.log('[creditOperations] Chamando consumirCreditos callable:', { userId, acao });
      const response = await fetch('https://us-central1-culturalapp-fb9b0.cloudfunctions.net/consumirCreditos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            acao,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[creditOperations] Sucesso do consumirCreditos:', data);
        
        const result = data.result || data;
        if (result.success) {
          const newBalance = result.balance ?? result.saldoRestante;
          if (onCreditsUpdated && typeof newBalance === 'number') {
            onCreditsUpdated(newBalance);
          }
          return { success: true, balance: newBalance };
        } else {
          return { success: false, error: result.error || 'Créditos insuficientes' };
        }
      } else {
        console.error('[creditOperations] consumirCreditos falhou com status:', response.status);
        const errorText = await response.text();
        console.error('[creditOperations] Resposta de erro:', errorText);
      }
    } catch (err) {
      console.error('[creditOperations] Erro ao chamar consumirCreditos:', err);
    }

    // No fallback: new Firestore rules forbid clients writing creditos
    // If consumirCreditos is unavailable, return error
    console.error('[creditOperations] consumirCreditos não disponível e fallback desabilitado');
    return { 
      success: false, 
      error: 'Serviço de créditos indisponível. Por favor, tente novamente em alguns instantes.' 
    };
  } catch (error) {
    console.error('[creditOperations] Erro ao consumir créditos:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Check if user has sufficient credits for an action
 */
export async function hasEnoughCredits(
  userId: string,
  acao: CreditAction
): Promise<boolean> {
  try {
    const userRef = doc(db, 'usuarios', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return false;
    }

    const userData = userSnap.data();
    
    // Check if premium (unlimited credits)
    const isPremium = userData.isPremium === true;
    const hasPaidAccess = userData.entitlements?.criacao === true || 
                          userData.entitlements?.finance === true || 
                          userData.entitlements?.gestor === true;
    
    if (isPremium || hasPaidAccess) {
      return true;
    }

    const currentCredits = typeof userData.creditos === 'number' 
      ? userData.creditos 
      : Number(userData.creditos ?? 0);
    
    const cost = CREDIT_COSTS[acao] || 5;
    return currentCredits >= cost;
  } catch (error) {
    console.error('[creditOperations] Erro ao verificar créditos:', error);
    return false;
  }
}

/**
 * Get credit cost for an action
 */
export function getCreditCost(acao: CreditAction): number {
  return CREDIT_COSTS[acao] || 5;
}
