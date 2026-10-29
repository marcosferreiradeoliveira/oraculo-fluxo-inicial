const CHECKOUT_URL =
  'https://us-central1-culturalapp-fb9b0.cloudfunctions.net/criarAssinaturaPremiumStripe';

export type CheckoutPlanType = 'basico' | 'essencial';
export type CheckoutCiclo = 'anual' | 'mensal';

export async function createCheckout(params: {
  userId: string;
  email: string;
  planType: CheckoutPlanType;
  ciclo: CheckoutCiclo;
}): Promise<{ checkout_url: string; session_id?: string }> {
  const response = await fetch(CHECKOUT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: params.userId,
      email: params.email,
      planType: params.planType,
      ciclo: params.ciclo,
      isAnnual: params.ciclo === 'anual',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Erro ao criar checkout: ${response.status} - ${JSON.stringify(errorData)}`,
    );
  }

  return response.json();
}
