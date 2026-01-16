import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/cadastro');
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
  }, [user, loading, navigate, requireEmailVerification]);

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

