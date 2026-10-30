/**
 * Credit operations — debits via consumirCreditos callable (cultura-fluxo-finance).
 */

import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FirebaseError } from 'firebase/app';
import { app, db } from './firebase';

export type CreditAction =
  | 'analise_projeto'
  | 'avaliar_projeto'
  | 'gerar_texto'
  | 'gerar_cronograma'
  | 'gerar_orcamento';

const CREDIT_COSTS: Record<CreditAction, number> = {
  analise_projeto: 5,
  avaliar_projeto: 5,
  gerar_texto: 1,
  gerar_cronograma: 3,
  gerar_orcamento: 3,
};

type ConsumirCreditosResult = {
  saldoRestante?: number;
  custoAcao?: number;
  acao?: string;
};

export async function consumirCreditos(
  _userId: string,
  acao: CreditAction,
  options: {
    onCreditsUpdated?: (newBalance: number) => void;
  } = {},
): Promise<{ success: boolean; balance?: number; error?: string }> {
  const { onCreditsUpdated } = options;

  try {
    const functions = getFunctions(app, 'us-central1');
    const callable = httpsCallable<{ acao: CreditAction }, ConsumirCreditosResult>(
      functions,
      'consumirCreditos',
    );
    const result = await callable({ acao });
    const balance = result.data.saldoRestante;
    if (onCreditsUpdated && typeof balance === 'number') {
      onCreditsUpdated(balance);
    }
    return { success: true, balance };
  } catch (error) {
    if (error instanceof FirebaseError) {
      if (error.code === 'functions/resource-exhausted') {
        return { success: false, error: error.message || 'Créditos insuficientes' };
      }
      if (error.code === 'functions/unauthenticated') {
        return { success: false, error: 'Faça login para usar créditos.' };
      }
    }
    console.error('[creditOperations] Erro ao consumir créditos:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao processar créditos',
    };
  }
}

export async function hasEnoughCredits(userId: string, acao: CreditAction): Promise<boolean> {
  try {
    const userRef = doc(db, 'usuarios', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return false;
    }

    const userData = userSnap.data();
    const currentCredits =
      typeof userData.creditos === 'number'
        ? userData.creditos
        : Number(userData.creditos ?? 0);

    const cost = CREDIT_COSTS[acao] ?? 5;
    return currentCredits >= cost;
  } catch (error) {
    console.error('[creditOperations] Erro ao verificar créditos:', error);
    return false;
  }
}

export function getCreditCost(acao: CreditAction): number {
  return CREDIT_COSTS[acao] ?? 5;
}
