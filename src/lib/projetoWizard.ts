import { inferirTipoProjeto, type ProjetoComTipo } from '@/lib/criteriosAvaliacao';

/** Labels e rotas do assistente de criação de projeto (ordem fixa). */
export const WIZARD_STEP_LABELS = [
  'Criar Projeto',
  'Avaliar com IA',
  'Alterar com IA',
  'Gerar Textos',
  'Criar Cronograma',
  'Criar Orçamento',
  'Equipe',
  'Documentos de Inscrição',
  'Preencher Anexos',
] as const;

export const WIZARD_STEP = {
  criarProjeto: 0,
  avaliar: 1,
  alterar: 2,
  gerarTextos: 3,
  cronograma: 4,
  orcamento: 5,
  equipe: 6,
  documentos: 7,
  anexos: 8,
} as const;

/** Rota ao abrir o projeto (lista / dashboard). Projetos sem edital → Alterar com IA. */
export function projetoEntryPath(projectId: string, projeto?: ProjetoComTipo | null): string {
  if (projeto && inferirTipoProjeto(projeto) === 'mae') {
    return `/projeto/${projectId}/alterar-com-ia`;
  }
  return `/projeto/${projectId}`;
}

export function wizardRoutes(projectId: string): string[] {
  return [
    '/criar-projeto',
    `/projeto/${projectId}`,
    `/projeto/${projectId}/alterar-com-ia`,
    `/projeto/${projectId}/gerar-textos`,
    `/projeto/${projectId}/criar-cronograma`,
    `/projeto/${projectId}/criar-orcamento`,
    `/projeto/${projectId}/equipe`,
    `/projeto/${projectId}/documentos-inscricao`,
    `/projeto/${projectId}/preencher-anexos`,
  ];
}
