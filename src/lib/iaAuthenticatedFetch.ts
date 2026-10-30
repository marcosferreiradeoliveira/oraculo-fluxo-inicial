import { auth } from '@/lib/firebase';
import { starterPaywallUrl } from '@/lib/starterPlan';

export class IaHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function getIaAuthHeaders(
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new IaHttpError(401, 'Faça login para continuar.');
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

export function handleIaHttpStatus(
  status: number,
  navigate?: (path: string) => void,
): void {
  if (status === 401) {
    if (navigate) navigate('/login');
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
  options: { navigate?: (path: string) => void } = {},
): Promise<Response> {
  const headers = await getIaAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (response.status === 401 || response.status === 402 || response.status === 403) {
    handleIaHttpStatus(response.status, options.navigate);
  }
  return response;
}

export async function iaFetch(
  url: string,
  init: RequestInit & { navigate?: (path: string) => void } = {},
): Promise<Response> {
  const { navigate, headers, ...rest } = init;
  const authHeaders = await getIaAuthHeaders(
    headers && typeof headers === 'object' && !(headers instanceof Headers)
      ? (headers as Record<string, string>)
      : {},
  );
  const response = await fetch(url, { ...rest, headers: authHeaders });
  if (!response.ok) {
    handleIaHttpStatus(response.status, navigate);
  }
  return response;
}
