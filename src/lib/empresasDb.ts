import {
  arrayUnion,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  type DadosCadastraisEmpresa,
  dadosCadastraisParaTexto,
  emptyDadosCadastraisEmpresa,
  lerDadosCadastraisDoUsuario,
  normalizarDadosCadastraisEmpresa,
} from '@/lib/dadosCadastraisEmpresa';

export type EmpresaMembroRole = 'super_admin' | 'gestor_financeiro' | 'membro';

export type EmpresaDoc = {
  nome: string;
  ownerUid: string;
  portfolio: string;
  equipeBio: string;
  dadosCadastraisEmpresa: DadosCadastraisEmpresa;
  dadosCadastrais: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type EmpresaComId = EmpresaDoc & { id: string };

export type UsuarioEmpresaRefs = {
  empresaIds: string[];
  defaultEmpresaId: string;
};

function empresaFromSnap(id: string, data: DocumentData): EmpresaComId {
  const dados = lerDadosCadastraisDoUsuario({
    dadosCadastraisEmpresa: data.dadosCadastraisEmpresa,
    dadosCadastrais: data.dadosCadastrais,
  });
  return {
    id,
    nome: typeof data.nome === 'string' ? data.nome : '',
    ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : '',
    portfolio: typeof data.portfolio === 'string' ? data.portfolio : '',
    equipeBio: typeof data.equipeBio === 'string' ? data.equipeBio : '',
    dadosCadastraisEmpresa: dados,
    dadosCadastrais:
      typeof data.dadosCadastrais === 'string'
        ? data.dadosCadastrais
        : dadosCadastraisParaTexto(dados),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function lerRefsEmpresaDoUsuario(data: DocumentData | undefined): UsuarioEmpresaRefs {
  const empresaIds = Array.isArray(data?.empresaIds)
    ? (data!.empresaIds as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const defaultEmpresaId =
    typeof data?.defaultEmpresaId === 'string' ? data.defaultEmpresaId : '';
  return { empresaIds, defaultEmpresaId };
}

/** Campos legados em `usuarios` para importar na primeira empresa. */
export function legacyEmpresaFromUsuario(data: DocumentData | undefined): Partial<EmpresaDoc> {
  if (!data) return {};
  const dadosEmpresa = lerDadosCadastraisDoUsuario(data);
  const nome =
    (typeof data.empresa === 'string' && data.empresa.trim()) ||
    dadosEmpresa.nomeFantasia.trim() ||
    dadosEmpresa.razaoSocial.trim() ||
    '';
  return {
    nome,
    portfolio: typeof data.portfolio === 'string' ? data.portfolio : '',
    equipeBio: typeof data.equipeBio === 'string' ? data.equipeBio : '',
    dadosCadastraisEmpresa: dadosEmpresa,
    dadosCadastrais:
      typeof data.dadosCadastrais === 'string' && data.dadosCadastrais.trim()
        ? data.dadosCadastrais
        : dadosCadastraisParaTexto(dadosEmpresa),
  };
}

export async function getEmpresa(empresaId: string): Promise<EmpresaComId | null> {
  const snap = await getDoc(doc(db, 'empresas', empresaId));
  if (!snap.exists()) return null;
  return empresaFromSnap(snap.id, snap.data());
}

export async function listEmpresasDoUsuario(empresaIds: string[]): Promise<EmpresaComId[]> {
  const ids = [...new Set(empresaIds.filter(Boolean))];
  const results = await Promise.all(ids.map((id) => getEmpresa(id)));
  return results.filter((e): e is EmpresaComId => e != null);
}

/** Espelha dados da empresa ativa no doc do usuário (compatível com GerarTextos, anexos, etc.). */
export async function sincronizarPerfilUsuarioComEmpresa(
  uid: string,
  empresa: Pick<
    EmpresaDoc,
    'nome' | 'portfolio' | 'equipeBio' | 'dadosCadastraisEmpresa' | 'dadosCadastrais'
  >
): Promise<void> {
  const dadosNorm = normalizarDadosCadastraisEmpresa(empresa.dadosCadastraisEmpresa);
  await updateDoc(doc(db, 'usuarios', uid), {
    empresa: empresa.nome,
    portfolio: empresa.portfolio,
    equipeBio: empresa.equipeBio,
    dadosCadastraisEmpresa: dadosNorm,
    dadosCadastrais: empresa.dadosCadastrais || dadosCadastraisParaTexto(dadosNorm),
  });
}

export type CriarEmpresaInput = {
  nome: string;
  portfolio?: string;
  equipeBio?: string;
  dadosCadastraisEmpresa?: DadosCadastraisEmpresa;
};

export async function criarEmpresa(
  uid: string,
  email: string,
  input: CriarEmpresaInput
): Promise<string> {
  const nome = input.nome.trim();
  if (!nome) throw new Error('Informe o nome da empresa.');

  const dadosNorm = normalizarDadosCadastraisEmpresa(
    input.dadosCadastraisEmpresa ?? emptyDadosCadastraisEmpresa()
  );
  const portfolio = input.portfolio ?? '';
  const equipeBio = input.equipeBio ?? '';
  const dadosCadastrais = dadosCadastraisParaTexto(dadosNorm);

  const empresaRef = doc(collection(db, 'empresas'));
  const empresaId = empresaRef.id;

  await setDoc(empresaRef, {
    nome,
    ownerUid: uid,
    portfolio,
    equipeBio,
    dadosCadastraisEmpresa: dadosNorm,
    dadosCadastrais,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, 'empresas', empresaId, 'membros', uid), {
    uid,
    email: email.toLowerCase(),
    role: 'super_admin' satisfies EmpresaMembroRole,
    status: 'active',
    joinedAt: serverTimestamp(),
  });

  const userRef = doc(db, 'usuarios', uid);
  const userSnap = await getDoc(userRef);
  const refs = lerRefsEmpresaDoUsuario(userSnap.data());
  const patch: Record<string, unknown> = {
    empresaIds: arrayUnion(empresaId),
    updatedAt: serverTimestamp(),
  };
  if (!refs.defaultEmpresaId) {
    patch.defaultEmpresaId = empresaId;
  }
  await updateDoc(userRef, patch);

  await sincronizarPerfilUsuarioComEmpresa(uid, {
    nome,
    portfolio,
    equipeBio,
    dadosCadastraisEmpresa: dadosNorm,
    dadosCadastrais,
  });

  return empresaId;
}

export type AtualizarEmpresaInput = {
  nome: string;
  portfolio: string;
  equipeBio: string;
  dadosCadastraisEmpresa: DadosCadastraisEmpresa;
};

export async function atualizarEmpresa(
  empresaId: string,
  input: AtualizarEmpresaInput
): Promise<EmpresaComId> {
  const nome = input.nome.trim();
  if (!nome) throw new Error('Informe o nome da empresa.');

  const dadosNorm = normalizarDadosCadastraisEmpresa(input.dadosCadastraisEmpresa);
  const dadosCadastrais = dadosCadastraisParaTexto(dadosNorm);

  await updateDoc(doc(db, 'empresas', empresaId), {
    nome,
    portfolio: input.portfolio,
    equipeBio: input.equipeBio,
    dadosCadastraisEmpresa: dadosNorm,
    dadosCadastrais,
    updatedAt: serverTimestamp(),
  });

  return {
    id: empresaId,
    ownerUid: '',
    nome,
    portfolio: input.portfolio,
    equipeBio: input.equipeBio,
    dadosCadastraisEmpresa: dadosNorm,
    dadosCadastrais,
  };
}

export async function definirEmpresaAtiva(uid: string, empresaId: string): Promise<void> {
  const empresa = await getEmpresa(empresaId);
  if (!empresa) throw new Error('Empresa não encontrada ou sem permissão de leitura.');

  await updateDoc(doc(db, 'usuarios', uid), {
    defaultEmpresaId: empresaId,
    updatedAt: serverTimestamp(),
  });

  await sincronizarPerfilUsuarioComEmpresa(uid, empresa);
}

/** Convites pendentes para o e-mail do usuário (aceite futuro na UI). */
export async function listConvitesPendentesPorEmail(email: string): Promise<
  { empresaId: string; conviteId: string; email: string }[]
> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];

  const q = query(
    collectionGroup(db, 'convites'),
    where('email', '==', normalized),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const path = d.ref.path.split('/');
    const empresaId = path.length >= 2 ? path[1] : '';
    return {
      empresaId,
      conviteId: d.id,
      email: typeof d.data().email === 'string' ? d.data().email : normalized,
    };
  });
}
