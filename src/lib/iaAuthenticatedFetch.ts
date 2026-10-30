import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { starterPaywallUrl } from '@/lib/starterPlan';

export class IaHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Login do app usa /cadastro com redirect (não existe rota /login). */
export function loginRedirectPath(returnTo: string): string {
  const path = returnTo.startsWith('/') ? returnTo : '/cadastro-premium';
  return `/cadastro?redirect=${encodeURIComponent(path)}`;
}

export function currentPathWithSearch(): string {
  if (typeof window === 'undefined') return '/cadastro-premium';
  return `${window.location.pathname}${window.location.search}`;
}

/** Aguarda Firebase Auth restaurar sessão após redirect/cadastro. */
export function waitForAuthUser(timeoutMs = 8000): Promise<User | null> {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (user: User | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      resolve(user);
    };
    const timer = setTimeout(() => finish(auth.currentUser), timeoutMs);
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) finish(user);
    });
  });
}

export async function ensureAuthenticatedUser(options: {
  navigate?: (path: string) => void;
  returnTo?: string;
  waitMs?: number;
  forceRefresh?: boolean;
}): Promise<User> {
  const user = await waitForAuthUser(options.waitMs ?? 8000);
  if (!user) {
    const returnTo = options.returnTo ?? currentPathWithSearch();
    if (options.navigate) {
      options.navigate(loginRedirectPath(returnTo));
    }
    throw new IaHttpError(401, 'Faça login para continuar.');
  }
  await user.getIdToken(options.forceRefresh ?? true);
  return user;
}

export async function getIaAuthHeaders(
  extra: Record<string, string> = {},
  options?: { forceRefresh?: boolean },
): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new IaHttpError(401, 'Faça login para continuar.');
  }
  const token = await user.getIdToken(options?.forceRefresh ?? true);
  return {
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

export function handleIaHttpStatus(
  status: number,
  navigate?: (path: string) => void,
  returnTo?: string,
): void {
  if (status === 401) {
    const target = returnTo ?? currentPathWithSearch();
    if (navigate) {
      navigate(loginRedirectPath(target));
    }
    throw new IaHttpError(401, 'Faça login para continuar.');
  }
  if (status === 402) {
    if (navigate) navigate(starterPaywallUrl('creditos_insuficientes'));
    throw new IaHttpError(402, 'Créditos insuficientes');
  }
  if (status === 403) {
    throw new IaHttpError(403, 'Sem permissão para esta assinatura.');
  }
}

/** POST autenticado às Cloud Functions (assinatura, IA, etc.). */
export async function authenticatedPost(
  url: string,
  body: unknown,
  options: {
    navigate?: (path: string) => void;
    returnTo?: string;
    waitForAuthMs?: number;
  } = {},
): Promise<Response> {
  await ensureAuthenticatedUser({
    navigate: options.navigate,
    returnTo: options.returnTo,
    waitMs: options.waitForAuthMs,
    forceRefresh: true,
  });

  const headers = await getIaAuthHeaders({ 'Content-Type': 'application/json' }, { forceRefresh: true });
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (response.status === 401 || response.status === 402 || response.status === 403) {
    handleIaHttpStatus(response.status, options.navigate, options.returnTo);
  }
  return response;
}

export async function iaFetch(
  url: string,
  init: RequestInit & { navigate?: (path: string) => void; returnTo?: string } = {},
): Promise<Response> {
  const { navigate, returnTo, headers, ...rest } = init;
  await ensureAuthenticatedUser({ navigate, returnTo, forceRefresh: true });
  const authHeaders = await getIaAuthHeaders(
    headers && typeof headers === 'object' && !(headers instanceof Headers)
      ? (headers as Record<string, string>)
      : {},
    { forceRefresh: true },
  );
  const response = await fetch(url, { ...rest, headers: authHeaders });
  if (!response.ok) {
    handleIaHttpStatus(response.status, navigate, returnTo);
  }
  return response;
}
