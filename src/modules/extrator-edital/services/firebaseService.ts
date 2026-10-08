import { auth, storage } from '@/lib/firebase';
import { getEditaisWriteDb } from '@/lib/editaisDb';
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

function editaisCol() {
  return collection(getEditaisWriteDb(), COLLECTION_NAME);
}

function editalDoc(id: string) {
  return doc(getEditaisWriteDb(), COLLECTION_NAME, id);
}

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

const MAX_TEXTO_EDITAL_CHARS = 450_000;

function sanitizePdfFileName(name: string): string {
  return name.replace(/[^\w.\-()+\s]/gi, '_').slice(0, 120) || 'edital.pdf';
}

export type SalvarAnaliseOptions = {
  pdfFile?: File | null;
  /** Texto extraído do PDF — gravado no Firestore (projeto logado), sem depender de Storage. */
  textoPdf?: string;
};

export async function salvarAnalise(
  analise: Omit<AnaliseEdital, 'id' | 'dataAnalise'>,
  options?: SalvarAnaliseOptions
): Promise<{ id: string; pdfUrl?: string }> {
  const uid = auth.currentUser?.uid;
  const pdfFile = options?.pdfFile ?? null;
  const textoPdf = options?.textoPdf?.trim() ?? '';

  const payload: Record<string, unknown> = {
    ...analise,
    dataEncerramento: toTimestamp(analise.dataEncerramento),
    data_encerramento: toTimestamp(analise.data_encerramento),
    criado_em: Timestamp.now(),
  };

  if (uid) {
    payload.importado_por_uid = uid;
  }

  if (textoPdf) {
    payload.texto_edital = textoPdf.slice(0, MAX_TEXTO_EDITAL_CHARS);
    if (textoPdf.length > MAX_TEXTO_EDITAL_CHARS) {
      payload.texto_edital_truncado = true;
    }
  }

  if (pdfFile?.name) {
    payload.nome_arquivo_pdf = pdfFile.name;
  }

  if (typeof payload.nome === 'string' && payload.nome.trim()) {
    payload.destaque = false;
  }

  const docRef = await addDoc(editaisCol(), {
    ...payload,
    dataAnalise: Timestamp.now(),
  });

  let pdfUrl: string | undefined;

  if (pdfFile && uid) {
    try {
      const safeName = sanitizePdfFileName(pdfFile.name);
      const pdfRef = storageRef(storage, `editais/${uid}/${docRef.id}/${safeName}`);
      await uploadBytes(pdfRef, pdfFile);
      pdfUrl = await getDownloadURL(pdfRef);
      await updateDoc(editalDoc(docRef.id), { pdf_url: pdfUrl });
    } catch (storageErr) {
      console.warn('PDF não enviado ao Storage (edital salvo no Firestore):', storageErr);
    }
  }

  return { id: docRef.id, pdfUrl };
}

export async function obterHistoricoAnalises(limite: number = 10): Promise<AnaliseEdital[]> {
  const q = query(editaisCol(), orderBy('dataAnalise', 'desc'), limit(limite));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>));
}

export async function obterTodasAnalises(): Promise<AnaliseEdital[]> {
  try {
    const q = query(editaisCol(), orderBy('dataAnalise', 'desc'));
    const orderedSnapshot = await getDocs(q);
    return orderedSnapshot.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>));
  } catch {
    const querySnapshot = await getDocs(editaisCol());
    return querySnapshot.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>));
  }
}

export async function atualizarAnalise(id: string, dadosAtualizados: Partial<AnaliseEdital>): Promise<void> {
  const docRef = editalDoc(id);
  await updateDoc(docRef, {
    ...dadosAtualizados,
    dataAtualizacao: Timestamp.now(),
  });
}

export async function excluirAnalise(id: string): Promise<void> {
  await deleteDoc(editalDoc(id));
}

export async function buscarAnalisesPorProponente(proponente: string): Promise<AnaliseEdital[]> {
  const q = query(
    editaisCol(),
    where('proponente', '==', proponente),
    orderBy('dataAnalise', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>));
}
