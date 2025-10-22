import React, { useEffect, useState } from 'react';
import { Sparkles, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';

export function DashboardHeader() {
  const [user, setUser] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [nomeUsuario, setNomeUsuario] = useState<string | null>(null);

  const fixEmptyNomeCompleto = async (userDocRef: any, firebaseUser: any) => {
    try {
      const nomeCompleto = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário';
      await updateDoc(userDocRef, {
        nome_completo: nomeCompleto
      });
      console.log('Campo nome_completo corrigido para:', nomeCompleto);
      return nomeCompleto;
    } catch (error) {
      console.error('Erro ao corrigir nome_completo:', error);
      return firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário';
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const db = getFirestore();
        const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
        
        // Forçar nova leitura sem cache
        const userDoc = await getDoc(userDocRef);
        
        // Verificar se há múltiplos documentos para o mesmo UID
        console.log('UID do usuário:', firebaseUser.uid);
        console.log('Documento ID sendo lido:', userDocRef.id);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('Dados do usuário:', userData);
          console.log('Nome completo raw:', userData.nome_completo);
          console.log('Tipo do nome_completo:', typeof userData.nome_completo);
          console.log('Nome completo length:', userData.nome_completo?.length);
          console.log('Todas as chaves do documento:', Object.keys(userData));
          console.log('Verificando se nome_completo existe:', 'nome_completo' in userData);
          console.log('Valor exato do nome_completo:', JSON.stringify(userData.nome_completo));
          
          // Debug específico para isPremium
          console.log('isPremium raw:', userData.isPremium);
          console.log('Tipo do isPremium:', typeof userData.isPremium);
          console.log('isPremium === true:', userData.isPremium === true);
          console.log('isPremium == true:', userData.isPremium == true);
          console.log('Boolean(isPremium):', Boolean(userData.isPremium));
          
          setIsPremium(userData.isPremium === true);
          // Buscar nome na collection usuarios
          if (userData.nome_completo && userData.nome_completo.trim()) {
            const primeiroNome = userData.nome_completo.trim().split(' ')[0];
            console.log('Nome encontrado no Firestore:', primeiroNome);
            setNomeUsuario(primeiroNome);
          } else {
            console.log('Nome completo vazio, corrigindo automaticamente...');
            const nomeCorrigido = await fixEmptyNomeCompleto(userDocRef, firebaseUser);
            const primeiroNome = nomeCorrigido.split(' ')[0];
            setNomeUsuario(primeiroNome);
          }
        } else {
          const displayName = firebaseUser.displayName ? firebaseUser.displayName.split(' ')[0] : 'usuário';
          console.log('Usuário não encontrado no Firestore, usando displayName:', displayName);
          setNomeUsuario(displayName);
        }
      } else {
        setNomeUsuario(null);
        setIsPremium(false);
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
      <div className="flex items-center justify-end">
        {/* User Section */}
        <div className="flex items-center space-x-4">

          {/* User Profile ou chamada para criar conta */}
          <div className="flex items-center space-x-3 relative">
            {user ? (
              <>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    <div className="flex items-center">
                      <span>Olá{nomeUsuario ? `, ${nomeUsuario}` : ', usuário'}</span>
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
                    Acessar Conta
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
