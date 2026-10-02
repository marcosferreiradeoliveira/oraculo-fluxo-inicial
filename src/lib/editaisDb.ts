import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { db as primaryDb } from '@/lib/firebase';

/** App web culturalapp-fb9b0 — só leitura pública de `editais` (rules: allow read: if true). */
const CULTURALAPP_CATALOG_CONFIG = {
  apiKey: 'AIzaSyACnggZbrdBu8vdVhga2qQH5LF95qgHixA',
  authDomain: 'culturalapp-fb9b0.firebaseapp.com',
  projectId: 'culturalapp-fb9b0',
  storageBucket: 'culturalapp-fb9b0.firebasestorage.app',
  messagingSenderId: '665760404958',
  appId: '1:665760404958:web:79fc4ab3607eb0db51f94f',
} as const;

const CATALOG_APP_NAME = 'edital-catalog-culturalapp';

export type EditaisCatalogSource = 'local' | 'culturalapp';

export function editaisCatalogSource(): EditaisCatalogSource {
  const v = (import.meta.env.VITE_EDITAIS_CATALOG as string | undefined)?.trim().toLowerCase();
  if (v === 'culturalapp' || v === 'culturalapp-fb9b0' || v === 'roxo') return 'culturalapp';
  return 'local';
}

function getCatalogApp(): FirebaseApp {
  const existing = getApps().find((a) => a.name === CATALOG_APP_NAME);
  if (existing) return existing;
  return initializeApp(CULTURALAPP_CATALOG_CONFIG, CATALOG_APP_NAME);
}

/** Firestore usado para **ler** editais (listagens, detalhe, textos do edital no fluxo IA). */
export function getEditaisDb(): Firestore {
  if (editaisCatalogSource() === 'culturalapp') {
    return getFirestore(getCatalogApp());
  }
  return primaryDb;
}

/** Onde **gravar** editais (cadastro/extrator/admin) — sempre o projeto principal do app. */
export function getEditaisWriteDb(): Firestore {
  return primaryDb;
}

export function isEditaisCatalogExternal(): boolean {
  return editaisCatalogSource() === 'culturalapp';
}
