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
import { publicAppOrigin } from '@/lib/publicAppUrl';
import {
  type DadosCadastraisEmpresa,
  dadosCadastraisParaTexto,
  emptyDadosCadastraisEmpresa,
  lerDadosCadastraisDoUsuario,
  normalizarDadosCadastraisEmpresa,
} from '@/lib/dadosCadastraisEmpresa';

export type EmpresaMembroRole = 'super_admin' | 'gestor_financeiro' | 'membro';

export type ConviteEmpresaStatus = 'pending' | 'accepted' | 'cancelled';

export type ConviteEmpresaDoc = {
  email: string;
  /** Projetos da coleção `projetos` visíveis para convidado membro. */
  assignedProjectIds?: string[];
  status: ConviteEmpresaStatus;
  role: Exclude<EmpresaMembroRole, 'super_admin'>;
  invitedByUid: string;
  invitedByEmail?: string;
  empresaNome?: string;
  emailSendError?: string;
  emailSentAt?: unknown;
  emailProvider?: string;
  createdAt?: unknown;
  acceptedAt?: unknown;
  acceptedByUid?: string;
};

export type ConviteEmpresaComId = ConviteEmpresaDoc & { id: string };

export type EmpresaMembroDoc = {
  uid: string;
  email: string;
  role: EmpresaMembroRole;
  status: 'active' | 'inactive';
  joinedAt?: unknown;
  assignedProjects?: string[];
};

export type EmpresaMembroComId = EmpresaMembroDoc & { id: string };

export type ConvitePendenteUsuario = {
  empresaId: string;
  conviteId: string;
  email: string;
  role: ConviteEmpresaDoc['role'];
  empresaNome?: string;
};

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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function membroFromSnap(id: string, data: DocumentData): EmpresaMembroComId {
  const roleRaw = data.role;
  const role: EmpresaMembroRole =
    roleRaw === 'super_admin' || roleRaw === 'gestor_financeiro' || roleRaw === 'membro'
      ? roleRaw
      : 'membro';
  return {
    id,
    uid: typeof data.uid === 'string' ? data.uid : id,
    email: typeof data.email === 'string' ? data.email : '',
    role,
    status: data.status === 'inactive' ? 'inactive' : 'active',
    joinedAt: data.joinedAt,
    assignedProjects: Array.isArray(data.assignedProjects)
      ? data.assignedProjects.filter((x): x is string => typeof x === 'string')
      : undefined,
  };
}

function conviteFromSnap(id: string, data: DocumentData): ConviteEmpresaComId {
  const roleRaw = data.role;
  const role: ConviteEmpresaDoc['role'] =
    roleRaw === 'gestor_financeiro' ? 'gestor_financeiro' : 'membro';
  const statusRaw = data.status;
  const status: ConviteEmpresaStatus =
    statusRaw === 'accepted' || statusRaw === 'cancelled' ? statusRaw : 'pending';
  return {
    id,
    email: typeof data.email === 'string' ? data.email : '',
    status,
    role,
    invitedByUid: typeof data.invitedByUid === 'string' ? data.invitedByUid : '',
    invitedByEmail: typeof data.invitedByEmail === 'string' ? data.invitedByEmail : undefined,
    empresaNome: typeof data.empresaNome === 'string' ? data.empresaNome : undefined,
    emailSendError: typeof data.emailSendError === 'string' ? data.emailSendError : undefined,
    emailSentAt: data.emailSentAt,
    emailProvider: typeof data.emailProvider === 'string' ? data.emailProvider : undefined,
    createdAt: data.createdAt,
    acceptedAt: data.acceptedAt,
    acceptedByUid: typeof data.acceptedByUid === 'string' ? data.acceptedByUid : undefined,
    assignedProjectIds: Array.isArray(data.assignedProjectIds)
      ? data.assignedProjectIds.filter((x): x is string => typeof x === 'string')
      : undefined,
  };
}

export async function getMembroEmpresa(
  empresaId: string,
  uid: string
): Promise<EmpresaMembroComId | null> {
  const snap = await getDoc(doc(db, 'empresas', empresaId, 'membros', uid));
  if (!snap.exists()) return null;
  return membroFromSnap(snap.id, snap.data());
}

/** Alinhado a `canManageEmpresaTeam` nas Firestore rules. */
export async function podeGerenciarEquipeEmpresa(empresaId: string, uid: string): Promise<boolean> {
  const empresa = await getEmpresa(empresaId);
  if (!empresa) return false;
  if (empresa.ownerUid === uid) return true;
  const membro = await getMembroEmpresa(empresaId, uid);
  if (!membro || membro.status !== 'active') return false;
  return membro.role === 'super_admin' || membro.role === 'gestor_financeiro';
}

export async function listMembrosEmpresa(empresaId: string): Promise<EmpresaMembroComId[]> {
  const snap = await getDocs(collection(db, 'empresas', empresaId, 'membros'));
  return snap.docs.map((d) => membroFromSnap(d.id, d.data()));
}

export async function listConvitesPendentesEmpresa(empresaId: string): Promise<ConviteEmpresaComId[]> {
  const q = query(
    collection(db, 'empresas', empresaId, 'convites'),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => conviteFromSnap(d.id, d.data()));
}

export async function criarConviteEmpresa(
  empresaId: string,
  inviter: { uid: string; email: string },
  emailConvidado: string,
  role: ConviteEmpresaDoc['role'] = 'membro'
): Promise<string> {
  const canManage = await podeGerenciarEquipeEmpresa(empresaId, inviter.uid);
  if (!canManage) throw new Error('Sem permissão para convidar membros nesta empresa.');

  const email = normalizeEmail(emailConvidado);
  if (!email || !email.includes('@')) throw new Error('Informe um e-mail válido.');

  const membros = await listMembrosEmpresa(empresaId);
  if (membros.some((m) => m.email.toLowerCase() === email && m.status === 'active')) {
    throw new Error('Este e-mail já faz parte da equipe.');
  }

  const pendentes = await listConvitesPendentesEmpresa(empresaId);
  if (pendentes.some((c) => c.email.toLowerCase() === email)) {
    throw new Error('Já existe um convite pendente para este e-mail.');
  }

  const empresa = await getEmpresa(empresaId);
  const conviteRef = doc(collection(db, 'empresas', empresaId, 'convites'));
  await setDoc(conviteRef, {
    email,
    status: 'pending' satisfies ConviteEmpresaStatus,
    role,
    invitedByUid: inviter.uid,
    invitedByEmail: normalizeEmail(inviter.email),
    empresaNome: empresa?.nome?.trim() || '',
    createdAt: serverTimestamp(),
  });
  return conviteRef.id;
}

export async function cancelarConviteEmpresa(empresaId: string, conviteId: string, uid: string): Promise<void> {
  const canManage = await podeGerenciarEquipeEmpresa(empresaId, uid);
  if (!canManage) throw new Error('Sem permissão para cancelar convites.');

  const ref = doc(db, 'empresas', empresaId, 'convites', conviteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Convite não encontrado.');
  if (snap.data().status !== 'pending') throw new Error('Este convite já foi utilizado ou cancelado.');

  await updateDoc(ref, {
    status: 'cancelled' satisfies ConviteEmpresaStatus,
    cancelledAt: serverTimestamp(),
  });
}

/** Convites pendentes para o e-mail do usuário logado. */
export async function listConvitesPendentesPorEmail(email: string): Promise<ConvitePendenteUsuario[]> {
  const normalized = normalizeEmail(email);
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
    const data = d.data();
    const roleRaw = data.role;
    const role: ConviteEmpresaDoc['role'] =
      roleRaw === 'gestor_financeiro' ? 'gestor_financeiro' : 'membro';
    return {
      empresaId,
      conviteId: d.id,
      email: typeof data.email === 'string' ? data.email : normalized,
      role,
      empresaNome: typeof data.empresaNome === 'string' ? data.empresaNome : undefined,
    };
  });
}

export async function aceitarConviteEmpresa(
  uid: string,
  authEmail: string,
  empresaId: string,
  conviteId: string
): Promise<void> {
  const email = normalizeEmail(authEmail);
  if (!email) throw new Error('E-mail da conta não disponível.');

  const conviteRef = doc(db, 'empresas', empresaId, 'convites', conviteId);
  const conviteSnap = await getDoc(conviteRef);
  if (!conviteSnap.exists()) throw new Error('Convite não encontrado.');
  const convite = conviteFromSnap(conviteSnap.id, conviteSnap.data());
  if (convite.status !== 'pending') throw new Error('Este convite não está mais disponível.');
  if (convite.email !== email) throw new Error('Este convite foi enviado para outro e-mail.');

  const membroExistente = await getMembroEmpresa(empresaId, uid);
  if (membroExistente?.status === 'active') {
    const syncMembro: Record<string, unknown> = {};
    if (convite.role === 'membro' && convite.assignedProjectIds?.length) {
      syncMembro.assignedProjects = convite.assignedProjectIds;
    }
    if (Object.keys(syncMembro).length > 0) {
      await updateDoc(doc(db, 'empresas', empresaId, 'membros', uid), syncMembro);
    }
    await updateDoc(conviteRef, { status: 'accepted', acceptedAt: serverTimestamp(), acceptedByUid: uid });
    return;
  }

  const userRef = doc(db, 'usuarios', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error('Complete seu cadastro antes de aceitar o convite.');

  const refs = lerRefsEmpresaDoUsuario(userSnap.data());

  // Ordem importa: rules de `membros` usam `usuarioEmpresaIds()` após o doc do usuário existir.
  await updateDoc(userRef, {
    empresaIds: arrayUnion(empresaId),
    ...(!refs.defaultEmpresaId ? { defaultEmpresaId: empresaId } : {}),
    updatedAt: serverTimestamp(),
  });

  const membroPayload: Record<string, unknown> = {
    uid,
    email,
    role: convite.role,
    status: 'active',
    joinedAt: serverTimestamp(),
  };
  if (convite.role === 'membro') {
    membroPayload.assignedProjects = convite.assignedProjectIds ?? [];
  }
  await setDoc(doc(db, 'empresas', empresaId, 'membros', uid), membroPayload, { merge: true });

  await updateDoc(conviteRef, {
    status: 'accepted' satisfies ConviteEmpresaStatus,
    acceptedAt: serverTimestamp(),
    acceptedByUid: uid,
  });

  const empresa = await getEmpresa(empresaId);
  if (empresa && !refs.defaultEmpresaId) {
    await sincronizarPerfilUsuarioComEmpresa(uid, empresa);
  }
}

export function linkConviteEmpresa(empresaId: string, conviteId: string): string {
  const base = publicAppOrigin();
  const path = `/empresas?convite=${encodeURIComponent(empresaId)}:${encodeURIComponent(conviteId)}`;
  return `${base}${path}`;
}
