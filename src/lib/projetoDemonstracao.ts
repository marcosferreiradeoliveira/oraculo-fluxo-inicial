/** Rota pública — projeto fictício completo para visitantes não logados */
export const PROJETO_EXEMPLO_PATH = '/projeto-exemplo';

export const PROJETO_DEMO_STEPS = [
  'Criar Projeto',
  'Avaliar com IA',
  'Alterar com IA',
  'Gerar Textos',
  'Criar Orçamento',
  'Criar Cronograma',
  'Documentos de Inscrição',
  'Preencher Anexos',
] as const;

export type ProjetoDemonstracao = {
  nome: string;
  editalNome: string;
  descricao: string;
  analise_ia: string;
  textos_gerados: Record<string, string>;
  orcamento: {
    rubricas: Array<{
      id: string;
      nome: string;
      quantidade: number;
      unidade: string;
      quantidadeUnidade: number;
      valorUnitario: number;
      total: number;
    }>;
  };
  cronograma: {
    etapas: Array<{ id: string; etapa: string; inicio: string; fim: string; observacao?: string }>;
  };
  documentos_inscricao: Array<{ nome: string; status: string }>;
};

export const PROJETO_DEMONSTRACAO: ProjetoDemonstracao = {
  nome: 'Festival de Música e Poesia na Praça',
  editalNome: 'Edital de fomento à cultura — exemplo',
  descricao: `Projeto de realização de um festival gratuito de música e poesia em praça pública, com 4 apresentações ao longo de um fim de semana.

Objetivos: democratizar o acesso à cultura, valorizar artistas locais e promover o encontro entre música e literatura.

Público-alvo: população em geral, famílias e jovens. Estimativa de 2.000 pessoas no total.`,
  analise_ia: `1. ADEQUAÇÃO AOS CRITÉRIOS DO EDITAL
O projeto responde de forma clara aos eixos de democratização do acesso e valorização de artistas locais. A proposta de festival gratuito em espaço público está alinhada ao perfil do edital.

2. PONTOS FORTES DO PROJETO
• Objetivos mensuráveis e público-alvo definido.
• Equipe e parcerias locais descritas com papéis claros.
• Atividades coerentes com o orçamento e o cronograma apresentados.

3. PONTOS FRACOS E GAPS
• Detalhar indicadores de impacto (número de artistas, oficinas, acessibilidade).
• Reforçar estratégia de divulgação além das redes sociais.

4. SUGESTÕES DE MELHORIA
Sugestão: Incluir ações de acessibilidade (libras, audiodescrição) para fortalecer a nota em inclusão.

5. NOTA ESTIMADA (0–10): 8,0 / 10`,
  textos_gerados: {
    justificativa:
      'A proposta justifica-se pela carência de programação cultural gratuita de qualidade no território, reunindo música e literatura em formato acessível à comunidade.',
    objetivos:
      'Geral: promover encontros entre artistas e público em praça pública. Específicos: realizar 4 apresentações; registrar o festival em vídeo; alcançar 2.000 espectadores.',
    metodologia:
      'Curadoria de artistas, produção técnica de palco e som, mediação cultural antes de cada apresentação e divulgação em redes e rádio comunitária.',
    resultados_esperados:
      'Ampliação do acesso à cultura, visibilidade de artistas locais e registro audiovisual para circulação posterior.',
    cronograma:
      'Execução em 10 meses (jan–out/2026): planejamento e curadoria (jan–mar), contratações e licenciamento (mar–jun), oficinas e acessibilidade (abr–jun), montagem e festival (15–21/jun), desmontagem e audiovisual (jun–ago), circulação digital (ago–out) e prestação de contas (jul–out). Marcos com responsáveis e entregas definidas na planilha física do projeto.',
    orcamento:
      'Orçamento total de R$ 600.000,00, com rubricas de cachê artístico, infraestrutura técnica, equipe, acessibilidade, audiovisual, logística e administração, coerentes com festival de médio porte.',
  },
  orcamento: {
    rubricas: [
      {
        id: '1',
        nome: 'Cachê artístico (8 apresentações)',
        quantidade: 8,
        unidade: 'un',
        quantidadeUnidade: 1,
        valorUnitario: 2500,
        total: 20000,
      },
      {
        id: '2',
        nome: 'Locação de palco, som e luz',
        quantidade: 2,
        unidade: 'dia',
        quantidadeUnidade: 1,
        valorUnitario: 4500,
        total: 9000,
      },
      {
        id: '3',
        nome: 'Produção e coordenação',
        quantidade: 3,
        unidade: 'mes',
        quantidadeUnidade: 1,
        valorUnitario: 3500,
        total: 10500,
      },
      {
        id: '4',
        nome: 'Divulgação e design',
        quantidade: 1,
        unidade: 'pacote',
        quantidadeUnidade: 1,
        valorUnitario: 3500,
        total: 3500,
      },
      {
        id: '5',
        nome: 'Equipe técnica (som, luz e palco)',
        quantidade: 6,
        unidade: 'mes',
        quantidadeUnidade: 1,
        valorUnitario: 12500,
        total: 75000,
      },
      {
        id: '6',
        nome: 'Cachê atrações principais (bandas e convidados)',
        quantidade: 5,
        unidade: 'un',
        quantidadeUnidade: 1,
        valorUnitario: 21000,
        total: 105000,
      },
      {
        id: '7',
        nome: 'Infraestrutura de palco, energia e rigging',
        quantidade: 1,
        unidade: 'pacote',
        quantidadeUnidade: 1,
        valorUnitario: 56000,
        total: 56000,
      },
      {
        id: '8',
        nome: 'Estruturas para público (gradil, tendas, sinalização)',
        quantidade: 1,
        unidade: 'pacote',
        quantidadeUnidade: 1,
        valorUnitario: 34000,
        total: 34000,
      },
      {
        id: '9',
        nome: 'Alimentação da equipe e elenco',
        quantidade: 40,
        unidade: 'ref',
        quantidadeUnidade: 1,
        valorUnitario: 720,
        total: 28800,
      },
      {
        id: '10',
        nome: 'Transporte, frete e logística',
        quantidade: 1,
        unidade: 'pacote',
        quantidadeUnidade: 1,
        valorUnitario: 32000,
        total: 32000,
      },
      {
        id: '11',
        nome: 'Hospedagem de artistas regionais',
        quantidade: 70,
        unidade: 'diária',
        quantidadeUnidade: 1,
        valorUnitario: 310,
        total: 21700,
      },
      {
        id: '12',
        nome: 'Segurança privada e brigada',
        quantidade: 6,
        unidade: 'dia',
        quantidadeUnidade: 1,
        valorUnitario: 4000,
        total: 24000,
      },
      {
        id: '13',
        nome: 'Acessibilidade (Libras, audiodescrição, piso tátil)',
        quantidade: 1,
        unidade: 'pacote',
        quantidadeUnidade: 1,
        valorUnitario: 36000,
        total: 36000,
      },
      {
        id: '14',
        nome: 'Registro audiovisual e pós-produção',
        quantidade: 1,
        unidade: 'pacote',
        quantidadeUnidade: 1,
        valorUnitario: 38000,
        total: 38000,
      },
      {
        id: '15',
        nome: 'Campanha de mídia e assessoria de imprensa',
        quantidade: 1,
        unidade: 'pacote',
        quantidadeUnidade: 1,
        valorUnitario: 22000,
        total: 22000,
      },
      {
        id: '16',
        nome: 'Administração financeira e contabilidade',
        quantidade: 6,
        unidade: 'mes',
        quantidadeUnidade: 1,
        valorUnitario: 3500,
        total: 21000,
      },
      {
        id: '17',
        nome: 'ECAD, licenças ambientais e seguro do evento',
        quantidade: 1,
        unidade: 'pacote',
        quantidadeUnidade: 1,
        valorUnitario: 15500,
        total: 15500,
      },
      {
        id: '18',
        nome: 'Cenografia e material expográfico',
        quantidade: 1,
        unidade: 'pacote',
        quantidadeUnidade: 1,
        valorUnitario: 24000,
        total: 24000,
      },
      {
        id: '19',
        nome: 'Oficinas formativas e mediação cultural',
        quantidade: 10,
        unidade: 'un',
        quantidadeUnidade: 1,
        valorUnitario: 2400,
        total: 24000,
      },
    ],
  },
  cronograma: {
    etapas: [
      {
        id: '1',
        etapa: 'Planejamento estratégico e formação da equipe',
        inicio: '2026-01-15',
        fim: '2026-02-28',
        observacao: 'Coordenação geral, organograma e plano de trabalho aprovado',
      },
      {
        id: '2',
        etapa: 'Curadoria artística e seleção de atrações',
        inicio: '2026-02-01',
        fim: '2026-03-31',
        observacao: '8 apresentações + 5 atrações principais confirmadas',
      },
      {
        id: '3',
        etapa: 'Contratação da equipe técnica e produção',
        inicio: '2026-03-01',
        fim: '2026-04-15',
        observacao: 'Som, luz, palco e produção executiva',
      },
      {
        id: '4',
        etapa: 'Assinatura de contratos e cachês artísticos',
        inicio: '2026-03-15',
        fim: '2026-05-15',
        observacao: 'Contratos, notas de empenho e cronograma de pagamentos',
      },
      {
        id: '5',
        etapa: 'Projeto executivo de infraestrutura (palco, som e luz)',
        inicio: '2026-03-01',
        fim: '2026-05-31',
        observacao: 'Memorial descritivo, rider técnico e planta de montagem',
      },
      {
        id: '6',
        etapa: 'Licenciamento urbano, bombeiros e alvarás',
        inicio: '2026-04-01',
        fim: '2026-06-10',
        observacao: 'Praça pública, AVCB e autorização da prefeitura',
      },
      {
        id: '7',
        etapa: 'ECAD, direitos autorais e seguro do evento',
        inicio: '2026-05-01',
        fim: '2026-06-15',
        observacao: 'Apólice RC e guias ECAD quitadas antes da abertura',
      },
      {
        id: '8',
        etapa: 'Identidade visual, design e material gráfico',
        inicio: '2026-04-15',
        fim: '2026-06-01',
        observacao: 'Marca do festival, cartazes, sinalização e kit de imprensa',
      },
      {
        id: '9',
        etapa: 'Campanha de divulgação — fase institucional',
        inicio: '2026-05-01',
        fim: '2026-06-30',
        observacao: 'Redes, rádio comunitária, mailing e parceiros locais',
      },
      {
        id: '10',
        etapa: 'Oficinas formativas e mediação cultural (10 encontros)',
        inicio: '2026-04-01',
        fim: '2026-06-15',
        observacao: 'Formação de artistas e mediadores',
      },
      {
        id: '11',
        etapa: 'Plano operacional de acessibilidade',
        inicio: '2026-04-01',
        fim: '2026-06-01',
        observacao: 'Libras, audiodescrição, piso tátil e fluxo do público PcD',
      },
      {
        id: '12',
        etapa: 'Logística: transporte, frete e hospedagem',
        inicio: '2026-05-15',
        fim: '2026-06-19',
        observacao: 'Artistas regionais e equipamentos',
      },
      {
        id: '13',
        etapa: 'Contratação de segurança e brigada',
        inicio: '2026-05-01',
        fim: '2026-06-21',
        observacao: '6 diárias de operação + plano de contingência',
      },
      {
        id: '14',
        etapa: 'Montagem técnica, ensaios e testes de palco',
        inicio: '2026-06-15',
        fim: '2026-06-19',
        observacao: 'Check-list de segurança e sound check',
      },
      {
        id: '15',
        etapa: 'Campanha de divulgação — virada (pré-evento)',
        inicio: '2026-06-01',
        fim: '2026-06-21',
        observacao: 'Anúncios pagos, cobertura de imprensa e influencers locais',
      },
      {
        id: '16',
        etapa: 'Realização do festival — 1º dia',
        inicio: '2026-06-20',
        fim: '2026-06-20',
        observacao: '4 apresentações, mediação e registro audiovisual',
      },
      {
        id: '17',
        etapa: 'Realização do festival — 2º dia',
        inicio: '2026-06-21',
        fim: '2026-06-21',
        observacao: '4 apresentações, fechamento e agradecimentos',
      },
      {
        id: '18',
        etapa: 'Desmontagem e devolução de equipamentos',
        inicio: '2026-06-22',
        fim: '2026-06-28',
        observacao: 'Relatório fotográfico de desmontagem',
      },
      {
        id: '19',
        etapa: 'Registro audiovisual e pós-produção',
        inicio: '2026-06-20',
        fim: '2026-08-31',
        observacao: 'Edição, legendas, audiodescrição e arquivos finais',
      },
      {
        id: '20',
        etapa: 'Circulação e distribuição digital',
        inicio: '2026-08-01',
        fim: '2026-10-31',
        observacao: 'YouTube, parceiros e escolas — meta 90 dias pós-evento',
      },
      {
        id: '21',
        etapa: 'Relatório de execução e indicadores de impacto',
        inicio: '2026-07-01',
        fim: '2026-09-15',
        observacao: 'Público, artistas, acessibilidade e mídia',
      },
      {
        id: '22',
        etapa: 'Prestação de contas financeira',
        inicio: '2026-07-15',
        fim: '2026-10-31',
        observacao: 'Notas fiscais, extratos e planilha R$ 600 mil',
      },
      {
        id: '23',
        etapa: 'Avaliação participativa e encerramento do projeto',
        inicio: '2026-09-01',
        fim: '2026-10-15',
        observacao: 'Oficina de balanço com equipe e parceiros',
      },
    ],
  },
  documentos_inscricao: [
    { nome: 'Certidões negativas (FGTS, CNDT)', status: 'Anexado (exemplo)' },
    { nome: 'Estatuto social / contrato social', status: 'Anexado (exemplo)' },
    { nome: 'Comprovante de endereço da sede', status: 'Anexado (exemplo)' },
  ],
};

export function formatarMoedaBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Campos iniciais do formulário /avaliar-projeto (visitante) */
export const PROJETO_EXEMPLO = {
  nome: PROJETO_DEMONSTRACAO.nome,
  descricao: PROJETO_DEMONSTRACAO.descricao,
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type AvaliacaoDemoProgress = {
  setStatus: (status: string) => void;
  setSubEtapas: (etapas: string[]) => void;
  setConteudo: (parcial: string) => void;
};

/** Simula avaliação com IA para visitantes (sem Cloud Function). */
export async function executarAvaliacaoDemonstracao(progress: AvaliacaoDemoProgress): Promise<string> {
  const full = PROJETO_DEMONSTRACAO.analise_ia;
  const fases: Array<[string, string[]]> = [
    ['Coletando dados do projeto e edital...', ['Lendo edital e critérios...']],
    ['Gerando avaliação demonstrativa...', ['Simulando banca examinadora...']],
    ['Recebendo análise...', ['Organizando pontos fortes e gaps...']],
  ];
  for (const [status, subs] of fases) {
    progress.setStatus(status);
    progress.setSubEtapas(subs);
    await delay(650);
  }
  const tokens = full.match(/\S+|\s+/g) ?? [full];
  let acc = '';
  for (let i = 0; i < tokens.length; i += 6) {
    acc += tokens.slice(i, i + 6).join('');
    progress.setConteudo(acc);
    await delay(35);
  }
  progress.setConteudo(full);
  return full;
}

export function textoDemonstracaoPorTipo(tipo: string): string {
  const t = PROJETO_DEMONSTRACAO.textos_gerados[tipo];
  if (t) return t;
  return `Texto demonstrativo para "${tipo}". Crie sua conta para gerar conteúdo personalizado com IA.`;
}

/** Simula geração de texto na etapa /avaliar-projeto/gerar-textos (sem API). */
export async function simularGeracaoTextoDemo(
  tipo: string,
  onUpdate: (parcial: string) => void
): Promise<string> {
  const full = textoDemonstracaoPorTipo(tipo);
  await delay(350);
  onUpdate('');
  const tokens = full.match(/\S+|\s+/g) ?? [full];
  let acc = '';
  for (let i = 0; i < tokens.length; i += 4) {
    acc += tokens.slice(i, i + 4).join('');
    onUpdate(acc);
    await delay(30);
  }
  onUpdate(full);
  return full;
}

export function aplicarSugestaoDemonstracao(textoBase: string, sugestao: string): string {
  const bloco = sugestao.trim();
  if (!bloco) return textoBase;
  return `${textoBase.trim()}\n\n${bloco}`;
}

/** UI do parecer demonstrativo (Módulo 1 — visitante deslogado) */
export type DemoCriterioNota = {
  nome: string;
  nota: number;
  max: number;
  alerta?: boolean;
};

export const DEMO_PARECER_UI = {
  statusBadge: 'APROVADO COM RESSALVAS',
  notaGlobal: 8.0,
  notaMax: 10,
  criterios: [
    { nome: 'Exequibilidade Orçamentária', nota: 8.0, max: 10 },
    { nome: 'Democratização e Acessibilidade', nota: 6.0, max: 10, alerta: true },
    { nome: 'Coerência dos Objetivos', nota: 10.0, max: 10 },
  ] as DemoCriterioNota[],
  textoOriginal:
    'Festival gratuito em praça pública com 4 apresentações. Objetivo de democratizar o acesso à cultura e valorizar artistas locais. Público estimado: 2.000 pessoas.',
  textoOtimizado:
    'Festival gratuito em praça pública com 4 apresentações, mediação cultural e ações de acessibilidade (Libras e audiodescrição em ao menos 50% das apresentações). Objetivos mensuráveis: 2.000 espectadores, 8 artistas contratados, registro audiovisual para circulação pós-evento.',
  ganhoPontos: 2.0,
  pontosFortes: [
    'Objetivos claros e alinhados ao edital de democratização cultural.',
    'Orçamento coerente com escala do festival e rubricas identificáveis.',
    'Equipe e parcerias locais com papéis definidos na execução.',
  ],
  gaps: [
    'Falta detalhar acessibilidade atitudinal e Libras de forma operacional.',
    'Indicadores de impacto ainda genéricos (faltam metas por ação).',
    'Plano de divulgação limitado a redes sociais — ampliar rádio comunitária e parceiros.',
  ],
};

/** Wizard e conteúdo rico — espelho do fluxo real (visitante /avaliar-projeto) */
export const DEMO_WIZARD_STEPS = [
  'Criar Projeto',
  'Profundidade e Escopo',
  'Leitura do Edital',
  'Gerar Textos',
  'Definir Orçamento',
  'Criar Cronograma',
  'Documentos e Inscrição',
  'Finalizar e Inscrição',
] as const;

export type DemoCriterioMatriz = {
  titulo: string;
  analise: string;
  pontuacao: string;
  obtida: number;
  maxima: number;
};

export const DEMO_MODULO1 = {
  etapaAtiva: 2,
  planBadge: 'Demonstração',
  /** Resumo curto exibido antes da nota na análise demo */
  resumoProjeto:
    'Festival gratuito de música e poesia em praça pública, com oito apresentações em um fim de semana, mediação cultural e foco em artistas locais. Objetivo: democratizar o acesso à cultura e reunir cerca de 2.000 pessoas, com registro audiovisual para circulação após o evento.',
  criteriosMatriz: [
    {
      titulo: '1. Relevância artístico-cultural da proposta (0 a 30 pontos)',
      analise:
        'A proposta articula democratização do acesso e valorização de artistas locais com viabilidade técnica plausível. Há coerência entre objetivos, público-alvo e formato em praça pública. O histórico de realizações comunitárias reforça credibilidade, embora falte detalhar inovação metodológica e registro de impacto de edições anteriores.',
      pontuacao: '21/30',
      obtida: 21,
      maxima: 30,
    },
    {
      titulo: '2. Trajetória do agente cultural e da equipe (0 a 30 pontos)',
      analise:
        'A proponente possui uma trajetória sólida e reconhecida na aplicação de tecnologias inovadoras em contextos culturais, como demonstrado no portfólio. A equipe parece bem equipada para executar o projeto, dada sua experiência com tecnologias emergentes e projetos culturais.',
      pontuacao: '28/30',
      obtida: 28,
      maxima: 30,
    },
    {
      titulo: '3. Viabilidade técnica de execução (0 a 20 pontos)',
      analise:
        'O projeto apresenta uma estratégia de comunicação clara, mas carece de detalhes sobre o cronograma e a distribuição orçamentária, o que dificulta a avaliação completa da viabilidade técnica. A descrição dos eventos e das parcerias é promissora, mas faltam informações específicas sobre a execução técnica.',
      pontuacao: '14/20',
      obtida: 14,
      maxima: 20,
    },
    {
      titulo: '4. Promoção da democratização de acesso e acessibilidade (0 a 20 pontos)',
      analise:
        'O projeto aborda a acessibilidade ao incluir legendas e audiodescrição, além de planejar eventos comunitários. No entanto, poderia expandir mais sobre como envolverá públicos diversos e garantir a acessibilidade em todas as etapas do projeto.',
      pontuacao: '16/20',
      obtida: 16,
      maxima: 20,
    },
  ] as DemoCriterioMatriz[],
  notaTotal: {
    obtida: 79,
    maxima: 100,
    rotulo: '79/100',
  },
  /** @deprecated use criteriosMatriz[0] */
  criterioRelevancia: {
    titulo: 'Relevância artístico-cultural da proposta (0 a 30 pontos)',
    analise:
      'A proposta articula democratização do acesso e valorização de artistas locais com viabilidade técnica plausível.',
    pontuacao: '21/30',
  },
  pontosFortes: [
    'Inovação Tecnológica — registro audiovisual e divulgação digital integrada ao festival.',
    'Parcerias Estratégicas — coletivos locais, rádio comunitária e pontos culturais.',
    'Formação — oficina preparatória e mediação cultural nas apresentações.',
    'Impacto Comunitário — acesso gratuito e meta de 2.000 espectadores.',
  ],
  gaps: [
    'Falta de informações detalhadas no cronograma (marcos, responsáveis e entregas).',
    'Acessibilidade limitada — Libras e audiodescrição ainda não operacionalizadas.',
    'Lacunas técnicas no orçamento e na descrição de parcerias institucionais.',
  ],
  sugestoesMelhoria: [
    'Determinar um cronograma claro e uma planilha orçamentária que demonstre a viabilidade técnica e financeira do festival, com marcos e responsáveis por entrega.',
    'Expandir as estratégias de acessibilidade para incluir audiodescrição e Libras em ao menos metade das apresentações, com custos previstos.',
    'Fornecer mais informações sobre as parcerias estratégicas (instituições, contrapartidas e papéis na execução).',
  ],
  secoesTextoProjeto: [
    {
      titulo: '1. Estratégia de Comunicação',
      corpo:
        'Divulgação multicanal: redes sociais, rádio comunitária parceira, cartazes em pontos culturais e mailing para escolas. Identidade visual única para o festival e cobertura ao vivo de uma apresentação.',
    },
    {
      titulo: '2. Formação Digital e Recursos',
      corpo:
        'Oficina preparatória para artistas locais sobre produção de conteúdo e uso de plataformas digitais; kit de apoio com orientações de acessibilidade e registro de audiência.',
    },
    {
      titulo: '3. Eventos Comunitários',
      corpo:
        'Quatro apresentações gratuitas em praça pública, com mediação cultural antes de cada ato, estimativa de 2.000 espectadores no fim de semana e registro audiovisual para circulação pós-evento.',
    },
  ],
};
