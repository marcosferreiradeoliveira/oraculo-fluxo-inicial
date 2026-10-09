import { getApp } from 'firebase/app';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import type { EmpresaMembroRole } from '@/lib/empresasDb';
import { publicAppOrigin } from '@/lib/publicAppUrl';

let emulatorConnected = false;

function functionsInstance() {
  const fn = getFunctions(getApp(), 'us-central1');
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_FUNCTIONS_USE_EMULATOR === '1' &&
    !emulatorConnected
  ) {
    const host = (import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined)?.trim();
    if (host) {
      try {
        const url = new URL(host);
        connectFunctionsEmulator(fn, url.hostname, Number(url.port) || 5001);
        emulatorConnected = true;
      } catch {
        connectFunctionsEmulator(fn, '127.0.0.1', 5001);
        emulatorConnected = true;
      }
    }
  }
  return fn;
}

export type ProvisionarConviteResult = {
  conviteId: string;
  link: string;
  authCreated: boolean;
  email: string;
  emailSent: boolean;
  emailError: string | null;
  emailProvider?: string | null;
  resent?: boolean;
};

/** Mensagem legível de erro das Cloud Functions callable (ex.: HTTP 409). */
export function mensagemErroCallable(err: unknown): string {
  if (err && typeof err === 'object') {
    const o = err as { code?: string; message?: string };
    if (o.code === 'functions/already-exists') {
      return o.message || 'Este e-mail já está na equipe ou com convite ativo.';
    }
    if (o.message) return o.message;
  }
  return err instanceof Error ? err.message : 'Não foi possível concluir a operação.';
}

export async function revogarAcessoMembroEmpresaCallable(
  empresaId: string,
  membroUid: string
): Promise<{ ok: boolean; membroUid: string; email?: string }> {
  const callable = httpsCallable(functionsInstance(), 'revogarAcessoMembroEmpresa');
  const res = await callable({ empresaId, membroUid });
  return res.data as { ok: boolean; membroUid: string; email?: string };
}

export async function provisionarConviteEmpresaCallable(
  empresaId: string,
  email: string,
  role: Exclude<EmpresaMembroRole, 'super_admin'>,
  assignedProjectIds?: string[]
): Promise<ProvisionarConviteResult> {
  const callable = httpsCallable(functionsInstance(), 'provisionarConviteEmpresa');
  const res = await callable({
    empresaId,
    email,
    role,
    assignedProjectIds: role === 'membro' ? assignedProjectIds ?? [] : [],
    appOrigin: publicAppOrigin(),
  });
  return res.data as ProvisionarConviteResult;
}

export type TokenPrimeiroAcessoInfo = {
  email: string;
  authCreated: boolean;
  empresaNome: string;
  role: string;
};

export async function consultarTokenPrimeiroAcessoCallable(
  token: string
): Promise<TokenPrimeiroAcessoInfo> {
  const callable = httpsCallable(functionsInstance(), 'consultarTokenPrimeiroAcesso');
  const res = await callable({ token });
  return res.data as TokenPrimeiroAcessoInfo;
}

export async function resolverEntradaConviteCallable(convite: string): Promise<{ url: string }> {
  const callable = httpsCallable(functionsInstance(), 'resolverEntradaConvite');
  const res = await callable({ convite, appOrigin: publicAppOrigin() });
  return res.data as { url: string };
}

export async function concluirPrimeiroAcessoConviteCallable(
  token: string,
  password: string
): Promise<{ email: string; empresaId: string; authCreated: boolean }> {
  const callable = httpsCallable(functionsInstance(), 'concluirPrimeiroAcessoConvite');
  const res = await callable({ token, password });
  return res.data as { email: string; empresaId: string; authCreated: boolean };
}

export async function aceitarConviteAutenticadoCallable(
  token: string
): Promise<{ email: string; empresaId: string }> {
  const callable = httpsCallable(functionsInstance(), 'aceitarConviteAutenticado');
  const res = await callable({ token });
  return res.data as { email: string; empresaId: string };
}

/** Extrai `empresaId:conviteId` de redirect ou search `convite`. */
export function parseConviteParam(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const v = decodeURIComponent(value.trim());
  if (v.includes('convite=')) {
    const query = v.includes('?') ? v.slice(v.indexOf('?') + 1) : v;
    const p = new URLSearchParams(query);
    return p.get('convite');
  }
  if (/^[^:]+:[^:]+$/.test(v)) return v;
  return null;
}
