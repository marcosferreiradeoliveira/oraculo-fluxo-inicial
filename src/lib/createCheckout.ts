import { getFunctionsBaseUrl } from '@/lib/functionsUrl';
import { authenticatedPost } from '@/lib/iaAuthenticatedFetch';

const CHECKOUT_URL = `${getFunctionsBaseUrl()}/criarAssinaturaPremiumStripe`;

export type CheckoutPlanType = 'basico' | 'essencial';
export type CheckoutCiclo = 'anual' | 'mensal';

export async function createCheckout(params: {
  userId: string;
  email: string;
  planType: CheckoutPlanType;
  ciclo: CheckoutCiclo;
  navigate?: (path: string) => void;
}): Promise<{ checkout_url: string; session_id?: string }> {
  const response = await authenticatedPost(
    CHECKOUT_URL,
    {
      planType: params.planType,
      ciclo: params.ciclo,
      isAnnual: params.ciclo === 'anual',
    },
    { navigate: params.navigate },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Erro ao criar checkout: ${response.status} - ${JSON.stringify(errorData)}`,
    );
  }

  return response.json();
}
