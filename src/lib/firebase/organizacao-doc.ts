import type { Timestamp } from "firebase/firestore";
import type { AppsMembro } from "@/lib/auth/ecossistema-acesso";

export const ORGANIZACOES_COLLECTION = "organizacoes";
export const MEMBROS_SUBCOLLECTION = "membros";

export type MembroOrganizacaoStatus = "active" | "suspended";
export type PapelOrganizacao = "admin" | "membro";

export type MembroOrganizacaoFirestore = {
  uid: string;
  email: string;
  nomeCompleto?: string;
  status: MembroOrganizacaoStatus;
  papelOrg: PapelOrganizacao;
  apps: AppsMembro;
  participaEmpresa: boolean;
  empresaIds?: string[];
  defaultEmpresaId?: string;
  roleLegacy?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type MembroOrganizacao = MembroOrganizacaoFirestore & {
  orgId: string;
};
