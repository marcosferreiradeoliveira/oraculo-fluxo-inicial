import type { AppId, AppsMembro, PapelApp } from "@/lib/auth/ecossistema-acesso";
import type { MembroOrganizacao } from "@/lib/firebase/organizacao-doc";

const ORDEM_PAPEL: Record<PapelApp, number> = {
  none: 0,
  leitor: 1,
  editor: 2,
  gestor: 3,
  admin: 4,
};

export type EcossistemaGateConfig = {
  appId: AppId;
  requireAppAccess: boolean;
  inviteOnly?: boolean;
};

export function canAccessApp(apps: AppsMembro | undefined, appId: AppId): boolean {
  const papel = apps?.[appId] ?? "none";
  return ORDEM_PAPEL[papel] > 0;
}

export function appsComAcesso(apps: AppsMembro | undefined): AppId[] {
  const ids: AppId[] = ["criacao", "gestor", "financeiro"];
  return ids.filter((id) => canAccessApp(apps, id));
}

export function appsAdminPlataforma(): AppsMembro {
  return { criacao: "admin", gestor: "admin", financeiro: "admin" };
}

export function resolveAppsEfetivos(
  membro: MembroOrganizacao | null,
  profileRole: string | undefined,
): AppsMembro | undefined {
  if (profileRole === "super_admin") return appsAdminPlataforma();
  return membro?.apps;
}

export function podeUsarAppAtual(
  gate: EcossistemaGateConfig | undefined,
  membro: MembroOrganizacao | null,
  profileRole: string | undefined,
): boolean {
  if (!gate?.requireAppAccess) return true;

  const apps = resolveAppsEfetivos(membro, profileRole);
  if (apps) return canAccessApp(apps, gate.appId);

  return !gate.inviteOnly;
}

export type AppUrlsEcossistema = Partial<Record<AppId, string>>;

export function appUrlsFromEnv(): AppUrlsEcossistema {
  return {
    criacao: import.meta.env.VITE_APP_URL_CRIACAO?.trim() || undefined,
    gestor: import.meta.env.VITE_APP_URL_GESTOR?.trim() || undefined,
    financeiro: import.meta.env.VITE_APP_URL_FINANCEIRO?.trim() || undefined,
  };
}

export const APP_LABEL: Record<AppId, string> = {
  criacao: "Oráculo · Criação",
  gestor: "Gestor Operacional",
  financeiro: "Fluxo Financeiro",
};
