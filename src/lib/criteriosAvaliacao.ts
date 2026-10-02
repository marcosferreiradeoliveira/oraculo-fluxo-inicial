export type TipoProjeto = 'mae' | 'edital';

export type ProjetoComTipo = {
  tipo_projeto?: TipoProjeto;
  edital_id?: string;
  edital_associado?: string;
};

export const NOME_CRITERIOS_GERAIS = 'Critérios gerais de avaliação de projetos culturais';

/** Critérios gerais de avaliação de projetos culturais (projeto mãe / sem edital). */
export const CRITERIOS_GERAIS = `Critérios gerais de avaliação de projetos culturais:

1. RELEVÂNCIA CULTURAL E ARTÍSTICA – Pertinência do projeto para a área cultural; contribuição para a diversidade e para o fortalecimento das expressões culturais.

2. VIABILIDADE TÉCNICA E FINANCEIRA – Coerência entre objetivos, metodologia, cronograma e orçamento; capacidade de execução da proposta.

3. QUALIFICAÇÃO DA EQUIPE – Experiência e competências dos responsáveis; adequação do perfil à natureza do projeto.

4. IMPACTO SOCIAL E DEMOCRATIZAÇÃO – Efeitos esperados na comunidade; ampliação do acesso à cultura e à participação cultural.

5. INOVAÇÃO E DIVERSIDADE – Contribuição para a inovação no campo cultural; valorização da diversidade cultural e das expressões regionais.

6. SUSTENTABILIDADE – Potencial de continuidade e legado do projeto após o período de apoio.

7. COMUNICAÇÃO E DIVULGAÇÃO – Estratégias de divulgação e de registro do projeto; alcance e visibilidade.`;

export function inferirTipoProjeto(p: ProjetoComTipo): TipoProjeto {
  if (p.tipo_projeto === 'mae' || p.tipo_projeto === 'edital') return p.tipo_projeto;
  return p.edital_id || p.edital_associado ? 'edital' : 'mae';
}
