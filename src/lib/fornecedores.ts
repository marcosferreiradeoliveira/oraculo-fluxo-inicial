export type Fornecedor = {
  id: string;
  userId: string;
  nome: string;
  cpf: string;
  identidade: string;
  minibio: string;
  email: string;
  criadoEm?: unknown;
  atualizadoEm?: unknown;
};

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

export function emailValidoBasico(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
