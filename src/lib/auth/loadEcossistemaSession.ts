import { doc, getDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { ORG_ID_IS } from "@/lib/auth/ecossistema-acesso";
import { podeUsarAppAtual, type EcossistemaGateConfig } from "@/lib/auth/app-gate";
import { EcossistemaAccessError } from "@/lib/auth/ecossistema-errors";
import { getMembroOrganizacao, type MembroOrganizacao } from "@/lib/firebase/organizacao";
import { getEcossistemaGate } from "@/lib/auth/ecossistema-config";
import { db } from "@/lib/firebase";

export type EcossistemaSession = {
  membro: MembroOrganizacao | null;
  appAccess: boolean;
  profileRole: string | undefined;
};

export async function loadEcossistemaSession(authUser: User): Promise<EcossistemaSession> {
  const gate: EcossistemaGateConfig = getEcossistemaGate();
  if (!gate.requireAppAccess && !gate.inviteOnly) {
    return { membro: null, appAccess: true, profileRole: undefined };
  }

  const userSnap = await getDoc(doc(db, "usuarios", authUser.uid));
  if (gate.inviteOnly && !userSnap.exists()) {
    throw new EcossistemaAccessError(
      "NO_PROFILE",
      "Conta não provisionada. Use o link de convite enviado pela equipe IS.",
    );
  }

  const profileRole = userSnap.exists() ? (userSnap.data().role as string | undefined) : undefined;
  const membro = await getMembroOrganizacao(ORG_ID_IS, authUser.uid);

  if (gate.inviteOnly) {
    if (!membro) {
      throw new EcossistemaAccessError(
        "NO_MEMBRO",
        "Seu usuário ainda não está ativo na organização. Aguarde um convite ou fale com a administração.",
      );
    }
    if (membro.status !== "active") {
      throw new EcossistemaAccessError(
        "MEMBRO_SUSPENDED",
        "Acesso suspenso. Entre em contato com a administração do Instituto dos Sonhos.",
      );
    }
  }

  const appAccess = podeUsarAppAtual(gate, membro, profileRole);
  return { membro, appAccess, profileRole };
}