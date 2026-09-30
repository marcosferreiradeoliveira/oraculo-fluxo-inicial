import React from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';

export default function Header() {
  const [user] = useAuthState(auth);

  return (
    <header className="bg-white border-b border-gray-200 p-4 shadow-sm">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-900">Importar edital (PDF)</h1>
        {user?.email ? (
          <p className="text-sm text-gray-500 truncate max-w-[200px]">{user.email}</p>
        ) : null}
      </div>
    </header>
  );
}
