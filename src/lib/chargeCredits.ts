import { hasEnoughCredits, type CreditAction } from '@/lib/creditOperations';
import { starterPaywallUrl } from '@/lib/starterPlan';

export async function assertCanSpendCredits(
  userId: string,
  acao: CreditAction,
  navigate: (path: string) => void,
): Promise<boolean> {
  const ok = await hasEnoughCredits(userId, acao);
  if (!ok) {
    navigate(starterPaywallUrl('creditos_insuficientes'));
    return false;
  }
  return true;
}
