import React, { useEffect, useState } from 'react';
import { Search, Bell, Sparkles, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';

export function DashboardHeader() {
  const [user, setUser] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [nomeUsuario, setNomeUsuario] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
          if (firebaseUser) {
            const db = getFirestore();
            const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              setIsPremium(userDoc.data().isPremium === true);
            }
          }
      if (firebaseUser) {
        // Buscar nome na collection usuarios
        try {
          const db = getFirestore();
          const q = query(collection(db, 'usuarios'), where('uid', '==', firebaseUser.uid));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const doc = snap.docs[0].data();
            setNomeUsuario(doc.nome_completo.split(' ')[0]);
          } else {
            setNomeUsuario(firebaseUser.displayName ? firebaseUser.displayName.split(' ')[0] : 'usuário');
          }
        } catch {
          setNomeUsuario(firebaseUser.displayName ? firebaseUser.displayName.split(' ')[0] : 'usuário');
        }
      } else {
        setNomeUsuario(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setShowMenu(false);
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Search Bar */}
        <div className="flex-1 max-w-2xl relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input
            placeholder="Buscar em toda a plataforma..."
            className="pl-10 pr-4 py-2 w-full bg-gray-50 border-gray-200 focus:border-oraculo-blue focus:ring-oraculo-blue"
          />
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5 text-gray-600" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-oraculo-magenta rounded-full"></span>
          </Button>

          {/* User Profile ou chamada para criar conta */}
          <div className="flex items-center space-x-3 relative">
            {user ? (
              <>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    <div className="flex items-center">
                      <span>Olá{nomeUsuario ? `, ${nomeUsuario}` : ','}</span>
                      {isPremium && <span className="ml-2 px-2 py-0.5 text-xs font-bold text-white bg-yellow-500 rounded-full">PREMIUM</span>}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">Bem-vindo de volta</p>
                </div>
                <button
                  className="focus:outline-none"
                  onClick={() => setShowMenu((v) => !v)}
                  aria-label="Abrir menu do usuário"
                >
                  <Avatar>
                    {user.photoURL ? (
                      <AvatarImage src={user.photoURL} />
                    ) : (
                      <AvatarFallback className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white">
                        {nomeUsuario ? nomeUsuario[0] : (user.displayName || user.email)[0]}
                      </AvatarFallback>
                    )}
                  </Avatar>
                </button>
                {showMenu && (
                  <div className="absolute right-0 mt-2 w-40 bg-white border rounded-lg shadow-lg z-50">
                    <button
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-right flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-oraculo-blue" />
                <Link to="/cadastro">
                  <Button size="sm" className="mt-0.5 bg-oraculo-blue text-white hover:bg-oraculo-purple">
                    Criar conta
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
