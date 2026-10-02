import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2, Save, DollarSign, Sparkles, FileDown, FileText, CheckCircle2, Undo2 } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';
import { trackTextGenerationStarted, trackTextGenerationCompleted, trackProjectStepViewed } from '@/lib/analytics';
import {
  arredondarValorOrcamento,
  extrairValorRsUltimoDaLinha,
  instrucoesQuantidadeRubricas,
  linhaIgnoradaNoOrcamento,
  minimoRubricasOrcamento,
  ORCAMENTO_COOLDOWN_ENTRE_TENTATIVAS_SEC,
  checklistRubricasDetalhadas,
  extrairQuantidadeMesesDaLinha,
  posProcessarRubricasGeradas,
} from '@/lib/orcamentoTeto';
import {
  inferirDuracaoMesesCronograma,
  instrucoesOrcamentoAlinhadoCronograma,
  resumoCronogramaParaOrcamento,
} from '@/lib/cronogramaDuracao';
import { getFunctionsBaseUrl } from '@/lib/functionsUrl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VinculoCronogramaOrcamentoPainel } from '@/components/cronograma/VinculoCronogramaOrcamentoPainel';
import {
  type EtapaVinculo,
  limparRubricasOrfas,
  sugerirVinculosRubricasEtapas,
} from '@/lib/vinculoCronogramaOrcamento';

interface RubricaOrcamento {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  quantidadeUnidade: number;
  valorUnitario: number;
  total: number;
}

interface ProjetoDocument {
  id: string;
  nome?: string;
  edital_id?: string;
  orcamento?: {
    teto: number;
    rubricas: RubricaOrcamento[];
  };
  cronograma?: {
    duracaoMeses?: number;
    etapas?: {
      id?: string;
      etapa?: string;
      inicio?: string;
      fim?: string;
      rubricasAssociadas?: string[];
    }[];
  };
  [key: string]: any;
}

interface EditalDocument {
  id: string;
  teto?: number;
  valor_maximo?: number;
  orcamento_limite?: number;
  limite_orcamento?: number;
  [key: string]: any;
}

const UNIDADES = [
  'achê',
  'serviço',
  'dia',
  'dias',
  'mês',
  'meses',
  'semana',
  'semanas',
  'quilômetro',
  'quilômetros',
  'km',
  'locação',
  'pessoa',
  'pessoas',
  'verba',
  'verbas',
  'unidade',
  'unidades',
  'hora',
  'horas'
];

// Função para detectar unidade baseada no nome da rubrica
const detectarUnidade = (nomeRubrica: string, textoLinha?: string): string => {
  const nomeLower = nomeRubrica.toLowerCase();
  
  // Verificar se há unidade mencionada explicitamente no texto da linha
  if (textoLinha) {
    const padraoUnidade = new RegExp(`(?:\\(unidade:\\s*|unidade:\\s*|por\\s+|/\\s*)([a-záêêéíóôú]+)`, 'i');
    const match = textoLinha.match(padraoUnidade);
    if (match && match[1]) {
      let unidadeEncontrada = match[1].toLowerCase().trim();
      // Normalizar plural/singular
      if (unidadeEncontrada === 'dias') return 'dia';
      if (unidadeEncontrada === 'meses') return 'mês';
      if (unidadeEncontrada === 'semanas') return 'semana';
      if (unidadeEncontrada === 'quilômetros' || unidadeEncontrada === 'quilometros' || unidadeEncontrada === 'km') return 'km';
      if (unidadeEncontrada === 'pessoas') return 'pessoa';
      if (unidadeEncontrada === 'verbas') return 'verba';
      if (unidadeEncontrada === 'unidades') return 'unidade';
      if (unidadeEncontrada === 'horas') return 'hora';
      if (UNIDADES.includes(unidadeEncontrada)) {
        return unidadeEncontrada;
      }
    }
  }
  
  // Detectar por palavras-chave no nome da rubrica (mais específico primeiro)
  
  // DIÁRIA - deve vir antes de "dia" genérico
  if (nomeLower.includes('diária') || nomeLower.includes('diaria') || nomeLower.includes('per diem') || nomeLower.includes('perdiem')) {
    return 'dia';
  }
  
  // LOCAÇÃO/ALUGUEL
  if (nomeLower.includes('locação') || nomeLower.includes('locacao') || nomeLower.includes('aluguel') || 
      nomeLower.includes('aluguel') || nomeLower.includes('locar') || nomeLower.includes('arrendamento')) {
    return 'mês';
  }
  
  // TRANSPORTE/KM
  if (nomeLower.includes('transporte') || nomeLower.includes('deslocamento') || nomeLower.includes('combustível') || 
      nomeLower.includes('combustivel') || nomeLower.includes('quilômetro') || nomeLower.includes('quilometro') || 
      nomeLower.includes(' km') || nomeLower.includes('km ') || nomeLower.includes('viagem') || nomeLower.includes('passagem')) {
    return 'km';
  }
  
  // MÃO DE OBRA/PESSOAS
  if (nomeLower.includes('mão de obra') || nomeLower.includes('mao de obra') || nomeLower.includes('mão-de-obra') ||
      nomeLower.includes('profissional') || nomeLower.includes('técnico') || nomeLower.includes('tecnico') || 
      nomeLower.includes('artista') || nomeLower.includes('diretor') || nomeLower.includes('produtor') ||
      nomeLower.includes('ator') || nomeLower.includes('atriz') || nomeLower.includes('músico') || nomeLower.includes('musico') ||
      nomeLower.includes('cenógrafo') || nomeLower.includes('cenografo') || nomeLower.includes('iluminador') ||
      nomeLower.includes('som') || nomeLower.includes('figurinista') || nomeLower.includes('maquiador') ||
      nomeLower.includes('equipe') || nomeLower.includes('staff') || nomeLower.includes('pessoal')) {
    return 'pessoa';
  }
  
  // SEMANA
  if (nomeLower.includes('semana') || nomeLower.includes('semanal')) {
    return 'semana';
  }
  
  // HORA
  if ((nomeLower.includes('hora') || nomeLower.includes('horas')) && 
      !nomeLower.includes('horário') && !nomeLower.includes('horario') && !nomeLower.includes('horarios')) {
    return 'hora';
  }
  
  // MATERIAL/EQUIPAMENTO - itens físicos
  if (nomeLower.includes('material') || nomeLower.includes('equipamento') || nomeLower.includes('insumo') || 
      nomeLower.includes('item') || nomeLower.includes('aparelho') || nomeLower.includes('máquina') || nomeLower.includes('maquina') ||
      nomeLower.includes('computador') || nomeLower.includes('notebook') || nomeLower.includes('câmera') || nomeLower.includes('camera') ||
      nomeLower.includes('fone') || nomeLower.includes('microfone') || nomeLower.includes('caixa de som') ||
      nomeLower.includes('projetor') || nomeLower.includes('impressora') || nomeLower.includes('papel') ||
      nomeLower.includes('cartolina') || nomeLower.includes('tinta') || nomeLower.includes('pincel') ||
      nomeLower.includes('tela') || nomeLower.includes('cabo') || nomeLower.includes('adaptador')) {
    return 'unidade';
  }
  
  // DIVULGAÇÃO/PUBLICIDADE/MARKETING - serviços especializados
  if (nomeLower.includes('divulgação') || nomeLower.includes('divulgacao') || nomeLower.includes('publicidade') || 
      nomeLower.includes('marketing') || nomeLower.includes('assessoria de imprensa') || nomeLower.includes('press release') ||
      nomeLower.includes('redes sociais') || nomeLower.includes('social media') || nomeLower.includes('influencer') ||
      nomeLower.includes('patrocínio') || nomeLower.includes('patrocinio')) {
    return 'serviço';
  }
  
  // PRODUÇÃO/COORDENAÇÃO - verbas gerais
  if (nomeLower.includes('produção') || nomeLower.includes('producao') || nomeLower.includes('coordenação') ||
      nomeLower.includes('coordenacao') || nomeLower.includes('gerência') || nomeLower.includes('gerencia') ||
      nomeLower.includes('administração') || nomeLower.includes('administracao') || nomeLower.includes('gestão') ||
      nomeLower.includes('gestao') || nomeLower.includes('verba') || nomeLower.includes('recursos')) {
    return 'verba';
  }
  
  // HOSPEDAGEM - diária
  if (nomeLower.includes('hospedagem') || nomeLower.includes('hotel') || nomeLower.includes('pousada') ||
      nomeLower.includes('acomodação') || nomeLower.includes('acomodacao')) {
    return 'dia';
  }
  
  // ALIMENTAÇÃO - pode ser dia ou serviço
  if (nomeLower.includes('alimentação') || nomeLower.includes('alimentacao') || nomeLower.includes('refeição') ||
      nomeLower.includes('refeicao') || nomeLower.includes('catering') || nomeLower.includes('buffet')) {
    return 'serviço';
  }
  
  // PADRÃO: usar serviço para coisas genéricas, não unidade
  return 'serviço';
};

const CriarOrcamento = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [projeto, setProjeto] = useState<ProjetoDocument | null>(null);
  const [edital, setEdital] = useState<EditalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [gerandoOrcamento, setGerandoOrcamento] = useState(false);
  const [tetoOrcamento, setTetoOrcamento] = useState<number>(0);
  const [rubricas, setRubricas] = useState<RubricaOrcamento[]>([]);
  const [rubricasAnteriores, setRubricasAnteriores] = useState<RubricaOrcamento[]>([]); // Guardar versão anterior antes de aplicar alterações
  const [temAlteracoesPendentes, setTemAlteracoesPendentes] = useState(false); // Flag para indicar se há alterações não salvas
  const [sugestoesAlteracoes, setSugestoesAlteracoes] = useState<string>('');
  const [processandoAlteracoes, setProcessandoAlteracoes] = useState(false);
  const [rateLimitModal, setRateLimitModal] = useState<{ message: string; retryAfterSeconds?: number } | null>(null);
  const [etapasCronograma, setEtapasCronograma] = useState<EtapaVinculo[]>([]);
  const [abaOrcamento, setAbaOrcamento] = useState('rubricas');

  const gerarIdEtapa = () => Math.random().toString(36).slice(2, 11);

  const rubricasParaVinculo = useMemo(
    () =>
      rubricas
        .filter((r) => r.nome.trim())
        .map((r) => ({ id: r.id, nome: r.nome.trim() })),
    [rubricas]
  );

  const aplicarSugestaoVinculosOrcamento = () => {
    if (!etapasCronograma.length) {
      toast.info('Não há etapas no cronograma. Crie o cronograma antes de vincular.');
      return;
    }
    setEtapasCronograma(sugerirVinculosRubricasEtapas(etapasCronograma, rubricasParaVinculo));
    toast.success('Vínculos sugeridos — revise e salve o orçamento.');
  };

  const vincularOrcamentoGeradoAoCronograma = (lista: RubricaOrcamento[]) => {
    const rub = lista.filter((r) => r.nome.trim()).map((r) => ({ id: r.id, nome: r.nome.trim() }));
    if (!rub.length) return;
    setEtapasCronograma((prev) => {
      if (!prev.length) return prev;
      return sugerirVinculosRubricasEtapas(prev, rub);
    });
    setAbaOrcamento('vinculos');
    toast.success('Orçamento gerado. Revise os vínculos com o cronograma e clique em Salvar orçamento.', {
      duration: 6000,
    });
  };
  const steps = ['Criar Projeto', 'Avaliar com IA', 'Alterar com IA', 'Gerar Textos', 'Criar Cronograma', 'Criar Orçamento', 'Equipe', 'Documentos de Inscrição', 'Preencher Anexos'];
  const currentStep = 5;

  // Analytics: etapa "Criar Orçamento" visualizada (Mixpanel/Firebase/GTM) — uma vez ao carregar
  const stepViewedRef = React.useRef(false);
  useEffect(() => {
    if (id && projeto && !stepViewedRef.current) {
      stepViewedRef.current = true;
      trackProjectStepViewed({
        projectId: id,
        step: 'criar_orcamento',
        });
    }
  }, [id, projeto]);


  useEffect(() => {
    const fetchProjeto = async () => {
      if (!id || !user) {
        setLoading(false);
        navigate('/');
        return;
      }

      setLoading(true);
      try {
        const db = getFirestore();
        const projetoRef = doc(db, 'projetos', id);
        const projetoSnap = await getDoc(projetoRef);

        if (!projetoSnap.exists()) {
          console.error('Projeto não encontrado');
          setLoading(false);
          navigate('/');
          return;
        }

        const projetoData = {
          id: projetoSnap.id,
          ...projetoSnap.data()
        } as ProjetoDocument;

        setProjeto(projetoData);

        const etapasRaw = projetoData.cronograma?.etapas ?? [];
        setEtapasCronograma(
          Array.isArray(etapasRaw)
            ? etapasRaw.map((e) => ({
                id: e.id || gerarIdEtapa(),
                etapa: e.etapa || '',
                inicio: e.inicio,
                fim: e.fim,
                rubricasAssociadas: e.rubricasAssociadas ?? [],
              }))
            : []
        );

        // Buscar edital para obter o teto do orçamento
        if (projetoData.edital_id) {
          try {
            const editalRef = doc(db, 'editais', projetoData.edital_id);
            const editalSnap = await getDoc(editalRef);
            
            if (editalSnap.exists()) {
              const editalData = {
                id: editalSnap.id,
                ...editalSnap.data()
              } as EditalDocument;
              
              setEdital(editalData);
              
              // Buscar teto do orçamento do edital (tentar diferentes campos possíveis)
              const tetoEdital = editalData.teto || 
                                 editalData.valor_maximo || 
                                 editalData.orcamento_limite || 
                                 editalData.limite_orcamento || 
                                 0;
              
              // Só definir o teto do edital se não houver um já salvo no orçamento
              if (tetoEdital > 0) {
                // Verificar se já existe um teto salvo no orçamento do projeto
                if (!projetoData.orcamento?.teto || projetoData.orcamento.teto === 0) {
                  setTetoOrcamento(tetoEdital);
                }
              }
            }
          } catch (error) {
            console.error('Erro ao buscar edital:', error);
          }
        }

        // Carregar orçamento existente se houver
        if (projetoData.orcamento) {
          // Se já tem teto salvo no orçamento, usar ele (pode ter sido editado)
          if (projetoData.orcamento.teto && projetoData.orcamento.teto > 0) {
            setTetoOrcamento(projetoData.orcamento.teto);
          }
          setRubricas(projetoData.orcamento.rubricas || []);
        } else {
          // Inicializar com uma rubrica vazia
          setRubricas([{
            id: Date.now().toString(),
            nome: '',
            quantidade: 1,
            unidade: 'unidade',
            quantidadeUnidade: 1,
            valorUnitario: 0,
            total: 0
          }]);
        }

        setLoading(false);
      } catch (error) {
        console.error('Erro ao carregar projeto:', error);
        setLoading(false);
      }
    };

    fetchProjeto();
  }, [id, navigate, user]);

  // Calcular total da linha automaticamente
  const calcularTotal = (quantidade: number, quantidadeUnidade: number, valorUnitario: number): number => {
    return quantidade * quantidadeUnidade * valorUnitario;
  };

  // Atualizar rubrica
  const atualizarRubrica = (id: string, campo: keyof RubricaOrcamento, valor: any) => {
    setRubricas(prev => prev.map(rubrica => {
      if (rubrica.id === id) {
        const atualizada = { ...rubrica, [campo]: valor };
        
        // Recalcular total se quantidade, quantidadeUnidade ou valorUnitario mudaram
        if (campo === 'quantidade' || campo === 'quantidadeUnidade' || campo === 'valorUnitario') {
          atualizada.total = calcularTotal(
            campo === 'quantidade' ? valor : atualizada.quantidade,
            campo === 'quantidadeUnidade' ? valor : atualizada.quantidadeUnidade,
            campo === 'valorUnitario' ? valor : atualizada.valorUnitario
          );
        }
        
        return atualizada;
      }
      return rubrica;
    }));
  };

  // Adicionar nova rubrica
  const adicionarRubrica = () => {
    setRubricas(prev => [...prev, {
      id: Date.now().toString(),
      nome: '',
      quantidade: 1,
      unidade: 'unidade',
      quantidadeUnidade: 1,
      valorUnitario: 0,
      total: 0
    }]);
  };

  // Remover rubrica
  const removerRubrica = (id: string) => {
    if (rubricas.length === 1) {
      toast.error('Rubrica necessária', {
        description: 'É necessário ter pelo menos uma rubrica.',
        duration: 4000,
      });
      return;
    }
    setRubricas(prev => prev.filter(r => r.id !== id));
  };

  // Calcular total geral
  const calcularTotalGeral = (): number => {
    return rubricas.reduce((total, rubrica) => total + rubrica.total, 0);
  };

  const avisarSePoucasRubricas = (lista: RubricaOrcamento[]) => {
    const min = minimoRubricasOrcamento(tetoOrcamento);
    if (lista.length > 0 && lista.length < min) {
      toast.warning(`Poucas rubricas (${lista.length} de ${min} esperadas)`, {
        description:
          'Gere o orçamento de novo (prompt pede mais detalhes) ou use "+ Adicionar Rubrica".',
        duration: 7000,
      });
    }
  };

  // Gerar orçamento com IA em streaming
  const gerarOrcamento = async () => {
    if (!projeto) {
      toast.error('Erro ao carregar projeto', {
        description: 'Não foi possível carregar as informações do projeto.',
        duration: 4000,
      });
      return;
    }

    if (!tetoOrcamento || tetoOrcamento <= 0) {
      toast.error('Teto do orçamento necessário', {
        description: 'Por favor, defina um teto de orçamento antes de gerar.',
        duration: 4000,
      });
      return;
    }


    setGerandoOrcamento(true);
    // Limpar rubricas existentes para começar do zero
    setRubricas([]);

    const startTimeOrcamento = Date.now();
    trackTextGenerationStarted({
      projectId: id!,
      textType: 'orcamento',
    });

    let gerouComSucesso = false;
    let rubricasFinaisGeracao: RubricaOrcamento[] = [];
    try {
      // Buscar dados do projeto para enviar à IA
      const descricaoProjeto = projeto.descricao || '';
      const nomeProjeto = projeto.nome || 'Projeto';
      const resumoProjeto = projeto.resumo || '';

      // Buscar portfolio do usuário se houver
      let portfolioTexto = '';
      if (user) {
        try {
          const db = getFirestore();
          const userDocRef = doc(db, 'usuarios', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            portfolioTexto = userDoc.data().portfolio || '';
          }
        } catch (err) {
          console.error('Erro ao buscar portfolio:', err);
        }
      }

      const endpoint = `${getFunctionsBaseUrl()}/gerarTextosProjeto`;
      const minEsperado = minimoRubricasOrcamento(tetoOrcamento);
      const tetoFmt = tetoOrcamento.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const duracaoMeses = inferirDuracaoMesesCronograma(projeto.cronograma);
      const resumoCron = resumoCronogramaParaOrcamento(projeto.cronograma);
      const blocoCron =
        resumoCron.trim().length > 0
          ? `${instrucoesOrcamentoAlinhadoCronograma(duracaoMeses)}\n\n${resumoCron}\n\n`
          : '';
      if (!resumoCron.trim()) {
        toast.info('Cronograma vazio — orçamento sem prazo de referência.', {
          description: 'Crie o cronograma antes para alinhar rubricas mensais.',
          duration: 5000,
        });
      }
      const promptBase = `${blocoCron}Gere um orçamento detalhado para o projeto. VALOR TOTAL (valor CHEIO): R$ ${tetoFmt} — soma EXATA. ${instrucoesQuantidadeRubricas(tetoOrcamento)} Uma rubrica por linha: "Nome: R$ valor" ou "Nome (unidade: mês, quantidade: N): R$ valor" (R$ = total da linha).`;

      const orcamentoGeracaoId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `orc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const consumirStreamOrcamento = async (
        response: Response,
        onProgress?: (rubricas: RubricaOrcamento[]) => void
      ): Promise<RubricaOrcamento[]> => {
        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as {
            message?: string;
            retryAfterSeconds?: number;
          };
          const err = new Error(
            errorData.message ||
              `Erro ao gerar orçamento: ${response.status} - ${JSON.stringify(errorData)}`
          ) as Error & { status?: number; retryAfterSeconds?: number };
          err.status = response.status;
          err.retryAfterSeconds = errorData.retryAfterSeconds;
          throw err;
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Não foi possível ler a resposta do servidor');

        const decoder = new TextDecoder();
        let buffer = '';
        let textoAcumulado = '';
        let textoCompletoEvento = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') continue;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.type === 'chunk' && parsed.content) {
                textoAcumulado += parsed.content;
                if (onProgress && textoAcumulado.length > 200) {
                  const parcial = posProcessarRubricasGeradas(
                    extrairRubricasDoTexto(textoAcumulado),
                    tetoOrcamento,
                    duracaoMeses
                  );
                  if (parcial.length > 0) onProgress(parcial);
                }
              }
              if (parsed.type === 'complete') {
                textoCompletoEvento = parsed.fullText || textoAcumulado;
              }
            } catch {
              /* chunk inválido */
            }
          }
        }

        const textoFinal = textoCompletoEvento || textoAcumulado;
        return posProcessarRubricasGeradas(
          extrairRubricasDoTexto(textoFinal),
          tetoOrcamento,
          duracaoMeses
        );
      };

      let melhor: RubricaOrcamento[] = [];
      const maxTentativas = 2;

      for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
        const reforco =
          tentativa === 1
            ? ''
            : [
                `REFORÇO (2ª passagem): mínimo ${minEsperado} rubricas.`,
                'NÃO repita só Coordenação Geral, Direção Artística e Produção Executiva.',
                checklistRubricasDetalhadas(),
                `Soma EXATA R$ ${tetoFmt}.`,
              ].join(' ');

        if (tentativa > 1) {
          toast.info(
            `Aguardando ${ORCAMENTO_COOLDOWN_ENTRE_TENTATIVAS_SEC}s (limite do servidor)…`,
            { duration: ORCAMENTO_COOLDOWN_ENTRE_TENTATIVAS_SEC * 1000 }
          );
          await sleepMs(ORCAMENTO_COOLDOWN_ENTRE_TENTATIVAS_SEC * 1000);
          toast.info('Detalhando orçamento (2ª passagem)…', { duration: 4000 });
          setRubricas([]);
        }

        let resultado: RubricaOrcamento[] = [];
        let fetchOk = false;

        for (let sub = 0; sub < 2 && !fetchOk; sub++) {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projetoId: id,
              tipo: 'orcamento',
              refinementAttempt: tentativa,
              orcamentoGeracaoId,
              dadosProjeto: {
                ...projeto,
                portfolio: portfolioTexto,
                teto: tetoOrcamento,
              },
              prompt: reforco ? `${promptBase}\n\n${reforco}` : promptBase,
              userId: user?.uid,
            }),
          });

          try {
            resultado = await consumirStreamOrcamento(
              response,
              tentativa === 1 ? (r) => setRubricas(r) : undefined
            );
            fetchOk = true;
          } catch (streamErr: unknown) {
            const e = streamErr as Error & { status?: number; retryAfterSeconds?: number };
            if (e.status === 429 && sub === 0) {
              const waitSec = Math.min(60, Math.max(1, e.retryAfterSeconds ?? 30));
              toast.info(`Aguardando ${waitSec}s (limite do servidor)…`, { duration: waitSec * 1000 });
              await sleepMs(waitSec * 1000 + 500);
              continue;
            }
            throw streamErr;
          }
        }

        if (resultado.length > melhor.length) melhor = resultado;
        if (resultado.length >= minEsperado) {
          setRubricas(resultado);
          rubricasFinaisGeracao = resultado;
          gerouComSucesso = true;
          break;
        }
      }

      if (!gerouComSucesso && melhor.length > 0) {
        setRubricas(melhor);
        rubricasFinaisGeracao = melhor;
        gerouComSucesso = true;
        avisarSePoucasRubricas(melhor);
      }

    } catch (error) {
      console.error('Erro ao gerar orçamento:', error);
      toast.error('Erro ao gerar orçamento', {
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        duration: 5000,
      });
    } finally {
      if (gerouComSucesso) {
        trackTextGenerationCompleted({
          projectId: id!,
          textType: 'orcamento',
          durationSeconds: (Date.now() - startTimeOrcamento) / 1000,
        });
        if (rubricasFinaisGeracao.length > 0) {
          if (etapasCronograma.length > 0) {
            vincularOrcamentoGeradoAoCronograma(rubricasFinaisGeracao);
          } else {
            toast.info('Orçamento gerado. Crie o cronograma para vincular rubricas às etapas.');
          }
        }
      }
      setGerandoOrcamento(false);
    }
  };

  const adicionarRubricaDeLinha = (
    linhaLimpa: string,
    idCounter: number,
    rubricasProcessadas: Set<string>,
    rubricas: RubricaOrcamento[]
  ): number => {
    if (linhaIgnoradaNoOrcamento(linhaLimpa)) return idCounter;
    const valorRaw = extrairValorRsUltimoDaLinha(linhaLimpa);
    if (!valorRaw) return idCounter;

    let nome = linhaLimpa.split(/R\$/i)[0].trim().replace(/^\d+[\.\)]\s*/, '').replace(/^[-*•]\s*/, '');
    nome = nome.replace(/\s*[:\-]\s*$/, '').trim();
    nome = nome.replace(/\s*\(unidade\s*:\s*[^)]+\)/gi, '').trim();
    nome = nome.replace(/\s*\(por\s+[^)]+\)/gi, '').trim();
    nome = nome.replace(/\s*\/\s*[a-záêêéíóôú]+$/i, '').trim();
    if (nome.length < 3 || /^teto\b/i.test(nome)) return idCounter;

    const valorTotal = arredondarValorOrcamento(valorRaw, tetoOrcamento);
    const chave = `${nome.toLowerCase().trim()}_${valorTotal}`;
    if (rubricasProcessadas.has(chave)) return idCounter;

    rubricasProcessadas.add(chave);
    const unidade = detectarUnidade(nome, linhaLimpa);
    const duracaoMeses = inferirDuracaoMesesCronograma(projeto?.cronograma);
    let quantidadeUnidade = 1;
    if (unidade === 'mês') {
      const expl = extrairQuantidadeMesesDaLinha(linhaLimpa);
      quantidadeUnidade = expl ?? duracaoMeses;
      quantidadeUnidade = Math.max(1, Math.min(120, Math.round(quantidadeUnidade)));
    }
    const quantidade = 1;
    const valorUnitario =
      quantidade * quantidadeUnidade > 0
        ? arredondarValorOrcamento(valorTotal / (quantidade * quantidadeUnidade), tetoOrcamento)
        : valorTotal;
    rubricas.push({
      id: (idCounter++).toString(),
      nome,
      quantidade,
      unidade,
      quantidadeUnidade,
      valorUnitario,
      total: valorTotal,
    });
    return idCounter;
  };

  const extrairRubricasDoTextoStream = (texto: string, idCounterBase: number): RubricaOrcamento[] => {
    const rubricas: RubricaOrcamento[] = [];
    let idCounter = idCounterBase;
    const rubricasProcessadas = new Set<string>();

    for (const linha of texto.split('\n')) {
      let linhaLimpa = linha.trim().replace(/^[-*•]\s+/, '').trim();
      if (!linhaLimpa) continue;
      idCounter = adicionarRubricaDeLinha(linhaLimpa, idCounter, rubricasProcessadas, rubricas);
    }

    return rubricas;
  };

  const extrairRubricasDoTexto = (texto: string): RubricaOrcamento[] => {
    const rubricas: RubricaOrcamento[] = [];
    let idCounter = Date.now();
    const rubricasProcessadas = new Set<string>();

    for (const linha of texto.split('\n')) {
      let linhaLimpa = linha.trim().replace(/^[-*•]\s+/, '').trim();
      if (!linhaLimpa) continue;
      idCounter = adicionarRubricaDeLinha(linhaLimpa, idCounter, rubricasProcessadas, rubricas);
    }

    return rubricas;
  };

  // Processar alterações sugeridas
  const processarAlteracoes = async () => {
    if (!sugestoesAlteracoes.trim() || rubricas.length === 0 || !projeto) {
      toast.error('Preencha as sugestões', {
        description: 'Por favor, preencha as sugestões de alterações e tenha rubricas no orçamento.',
        duration: 4000,
      });
      return;
    }

    setProcessandoAlteracoes(true);
    
    // Guardar versão anterior das rubricas antes de aplicar alterações
    setRubricasAnteriores([...rubricas]);
    
    try {
      // Buscar portfolio do usuário se houver
      let portfolioTexto = '';
      if (user) {
        try {
          const db = getFirestore();
          const userDocRef = doc(db, 'usuarios', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            portfolioTexto = userDoc.data().portfolio || '';
          }
        } catch (err) {
          console.error('Erro ao buscar portfolio:', err);
        }
      }

      const endpoint = `${getFunctionsBaseUrl()}/gerarTextosProjeto`;
      
      // Criar contexto do orçamento atual
      const orcamentoAtual = rubricas.map((r, idx) => 
        `${idx + 1}. ${r.nome}: Quantidade ${r.quantidade} ${r.unidade}, ${r.quantidadeUnidade} unidade(s), Valor unitário R$ ${r.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Total R$ ${r.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ).join('\n');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projetoId: id,
          tipo: 'orcamento',
          dadosProjeto: {
            ...projeto,
            portfolio: portfolioTexto,
            teto: tetoOrcamento,
            orcamentoAtual: orcamentoAtual,
            totalGeral: calcularTotalGeral()
          },
          prompt: `Aplique as seguintes sugestões de alterações ao orçamento abaixo.

CRÍTICO - REGRA OBRIGATÓRIA: A soma total de TODAS as rubricas DEVE ser IGUAL ou MENOR que o TETO MÁXIMO de R$ ${tetoOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. 

IMPORTANTE:
- Se as alterações sugeridas fizerem o total ultrapassar o teto, você DEVE ajustar os valores das rubricas proporcionalmente ou remover/adicionar rubricas para manter o total dentro do teto.
- O teto máximo de R$ ${tetoOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NÃO pode ser ultrapassado sob nenhuma circunstância.
- Use valores redondos (múltiplos de 100 para valores >= 1000, múltiplos de 50 para valores >= 100, múltiplos de 10 para valores >= 10).

SUGESTÕES DE ALTERAÇÕES:
${sugestoesAlteracoes}

ORÇAMENTO ATUAL:
${orcamentoAtual}

TETO MÁXIMO ABSOLUTO: R$ ${tetoOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
TOTAL ATUAL: R$ ${calcularTotalGeral().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

Gere um orçamento atualizado aplicando as alterações sugeridas, mas GARANTINDO que o total final seja igual ou menor que R$ ${tetoOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.

Formate cada rubrica como: "Nome da Rubrica: R$ valor" ou "Nome da Rubrica - R$ valor". Use valores redondos, sem centavos.`,
          userId: user?.uid
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          const message = (errorData as { message?: string }).message ?? (errorData as { error?: string }).error ?? 'Aguarde alguns segundos antes de gerar este texto novamente.';
          const retryAfterSeconds = (errorData as { retryAfterSeconds?: number }).retryAfterSeconds;
          setRateLimitModal({ message, retryAfterSeconds });
          setProcessandoAlteracoes(false);
          return;
        }
        throw new Error(`Erro ao processar alterações: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      // Processar resposta streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let textoAcumulado = '';
      let idCounter = Date.now();

      if (!reader) {
        throw new Error('Não foi possível ler a resposta do servidor');
      }

      // Limpar rubricas anteriores antes de aplicar as novas
      setRubricas([]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              break;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'chunk' && parsed.content) {
                textoAcumulado += parsed.content;
                
                clearTimeout((window as any).timeoutRubricasAlteracoes);
                (window as any).timeoutRubricasAlteracoes = setTimeout(() => {
                  if (textoAcumulado.length > 200) {
                    setRubricas(prev => {
                      const todasRubricas = extrairRubricasDoTextoStream(textoAcumulado, idCounter);
                      
                      if (todasRubricas.length >= prev.length) {
                        const mapaRubricas = new Map<string, RubricaOrcamento>();
                        
                        prev.forEach(r => {
                          const chave = `${r.nome.toLowerCase().trim()}_${Math.round(r.total * 100)}`;
                          if (!mapaRubricas.has(chave)) {
                            mapaRubricas.set(chave, r);
                          }
                        });
                        
                        todasRubricas.forEach(rubrica => {
                          const chave = `${rubrica.nome.toLowerCase().trim()}_${Math.round(rubrica.total * 100)}`;
                          if (!mapaRubricas.has(chave) && rubrica.nome.trim() && rubrica.total > 0) {
                            mapaRubricas.set(chave, rubrica);
                          }
                        });
                        
                        const todasAtualizadas = Array.from(mapaRubricas.values());
                        
                        const dm = inferirDuracaoMesesCronograma(projeto?.cronograma);
                        return posProcessarRubricasGeradas(todasAtualizadas, tetoOrcamento, dm);
                      }
                      return prev;
                    });
                  }
                }, 1000);
              }
              
              if (parsed.type === 'complete') {
                clearTimeout((window as any).timeoutRubricasAlteracoes);
                const textoFinal = parsed.fullText || textoAcumulado;
                setRubricas(prev => {
                  const rubricasFinais = extrairRubricasDoTexto(textoFinal);
                  
                  const dm = inferirDuracaoMesesCronograma(projeto?.cronograma);
                  const ajustadas = posProcessarRubricasGeradas(rubricasFinais, tetoOrcamento, dm);
                  return ajustadas.length > 0 ? ajustadas : prev;
                });
              }
            } catch (e) {
              console.debug('Erro ao parsear chunk:', e);
            }
          }
        }
      }

      // Limpar o campo de sugestões após processar
      setSugestoesAlteracoes('');
      
      // Marcar que há alterações pendentes (não salvas ainda)
      setTemAlteracoesPendentes(true);
      
      // Mostrar toast estilizado de sucesso
      toast.success('Alterações aplicadas com sucesso!', {
        description: 'Revise o orçamento e aprove as alterações ou volte à versão anterior.',
        duration: 6000,
        icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
        className: 'bg-green-50 border-green-200',
        style: {
          background: 'linear-gradient(to right, #f0fdf4, #dcfce7)',
          border: '1px solid #86efac',
          borderRadius: '0.5rem',
          padding: '1rem',
        }
      });

    } catch (error) {
      console.error('Erro ao processar alterações:', error);
      toast.error('Erro ao processar alterações', {
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        duration: 5000,
      });
    } finally {
      setProcessandoAlteracoes(false);
    }
  };

  // Desfazer alterações e voltar para versão anterior
  const desfazerAlteracoes = () => {
    if (rubricasAnteriores.length > 0) {
      setRubricas([...rubricasAnteriores]);
      setTemAlteracoesPendentes(false);
      setRubricasAnteriores([]);
      toast.success('Alterações desfeitas', {
        description: 'Orçamento restaurado para a versão anterior.',
        duration: 3000,
      });
    }
  };

  // Salvar orçamento
  const salvarOrcamento = async () => {
    if (!id) return;

    setSalvando(true);
    try {
      const db = getFirestore();
      const projetoRef = doc(db, 'projetos', id);
      
      const nomesValidos = new Set(rubricas.map((r) => r.nome.trim()).filter(Boolean));
      const etapasVinculo =
        etapasCronograma.length > 0
          ? limparRubricasOrfas(etapasCronograma, nomesValidos)
          : null;

      const payload: Record<string, unknown> = {
        orcamento: {
          teto: tetoOrcamento,
          rubricas: rubricas,
          totalGeral: calcularTotalGeral(),
          atualizado_em: serverTimestamp(),
        },
      };

      if (etapasVinculo && etapasVinculo.length > 0) {
        payload.cronograma = {
          ...(projeto?.cronograma || {}),
          etapas: etapasVinculo,
          atualizado_em: serverTimestamp(),
        };
        setEtapasCronograma(etapasVinculo);
      }

      await updateDoc(projetoRef, payload);

      setTemAlteracoesPendentes(false);
      setRubricasAnteriores([]);

      toast.success('Orçamento salvo com sucesso!', {
        description:
          etapasVinculo && etapasVinculo.length > 0
            ? 'Orçamento e vínculos com o cronograma foram salvos.'
            : 'O orçamento foi salvo no projeto.',
        duration: 4000,
        icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
      });
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error);
      toast.error('Erro ao salvar orçamento', {
        description: 'Por favor, tente novamente.',
        duration: 5000,
      });
    } finally {
      setSalvando(false);
    }
  };

  // Exportar para PDF
  const exportarParaPDF = () => {
    const totalGeral = calcularTotalGeral();
    
    // Criar conteúdo HTML para o PDF
    let html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #1a1a1a; margin-bottom: 10px; }
            h2 { color: #333; margin-top: 20px; margin-bottom: 10px; }
            .info { margin-bottom: 20px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .total { font-weight: bold; font-size: 1.1em; margin-top: 20px; }
            .teto { margin-top: 10px; }
          </style>
        </head>
        <body>
          <h1>Orçamento - ${projeto?.nome || 'Projeto'}</h1>
          <div class="info">
            <p><strong>Teto do Orçamento:</strong> R$ ${tetoOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          
          <h2>Rubricas</h2>
          <table>
            <thead>
              <tr>
                <th>Nome da Rubrica</th>
                <th class="text-center">Quantidade</th>
                <th class="text-center">Unidade</th>
                <th class="text-center">Qtd. Unidade</th>
                <th class="text-right">Valor Unitário (R$)</th>
                <th class="text-right">Total (R$)</th>
              </tr>
            </thead>
            <tbody>
    `;

    rubricas.forEach(rubrica => {
      html += `
        <tr>
          <td>${rubrica.nome || ''}</td>
          <td class="text-center">${rubrica.quantidade}</td>
          <td class="text-center">${rubrica.unidade}</td>
          <td class="text-center">${rubrica.quantidadeUnidade}</td>
          <td class="text-right">${rubrica.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="text-right">${rubrica.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
          
          <div class="total">
            <p><strong>Total Geral:</strong> R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p class="teto"><strong>Diferença do Teto:</strong> R$ ${(tetoOrcamento - totalGeral).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </body>
      </html>
    `;

    // Criar nova janela e imprimir
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  // Exportar para XLS (Excel) - usando CSV formatado
  const exportarParaXLS = () => {
    const totalGeral = calcularTotalGeral();
    
    // Criar conteúdo CSV (que pode ser aberto no Excel como XLS)
    let csv = `\ufeffOrçamento - ${projeto?.nome || 'Projeto'}\n\n`;
    csv += `Teto do Orçamento;R$ ${tetoOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
    csv += `Nome da Rubrica;Quantidade;Unidade;Qtd. Unidade;Valor Unitário (R$);Total (R$)\n`;
    
    rubricas.forEach(rubrica => {
      const nome = (rubrica.nome || '').replace(/"/g, '""');
      csv += `"${nome}";${rubrica.quantidade};"${rubrica.unidade}";${rubrica.quantidadeUnidade};${rubrica.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })};${rubrica.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    });
    
    csv += `\nTotal Geral;R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    csv += `Diferença do Teto;R$ ${(tetoOrcamento - totalGeral).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;

    // Criar blob e fazer download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `orcamento_${projeto?.nome?.replace(/[^a-z0-9]/gi, '_') || 'projeto'}_${new Date().toISOString().split('T')[0]}.xls`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-oraculo-blue mb-4" />
            <p className="text-gray-600">Carregando projeto...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="bg-white rounded-lg p-6 shadow-sm text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Erro ao carregar o projeto</h2>
            <p className="text-gray-600 mb-4">Não foi possível carregar as informações do projeto.</p>
            <Button onClick={() => navigate('/')} className="bg-oraculo-blue hover:bg-oraculo-blue/90">
              Voltar
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const totalGeral = calcularTotalGeral();
  const diferencaTeto = tetoOrcamento - totalGeral;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <DashboardHeader />
        
        <main className="flex-1 p-3 md:p-8 overflow-x-hidden pb-20 md:pb-8 min-h-0">
          <div className="max-w-7xl mx-auto min-w-0">
            <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-3xl font-bold text-gray-900 mb-2">
                  Criar Orçamento
                </h1>
                <p className="text-gray-600 text-sm md:text-base break-words">
                  Crie um orçamento detalhado para o projeto &quot;{projeto.nome || 'sem nome'}&quot;
                </p>
              </div>
              <div className="flex flex-col items-stretch sm:items-end gap-1.5 flex-shrink-0 w-full sm:w-auto">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Próximo passo</span>
                <Button
                  size="lg"
                  onClick={() => navigate(`/projeto/${id}/equipe`)}
                  className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white w-full sm:w-auto px-4 sm:px-6 md:px-8 py-3 sm:py-2.5 text-sm sm:text-base font-semibold"
                >
                  Próximo: Equipe <span className="ml-2 opacity-90">→</span>
                </Button>
              </div>
            </div>

            {/* Barra de progresso - scroll horizontal no mobile */}
            <div className="mb-6 md:mb-8 overflow-hidden">
              <div className="flex items-center gap-2 md:justify-between mb-2 overflow-x-auto pb-2 md:pb-0 min-w-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                {steps.map((step, index) => {
                  const isClickable = index <= currentStep;
                  return (
                    <div
                      key={index}
                      className={`flex flex-col items-center flex-shrink-0 min-w-[3.5rem] md:min-w-0 ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    >
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                          index <= currentStep
                            ? 'bg-oraculo-blue text-white hover:bg-oraculo-blue/90'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <span
                        className={`text-xs mt-1 text-center whitespace-nowrap transition-colors ${
                          index === currentStep
                            ? 'font-medium text-oraculo-blue'
                            : index < currentStep
                              ? 'text-oraculo-blue hover:underline'
                              : 'text-gray-500'
                        }`}
                      >
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 min-w-0">
                <div
                  className="bg-oraculo-blue h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              {/* Teto do Orçamento */}
              <div className="p-4 md:p-6 border-b">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="teto" className="text-base font-semibold mb-2 block">
                      Teto do Orçamento (R$)
                    </Label>
                    <Input
                      id="teto"
                      type="number"
                      step="0.01"
                      min="0"
                      value={tetoOrcamento === 0 ? '' : tetoOrcamento}
                      onChange={(e) => {
                        const valorDigitado = e.target.value;
                        if (valorDigitado === '' || valorDigitado.trim() === '') {
                          setTetoOrcamento(0);
                        } else {
                          const valor = parseFloat(valorDigitado) || 0;
                          setTetoOrcamento(valor);
                        }
                      }}
                      className="text-lg h-11 w-full min-w-0"
                      placeholder="0.00"
                    />
                    {edital && tetoOrcamento > 0 && (
                      <p className="text-sm text-gray-500 mt-1 break-words">
                        Sugerido do edital: {edital.titulo || edital.nome || 'Edital associado'} (você pode editar)
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col justify-end sm:pt-7">
                    <Button
                      onClick={gerarOrcamento}
                      disabled={gerandoOrcamento || tetoOrcamento <= 0}
                      className="bg-gradient-to-r from-oraculo-purple to-oraculo-blue hover:opacity-90 text-white px-6 py-2 h-11 whitespace-nowrap w-full sm:w-auto"
                    >
                      {gerandoOrcamento ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Gerar Orçamento
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Campo de Sugestões de Alterações — só aparece depois de gerado o primeiro orçamento */}
              {rubricas.length > 0 && (
              <div className="p-4 md:p-6 border-b border-gray-200">
                <Label htmlFor="sugestoes" className="text-base font-semibold text-gray-900 mb-2 block">
                  Sugestões de Alterações ao Orçamento
                </Label>
                <Textarea
                  id="sugestoes"
                  value={sugestoesAlteracoes}
                  onChange={(e) => setSugestoesAlteracoes(e.target.value)}
                  placeholder="Digite suas sugestões de alterações ou observações sobre o orçamento..."
                  className="min-h-[100px] resize-y mb-3 w-full min-w-0"
                  rows={4}
                />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm text-gray-500 order-2 sm:order-1">
                    Use este campo para adicionar comentários, sugestões ou observações sobre o orçamento gerado.
                  </p>
                  <Button
                    onClick={processarAlteracoes}
                    disabled={!sugestoesAlteracoes.trim() || processandoAlteracoes}
                    className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white w-full sm:w-auto order-1 sm:order-2"
                  >
                    {processandoAlteracoes ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Aplicar Alterações
                      </>
                    )}
                  </Button>
                </div>
              </div>
              )}

              <div className="p-4 md:p-6 min-w-0 border-b">
                <Tabs value={abaOrcamento} onValueChange={setAbaOrcamento}>
                  <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                    <TabsTrigger value="rubricas">Rubricas</TabsTrigger>
                    <TabsTrigger value="vinculos">Orçamento × Cronograma</TabsTrigger>
                  </TabsList>
                  <TabsContent value="rubricas" className="mt-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Rubricas do Orçamento</h2>
                  <Button
                    onClick={adicionarRubrica}
                    className="bg-oraculo-blue hover:bg-oraculo-blue/90 text-white w-full sm:w-auto"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Rubrica
                  </Button>
                </div>

                <div className="overflow-x-auto -mx-2 md:mx-0">
                  <table className="w-full border-collapse min-w-[640px]">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left p-2 md:p-3 font-semibold text-gray-700 text-sm">Nome da Rubrica</th>
                        <th className="text-center p-2 md:p-3 font-semibold text-gray-700 text-sm">Qtd</th>
                        <th className="text-center p-2 md:p-3 font-semibold text-gray-700 text-sm">Unidade</th>
                        <th className="text-center p-2 md:p-3 font-semibold text-gray-700 text-sm">Qtd. Un.</th>
                        <th className="text-center p-2 md:p-3 font-semibold text-gray-700 text-sm">Valor Unit. (R$)</th>
                        <th className="text-center p-2 md:p-3 font-semibold text-gray-700 text-sm">Total (R$)</th>
                        <th className="text-center p-2 md:p-3 font-semibold text-gray-700 text-sm">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rubricas.map((rubrica, index) => (
                        <tr key={rubrica.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-2 md:p-3">
                            <Input
                              value={rubrica.nome}
                              onChange={(e) => atualizarRubrica(rubrica.id, 'nome', e.target.value)}
                              placeholder="Ex: Material gráfico"
                              className="min-w-[120px] md:min-w-[200px] w-full max-w-[200px]"
                            />
                          </td>
                          <td className="p-2 md:p-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={rubrica.quantidade}
                              onChange={(e) => atualizarRubrica(rubrica.id, 'quantidade', parseFloat(e.target.value) || 0)}
                              className="text-center w-16 md:w-20"
                            />
                          </td>
                          <td className="p-2 md:p-3">
                            <Select
                              value={rubrica.unidade}
                              onValueChange={(value) => atualizarRubrica(rubrica.id, 'unidade', value)}
                            >
                              <SelectTrigger className="w-24 md:w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UNIDADES.map((unidade) => (
                                  <SelectItem key={unidade} value={unidade}>
                                    {unidade}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2 md:p-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={rubrica.quantidadeUnidade}
                              onChange={(e) => atualizarRubrica(rubrica.id, 'quantidadeUnidade', parseFloat(e.target.value) || 0)}
                              className="text-center w-16 md:w-24"
                            />
                          </td>
                          <td className="p-2 md:p-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={rubrica.valorUnitario}
                              onChange={(e) => atualizarRubrica(rubrica.id, 'valorUnitario', parseFloat(e.target.value) || 0)}
                              className="text-center w-20 md:w-28"
                            />
                          </td>
                          <td className="p-2 md:p-3">
                            <div className="text-center font-semibold text-gray-900 bg-gray-100 px-2 md:px-3 py-2 rounded text-sm">
                              {rubrica.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </td>
                          <td className="p-2 md:p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removerRubrica(rubrica.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold">
                        <td colSpan={5} className="p-2 md:p-3 text-right text-sm md:text-base">
                          Total Geral:
                        </td>
                        <td className="p-2 md:p-3 text-center text-base md:text-lg text-oraculo-blue">
                          {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                      {tetoOrcamento > 0 && (
                        <tr className="bg-blue-50">
                          <td colSpan={5} className="p-2 md:p-3 text-right text-sm md:text-base">
                            Diferença (Teto - Total):
                          </td>
                          <td className={`p-2 md:p-3 text-center font-semibold text-sm md:text-base ${
                            diferencaTeto >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {diferencaTeto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td></td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
                  </TabsContent>
                  <TabsContent value="vinculos" className="mt-0">
                    <VinculoCronogramaOrcamentoPainel
                      etapas={etapasCronograma}
                      rubricas={rubricasParaVinculo}
                      onEtapasChange={setEtapasCronograma}
                      onSugerirVinculos={
                        rubricasParaVinculo.length && etapasCronograma.length
                          ? aplicarSugestaoVinculosOrcamento
                          : undefined
                      }
                      emptyEtapasMessage={
                        id
                          ? `Nenhuma etapa no cronograma. Volte em Criar Cronograma ou abra /projeto/${id}/criar-cronograma.`
                          : 'Nenhuma etapa no cronograma.'
                      }
                    />
                    <p className="text-xs text-gray-500 mt-4">
                      Os vínculos são gravados no cronograma ao clicar em &quot;Salvar Orçamento&quot;.
                    </p>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Botões de ação */}
              <div className="p-4 md:p-6 border-t bg-gray-50 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-start">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/projeto/${id}/gerar-textos`)}
                  className="border-gray-300 w-full sm:w-auto order-2 sm:order-1"
                >
                  Voltar
                </Button>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center order-1 sm:order-2 min-w-0">
                  <div className="flex flex-wrap gap-2 justify-start">
                    <Button
                      onClick={exportarParaPDF}
                      disabled={rubricas.length === 0}
                      variant="outline"
                      className="border-gray-300 hover:bg-gray-50"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Exportar PDF
                    </Button>
                    <Button
                      onClick={exportarParaXLS}
                      disabled={rubricas.length === 0}
                      variant="outline"
                      className="border-gray-300 hover:bg-gray-50"
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      Exportar XLS
                    </Button>
                    {temAlteracoesPendentes && (
                      <Button
                        onClick={desfazerAlteracoes}
                        disabled={!rubricasAnteriores.length || processandoAlteracoes}
                        variant="outline"
                        className="border-orange-300 text-orange-700 hover:bg-orange-50"
                      >
                        <Undo2 className="mr-2 h-4 w-4" />
                        Desfazer
                      </Button>
                    )}
                    <Button
                      onClick={salvarOrcamento}
                      disabled={salvando}
                      className="bg-oraculo-blue hover:bg-oraculo-blue/90 text-white"
                    >
                      {salvando ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Salvar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Próximo passo: Documentos de Inscrição — mesmo formato da página Gerar Textos */}
            <div className="flex flex-col items-stretch sm:items-end gap-2 pt-6 sm:pt-8 pb-6 px-4 md:px-8 mt-8 sm:mt-10 border-t-2 border-oraculo-blue/20 bg-gradient-to-r from-transparent to-oraculo-purple/5 rounded-b-xl">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Próximo passo</span>
              <Button
                size="lg"
                onClick={() => navigate(`/projeto/${id}/equipe`)}
                className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white w-full sm:w-auto px-4 sm:px-8 md:px-10 py-3 sm:py-4 text-sm sm:text-base md:text-lg font-semibold"
              >
                Próximo: Equipe <span className="ml-2 text-lg sm:text-xl" aria-hidden>→</span>
              </Button>
            </div>
          </div>
        </main>
      </div>

      {/* Popup estilizado para limite de taxa (429) */}
      <Dialog open={!!rateLimitModal} onOpenChange={(open) => !open && setRateLimitModal(null)}>
        <DialogContent className="sm:max-w-md bg-white border-2 border-amber-200/80 shadow-xl rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/80 pointer-events-none" />
          <DialogHeader className="relative">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 border-2 border-amber-300/80 shadow-inner">
              <Clock className="h-7 w-7 text-amber-600" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold text-gray-800 pt-3">
              Aguarde um momento
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-center space-y-3 pt-1 pb-2">
                <p className="text-gray-600 leading-relaxed">
                  {rateLimitModal?.message}
                </p>
                {rateLimitModal?.retryAfterSeconds != null && (
                  <p className="text-sm font-medium text-amber-700 bg-amber-100/80 rounded-lg py-2 px-3 inline-block">
                    Tente novamente em cerca de {rateLimitModal.retryAfterSeconds} segundos
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="relative flex justify-center pb-1">
            <Button
              onClick={() => setRateLimitModal(null)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl px-6 py-2 shadow-md"
            >
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CriarOrcamento;
