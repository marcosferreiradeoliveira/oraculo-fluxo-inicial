import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAdicionarContatoBrevoUrl } from '@/lib/functionsUrl';
import { countdownDias } from '@/lib/editalLandingPages';

/**
 * Remarketing de funil (landing de edital + créditos não usados).
 *
 * No painel Brevo, crie atributos de contato (tipo indicado):
 * - EDITAL_NOME (texto)
 * - EDITAL_SLUG (texto)
 * - EDITAL_ENCERRAMENTO (data, YYYY-MM-DD)
 * - DIAS_ATE_ENCERRAMENTO (número)
 * - FUNIL_REMARKETING (texto)
 * - CREDITOS_RESTANTES (número)
 * - LINK_SIMULACAO (texto)
 * - NOME_PROJETO (texto)
 *
 * Lista dedicada (ex.: "Remarketing editais") → VITE_BREVO_REMARKETING_LIST_ID
 * Automação exemplo: FUNIL_REMARKETING ∈ { lead_capturado, analise_preview, cadastro_pendente, creditos_nao_usados }
 *   AND DIAS_ATE_ENCERRAMENTO ≤ 5 → e-mail "O edital {{ params.EDITAL_NOME }} fecha em X dias..."
 */

export const BREVO_REMARKETING_EDITAIS_LIST_ID = Number(
  import.meta.env.VITE_BREVO_REMARKETING_LIST_ID ?? 16
);

export type RemarketingFunil =
  | 'visitou_landing'
  | 'lead_capturado'
  | 'analise_preview'
  | 'cadastro_pendente'
  | 'cadastro_concluido_creditos_intactos'
  | 'creditos_usados';

export type SyncEditalRemarketingParams = {
  email: string;
  funil: RemarketingFunil;
  editalTitulo: string;
  editalSlug: string;
  dataEncerramentoIso: string;
  nomeContato?: string | null;
  nomeProjeto?: string | null;
  creditosRestantes?: number | null;
};

function landingUrl(slug: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/${slug}`;
  }
  return `https://oraculocultural.com.br/${slug}`;
}

function buildAttributes(params: SyncEditalRemarketingParams): Record<string, string | number> {
  const dias = countdownDias(params.dataEncerramentoIso);
  const attrs: Record<string, string | number> = {
    EDITAL_NOME: params.editalTitulo,
    EDITAL_SLUG: params.editalSlug,
    EDITAL_ENCERRAMENTO: params.dataEncerramentoIso,
    DIAS_ATE_ENCERRAMENTO: dias,
    FUNIL_REMARKETING: params.funil,
    LINK_SIMULACAO: landingUrl(params.editalSlug),
  };
  if (params.nomeProjeto?.trim()) {
    attrs.NOME_PROJETO = params.nomeProjeto.trim();
  }
  if (params.creditosRestantes != null && !Number.isNaN(params.creditosRestantes)) {
    attrs.CREDITOS_RESTANTES = params.creditosRestantes;
  }
  return attrs;
}

async function persistLeadEvent(params: SyncEditalRemarketingParams): Promise<void> {
  try {
    await addDoc(collection(db, 'remarketing_leads'), {
      email: params.email.trim().toLowerCase(),
      funil: params.funil,
      editalSlug: params.editalSlug,
      editalTitulo: params.editalTitulo,
      dataEncerramentoIso: params.dataEncerramentoIso,
      nomeProjeto: params.nomeProjeto ?? null,
      creditosRestantes: params.creditosRestantes ?? null,
      criadoEm: Timestamp.now(),
    });
  } catch (err) {
    console.warn('[Remarketing] Firestore remarketing_leads:', err);
  }
}

/**
 * Sincroniza contato + atributos na lista de remarketing Brevo (não bloqueia UX).
 */
export function syncEditalRemarketingToBrevo(params: SyncEditalRemarketingParams): void {
  const email = params.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

  void persistLeadEvent(params);

  const url = getAdicionarContatoBrevoUrl();
  const body = {
    email,
    nome: params.nomeContato || params.nomeProjeto || null,
    listId: BREVO_REMARKETING_EDITAIS_LIST_ID,
    attributes: buildAttributes(params),
  };

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((err) => {
    console.warn('[Remarketing] Brevo sync falhou:', err);
  });
}

/** Lê contexto da landing gravado na sessão demo (pós-lead / pós-preview). */
export function getRemarketingContextFromSession(): {
  editalTitulo: string;
  editalSlug: string;
  dataEncerramentoIso: string;
  nomeProjeto: string;
  email: string;
} | null {
  try {
    const raw = sessionStorage.getItem('avaliarProjeto_dados');
    const email =
      sessionStorage.getItem('oraculo_landing_email') ||
      (raw ? (JSON.parse(raw) as { email?: string }).email : '') ||
      '';
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      nome?: string;
      editalAssociado?: string;
      landingSlug?: string;
      email?: string;
    };
    const slug = data.landingSlug || sessionStorage.getItem('oraculo_landing_slug') || '';
    const titulo = data.editalAssociado || sessionStorage.getItem('oraculo_landing_edital_nome') || '';
    const enc = sessionStorage.getItem('oraculo_landing_data_encerramento') || '';
    if (!email || !slug || !titulo || !enc) return null;
    return {
      email: email.trim().toLowerCase(),
      editalTitulo: titulo,
      editalSlug: slug,
      dataEncerramentoIso: enc,
      nomeProjeto: data.nome || sessionStorage.getItem('oraculo_landing_nome_projeto') || '',
    };
  } catch {
    return null;
  }
}

export function stashRemarketingLandingMeta(slug: string, dataEncerramentoIso: string): void {
  sessionStorage.setItem('oraculo_landing_slug', slug);
  sessionStorage.setItem('oraculo_landing_data_encerramento', dataEncerramentoIso);
}
