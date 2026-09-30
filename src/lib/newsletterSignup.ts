import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAdicionarContatoBrevoUrl } from '@/lib/functionsUrl';
import { trackNewsletterSubscribed } from '@/lib/analytics';

/** Lista Brevo: "Receba em seu email os últimos editais" */
export const BREVO_NEWSLETTER_EDITAIS_LIST_ID = Number(
  import.meta.env.VITE_BREVO_NEWSLETTER_LIST_ID ?? 15
);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NewsletterOrigem =
  | 'home_editais_abertos'
  | 'editais_abertos'
  | 'oraculo_ai';

export type SubscribeEditaisNewsletterParams = {
  email: string;
  origem: NewsletterOrigem;
  userId?: string | null;
  displayName?: string | null;
};

export type SubscribeEditaisNewsletterResult =
  | { ok: true }
  | { ok: false; stage: 'validation' | 'firestore' | 'brevo'; message: string };

async function syncContactToBrevo(
  email: string,
  nome: string | null | undefined,
  listId: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const url = getAdicionarContatoBrevoUrl();
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        nome: nome || null,
        listId,
      }),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[Newsletter] Erro ao chamar função Brevo:', err);
    console.error('[Newsletter] Detalhes do erro:', detail, err);
    return {
      ok: false,
      message:
        detail === 'Failed to fetch'
          ? 'Newsletter indisponível (servidor Brevo ou rede). Tente de novo em alguns minutos.'
          : 'Não foi possível conectar ao serviço de newsletter. Verifique sua conexão e tente novamente.',
    };
  }

  let body: { success?: boolean; error?: string; message?: string } = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok || body.success === false) {
    console.error('[Newsletter] Brevo respondeu com erro:', response.status, body);
    const detail = body.message || body.error;
    return {
      ok: false,
      message: detail
        ? `Newsletter indisponível no momento (${detail}). Tente de novo em alguns minutos.`
        : 'Newsletter indisponível no momento (serviço temporariamente fora). Tente de novo em alguns minutos.',
    };
  }

  return { ok: true };
}

export async function subscribeToEditaisNewsletter(
  params: SubscribeEditaisNewsletterParams
): Promise<SubscribeEditaisNewsletterResult> {
  const email = params.email.trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    return { ok: false, stage: 'validation', message: 'Por favor, insira um email válido.' };
  }

  try {
    await addDoc(collection(db, 'newsletter_emails'), {
      email,
      userId: params.userId ?? null,
      criadoEm: Timestamp.now(),
      origem: params.origem,
    });
  } catch (err) {
    console.error('[Newsletter] Erro ao salvar no Firestore:', err);
    return {
      ok: false,
      stage: 'firestore',
      message: 'Erro ao cadastrar email. Tente novamente.',
    };
  }

  const brevo = await syncContactToBrevo(email, params.displayName, BREVO_NEWSLETTER_EDITAIS_LIST_ID);
  if (!brevo.ok) {
    return { ok: false, stage: 'brevo', message: brevo.message };
  }

  trackNewsletterSubscribed({
    source: params.origem,
    isLoggedIn: !!params.userId,
  });

  return { ok: true };
}
