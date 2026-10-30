import type { FieldValue } from 'firebase/firestore';

export type UsuarioFirestoreBasico = {
  perfil_dados_coletados?: boolean;
  nome_completo?: string;
  empresa?: string;
};

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

/** Campos que o cliente pode gravar na criação — role/creditos/isPremium ficam no servidor. */
export function buildNovoUsuarioFirestore(params: {
  uid: string;
  email: string;
  nomeCompletoInicial?: string;
  timestamp: FieldValue;
  attribution?: Record<string, string>;
}): Record<string, unknown> {
  const { uid, email, nomeCompletoInicial, timestamp, attribution } = params;
  const origemLead = attribution?.origem?.trim() || attribution?.utm_source?.trim() || 'captacao';
  return {
    uid,
    email,
    nome_completo: nomeCompletoInicial?.trim() || '',
    data_cadastro: timestamp,
    origem: origemLead,
    perfil_dados_coletados: false,
    ...(attribution?.utm_campaign ? { utm_campaign: attribution.utm_campaign } : {}),
    ...(attribution?.utm_content ? { utm_content: attribution.utm_content } : {}),
    ...(attribution?.utm_medium ? { utm_medium: attribution.utm_medium } : {}),
    ...(attribution?.utm_source ? { utm_source: attribution.utm_source } : {}),
    ...(attribution?.utm_term ? { utm_term: attribution.utm_term } : {}),
  };
}
