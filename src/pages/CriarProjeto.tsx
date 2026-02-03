import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '@/lib/firebase';
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, doc, setDoc, getDoc, query, where, updateDoc, increment } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import CriarImg from '@/assets/Criar.jpeg';
import { Link } from 'react-router-dom';
import { trackProjectCreated, trackAnalysisStarted, trackAnalysisCompleted, trackAnalysisFailed } from '@/lib/analytics';
import { Brain, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';


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
    const planType = userData?.planType || 'basico';
    
    if (isPremium) {
      return {
        podeCriar: true,
        mensagem: '',
        projetosAtivos: 0,
        limite: Infinity,
        planType
      };
    }
    
    let limiteProjetos: number;
    switch (planType.toLowerCase()) {
      case 'premium':
        limiteProjetos = Infinity;
        break;
      case 'essencial':
        limiteProjetos = 10;
        break;
      case 'basico':
      default:
        limiteProjetos = 3;
        break;
    }
    
    const projetosCriados = Math.max(0, Number(userData?.projetos_criados_count ?? 0));
    const podeCriar = projetosCriados < limiteProjetos;
    
    let mensagem = '';
    if (!podeCriar) {
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
      await updateStatusWithDelay('Iniciando análise do projeto...', ['Preparando ambiente de análise...']);
      await updateStatusWithDelay('Coletando dados do projeto e edital...', 
        ['Lendo o texto do projeto...', 'Lendo o edital...', 'Lendo critérios do edital...'], 1500);
      
      let dadosConsolidados = {
        texto_edital: '',
        criterios: '',
        texto_selecionados: '',
        nome_edital: editalNome || '',
        resumo_projeto: projetoDescricao.slice(0, 2000) || '',
      };
      
      if (editalNome) {
        const res = await fetchEditalESelecionados(editalNome);
        dadosConsolidados.texto_edital = res.texto_edital;
        dadosConsolidados.criterios = res.criterios;
        dadosConsolidados.texto_selecionados = res.texto_selecionados;
      } else {
        dadosConsolidados.criterios = CRITERIOS_GERAIS;
        dadosConsolidados.nome_edital = 'Critérios gerais de avaliação de projetos culturais';
      }
      
      await updateStatusWithDelay('Processando informações...', 
        [editalNome ? 'Cruzando projeto com critérios do edital...' : 'Cruzando projeto com critérios gerais...'], 1200);
      await updateStatusWithDelay('', 
        [editalNome ? 'Comparando com projetos selecionados anteriores...' : 'Aplicando critérios gerais de projetos culturais...'], 1200);
      await updateStatusWithDelay('Construindo prompt para análise...', 
        ['Preparando dados para IA...'], 1500);
      
      // Verificar se há critérios antes de continuar
      if (!dadosConsolidados.criterios || dadosConsolidados.criterios.trim() === '') {
        throw new Error('O edital selecionado não possui critérios cadastrados. Por favor, certifique-se de que o edital possui critérios de avaliação cadastrados.');
      }
      
      await updateStatusWithDelay('Enviando para análise da IA...', 
        ['Enviando dados para IA...', 'Aguardando resposta da IA...'], 1800);
      
      // Buscar portfolio do usuário
      let portfolioTexto = '';
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
      
      const endpoint = 'https://us-central1-culturalapp-fb9b0.cloudfunctions.net/avaliarProjetoIA';
      const payload = {
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
      
      // Navegar para a página do projeto imediatamente
      navigate(`/projeto/${projetoIdParam}?streaming=true`);
      
      // Fazer requisição com streaming
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
      }
      
      // Processar stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let hasNavigated = false;
      
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
                
                // Atualizar análise no Firestore em tempo real (debounced)
                if (projetoIdParam && fullContent.length > 0) {
                  const db = getFirestore();
                  const ref = doc(db, 'projetos', projetoIdParam);
                  // Usar debounce para não fazer muitas escritas
                  clearTimeout((window as any).__analiseUpdateTimeout);
                  (window as any).__analiseUpdateTimeout = setTimeout(async () => {
                    await updateDoc(ref, {
                      analise_ia: fullContent,
                      data_atualizacao: serverTimestamp()
                    });
                  }, 1000);
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
      setErroIA(e.message || 'Erro ao analisar projeto. Tente novamente.');
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
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Convert data_encerramento to Date if it's a Firestore Timestamp
          data_encerramento: doc.data().data_encerramento?.toDate 
            ? doc.data().data_encerramento.toDate() 
            : doc.data().data_encerramento,
          // Also handle dataEncerramento (with capital E)
          dataEncerramento: doc.data().dataEncerramento?.toDate 
            ? doc.data().dataEncerramento.toDate() 
            : doc.data().dataEncerramento
        }))
        .filter(edital => {
          let dataEncerramento: Date | null = null;
          
          // Verifica data_encerramento primeiro
          if (edital.data_encerramento) {
            if (edital.data_encerramento instanceof Date) {
              dataEncerramento = edital.data_encerramento;
            } else if (typeof edital.data_encerramento === 'string') {
              dataEncerramento = new Date(edital.data_encerramento);
            }
          }
          
          // Se não tem data_encerramento ou já passou, verifica dataEncerramento (com E maiúsculo)
          if ((!dataEncerramento || (dataEncerramento && dataEncerramento <= now)) && edital.dataEncerramento) {
            if (edital.dataEncerramento instanceof Date) {
              dataEncerramento = edital.dataEncerramento;
            } else if (typeof edital.dataEncerramento === 'string') {
              dataEncerramento = new Date(edital.dataEncerramento);
            }
          }
          
          // If there's no valid deadline, don't show it
          if (!dataEncerramento || isNaN(dataEncerramento.getTime())) {
            return false;
          }
          
          return dataEncerramento > now;
        });
      
      setEditais(editaisFiltrados);
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
        if (res.limite === Infinity) {
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
  }, [navigate]);

  // Pré-selecionar edital quando ?edital=id (ex.: vindo da home "Avalie seu projeto neste edital")
  useEffect(() => {
    if (!editalIdParam || editais.length === 0) return;
    const edital = editais.find(e => e.id === editalIdParam);
    if (edital?.nome) setEditalAssociado(edital.nome);
  }, [editalIdParam, editais]);

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
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        
        <main className="flex-1 p-2 md:p-4">
          {checkingLimit ? (
            <div className="w-full flex flex-col items-center justify-center min-h-[40vh] gap-4">
              <Loader2 className="h-10 w-10 text-oraculo-blue animate-spin" />
              <p className="text-gray-600 font-medium">Verificando...</p>
            </div>
          ) : (
          <div className="w-full">
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Criar Novo Projeto
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Preencha os detalhes do seu projeto cultural para começar a usar o Oráculo AI.
              </p>
            </div>

            {/* Barra de progresso */}
            <div className="mb-8 p-12 bg-white rounded-xl shadow-lg border-2 border-gray-200">
              <div className="flex items-center justify-between mb-6">
                {steps.map((step, index) => (
                  <div key={index} className="flex flex-col items-center px-4">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold ${index <= currentStep ? 'bg-oraculo-blue text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {index + 1}
                    </div>
                    <span className={`text-sm mt-3 text-center font-medium ${index === currentStep ? 'text-oraculo-blue' : 'text-gray-500'}`}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
                <div 
                  className="bg-oraculo-blue h-3 rounded-full transition-all duration-300" 
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-8">
                {/* Indicador de limite de projetos */}
                {limiteProjetos && (
                  <div className={`mb-6 p-4 rounded-lg border-2 ${
                    limiteProjetos.projetosAtivos >= limiteProjetos.limite
                      ? 'bg-red-50 border-red-200'
                      : limiteProjetos.projetosAtivos >= limiteProjetos.limite * 0.8
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
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
                
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Nome do projeto</label>
                    <input
                      type="text"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                      value={nome}
                      onChange={e => setNome(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Edital associado</label>
                      <button
                        type="button"
                        onClick={() => window.open('https://extratordeeditais.web.app/', '_blank')}
                        className="text-xs text-oraculo-blue hover:text-oraculo-blue/80 font-medium"
                      >
                        Cadastrar novo edital
                      </button>
                    </div>
                    
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                      value={editalAssociado}
                      onChange={e => setEditalAssociado(e.target.value)}
                    >
                      <option value="">Selecione um edital</option>
                      {editais.map((edital) => (
                        <option key={edital.id} value={edital.nome}>
                          {edital.nome} - {edital.orgao}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Descrição</label>
                    <textarea
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition min-h-[160px]"
                      value={descricao}
                      onChange={e => setDescricao(e.target.value)}
                      required
                      placeholder="Cole aqui todas as informações do seu projeto cultural. Depois vamos refinar o projeto com uso de IA e análise dos últimos selecionados do edital."
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
                      {loading || uploading ? 'Salvando...' : 'Avaliar com IA'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Section de Como Funciona */}
            <div className="mb-8 mt-8 p-12 bg-gradient-to-br from-oraculo-blue/5 to-oraculo-purple/5 border-2 border-oraculo-blue rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold mb-6 text-oraculo-blue flex items-center gap-3">
                <span role="img" aria-label="Dica">🤖</span> Como funciona a análise do Oráculo
              </h2>
              <p className="text-gray-700 text-base mb-8 leading-relaxed">
                Agora chegou a hora de avaliar seu projeto. O Oráculo analisa seu projeto como um avaliador, levando em conta não só os critérios do edital, mas também os últimos selecionados e uma base grande de projetos culturais bem-sucedidos.
              </p>
            </div>
          </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default CriarProjeto;