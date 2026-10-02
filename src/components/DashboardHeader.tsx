import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';
import { trackIntentLogin } from '@/lib/analytics';
import { useDashboardUser } from '@/hooks/useDashboardUser';

export function DashboardHeader() {
  const { user, nomeUsuario, photoURL, loading } = useDashboardUser();

  if (loading) {
    return <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 min-h-[73px]" aria-hidden />;
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 relative z-40">
      <div className="flex items-center justify-end min-w-0">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          {user ? (
            <>
              <div className="text-right min-w-0 max-w-[50vw] sm:max-w-none">
                <p className="text-sm font-medium text-gray-900 truncate">
                  Olá{nomeUsuario ? `, ${nomeUsuario}` : ', usuário'}
                </p>
                <p className="text-xs text-gray-500 truncate">Bem-vindo de volta</p>
              </div>
              <Link to="/conta" className="shrink-0">
                <Avatar className="ring-2 ring-transparent hover:ring-oraculo-blue transition-all">
                  {photoURL || user.photoURL ? (
                    <AvatarImage src={photoURL || user.photoURL || ''} alt="" />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white">
                    {(nomeUsuario?.[0] || user.email?.[0] || 'U').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 text-oraculo-blue" />
              <Link to="/cadastro?mode=login" onClick={() => trackIntentLogin({ source: 'header' })}>
                <Button size="sm" className="bg-oraculo-blue text-white hover:bg-oraculo-dark-blue">
                  Acessar Conta
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
