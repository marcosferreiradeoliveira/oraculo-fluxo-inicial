import React, { useEffect, useState } from 'react';
import { Sparkles, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { Coins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { identifyMixpanelUser, trackIntentLogin } from '@/lib/analytics';

export function DashboardHeader() {
  const [user, setUser] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [creditos, setCreditos] = useState<number | null>(null);
  const [nomeUsuario, setNomeUsuario] = useState<string | null>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(null);

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
          setCreditos(typeof userData.creditos === 'number' ? userData.creditos : (userData.creditos ?? 0));
          
          // Identificar usuário no Mixpanel
          identifyMixpanelUser(firebaseUser.uid, {
            email: firebaseUser.email || userData.email,
            name: userData.nome_completo || firebaseUser.displayName,
            planType: userData.planType,
            isPremium: userData.isPremium === true,
            empresa: userData.empresa,
          });
          
          // Buscar foto do usuário no Firestore
          if (userData.photoURL) {
            setPhotoURL(userData.photoURL);
          } else if (firebaseUser.photoURL) {
            setPhotoURL(firebaseUser.photoURL);
          } else {
            setPhotoURL(null);
          }
          
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
          setCreditos(null);
        }
      } else {
        setNomeUsuario(null);
        setIsPremium(false);
        setCreditos(null);
        setPhotoURL(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Atualizar créditos (e isPremium) em tempo real quando o documento do usuário mudar
  useEffect(() => {
    if (!user?.uid) return;
    const db = getFirestore();
    const userDocRef = doc(db, 'usuarios', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setIsPremium(d?.isPremium === true);
        setCreditos(typeof d?.creditos === 'number' ? d.creditos : (d?.creditos ?? 0));
      }
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 relative z-40">
      <div className="flex items-center justify-end min-w-0">
        {/* User Section */}
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1 justify-end">

          {/* User Profile ou chamada para criar conta */}
          <div className="flex items-center space-x-2 sm:space-x-3 relative min-w-0 z-50">
            {user ? (
              <>
                <div className="text-right min-w-0 max-w-[50vw] sm:max-w-none">
                  <div className="text-sm font-medium text-gray-900">
                    <div className="flex items-center flex-wrap gap-2 justify-end">
                      <span className="truncate" title={nomeUsuario ? `Olá, ${nomeUsuario}` : 'Olá, usuário'}>Olá{nomeUsuario ? `, ${nomeUsuario}` : ', usuário'}</span>
                      {isPremium && <span className="px-2 py-0.5 text-xs font-bold text-white bg-yellow-500 rounded-full flex-shrink-0">PREMIUM</span>}
                      {!isPremium && creditos !== null && (
                        <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-full flex-shrink-0" title="Créditos para avaliação, textos, orçamento e cronograma">
                          <Coins className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                          <span className="hidden sm:inline">{creditos} {creditos === 1 ? 'crédito' : 'créditos'}</span>
                          <span className="sm:hidden">{creditos}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 truncate">Bem-vindo de volta</p>
                </div>
                <div className="relative group">
                  <Avatar className="cursor-pointer ring-2 ring-transparent group-hover:ring-oraculo-blue transition-all">
                    {photoURL || user.photoURL ? (
                      <AvatarImage src={photoURL || user.photoURL || ''} className="group-hover:opacity-0 transition-opacity duration-200" />
                    ) : null}
                    <AvatarFallback className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white">
                      {nomeUsuario ? nomeUsuario[0].toUpperCase() : (user.displayName || user.email || 'U')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {/* Botão de logoff no hover — z-[100] para ficar acima do conteúdo da página */}
                  <div className="absolute right-0 top-full mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-out z-[100] transform scale-95 group-hover:scale-100">
                    <button
                      className="flex items-center w-full px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-lg transition-colors whitespace-nowrap"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sair
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-right flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-oraculo-blue" />
                <Link to="/cadastro?mode=login" onClick={() => trackIntentLogin({ source: 'header' })}>
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
