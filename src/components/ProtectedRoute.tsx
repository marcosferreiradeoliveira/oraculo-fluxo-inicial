import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import ConfirmarEmail from '@/pages/ConfirmarEmail';

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
        const params = new URLSearchParams(location.search);
        const convite = params.get('convite');
        if (location.pathname === '/empresas' && convite) {
          navigate(`/primeiro-acesso?resolver=${encodeURIComponent(convite)}`, {
            replace: true,
          });
          return;
        }

        const returnTo = `${location.pathname}${location.search}`;
        const q =
          returnTo && returnTo !== '/cadastro'
            ? `?redirect=${encodeURIComponent(returnTo)}`
            : '';
        navigate(`/cadastro${q}`, { replace: true });
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
  }, [user, loading, navigate, location.pathname, location.search, requireEmailVerification]);

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oraculo-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
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

