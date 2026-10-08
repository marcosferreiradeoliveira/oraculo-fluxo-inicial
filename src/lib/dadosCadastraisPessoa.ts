import { formatarCep, ufValida } from '@/lib/dadosCadastraisEmpresa';
import { formatarCpf } from '@/lib/fornecedores';

export type DadosCadastraisPessoa = {
  cpf: string;
  rg: string;
  orgaoEmissorRg: string;
  dataNascimento: string;
  telefone: string;
  celular: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  profissao: string;
  nacionalidade: string;
};

export function emptyDadosCadastraisPessoa(): DadosCadastraisPessoa {
  return {
    cpf: '',
    rg: '',
    orgaoEmissorRg: '',
    dataNascimento: '',
    telefone: '',
    celular: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    profissao: '',
    nacionalidade: 'Brasileira',
  };
}

export function lerDadosPessoaDoUsuario(
  data: Record<string, unknown> | undefined | null
): DadosCadastraisPessoa {
  const base = emptyDadosCadastraisPessoa();
  if (!data) return base;
  const obj = data.dadosCadastraisPessoa;
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    return { ...base, ...(obj as Partial<DadosCadastraisPessoa>) };
  }
  return base;
}

export function normalizarDadosCadastraisPessoa(d: DadosCadastraisPessoa): DadosCadastraisPessoa {
  return {
    ...d,
    cpf: d.cpf ? formatarCpf(d.cpf) : '',
    cep: formatarCep(d.cep),
    uf: d.uf.trim().toUpperCase().slice(0, 2),
    nacionalidade: d.nacionalidade.trim() || 'Brasileira',
  };
}

export function validarDadosPessoa(d: DadosCadastraisPessoa): string | null {
  const cpfDigits = d.cpf.replace(/\D/g, '');
  if (cpfDigits.length > 0 && cpfDigits.length !== 11) {
    return 'CPF deve ter 11 dígitos.';
  }
  if (d.uf && !ufValida(d.uf)) {
    return 'UF inválida (use sigla de 2 letras, ex.: SP).';
  }
  return null;
}
