import { doc, getDoc, type DocumentData } from "firebase/firestore";
import { ORG_ID_IS } from "@/lib/auth/ecossistema-acesso";
import {
  MEMBROS_SUBCOLLECTION,
  ORGANIZACOES_COLLECTION,
  type MembroOrganizacao,
  type MembroOrganizacaoFirestore,
} from "@/lib/firebase/organizacao-doc";
import { db } from "@/lib/firebase";

export { ORG_ID_IS };

function membroRef(orgId: string, uid: string) {
  return doc(db, ORGANIZACOES_COLLECTION, orgId, MEMBROS_SUBCOLLECTION, uid);
}

export function mapMembroDoc(orgId: string, uid: string, data: DocumentData): MembroOrganizacao {
  const d = data as MembroOrganizacaoFirestore;
  return { orgId, uid, ...d };
}

export async function getMembroOrganizacao(orgId: string, uid: string): Promise<MembroOrganizacao | null> {
  const snap = await getDoc(membroRef(orgId, uid));
  if (!snap.exists()) return null;
  return mapMembroDoc(orgId, uid, snap.data());
}
