import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** Garante doc em `usuarios/{uid}` (login / criar projeto). Evita permission-denied em updates. */
export async function ensureUsuarioFirestore(user: User): Promise<void> {
  const userDocRef = doc(db, 'usuarios', user.uid);
  const snap = await getDoc(userDocRef);
  const timestamp = serverTimestamp();
  const email = user.email?.trim() || '';

  if (!snap.exists()) {
    await setDoc(userDocRef, {
      uid: user.uid,
      email,
      nome_completo: user.displayName || email.split('@')[0] || 'Usuário',
      createdAt: timestamp,
      data_cadastro: timestamp,
      lastLoginAt: timestamp,
      ultimo_login: timestamp,
      origem: 'oraculo_is',
      projetos_criados_count: 0,
      role: 'super_admin',
      empresa: '',
      portfolio: '',
      equipeBio: '',
      dadosCadastrais: '',
    });
    return;
  }

  await setDoc(
    userDocRef,
    {
      lastLoginAt: timestamp,
      ultimo_login: timestamp,
      ...(email ? { email } : {}),
    },
    { merge: true }
  );
}
