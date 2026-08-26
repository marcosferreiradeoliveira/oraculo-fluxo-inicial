import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '@/lib/firebase';
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, doc, setDoc, getDoc, query, where, updateDoc, increment } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import CriarImg from '@/assets/Criar.jpeg';
import { Link } from 'react-router-dom';
import { trackProjectCreated, trackAnalysisStarted, trackAnalysisCompleted, trackAnalysisFailed } from '@/lib/analytics';
import { Brain, Loader2, Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const MAX_RECORDING_SECONDS = 120; // 2 minutos
const MICROFONE_POPUP_KEY = 'criar-projeto-microfone-popup-visto';

// Produção: sempre Cloud Functions. Dev: emulador só se VITE_FUNCTIONS_BASE_URL estiver definido
const PRODUCTION_FUNCTIONS = 'https://us-central1-culturalapp-fb9b0.cloudfunctions.net';
const FUNCTIONS_BASE = import.meta.env.DEV && import.meta.env.VITE_FUNCTIONS_BASE_URL
  ? import.meta.env.VITE_FUNCTIONS_BASE_URL
  : PRODUCTION_FUNCTIONS;
const AVALIAR_PROJETO_IA_URL = `${FUNCTIONS_BASE}/avaliarProjetoIA`;

// Web Speech API (Chrome, Edge) - tipos não estão no DOM padrão
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (e: { resultIndex: number; results: Array<{ isFinal: boolean; [i: number]: { transcript: string } }> }) => void;
  onerror: (e: { error: string }) => void;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

const getSpeechRecognition = (): SpeechRecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};


const steps = [
  'Criar Projeto',
  'Avaliar com IA',
  'Alterar com IA',
  'Gerar Textos',
  'Criar Orçamento',
  'Criar Cronograma',
  'Documentos de Inscrição',
  'Preencher Anexos'
];
const currentStep: number = 0; // Criar Projeto

// Função para verificar limites de projetos por plano
// Limite é global (não por ano). Apagar projetos não libera novas vagas; o contador nunca diminui.
const verificarLimiteProjetos = async (userId: string): Promise<{ podeCriar: boolean; mensagem: string; projetosAtivos: number; limite: number; planType: string }> => {
  const db = getFirestore();
  
  try {
    const userDocRef = doc(db, 'usuarios', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      return {
        podeCriar: false,
        mensagem: 'Usuário não encontrado. Por favor, faça login novamente.',
        projetosAtivos: 0,
        limite: 0,
        planType: 'basico'
      };
    }
    
    const userData = userDoc.data();
    const isPremium = userData?.isPremium === true;
    const planType = userData?.planType ?? 'free';
    
    if (isPremium) {
      return {
        podeCriar: true,
        mensagem: '',
        projetosAtivos: 0,
        limite: Infinity,
        planType: planType || 'premium'
      };
    }
    
    let limiteProjetos: number;
    switch ((planType || 'free').toString().toLowerCase()) {
      case 'premium':
        limiteProjetos = Infinity;
        break;
      case 'essencial':
        limiteProjetos = 10;
        break;
      case 'basico':
        limiteProjetos = 3;
        break;
      case 'free':
      default:
        limiteProjetos = Infinity;
        break;
    }
    
    const projetosCriados = Math.max(0, Number(userData?.projetos_criados_count ?? 0));
    const podeCriar = projetosCriados < limiteProjetos;
    
    let mensagem = '';
    if (!podeCriar && (planType === 'essencial' || planType === 'basico')) {
      const nomePlano = planType === 'essencial' ? 'Essencial' : 'Básico';
      mensagem = `Você atingiu o limite de ${limiteProjetos} projetos do plano ${nomePlano}. Para criar mais projetos, faça upgrade do seu plano.`;
    }
    
    return {
      podeCriar,
      mensagem,
      projetosAtivos: projetosCriados,
      limite: limiteProjetos,
      planType
    };
  } catch (error) {
    console.error('Erro ao verificar limite de projetos:', error);
    return {
      podeCriar: false,
      mensagem: 'Erro ao verificar limite de projetos. Tente novamente.',
      projetosAtivos: 0,
      limite: 0,
      planType: 'basico'
    };
  }
};

const dicasProjetos = [
  "💡 Dica: Seja específico e detalhado na descrição do seu projeto. Quanto mais informações você fornecer, melhor será a avaliação.",
  "📋 Dica: Certifique-se de que seu projeto está alinhado com os critérios do edital selecionado. Isso aumenta significativamente suas chances de aprovação.",
  "🎯 Dica: Destaque o impacto social e cultural do seu projeto. Avaliadores valorizam projetos que beneficiam comunidades e promovem a cultura.",
  "📊 Dica: Apresente um cronograma realista e viável. Projetos bem planejados têm maior credibilidade junto aos avaliadores.",
  "💰 Dica: Elabore um orçamento detalhado e coerente. Cada rubrica deve estar justificada e alinhada com as atividades propostas.",
  "👥 Dica: Apresente a equipe envolvida e suas qualificações. A experiência da equipe é um fator importante na avaliação.",
  "🌍 Dica: Demonstre como seu projeto contribui para a democratização do acesso à cultura e para a diversidade cultural.",
  "📝 Dica: Revise cuidadosamente todos os textos antes de enviar. Erros de português podem prejudicar a avaliação do seu projeto.",
  "🎨 Dica: Seja criativo, mas mantenha a coerência. Projetos inovadores que são bem fundamentados têm maior chance de sucesso.",
  "✅ Dica: Certifique-se de que todos os documentos exigidos pelo edital estão completos e corretos antes do envio."
];

/** Critérios gerais de avaliação de projetos culturais (usados quando nenhum edital é selecionado) */
const CRITERIOS_GERAIS = `Critérios gerais de avaliação de projetos culturais:

1. RELEVÂNCIA CULTURAL E ARTÍSTICA – Pertinência do projeto para a área cultural; contribuição para a diversidade e para o fortalecimento das expressões culturais.

2. VIABILIDADE TÉCNICA E FINANCEIRA – Coerência entre objetivos, metodologia, cronograma e orçamento; capacidade de execução da proposta.

3. QUALIFICAÇÃO DA EQUIPE – Experiência e competências dos responsáveis; adequação do perfil à natureza do projeto.

4. IMPACTO SOCIAL E DEMOCRATIZAÇÃO – Efeitos esperados na comunidade; ampliação do acesso à cultura e à participação cultural.

5. INOVAÇÃO E DIVERSIDADE – Contribuição para a inovação no campo cultural; valorização da diversidade cultural e das expressões regionais.

6. SUSTENTABILIDADE – Potencial de continuidade e legado do projeto após o período de apoio.

7. COMUNICAÇÃO E DIVULGAÇÃO – Estratégias de divulgação e de registro do projeto; alcance e visibilidade.`;

/** Formata nome do edital: primeira letra maiúscula, resto minúscula */
const formatarNomeEdital = (s: string) => {
  if (!s || typeof s !== 'string') return s;
  const t = s.trim();
  if (!t) return s;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
};

const CriarProjeto = () => {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [editalAssociado, setEditalAssociado] = useState('');
  const [editais, setEditais] = useState<any[]>([]);
  const [showUploadEdital, setShowUploadEdital] = useState(false);
  const [novoEdital, setNovoEdital] = useState({
    nome: '',
    orgao: '',
    data_encerramento: '',
    link: '',
    arquivo: null as File | null,
    arquivoUrl: ''
  });
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [etapasIA] = useState([
    'Salvando projeto',
  ]);
  const [etapaAtualIA, setEtapaAtualIA] = useState<number>(0);
  const [limiteProjetos, setLimiteProjetos] = useState<{ projetosAtivos: number; limite: number; planType: string } | null>(null);
  const [checkingLimit, setCheckingLimit] = useState(true);
  const [searchParams] = useSearchParams();
  const editalIdParam = searchParams.get('edital');
  
  // Estados para análise IA
  const [mostrarAnalise, setMostrarAnalise] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [statusIA, setStatusIA] = useState('');
  const [subEtapasIA, setSubEtapasIA] = useState<string[]>([]);
  const [erroIA, setErroIA] = useState<string | null>(null);
  const [dicaAtual, setDicaAtual] = useState(0);
  const [projetoId, setProjetoId] = useState<string | null>(null);

  // Áudio: gravação e transcrição por IA (até 2 min)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcriptLive, setTranscriptLive] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptLiveRef = useRef('');
  const stopRecordingRef = useRef<() => void>(() => {});

  // Popup de permissão do microfone (exibido apenas uma vez por sessão)
  const [showMicrophonePopup, setShowMicrophonePopup] = useState(false);

  // Alternar dicas a cada 5 segundos quando estiver analisando
  useEffect(() => {
    if (!analisando || !mostrarAnalise) return;
    
    const interval = setInterval(() => {
      setDicaAtual((prev) => (prev + 1) % dicasProjetos.length);
    }, 5000); // 5 segundos
    
    return () => clearInterval(interval);
  }, [analisando, mostrarAnalise, dicasProjetos.length]);

  // Função auxiliar para adicionar delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Função para atualizar status com delay
  const updateStatusWithDelay = async (status: string, subEtapas: string[] = [], delayMs: number = 1500) => {
    if (status) {
      setStatusIA(status);
      setSubEtapasIA(prev => {
        const lastItem = prev[prev.length - 1];
        if (status !== lastItem) {
          return [...prev, status];
        }
        return prev;
      });
    }
    if (subEtapas.length > 0) {
      setSubEtapasIA(prev => [...prev, ...subEtapas]);
    }
    await delay(delayMs);
  };

  // Função para buscar textos do edital e selecionados
  const fetchEditalESelecionados = async (editalNome: string) => {
    const db = getFirestore();
    const editalQuery = query(collection(db, 'editais'), where('nome', '==', editalNome));
    const editalSnap = await getDocs(editalQuery);
    if (!editalSnap.empty) {
      const editalDoc = editalSnap.docs[0].data();
      return {
        texto_edital: editalDoc.texto_edital || '',
        criterios: editalDoc.criterios || '',
        texto_selecionados: editalDoc.texto_selecionados || '',
      };
    }
    return { texto_edital: '', criterios: '', texto_selecionados: '' };
  };

  // Função para analisar com IA
  const analisarComIA = async (projetoNome: string, projetoDescricao: string, editalNome: string | null, projetoIdParam: string) => {
    const user = auth.currentUser;
    if (!user || !projetoIdParam) return;

    // Track analysis started
    try {
      const db = getFirestore();
      const userRef = doc(db, 'usuarios', user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : {};
      const planType = userData?.planType || 'free';
      
      trackAnalysisStarted({
        projectId: projetoIdParam,
        planType: planType,
        isFirstAnalysis: true,
      });
    } catch (err) {
      console.error('Erro ao trackear início da análise:', err);
    }

    // Configurar estados iniciais
    setMostrarAnalise(true);
    setErroIA(null);
    setStatusIA('O Oráculo está consultando as musas...');
    setSubEtapasIA(['Consultando as musas da inspiração...']);
    setAnalisando(true);

    // Força uma atualização síncrona do DOM
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 100);
      });
    });

    try {
      // Atualizar status sem atrasos artificiais; coleta em paralelo
      setStatusIA('Coletando dados do projeto e edital...');
      setSubEtapasIA(['Lendo edital e critérios...']);

      const db = getFirestore();
      let dadosConsolidados = {
        texto_edital: '',
        criterios: '',
        texto_selecionados: '',
        nome_edital: editalNome || '',
        resumo_projeto: projetoDescricao.slice(0, 2000) || '',
      };

      // Buscar edital e portfolio em paralelo (sem delays)
      const portfolioPromise = getDoc(doc(db, 'usuarios', user.uid)).then(snap =>
        snap.exists() ? (snap.data()?.portfolio || '') : ''
      );
      const editalPromise = editalNome ? fetchEditalESelecionados(editalNome) : Promise.resolve(null);

      const [editalResult, portfolioTexto] = await Promise.all([editalPromise, portfolioPromise]);

      if (editalResult) {
        dadosConsolidados.texto_edital = editalResult.texto_edital;
        dadosConsolidados.criterios = editalResult.criterios;
        dadosConsolidados.texto_selecionados = editalResult.texto_selecionados;
      } else {
        dadosConsolidados.criterios = CRITERIOS_GERAIS;
        dadosConsolidados.nome_edital = 'Critérios gerais de avaliação de projetos culturais';
      }

      if (!dadosConsolidados.criterios || dadosConsolidados.criterios.trim() === '') {
        throw new Error('O edital selecionado não possui critérios cadastrados. Por favor, certifique-se de que o edital possui critérios de avaliação cadastrados.');
      }

      setStatusIA('Enviando para análise da IA...');
      setSubEtapasIA(['Aguardando resposta da IA...']);

      const payload = {
        projetoId: projetoIdParam,
        textoProjeto: dadosConsolidados.resumo_projeto,
        nomeProjeto: projetoNome,
        nomeEdital: dadosConsolidados.nome_edital,
        criteriosEdital: dadosConsolidados.criterios,
        textoEdital: dadosConsolidados.texto_edital,
        portfolio: portfolioTexto,
        projetosSelecionados: dadosConsolidados.texto_selecionados ? dadosConsolidados.texto_selecionados.slice(0, 2000) : '',
        userId: user.uid,
        stream: true // Habilitar streaming
      };
      
      // Fazer requisição com streaming (só navega após resposta aceita, para tratar 429 na mesma página)
      let response: Response;
      try {
        response = await fetch(AVALIAR_PROJETO_IA_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
          },
          body: JSON.stringify(payload)
        });
      } catch (networkErr: unknown) {
        setAnalisando(false);
        const isFailedFetch = networkErr instanceof TypeError && networkErr.message === 'Failed to fetch';
        if (isFailedFetch) {
          const dica = import.meta.env.VITE_FUNCTIONS_BASE_URL
            ? ' O app está apontando para o emulador local. Suba o emulador com: firebase emulators:start --only functions (ou remova VITE_FUNCTIONS_BASE_URL do .env para usar as functions em produção).'
            : ' Verifique sua conexão ou tente novamente em alguns instantes.';
          throw new Error('Não foi possível conectar ao servidor de análise.' + dica);
        }
        throw networkErr instanceof Error ? networkErr : new Error('Erro de rede ao analisar projeto.');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) {
          let msg = 'Aguarde alguns segundos antes de solicitar uma nova análise.';
          try {
            const data = JSON.parse(errorText);
            if (data.message) msg = data.message;
          } catch (_) { /* use default */ }
          setErroIA(msg);
          setAnalisando(false);
          return;
        }
        throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
      }
      
      // Resposta aceita: navegar para a página do projeto para acompanhar o streaming
      navigate(`/projeto/${projetoIdParam}?streaming=true`);
      
      // Processar stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let jaEscreveuPrimeiroChunk = false;
      
      if (!reader) {
        throw new Error('Stream não disponível');
      }
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.content) {
                fullContent += data.content;
                
                // Atualizar análise no Firestore: primeiro write imediato (página Projeto exibe conteúdo); demais debounced 200ms
                if (projetoIdParam && fullContent.length > 0) {
                  const db = getFirestore();
                  const ref = doc(db, 'projetos', projetoIdParam);
                  if (!jaEscreveuPrimeiroChunk) {
                    jaEscreveuPrimeiroChunk = true;
                    await updateDoc(ref, {
                      analise_ia: fullContent,
                      data_atualizacao: serverTimestamp()
                    });
                  } else {
                    clearTimeout((window as any).__analiseUpdateTimeout);
                    (window as any).__analiseUpdateTimeout = setTimeout(async () => {
                      await updateDoc(ref, {
                        analise_ia: fullContent,
                        data_atualizacao: serverTimestamp()
                      });
                    }, 200);
                  }
                }
              }
              
              if (data.done) {
                // Salvar análise final no Firestore
                if (projetoIdParam) {
                  const db = getFirestore();
                  const ref = doc(db, 'projetos', projetoIdParam);
                  await updateDoc(ref, {
                    analise_ia: data.fullContent || fullContent,
                    data_atualizacao: serverTimestamp()
                  });
                  
                  // Deduzir 5 créditos para usuário não premium (avaliação = 5 créditos)
                  try {
                    const userRef = doc(db, 'usuarios', user.uid);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists() && userSnap.data()?.isPremium !== true) {
                      await updateDoc(userRef, { creditos: increment(-5) });
                    }
                  } catch (err) {
                    console.error('Erro ao descontar créditos:', err);
                  }
                  
                  // Track analysis completed
                  try {
                    const userRef = doc(db, 'usuarios', user.uid);
                    const userSnap = await getDoc(userRef);
                    const userData = userSnap.exists() ? userSnap.data() : {};
                    const planType = userData?.planType || 'free';
                    
                    trackAnalysisCompleted({
                      projectId: projetoIdParam,
                      planType: planType,
                    });
                  } catch (err) {
                    console.error('Erro ao trackear conclusão da análise:', err);
                  }
                }
                
                setMostrarAnalise(false);
                setAnalisando(false);
                setLoading(false);
                return;
              }
            } catch (e) {
              console.error('Erro ao processar chunk:', e);
            }
          }
        }
      }
    } catch (e: any) {
      console.error('Erro ao analisar projeto:', e);
      const isFailedFetch = e?.name === 'TypeError' && (e?.message === 'Failed to fetch' || String(e?.message || '').includes('fetch'));
      const mensagem = isFailedFetch
        ? 'Não foi possível conectar ao servidor de análise. Se estiver rodando local, inicie o servidor (em functions: npm run avaliar-local). Em produção, verifique sua conexão e tente novamente.'
        : (e?.message || 'Erro ao analisar projeto. Tente novamente.');
      setErroIA(mensagem);
      setAnalisando(false);
      setLoading(false);
      
      // Track analysis failed
      if (projetoIdParam && user) {
        try {
          const db = getFirestore();
          const userRef = doc(db, 'usuarios', user.uid);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() : {};
          const planType = userData?.planType || 'free';
          
          trackAnalysisFailed({
            projectId: projetoIdParam,
            planType: planType,
            error: e.message || 'Erro desconhecido',
          });
        } catch (err) {
          console.error('Erro ao trackear falha da análise:', err);
        }
      }
    }
  };

  useEffect(() => {
    const fetchEditais = async () => {
      const db = getFirestore();
      const snap = await getDocs(collection(db, 'editais'));
      const now = new Date();
      
      const editaisFiltrados = snap.docs
        .map(d => ({
          id: d.id,
          ...d.data(),
          data_encerramento: d.data().data_encerramento?.toDate 
            ? d.data().data_encerramento.toDate() 
            : d.data().data_encerramento,
          dataEncerramento: d.data().dataEncerramento?.toDate 
            ? d.data().dataEncerramento.toDate() 
            : d.data().dataEncerramento
        }))
        .filter(edital => {
          let dataEncerramento: Date | null = null;
          if (edital.data_encerramento) {
            if (edital.data_encerramento instanceof Date) {
              dataEncerramento = edital.data_encerramento;
            } else if (typeof edital.data_encerramento === 'string') {
              dataEncerramento = new Date(edital.data_encerramento);
            }
          }
          if ((!dataEncerramento || (dataEncerramento && dataEncerramento <= now)) && edital.dataEncerramento) {
            if (edital.dataEncerramento instanceof Date) {
              dataEncerramento = edital.dataEncerramento;
            } else if (typeof edital.dataEncerramento === 'string') {
              dataEncerramento = new Date(edital.dataEncerramento);
            }
          }
          if (!dataEncerramento || isNaN(dataEncerramento.getTime())) return false;
          return dataEncerramento > now;
        });
      
      // Se veio ?edital=id (ex.: Detalhes do Edital), incluir esse edital na lista e pré-selecionar
      const editalIdFromUrl = searchParams.get('edital');
      let listaFinal = editaisFiltrados;
      if (editalIdFromUrl && !editaisFiltrados.some(e => e.id === editalIdFromUrl)) {
        const ref = doc(db, 'editais', editalIdFromUrl);
        const docSnap = await getDoc(ref);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const extra = {
            id: docSnap.id,
            nome: data?.nome || data?.titulo || 'Edital',
            orgao: data?.orgao || data?.proponente || '',
            ...data,
            data_encerramento: data?.data_encerramento?.toDate?.() ?? data?.data_encerramento,
            dataEncerramento: data?.dataEncerramento?.toDate?.() ?? data?.dataEncerramento
          };
          listaFinal = [...editaisFiltrados, extra];
        }
      }
      // Editais em destaque primeiro
      listaFinal.sort((a, b) => ((a as { destaque?: boolean }).destaque ? 0 : 1) - ((b as { destaque?: boolean }).destaque ? 0 : 1));
      setEditais(listaFinal);
    };
    fetchEditais();
    
    const user = auth.currentUser;
    if (!user) {
      setCheckingLimit(false);
      return;
    }
    
    (async () => {
      try {
        const res = await verificarLimiteProjetos(user.uid);
        if (!res.podeCriar) {
          navigate('/cadastro-premium?motivo=limite_projetos');
          return;
        }
        if (res.limite === Infinity || (res.planType !== 'basico' && res.planType !== 'essencial')) {
          setLimiteProjetos(null);
        } else {
          setLimiteProjetos({
            projetosAtivos: res.projetosAtivos,
            limite: res.limite,
            planType: res.planType
          });
        }
        setCheckingLimit(false);
      } catch (e) {
        console.error('Erro ao verificar limite de projetos:', e);
        setCheckingLimit(false);
      }
    })();
  }, [navigate, searchParams]);

  // Pré-selecionar edital quando ?edital=id (ex.: vindo de Detalhes do Edital ou home)
  useEffect(() => {
    if (!editalIdParam || editais.length === 0) return;
    const naLista = editais.find(e => e.id === editalIdParam);
    if (naLista?.nome) setEditalAssociado(naLista.nome);
  }, [editalIdParam, editais]);

  const SILENCE_STOP_MS = 5000; // parar após 5 segundos de silêncio

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    try {
      if (recognitionRef.current) recognitionRef.current.stop();
      recognitionRef.current = null;
    } catch {
      // ignore
    }
    const finalTranscript = transcriptLiveRef.current.trim();
    setIsRecording(false);
    setTranscribing(false);
    setDescricao((prev) => (finalTranscript ? (prev ? prev + '\n\n' + finalTranscript : finalTranscript) : prev));
    setTranscriptLive('');
    transcriptLiveRef.current = '';
  }, []);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  // Limpar timer e recognition ao desmontar
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      try {
        if (recognitionRef.current) recognitionRef.current.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  const onIniciarGravacaoClick = () => {
    if (typeof sessionStorage === 'undefined') {
      startRecording();
      return;
    }
    if (sessionStorage.getItem(MICROFONE_POPUP_KEY)) {
      startRecording();
      return;
    }
    setShowMicrophonePopup(true);
  };

  const confirmarMicrofoneEIniciar = () => {
    try {
      sessionStorage.setItem(MICROFONE_POPUP_KEY, '1');
    } catch (_) {}
    setShowMicrophonePopup(false);
    startRecording();
  };

  const startRecording = async () => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) {
      setErro('Seu navegador não suporta gravação por voz. Use Chrome ou Edge, ou escreva a descrição abaixo.');
      return;
    }
    setErro('');
    setTranscriptLive('');
    setRecordingSeconds(0);
    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'pt-BR';
      let fullTranscript = '';
      recognition.onresult = (event: { resultIndex: number; results: Array<{ isFinal: boolean; 0?: { transcript: string } }> }) => {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        silenceTimerRef.current = setTimeout(() => {
          silenceTimerRef.current = null;
          stopRecordingRef.current();
        }, SILENCE_STOP_MS);

        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = (result[0] as { transcript: string } | undefined)?.transcript ?? '';
          if (result.isFinal) {
            fullTranscript += transcript + ' ';
            transcriptLiveRef.current = fullTranscript;
            setTranscriptLive(fullTranscript);
          } else {
            interim += transcript;
          }
        }
        const display = fullTranscript + interim;
        if (interim) {
          transcriptLiveRef.current = display;
          setTranscriptLive(display);
        }
      };
      recognition.onerror = (event: { error: string }) => {
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          setErro('Erro na captura de voz. Tente novamente ou escreva abaixo.');
        }
      };
      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      setTranscribing(true);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => {
          if (s >= MAX_RECORDING_SECONDS - 1) {
            if (recordingTimerRef.current) {
              clearInterval(recordingTimerRef.current);
              recordingTimerRef.current = null;
            }
            stopRecordingRef.current();
            return MAX_RECORDING_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      console.error(err);
      setErro('Não foi possível acessar o microfone. Verifique as permissões ou escreva a descrição.');
      setIsRecording(false);
    }
  };

  const handleFileUpload = async (file: File): Promise<string> => {
    const storage = getStorage();
    const fileRef = storageRef(storage, `editais/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  };

  const handleNovoEditalChange = (field: string, value: any) => {
    setNovoEdital(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleNovoEditalChange('arquivo', e.target.files[0]);
    }
  };

  const salvarNovoEdital = async () => {
    if (!novoEdital.nome || !novoEdital.data_encerramento) {
      setErro('Preencha todos os campos obrigatórios do edital.');
      return false;
    }

    try {
      setUploading(true);
      const db = getFirestore();
      let arquivoUrl = '';

      if (novoEdital.arquivo) {
        arquivoUrl = await handleFileUpload(novoEdital.arquivo);
      }

      const editalData = {
        nome: novoEdital.nome,
        orgao: novoEdital.orgao,
        data_encerramento: new Date(novoEdital.data_encerramento),
        link: novoEdital.link,
        arquivo_url: arquivoUrl,
        data_criacao: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'editais'), editalData);
      
      // Adiciona o novo edital à lista de editais
      const novoEditalCompleto = {
        id: docRef.id,
        ...editalData,
        data_encerramento: new Date(novoEdital.data_encerramento)
      };
      
      setEditais(prev => [...prev, novoEditalCompleto]);
      setEditalAssociado(novoEdital.nome);
      setShowUploadEdital(false);
      setNovoEdital({
        nome: '',
        orgao: '',
        data_encerramento: '',
        link: '',
        arquivo: null,
        arquivoUrl: ''
      });
      
      return true;
    } catch (error) {
      console.error('Erro ao salvar edital:', error);
      setErro('Erro ao salvar o novo edital. Tente novamente.');
      return false;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    
    console.log('Iniciando criação do projeto...');
    console.log('Dados do formulário:', { nome, descricao, editalAssociado });
    
    // Validações básicas
    if (!nome.trim()) {
      setErro('Nome do projeto é obrigatório.');
      setLoading(false);
      return;
    }
    
    if (!descricao.trim()) {
      setErro('Descrição do projeto é obrigatória.');
      setLoading(false);
      return;
    }
    
    let editalId = '';
    
    // Se estiver no modo de upload de novo edital, salva o edital primeiro
    if (showUploadEdital) {
      console.log('Modo upload de edital ativado');
      const sucesso = await salvarNovoEdital();
      if (!sucesso) return;
      
      // Pega o ID do último edital adicionado (que acabou de ser salvo)
      if (editais.length > 0) {
        editalId = editais[editais.length - 1].id;
      }
    } else if (editalAssociado) {
      console.log('Edital selecionado:', editalAssociado);
      // Se um edital existente foi selecionado, pega o ID
      const editalSelecionado = editais.find(e => e.nome === editalAssociado);
      if (editalSelecionado) {
        editalId = editalSelecionado.id;
        console.log('ID do edital encontrado:', editalId);
      }
    }
    
    setLoading(true);
    setEtapaAtualIA(0);
    try {
      const user = auth.currentUser;
      if (!user) {
        console.error('Usuário não logado');
        setErro('Você precisa estar logado para criar um projeto.');
        setLoading(false);
        return;
      }
      
      console.log('Usuário logado:', user.uid);
      
      // Verificar limite de projetos antes de criar
      const verificacaoLimite = await verificarLimiteProjetos(user.uid);
      if (!verificacaoLimite.podeCriar) {
        setErro(verificacaoLimite.mensagem);
        setLoading(false);
        return;
      }
      
      console.log(`Limite verificado: ${verificacaoLimite.projetosAtivos}/${verificacaoLimite.limite} projetos criados`);
      setEtapaAtualIA(0); // Salvando projeto
      console.log('Salvando projeto no Firestore...');
      // Salva no Firestore
      const db = getFirestore();
      const projetoData: any = {
        nome,
        descricao,
        data_criacao: serverTimestamp(),
        data_atualizacao: serverTimestamp(),
        user_id: user.uid,
        etapa_atual: 1, // já vai para Avaliar com IA
      };
      
      console.log('Dados do projeto a serem salvos:', projetoData);
      
      // Adiciona a referência ao edital se existir
      if (editalId) {
        projetoData.edital_id = editalId;
        projetoData.edital_associado = editalAssociado;
      }
      
      console.log('Salvando projeto no Firestore...');
      const docRef = await addDoc(collection(db, 'projetos'), projetoData);
      console.log('Projeto criado com ID:', docRef.id);
      
      const userRef = doc(db, 'usuarios', user.uid);
      await updateDoc(userRef, { projetos_criados_count: increment(1) });
      
      // Track project created
      trackProjectCreated({
        projectId: docRef.id,
        hasEdital: !!editalId,
      });

      // Evento para Tag Manager / Analytics: project_created (configurar conversão no GTM com esse evento)
      if (typeof (window as unknown as { gtag?: (a: string, b: string, c: object) => void }).gtag === 'function') {
        (window as unknown as { gtag: (a: string, b: string, c: object) => void }).gtag('event', 'project_created', {
          creator_id: user?.uid ?? '',
        });
      }
      
      // Iniciar análise imediatamente na mesma tela
      setProjetoId(docRef.id);
      // Não fazer setLoading(false) aqui, pois a análise vai continuar
      // O loading será desabilitado quando a análise terminar ou houver erro
      await analisarComIA(nome, descricao, editalAssociado || null, docRef.id);
    } catch (err) {
      console.error('Erro ao criar projeto:', err);
      setErro(`Erro ao criar projeto: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      setLoading(false);
    }
  };

  // Show loading popup when analyzing
  if (mostrarAnalise && analisando) {
    return (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-oraculo-blue/95 to-oraculo-purple/95 rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl border-2 border-white/20">
            <div className="flex flex-col items-center">
              {/* Animação bem humorada das musas */}
              <div className="relative mb-6">
                {/* Círculo central com ícone do Oráculo */}
                <div className="relative w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm animate-pulse">
                  <Brain className="h-12 w-12 text-white animate-bounce" />
                </div>
                
                {/* Musas girando ao redor */}
                <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <span className="text-2xl animate-bounce" style={{ animationDelay: '0s' }}>🎭</span>
                  </div>
                  <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2">
                    <span className="text-2xl animate-bounce" style={{ animationDelay: '0.3s' }}>🎨</span>
                  </div>
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
                    <span className="text-2xl animate-bounce" style={{ animationDelay: '0.6s' }}>📚</span>
                  </div>
                  <div className="absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <span className="text-2xl animate-bounce" style={{ animationDelay: '0.9s' }}>✨</span>
                  </div>
                </div>
                
                {/* Partículas mágicas */}
                <div className="absolute inset-0">
                  <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-yellow-300 rounded-full animate-ping" style={{ animationDelay: '0s' }}></div>
                  <div className="absolute top-3/4 right-1/4 w-2 h-2 bg-pink-300 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                  <div className="absolute bottom-1/4 left-3/4 w-2 h-2 bg-blue-300 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
                </div>
              </div>
              
              {/* Texto principal */}
              <h3 className="text-2xl font-bold text-white mb-3 text-center animate-pulse">
                O Oráculo está consultando as musas
              </h3>
              
              {/* Status da análise */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 w-full mb-4">
                <p className="text-sm text-white/90 text-center font-medium">
                  {statusIA || 'Consultando as musas da inspiração...'}
                </p>
                {subEtapasIA.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {subEtapasIA.slice(-3).map((etapa, idx) => (
                      <p key={idx} className="text-xs text-white/70 text-center animate-fade-in">
                        • {etapa}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Barra de progresso animada */}
              <div className="w-full bg-white/20 rounded-full h-2 mb-4 overflow-hidden">
                <div className="bg-white h-2 rounded-full animate-progress" style={{
                  width: '100%',
                  animation: 'progress 2s ease-in-out infinite'
                }}></div>
              </div>
              
              {/* Caixa de dicas rotativas */}
              <div className="w-full bg-white/20 backdrop-blur-sm rounded-lg p-4 mb-4 border border-white/30">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div className="flex-1">
                    <p className="text-xs text-white/80 font-semibold mb-1 uppercase tracking-wide">Dica do Oráculo</p>
                    <p className="text-sm text-white/95 leading-relaxed animate-fade-in">
                      {dicasProjetos[dicaAtual]}
                    </p>
                  </div>
                </div>
                {/* Indicador de progresso das dicas */}
                <div className="flex gap-1 mt-3 justify-center">
                  {dicasProjetos.map((_, index) => (
                    <div
                      key={index}
                      className={`h-1 rounded-full transition-all duration-500 ${
                        index === dicaAtual
                          ? 'bg-white w-8'
                          : 'bg-white/40 w-1'
                      }`}
                    />
                  ))}
                </div>
              </div>
              
              {erroIA && (
                <div className="mt-4 p-3 bg-red-500/90 text-white rounded-md text-sm w-full backdrop-blur-sm">
                  {erroIA}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Estilos CSS inline para animações */}
        <style>{`
          @keyframes progress {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(0%); }
            100% { transform: translateX(100%); }
          }
          .animate-progress {
            animation: progress 2s ease-in-out infinite;
          }
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.5s ease-out;
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <Dialog open={showMicrophonePopup} onOpenChange={setShowMicrophonePopup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Acesso ao microfone</DialogTitle>
            <DialogDescription>
              Para usar a gravação por voz, é necessário permitir o acesso ao microfone no navegador. 
              Quando você clicar em &quot;Permitir e iniciar&quot;, o navegador pode exibir um aviso pedindo a permissão — aceite para continuar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowMicrophonePopup(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmarMicrofoneEIniciar}>
              Permitir e iniciar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <DashboardHeader />
        
        <main className="flex-1 p-3 md:p-4 overflow-x-hidden overflow-y-auto pb-20 md:pb-8 min-h-0">
          {checkingLimit ? (
            <div className="w-full flex flex-col items-center justify-center min-h-[40vh] gap-4">
              <Loader2 className="h-10 w-10 text-oraculo-blue animate-spin" />
              <p className="text-gray-600 font-medium">Verificando...</p>
            </div>
          ) : (
          <div className="w-full max-w-5xl mx-auto min-w-0">
            <div className="mb-4 md:mb-8">
              <h1 className="text-xl md:text-3xl font-bold text-gray-900 mb-2 break-words">
                Criar Novo Projeto
              </h1>
              <p className="text-gray-600 text-sm md:text-base break-words">
                Preencha os detalhes do seu projeto cultural para começar a usar o Oráculo AI.
              </p>
            </div>

            {/* Barra de progresso - no mobile só etapas 1, 2, 3 e "..."; no desktop todas */}
            <div className="mb-4 md:mb-8 p-3 md:p-12 bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden">
              {/* Mobile: etapas 1, 2, 3 com espaço para o texto não encavalar; depois "..." */}
              <div className="flex items-center justify-between gap-2 mb-3 md:mb-6 md:hidden">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="flex flex-col items-center flex-1 min-w-0">
                    <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0 ${index <= currentStep ? 'bg-oraculo-blue text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {index + 1}
                    </div>
                    <span className={`text-[10px] sm:text-xs mt-1.5 text-center font-medium leading-tight break-words px-0.5 ${index === currentStep ? 'text-oraculo-blue' : 'text-gray-500'}`}>
                      {steps[index]}
                    </span>
                  </div>
                ))}
                <span className="text-gray-400 font-medium flex-shrink-0 px-1">…</span>
              </div>
              {/* Desktop: todas as etapas */}
              <div className="hidden md:flex items-center justify-between gap-4 mb-3 md:mb-6">
                {steps.map((step, index) => (
                  <div key={index} className="flex flex-col items-center flex-shrink-0 min-w-0">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold ${index <= currentStep ? 'bg-oraculo-blue text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {index + 1}
                    </div>
                    <span className={`text-sm mt-3 text-center font-medium whitespace-nowrap ${index === currentStep ? 'text-oraculo-blue' : 'text-gray-500'}`}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 md:h-3 mt-2 md:mt-4 min-w-0">
                <div 
                  className="bg-oraculo-blue h-2 md:h-3 rounded-full transition-all duration-300" 
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Box Como funciona a análise do Oráculo - em cima do formulário */}
            <div className="mb-6 md:mb-8 p-4 md:p-8 bg-gradient-to-br from-oraculo-blue/5 to-oraculo-purple/5 border-2 border-oraculo-blue rounded-xl shadow-lg min-w-0">
              <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-oraculo-blue flex items-center gap-3">
                <span role="img" aria-label="Dica">🤖</span> Como funciona a análise do Oráculo
              </h2>
              <p className="text-gray-700 text-sm md:text-base mb-0 leading-relaxed">
                Preencha os detalhes abaixo e clique em &quot;Avaliar com IA&quot;. O Oráculo analisa seu projeto como um avaliador, levando em conta não só os critérios do edital, mas também os últimos selecionados e uma base grande de projetos culturais bem-sucedidos.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden min-w-0">
              <div className="p-4 md:p-8 min-w-0">
                {/* Indicador de limite de projetos */}
                {limiteProjetos && (
                  <div className={`mb-6 p-4 rounded-lg border-2 ${
                    limiteProjetos.projetosAtivos >= limiteProjetos.limite
                      ? 'bg-red-50 border-red-200'
                      : limiteProjetos.projetosAtivos >= limiteProjetos.limite * 0.8
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700">
                          Projetos criados: <span className="font-bold">{limiteProjetos.projetosAtivos}/{limiteProjetos.limite}</span>
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Plano {limiteProjetos.planType === 'essencial' ? 'Essencial' : 'Básico'} – Limite de {limiteProjetos.limite} projetos. Apagar não libera novas vagas.
                        </p>
                      </div>
                      {limiteProjetos.projetosAtivos >= limiteProjetos.limite && (
                        <Link
                          to="/cadastro-premium"
                          className="text-sm font-semibold text-oraculo-blue hover:text-oraculo-purple underline"
                        >
                          Fazer upgrade
                        </Link>
                      )}
                    </div>
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-5 min-w-0">
                  <div className="min-w-0">
                    <label className="block text-sm font-medium mb-1 text-gray-700">Nome do projeto</label>
                    <input
                      type="text"
                      className="w-full min-w-0 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition box-border"
                      value={nome}
                      onChange={e => setNome(e.target.value)}
                      required
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                      <label className="block text-sm font-medium text-gray-700">Edital associado</label>
                      <button
                        type="button"
                        onClick={() => window.open('https://extratordeeditais.web.app/', '_blank')}
                        className="text-xs text-oraculo-blue hover:text-oraculo-blue/80 font-medium self-start"
                      >
                        Cadastrar novo edital
                      </button>
                    </div>
                    
                    <select
                      className="w-full min-w-0 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition box-border"
                      value={editalAssociado}
                      onChange={e => setEditalAssociado(e.target.value)}
                    >
                      <option value="">Selecione um edital</option>
                      {editais.map((edital) => (
                        <option key={edital.id} value={edital.nome}>
                          {formatarNomeEdital(edital.nome)} - {edital.orgao}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label className="block text-sm font-medium mb-1 text-gray-700">Descrição do projeto</label>
                    <div className="flex flex-col gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={isRecording ? () => stopRecordingRef.current() : onIniciarGravacaoClick}
                        disabled={transcribing && !isRecording}
                        className={`w-full sm:w-auto border-2 rounded-xl py-4 px-6 font-semibold flex items-center justify-center gap-2 ${
                          isRecording
                            ? 'border-red-400 bg-red-50 text-red-700 hover:bg-red-100'
                            : 'border-oraculo-blue bg-oraculo-blue/5 text-oraculo-blue hover:bg-oraculo-blue/10'
                        }`}
                      >
                        {isRecording ? (
                          <>
                            <Square className="h-5 w-5" />
                            Parar gravação ({Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}/2:00)
                          </>
                        ) : (
                          <>
                            <Mic className="h-5 w-5" />
                            Conte sobre seu projeto em 2 minutos
                          </>
                        )}
                      </Button>
                      {isRecording && transcriptLive && (
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 max-h-32 overflow-y-auto">
                          <p className="font-medium text-gray-500 mb-1">Transcrição em tempo real:</p>
                          <p className="whitespace-pre-wrap">{transcriptLive}</p>
                          <span className="inline-block w-2 h-4 bg-oraculo-blue animate-pulse align-middle ml-0.5" />
                        </div>
                      )}
                      <p className="text-xs text-gray-500">ou escreva sobre o projeto abaixo</p>
                    </div>
                    <textarea
                      className="w-full min-w-0 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition min-h-[160px] box-border mt-2"
                      value={descricao}
                      onChange={e => setDescricao(e.target.value)}
                      required
                      placeholder="Cole ou escreva aqui todas as informações do seu projeto cultural. Você também pode usar o botão acima para falar (até 2 minutos). Depois vamos refinar o projeto com uso de IA."
                    />
                  </div>
                  {erro && <div className="text-red-500 text-sm text-center">{erro}</div>}
                  {loading && (
                    <div className="mb-4">
                      <div className="bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 text-gray-700 text-sm font-medium text-center animate-pulse">
                        {etapasIA[etapaAtualIA]}
                      </div>
                    </div>
                  )}
                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white py-2.5 rounded-lg font-semibold shadow hover:opacity-90 transition disabled:opacity-70"
                      disabled={loading || uploading || (showUploadEdital && !novoEdital.nome)}
                    >
                      {loading || uploading ? 'Salvando...' : <>Avaliar com IA <span className="ml-1.5 text-white/80 font-normal text-sm">(5 créditos)</span></>}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          )}
        </main>
      </div>
    </div>
    </>
  );
};

export default CriarProjeto;