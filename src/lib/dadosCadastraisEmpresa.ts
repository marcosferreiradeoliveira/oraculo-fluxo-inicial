import { formatarCnpj, formatarCpf } from '@/lib/fornecedores';

export type DadosCadastraisEmpresa = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  telefone: string;
  emailInstitucional: string;
  representanteLegal: string;
  cpfRepresentante: string;
  /** Informações extras (opcional) */
  observacoes: string;
};

export function emptyDadosCadastraisEmpresa(): DadosCadastraisEmpresa {
  return {
    cnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    inscricaoEstadual: '',
    inscricaoMunicipal: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    telefone: '',
    emailInstitucional: '',
    representanteLegal: '',
    cpfRepresentante: '',
    observacoes: '',
  };
}

export function formatarCep(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type UfBrasil = (typeof UF_LIST)[number];

export function ufValida(uf: string): boolean {
  const u = uf.trim().toUpperCase();
  return u === '' || (UF_LIST as readonly string[]).includes(u);
}

function linha(label: string, valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  return `${label}: ${v}`;
}

/** Texto usado por anexos e geração de textos (campo legado `dadosCadastrais`). */
export function dadosCadastraisParaTexto(d: DadosCadastraisEmpresa): string {
  const partes = [
    linha('CNPJ', d.cnpj),
    linha('Razão social', d.razaoSocial),
    linha('Nome fantasia', d.nomeFantasia),
    linha('Inscrição estadual', d.inscricaoEstadual),
    linha('Inscrição municipal', d.inscricaoMunicipal),
    linha('CEP', d.cep),
    linha('Endereço', [d.logradouro, d.numero, d.complemento].filter(Boolean).join(', ').trim()),
    linha('Bairro', d.bairro),
    linha('Cidade/UF', [d.cidade, d.uf].filter(Boolean).join(' / ')),
    linha('Telefone', d.telefone),
    linha('E-mail institucional', d.emailInstitucional),
    linha('Representante legal', d.representanteLegal),
    linha('CPF do representante', d.cpfRepresentante),
    linha('Observações', d.observacoes),
  ].filter(Boolean) as string[];
  return partes.join('\n');
}

export function dadosCadastraisPreenchidos(d: DadosCadastraisEmpresa): boolean {
  return Boolean(
    d.cnpj.replace(/\D/g, '').length >= 14 &&
      d.razaoSocial.trim() &&
      d.cep.replace(/\D/g, '').length >= 8 &&
      d.cidade.trim() &&
      d.uf.trim()
  );
}

export function lerDadosCadastraisDoUsuario(
  data: Record<string, unknown> | undefined | null
): DadosCadastraisEmpresa {
  const base = emptyDadosCadastraisEmpresa();
  if (!data) return base;

  const obj = data.dadosCadastraisEmpresa;
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    return { ...base, ...(obj as Partial<DadosCadastraisEmpresa>) };
  }

  const legado = typeof data.dadosCadastrais === 'string' ? data.dadosCadastrais.trim() : '';
  if (legado) {
    return { ...base, observacoes: legado };
  }
  return base;
}

export function normalizarDadosCadastraisEmpresa(
  d: DadosCadastraisEmpresa
): DadosCadastraisEmpresa {
  return {
    ...d,
    cnpj: formatarCnpj(d.cnpj),
    cpfRepresentante: d.cpfRepresentante ? formatarCpf(d.cpfRepresentante) : '',
    cep: formatarCep(d.cep),
    uf: d.uf.trim().toUpperCase().slice(0, 2),
  };
}
