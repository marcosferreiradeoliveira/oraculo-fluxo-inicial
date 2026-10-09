import { collection, doc, getDoc, getDocs, query, where, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Fornecedor } from '@/lib/fornecedores';
import { getEmpresa, getMembroEmpresa, lerRefsEmpresaDoUsuario } from '@/lib/empresasDb';

function mapFornecedor(id: string, data: DocumentData): Fornecedor {
  return { id, ...data } as Fornecedor;
}

/** Fornecedores visíveis: próprios + catálogo da empresa (titular / gestor / membro). */
export async function fetchFornecedoresAcessiveis(uid: string): Promise<Fornecedor[]> {
  const userSnap = await getDoc(doc(db, 'usuarios', uid));
  const refs = lerRefsEmpresaDoUsuario(userSnap.data());
  const empresaId = refs.defaultEmpresaId || refs.empresaIds[0] || '';

  const byId = new Map<string, Fornecedor>();

  const ownSnap = await getDocs(
    query(collection(db, 'fornecedores'), where('userId', '==', uid))
  );
  for (const d of ownSnap.docs) {
    byId.set(d.id, mapFornecedor(d.id, d.data()));
  }

  if (!empresaId) {
    return [...byId.values()].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  }

  const membro = await getMembroEmpresa(empresaId, uid);
  if (!membro || membro.status !== 'active') {
    return [...byId.values()].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  }

  const empresa = await getEmpresa(empresaId);
  const tagged = await getDocs(
    query(collection(db, 'fornecedores'), where('empresaId', '==', empresaId))
  );
  for (const d of tagged.docs) {
    byId.set(d.id, mapFornecedor(d.id, d.data()));
  }

  if (empresa?.ownerUid && empresa.ownerUid !== uid) {
    const ownerSnap = await getDocs(
      query(collection(db, 'fornecedores'), where('userId', '==', empresa.ownerUid))
    );
    for (const d of ownerSnap.docs) {
      if (!byId.has(d.id)) {
        byId.set(d.id, mapFornecedor(d.id, d.data()));
      }
    }
  }

  return [...byId.values()].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
}

/** Membros convidados veem fornecedores, mas não cadastram/editam o catálogo. */
export async function usuarioPodeGerenciarFornecedores(uid: string): Promise<boolean> {
  const userSnap = await getDoc(doc(db, 'usuarios', uid));
  const refs = lerRefsEmpresaDoUsuario(userSnap.data());
  const empresaId = refs.defaultEmpresaId || refs.empresaIds[0] || '';
  if (!empresaId) return true;

  const empresa = await getEmpresa(empresaId);
  if (empresa?.ownerUid === uid) return true;

  const membro = await getMembroEmpresa(empresaId, uid);
  if (!membro || membro.status !== 'active') return true;
  return membro.role !== 'membro';
}
