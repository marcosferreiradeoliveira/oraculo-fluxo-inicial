import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { bumpAccessCountIfNewSession, deveMostrarFormularioPerfil } from '@/lib/perfilUsuario';

const PATHS_SEM_GATE = new Set(['/cadastro', '/termos', '/privacidade']);

/** A partir do 2º acesso (nova sessão), redireciona para completar perfil se ainda não coletado. */
export function PerfilCompletionGate() {
  const [user, loading] = useAuthState(auth);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    if (PATHS_SEM_GATE.has(location.pathname)) return;

    let cancelled = false;
    (async () => {
      const access = bumpAccessCountIfNewSession(user.uid);
      const snap = await getDoc(doc(getFirestore(), 'usuarios', user.uid));
      if (cancelled) return;
      if (!deveMostrarFormularioPerfil(snap.data(), access)) return;

      const returnTo = `${location.pathname}${location.search}`;
      const qs = new URLSearchParams({
        completar: 'perfil',
        redirect: returnTo.startsWith('/') ? returnTo : '/',
      });
      navigate(`/cadastro?${qs.toString()}`, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, location.pathname, location.search, navigate]);

  return null;
}
