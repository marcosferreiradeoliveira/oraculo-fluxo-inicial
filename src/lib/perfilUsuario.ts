import type { FieldValue } from 'firebase/firestore';

export type UsuarioFirestoreBasico = {
  perfil_dados_coletados?: boolean;
  nome_completo?: string;
  empresa?: string;
};

const SUPER_ADMIN_EMAIL = 'marcosferreira@mobcontent.com.br';

/** Role inicial no Firestore — só o e-mail da plataforma recebe super_admin. */
export function roleForNewUsuario(email: string): string {
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL ? 'super_admin' : 'user';
}

/** Primeira visita = 1; cada nova sessão no navegador incrementa. */
export function bumpAccessCountIfNewSession(uid: string): number {
  const sessKey = `oraculo_access_sess_${uid}`;
  const storageKey = `oraculo_access_${uid}`;
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessKey)) {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
    return Math.max(1, parseInt(stored || '1', 10));
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(sessKey, '1');
  }
  const prev = typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem(storageKey) || '0', 10) : 0;
  const next = prev + 1;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(storageKey, String(next));
  }
  return next;
}

export function precisaColetarPerfil(data: UsuarioFirestoreBasico | undefined): boolean {
  if (!data) return false;
  return data.perfil_dados_coletados !== true;
}

export function deveMostrarFormularioPerfil(
  data: UsuarioFirestoreBasico | undefined,
  accessCount: number,
): boolean {
  return accessCount >= 2 && precisaColetarPerfil(data);
}

export function buildNovoUsuarioFirestore(params: {
  uid: string;
  email: string;
  nomeCompletoInicial?: string;
  timestamp: FieldValue;
}): Record<string, unknown> {
  const { uid, email, nomeCompletoInicial, timestamp } = params;
  return {
    createdAt: timestamp,
    // creditos is set by server via auth onCreate trigger (30 for free users)
    dadosCadastrais: '',
    data_cadastro: timestamp,
    email,
    empresa: '',
    equipeBio: '',
    lastLoginAt: timestamp,
    nome_completo: nomeCompletoInicial?.trim() || '',
    perfil_dados_coletados: false,
    origem: 'captacao',
    portfolio: '',
    role: roleForNewUsuario(email),
    ultimo_login: timestamp,
    uid,
  };
}
