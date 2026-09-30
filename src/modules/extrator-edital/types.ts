
export interface Documento {
  nome: string;
  fase: 'inscrição' | 'contratação';
}

export interface ProjetoSelecionado {
  nome: string;
  proponente: string;
  resumo: string;
  valor: string;
  ano: string;
  fonte: string;
  url?: string;
}

export interface HistoricoEdital {
  edicoesAnteriores: string[];
  frequencia: string;
  ultimaEdicao: string;
}

export interface EditalData {
  nome: string;
  proponente: string;
  escopo: string;
  categorias: string[];
  criterios: string;
  dataEncerramento: string;
  data_encerramento: string;
  textos_exigidos: string[];
  documentacao_exigida: Documento[];
  valor_maximo_premiacao: string;
  criado_em: string;
  projetos_selecionados?: ProjetoSelecionado[];
  historico_edital?: HistoricoEdital;
}
