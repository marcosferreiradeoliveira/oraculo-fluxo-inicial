import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  documentId,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getEmpresa, getMembroEmpresa, lerRefsEmpresaDoUsuario } from '@/lib/empresasDb';

export type ProjetoResumoEmpresa = {
  id: string;
  nome: string;
  user_id?: string;
  empresaId?: string;
};

function nomeFromData(data: DocumentData): string {
  if (typeof data.nome === 'string' && data.nome.trim()) return data.nome.trim();
  return 'Projeto sem nome';
}

function mapProjetoDoc(id: string, data: DocumentData): ProjetoResumoEmpresa {
  return {
    id,
    nome: nomeFromData(data),
    user_id: typeof data.user_id === 'string' ? data.user_id : undefined,
    empresaId: typeof data.empresaId === 'string' ? data.empresaId : undefined,
  };
}

/** Projetos que gestores podem atribuir a um convite de membro. */
export async function listProjetosParaAtribuirConvite(
  empresaId: string
): Promise<ProjetoResumoEmpresa[]> {
  const empresa = await getEmpresa(empresaId);
  if (!empresa?.ownerUid) return [];

  const byId = new Map<string, ProjetoResumoEmpresa>();

  const byEmpresa = query(collection(db, 'projetos'), where('empresaId', '==', empresaId));
  const snapEmpresa = await getDocs(byEmpresa);
  for (const d of snapEmpresa.docs) {
    byId.set(d.id, mapProjetoDoc(d.id, d.data()));
  }

  const byOwner = query(collection(db, 'projetos'), where('user_id', '==', empresa.ownerUid));
  const snapOwner = await getDocs(byOwner);
  for (const d of snapOwner.docs) {
    if (!byId.has(d.id)) {
      byId.set(d.id, mapProjetoDoc(d.id, d.data()));
    }
  }

  return [...byId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

async function fetchProjetosByIds(ids: string[]): Promise<ProjetoResumoEmpresa[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];

  const out: ProjetoResumoEmpresa[] = [];
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    const q = query(collection(db, 'projetos'), where(documentId(), 'in', chunk));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      out.push(mapProjetoDoc(d.id, d.data()));
    }
  }
  return out;
}

function gestorVeTodosProjetos(role: string | undefined, ownerUid: string, uid: string): boolean {
  if (uid === ownerUid) return true;
  return role === 'super_admin' || role === 'gestor_financeiro';
}

/**
 * Projetos visíveis no dashboard / listagens: próprios + empresa (gestor) ou atribuídos (membro).
 */
export async function fetchProjetosAcessiveis(uid: string): Promise<ProjetoResumoEmpresa[]> {
  const userSnap = await getDoc(doc(db, 'usuarios', uid));
  const refs = lerRefsEmpresaDoUsuario(userSnap.data());
  const empresaId = refs.defaultEmpresaId || refs.empresaIds[0] || '';

  const byId = new Map<string, ProjetoResumoEmpresa>();

  const ownQ = query(collection(db, 'projetos'), where('user_id', '==', uid));
  const ownSnap = await getDocs(ownQ);
  for (const d of ownSnap.docs) {
    byId.set(d.id, mapProjetoDoc(d.id, d.data()));
  }

  if (!empresaId) {
    return [...byId.values()];
  }

  const empresa = await getEmpresa(empresaId);
  const membro = await getMembroEmpresa(empresaId, uid);
  if (!membro || membro.status !== 'active') {
    return [...byId.values()];
  }

  if (gestorVeTodosProjetos(membro.role, empresa?.ownerUid ?? '', uid)) {
    const tagged = await getDocs(
      query(collection(db, 'projetos'), where('empresaId', '==', empresaId))
    );
    for (const d of tagged.docs) {
      byId.set(d.id, mapProjetoDoc(d.id, d.data()));
    }
    if (empresa?.ownerUid && empresa.ownerUid !== uid) {
      const ownerProj = await getDocs(
        query(collection(db, 'projetos'), where('user_id', '==', empresa.ownerUid))
      );
      for (const d of ownerProj.docs) {
        byId.set(d.id, mapProjetoDoc(d.id, d.data()));
      }
    }
  } else {
    const ids = membro.assignedProjects ?? [];
    const assignedDocs = await fetchProjetosByIds(ids);
    for (const p of assignedDocs) {
      byId.set(p.id, p);
    }
  }

  return [...byId.values()];
}

/** Convidados com papel `membro` não excluem projetos (nem os atribuídos). */
export async function usuarioPodeExcluirProjetos(uid: string): Promise<boolean> {
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

export function podeExcluirProjetoCard(
  uid: string,
  projeto: { user_id?: string },
  podeExcluirGlobal: boolean,
  gestorEmpresa: boolean
): boolean {
  if (!podeExcluirGlobal) return false;
  if (gestorEmpresa) return true;
  return projeto.user_id === uid;
}
