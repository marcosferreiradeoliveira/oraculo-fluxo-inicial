import type { AtividadeFornecedor } from '@/lib/atividadesReferenciaFgv';

export type TipoPessoaFornecedor = 'PF' | 'PJ';

export type Fornecedor = {
  id: string;
  userId: string;
  /** PF = pessoa física; PJ = pessoa jurídica. Registros antigos sem campo tratados como PF. */
  tipoPessoa?: TipoPessoaFornecedor;
  nome: string;
  cpf: string;
  cnpj?: string;
  identidade: string;
  minibio: string;
  email: string;
  /** Função/atividade na tabela FGV (referência) ou cadastro livre. */
  atividade?: AtividadeFornecedor;
  criadoEm?: unknown;
  atualizadoEm?: unknown;
};

export function tipoPessoaFornecedor(f: Pick<Fornecedor, 'tipoPessoa' | 'cnpj'>): TipoPessoaFornecedor {
  if (f.tipoPessoa === 'PJ') return 'PJ';
  if (f.tipoPessoa === 'PF') return 'PF';
  const cnpjDigits = (f.cnpj || '').replace(/\D/g, '');
  return cnpjDigits.length === 14 ? 'PJ' : 'PF';
}

export type FornecedorInput = Omit<Fornecedor, 'id' | 'userId' | 'criadoEm' | 'atualizadoEm'>;

export function formatarCpf(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function cpfValidoBasico(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '');
  return d.length === 11 && !/^(\d)\1{10}$/.test(d);
}

export function formatarCnpj(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function cnpjValidoBasico(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, '');
  return d.length === 14 && !/^(\d)\1{13}$/.test(d);
}

export function emailValidoBasico(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
