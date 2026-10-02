import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, getFirestore, updateDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { identifyMixpanelUser } from '@/lib/analytics';

async function fixEmptyNomeCompleto(userDocRef: ReturnType<typeof doc>, firebaseUser: User) {
  try {
    const nomeCompleto = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário';
    await updateDoc(userDocRef, { nome_completo: nomeCompleto });
    return nomeCompleto;
  } catch (error) {
    console.error('Erro ao corrigir nome_completo:', error);
    return firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário';
  }
}

export function useDashboardUser() {
  const [user, setUser] = useState<User | null>(null);
  const [nomeUsuario, setNomeUsuario] = useState<string | null>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const db = getFirestore();
        const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          identifyMixpanelUser(firebaseUser.uid, {
            email: firebaseUser.email || userData.email,
            name: userData.nome_completo || firebaseUser.displayName,
            empresa: userData.empresa,
          });

          if (userData.photoURL) setPhotoURL(userData.photoURL);
          else if (firebaseUser.photoURL) setPhotoURL(firebaseUser.photoURL);
          else setPhotoURL(null);

          if (userData.nome_completo?.trim()) {
            setNomeUsuario(userData.nome_completo.trim().split(' ')[0]);
          } else {
            const nomeCorrigido = await fixEmptyNomeCompleto(userDocRef, firebaseUser);
            setNomeUsuario(nomeCorrigido.split(' ')[0]);
          }
        } else {
          const displayName = firebaseUser.displayName
            ? firebaseUser.displayName.split(' ')[0]
            : 'usuário';
          setNomeUsuario(displayName);
          setPhotoURL(firebaseUser.photoURL ?? null);
        }
      } else {
        setNomeUsuario(null);
        setPhotoURL(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { user, nomeUsuario, photoURL, loading };
}
