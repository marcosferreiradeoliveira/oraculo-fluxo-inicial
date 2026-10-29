/**
 * Credit operations helper for unified entitlements model
 * 
 * Routes IA credit debits through consumirCreditos callable with fallback
 */

import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';

export type CreditAction = 'analise_projeto' | 'gerar_texto' | 'alterar_texto' | 'avaliar_edital';

const CREDIT_COSTS: Record<CreditAction, number> = {
  analise_projeto: 5,
  gerar_texto: 3,
  alterar_texto: 2,
  avaliar_edital: 5,
};

/**
 * Consume credits using the new consumirCreditos callable
 * Falls back to direct Firestore update if callable is not deployed
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

    // Try new consumirCreditos callable first
    try {
      console.log('[creditOperations] Tentando consumirCreditos callable:', { userId, acao });
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
        console.log('[creditOperations] Success from consumirCreditos:', data);
        
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
        console.log('[creditOperations] consumirCreditos não disponível (status ' + response.status + '), usando fallback');
      }
    } catch (err) {
      console.log('[creditOperations] consumirCreditos não disponível, usando fallback:', err);
    }

    // Fallback to direct Firestore update
    console.log('[creditOperations] Usando fallback Firestore direto');
    const userRef = doc(db, 'usuarios', userId);
    const cost = CREDIT_COSTS[acao] || 5;
    
    // Check current balance
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const currentCredits = typeof userSnap.data().creditos === 'number' 
        ? userSnap.data().creditos 
        : Number(userSnap.data().creditos ?? 0);
      
      if (currentCredits < cost) {
        return { success: false, error: 'Créditos insuficientes' };
      }

      await updateDoc(userRef, { creditos: increment(-cost) });
      const newBalance = Math.max(0, currentCredits - cost);
      
      if (onCreditsUpdated) {
        onCreditsUpdated(newBalance);
      }
      
      return { success: true, balance: newBalance };
    }

    return { success: false, error: 'Usuário não encontrado' };
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
