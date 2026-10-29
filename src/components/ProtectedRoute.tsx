import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { AppShellSkeleton } from '@/components/AppShellSkeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireEmailVerification?: boolean;
}

export function ProtectedRoute({ children, requireEmailVerification = false }: ProtectedRouteProps) {
  const [user, loading] = useAuthState(auth);
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        const returnTo = `${location.pathname}${location.search}`;
        const redirect =
          returnTo && returnTo !== '/cadastro'
            ? `?redirect=${encodeURIComponent(returnTo)}`
            : '';
        navigate(`/cadastro${redirect}`);
      } else {
        // COMENTADO: Verificação de email confirmado
        // if (requireEmailVerification && !user.emailVerified) {
        //   setChecking(false);
        // } else {
        //   setChecking(false);
        // }
        setChecking(false);
      }
    }
  }, [user, loading, navigate, requireEmailVerification, location.pathname, location.search]);

  if (loading || checking) {
    return <AppShellSkeleton />;
  }

  if (!user) {
    return null; // Redirecionamento em andamento
  }

  // COMENTADO: Verificação de email confirmado
  // if (requireEmailVerification && !user.emailVerified) {
  //   return <ConfirmarEmail />;
  // }

  return <>{children}</>;
}

