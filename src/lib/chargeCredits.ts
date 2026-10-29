import { doc, getDoc, updateDoc, increment, type Firestore } from 'firebase/firestore';
import { hasPaidPlan, starterHasCreditsFor, starterPaywallUrl } from '@/lib/starterPlan';

export async function assertCanSpendCredits(
  db: Firestore,
  userId: string,
  cost: number,
  navigate: (path: string) => void,
): Promise<boolean> {
  const snap = await getDoc(doc(db, 'usuarios', userId));
  const data = snap.exists() ? snap.data() : null;
  if (hasPaidPlan(data)) return true;
  const creditos = typeof data?.creditos === 'number' ? data.creditos : Number(data?.creditos ?? 0);
  if (!starterHasCreditsFor(cost, creditos)) {
    navigate(starterPaywallUrl('creditos_insuficientes'));
    return false;
  }
  return true;
}

export async function spendCreditsIfStarter(db: Firestore, userId: string, cost: number): Promise<void> {
  const snap = await getDoc(doc(db, 'usuarios', userId));
  const data = snap.exists() ? snap.data() : null;
  if (hasPaidPlan(data)) return;
  await updateDoc(doc(db, 'usuarios', userId), { creditos: increment(-cost) });
}
