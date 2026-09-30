import React from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';

interface HeaderProps {
  abaAtiva: 'analisar' | 'dashboard';
  onAbaChange: (aba: 'analisar' | 'dashboard') => void;
}

export default function Header({ abaAtiva, onAbaChange }: HeaderProps) {
  const [user] = useAuthState(auth);

  return (
    <header className="bg-white border-b border-gray-200 p-4 shadow-sm">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-gray-900">Gerenciador de editais</h1>
          {user?.email ? (
            <p className="text-sm text-gray-500 truncate max-w-[200px]">{user.email}</p>
          ) : null}
        </div>

        <nav className="flex space-x-1">
          <button
            type="button"
            onClick={() => onAbaChange('analisar')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
              abaAtiva === 'analisar'
                ? 'bg-oraculo-purple/10 text-oraculo-purple'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Importar PDF
          </button>
          <button
            type="button"
            onClick={() => onAbaChange('dashboard')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
              abaAtiva === 'dashboard'
                ? 'bg-oraculo-purple/10 text-oraculo-purple'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Todos os editais
          </button>
        </nav>
      </div>
    </header>
  );
}
