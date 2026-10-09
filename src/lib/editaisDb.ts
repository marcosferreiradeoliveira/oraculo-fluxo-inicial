import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { collection, getDocs, getFirestore, type Firestore } from 'firebase/firestore';
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

  const profile = (import.meta.env.VITE_FIREBASE_PROFILE as string | undefined)?.trim().toLowerCase();
  if (profile === 'oraculo-is') return 'local';
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

/** Catálogo + editais importados localmente (quando leitura aponta para culturalapp). */
export async function fetchEditaisMergedDocs(): Promise<Array<{ id: string; data: () => Record<string, unknown> }>> {
  const byId = new Map<string, Record<string, unknown>>();

  const ingest = async (db: Firestore, optional = false) => {
    try {
      const snap = await getDocs(collection(db, 'editais'));
      snap.docs.forEach((d) => {
        byId.set(d.id, { id: d.id, ...d.data() });
      });
    } catch (err) {
      if (!optional) throw err;
      if (import.meta.env.DEV) {
        console.warn('[editais] leitura opcional falhou (projeto local):', err);
      }
    }
  };

  await ingest(getEditaisDb());
  if (isEditaisCatalogExternal()) {
    await ingest(getEditaisWriteDb(), true);
  }

  return Array.from(byId.entries()).map(([id, data]) => ({
    id,
    data: () => data,
  }));
}
