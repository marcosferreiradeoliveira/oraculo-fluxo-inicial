import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { hasPaidPlan, starterPaywallUrl } from '@/lib/starterPlan';

type Props = {
  children: React.ReactNode;
};

/** Bloqueia Módulo 2+ (textos, orçamento, cronograma…) para plano Starter. */
export function StarterPlanGuard({ children }: Props) {
  const [user, loadingAuth] = useAuthState(auth);
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (loadingAuth) return;

    if (!user) {
      navigate('/cadastro');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        const data = snap.exists() ? snap.data() : null;
        if (hasPaidPlan(data)) {
          if (!cancelled) setAllowed(true);
          return;
        }
        navigate(starterPaywallUrl('starter_modulo2'));
      } catch {
        navigate(starterPaywallUrl('starter_modulo2'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loadingAuth, navigate]);

  if (loadingAuth || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oraculo-blue" />
      </div>
    );
  }

  return <>{children}</>;
}
