import { db, storage } from '@/lib/firebase';
import { assignLandingFieldsForNewEdital, getEditalLandingPublicUrl } from '@/lib/editalLandingFirestore';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  updateDoc,
  deleteDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { EditalData } from '@/modules/extrator-edital/types';

const COLLECTION_NAME = 'editais';

export interface AnaliseEdital extends EditalData {
  id?: string;
  dataAnalise: Date;
  nomeArquivo: string;
  status: 'sucesso' | 'erro';
  erro?: string;
  landing_slug?: string;
  landing_ativa?: boolean;
  pdf_url?: string;
}

function toTimestamp(value: unknown): Timestamp | unknown {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Timestamp.fromDate(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return Timestamp.fromDate(d);
  }
  return value;
}

function mapDoc(id: string, data: Record<string, unknown>): AnaliseEdital {
  const processed: Record<string, unknown> = { ...data };
  for (const key of ['dataAnalise', 'dataEncerramento', 'data_encerramento', 'dataAtualizacao', 'criado_em'] as const) {
    const v = processed[key];
    if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
      processed[key] = (v as { toDate: () => Date }).toDate();
    }
  }
  return { id, ...processed } as AnaliseEdital;
}

export async function salvarAnalise(
  analise: Omit<AnaliseEdital, 'id' | 'dataAnalise'>,
  pdfFile?: File | null
): Promise<{ id: string; landingSlug?: string }> {
  const payload: Record<string, unknown> = {
    ...analise,
    dataEncerramento: toTimestamp(analise.dataEncerramento),
    data_encerramento: toTimestamp(analise.data_encerramento),
    criado_em: Timestamp.now(),
  };

  if (pdfFile) {
    const pdfRef = storageRef(storage, `editais/${Date.now()}_${pdfFile.name}`);
    await uploadBytes(pdfRef, pdfFile);
    payload.pdf_url = await getDownloadURL(pdfRef);
  }

  await assignLandingFieldsForNewEdital(payload);

  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...payload,
    dataAnalise: Timestamp.now(),
  });

  const landingSlug =
    typeof payload.landing_slug === 'string' ? payload.landing_slug : undefined;

  return { id: docRef.id, landingSlug };
}

export async function obterHistoricoAnalises(limite: number = 10): Promise<AnaliseEdital[]> {
  const q = query(collection(db, COLLECTION_NAME), orderBy('dataAnalise', 'desc'), limit(limite));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>));
}

export async function obterTodasAnalises(): Promise<AnaliseEdital[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('dataAnalise', 'desc'));
    const orderedSnapshot = await getDocs(q);
    return orderedSnapshot.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>));
  } catch {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    return querySnapshot.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>));
  }
}

export async function atualizarAnalise(id: string, dadosAtualizados: Partial<AnaliseEdital>): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    ...dadosAtualizados,
    dataAtualizacao: Timestamp.now(),
  });
}

export async function excluirAnalise(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

export async function buscarAnalisesPorProponente(proponente: string): Promise<AnaliseEdital[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('proponente', '==', proponente),
    orderBy('dataAnalise', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>));
}
