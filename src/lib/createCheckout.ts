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
  const returnTo =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/cadastro-premium';

  const response = await authenticatedPost(
    CHECKOUT_URL,
    {
      planType: params.planType,
      ciclo: params.ciclo,
      isAnnual: params.ciclo === 'anual',
    },
    { navigate: params.navigate, returnTo, waitForAuthMs: 10000 },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const msg =
      (errorData as { error?: string; message?: string }).error ||
      (errorData as { message?: string }).message ||
      JSON.stringify(errorData);
    throw new Error(`Erro ao criar checkout: ${response.status} - ${msg}`);
  }

  return response.json();
}
