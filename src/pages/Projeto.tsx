import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc, serverTimestamp, onSnapshot, increment } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Brain, Loader2, Check, X, CheckCircle, Trash2, Copy, Download } from 'lucide-react';
import AnalisarImg from '@/assets/Analisar.jpeg';
import CriarImg from '@/assets/Criar.jpeg';
import { 
  trackProjectViewed, 
  trackProjectDeleted, 
  trackAnalysisStarted, 
  trackAnalysisCompleted, 
  trackAnalysisFailed,
  trackSuggestionApplied
} from '@/lib/analytics';

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
const currentStep: number = 1; // Avaliar com IA

// Função utilitária para limpar markdown
const limparMarkdown = (texto: string): string => {
  return texto
    .replace(/####\s*/g, '') // Remove ####
    .replace(/###\s*/g, '') // Remove ###
    .replace(/##\s*/g, '') // Remove ##
    .replace(/#\s*/g, '') // Remove #
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **texto**
    .replace(/\*(.*?)\*/g, '$1') // Remove *texto*
    .replace(/`(.*?)`/g, '$1') // Remove `código`
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links [texto](url)
    .trim();
};

// Função para extrair sugestões de forma robusta
const extrairSugestoes = (analiseTexto: string): string[] => {
  let matches: string[] = [];
  
  if (!analiseTexto || analiseTexto.trim().length === 0) {
    return matches;
  }
  
  // Remove seções que não são sugestões
  const textoLimpo = analiseTexto
    .replace(/###?\s*\d+\.\s*NOTA\s+ESTIMADA.*?(?=###?\s*\d+\.|$)/is, '')
    .replace(/###?\s*\d+\.\s*PONTOS\s+FORTES.*?(?=###?\s*\d+\.|$)/is, '')
    .replace(/###?\s*\d+\.\s*PONTOS\s+FRACOS.*?(?=###?\s*\d+\.|$)/is, '')
    .replace(/###?\s*\d+\.\s*ADEQUAÇÃO.*?(?=###?\s*\d+\.|$)/is, '');
  
  // Padrão 1: "Sugestão:" ou "- Sugestão:" no início da linha (testa TODOS os matches, não apenas o primeiro)
  const padrao1 = /(?:^|\n)[-•]\s*Sugestão:\s*(.+?)(?=\n\n|\n[-•]\s*Sugestão:|$)/gis;
  let match;
  while ((match = padrao1.exec(textoLimpo)) !== null) {
    const sugestao = limparMarkdown(match[1].trim());
    if (sugestao.length > 15 && !sugestao.match(/\d+\/\d+/) && !sugestao.match(/^###/)) {
      matches.push(sugestao);
    }
  }
  
  // Padrão 2: Números seguidos de "Sugestão:" (testa TODOS os matches)
  const padrao2 = /\d+[\.\)]\s*Sugestão:\s*(.+?)(?=\n\n|\d+[\.\)]\s*Sugestão:|$)/gis;
  while ((match = padrao2.exec(textoLimpo)) !== null) {
    const sugestao = limparMarkdown(match[1].trim());
    if (sugestao.length > 15 && !sugestao.match(/\d+\/\d+/) && !sugestao.match(/^###/)) {
      matches.push(sugestao);
    }
  }
  
  // Padrão 3: Seção "Sugestões de Melhoria" com lista (sempre testa, mesmo se já encontrou matches)
  const secaoSugestoes = textoLimpo.match(/sugest[õo]es?\s+de\s+melhoria:?\s*(.+?)(?=\n\n[A-Z]|\n\n\d+\.|$)/is);
  if (secaoSugestoes) {
    const listaSugestoes = secaoSugestoes[1]
      .split(/\n/)
      .map(line => {
        const limpa = line.trim()
          .replace(/^[-•\d.)\s]+/, '')
          .replace(/^Sugestão:\s*/i, '');
        return limparMarkdown(limpa);
      })
      .filter(line => line.length > 20 && !line.match(/\d+\/\d+/) && !line.match(/^###/));
    matches.push(...listaSugestoes);
  }
  
  // Padrão 4: Linhas que começam com "-" ou "•" após a palavra "Sugestão" (sempre testa)
  const linhas = textoLimpo.split('\n');
  let dentroSecaoSugestoes = false;
  for (const linha of linhas) {
    if (linha.match(/sugest[õo]es?\s+de\s+melhoria/i)) {
      dentroSecaoSugestoes = true;
      continue;
    }
    if (dentroSecaoSugestoes && linha.match(/^[-•]\s*(.+)/)) {
      const sugestao = limparMarkdown(linha.replace(/^[-•]\s*/, '').trim());
      if (sugestao.length > 15 && !sugestao.match(/\d+\/\d+/) && !sugestao.match(/^###/)) {
        matches.push(sugestao);
      }
    }
    if (dentroSecaoSugestoes && linha.trim() === '') {
      dentroSecaoSugestoes = false;
    }
  }
  
  // Padrão 5: Linhas que começam com "Sugestão:" sem prefixo (sempre testa)
  const padrao5 = /(?:^|\n)\s*Sugestão:\s*(.+?)(?=\n\n|\n\s*Sugestão:|$)/gis;
  while ((match = padrao5.exec(textoLimpo)) !== null) {
    const sugestao = limparMarkdown(match[1].trim());
    if (sugestao.length > 15 && !sugestao.match(/\d+\/\d+/) && !sugestao.match(/^###/)) {
      matches.push(sugestao);
    }
  }
  
  // Rejeitar itens que são títulos de seção da análise (não sugestões reais)
  const titulosSecao = [
    /^\d+\.\s*\*?NOTA\s+ESTIMADA\s*\(?\d*\s*[-–]?\s*\d*\)?/i,
    /^\d+\.\s*\*?PONTOS\s+FORTES/i,
    /^\d+\.\s*\*?PONTOS\s+FRACOS/i,
    /^\d+\.\s*\*?ADEQUAÇÃO\s+AOS\s+CRITÉRIOS/i,
    /^\d+\.\s*\*?SUGESTÕES\s+DE\s+MELHORIA/i,
    /NOTA\s+ESTIMADA\s*\(?\d*\s*[-–]?\s*\d*\)?\s*$/i,
  ];
  const ehTituloSecao = (texto: string) => titulosSecao.some(r => r.test(texto.trim()));

  return matches
    .filter(s => !ehTituloSecao(s) && s.trim().length > 10)
    .filter((s, i, arr) => {
      const index = arr.findIndex(item => item.trim().toLowerCase() === s.trim().toLowerCase());
      return index === i;
    });
};

// Função para formatar texto para exibição
// Função para remover sugestões do texto da análise
const removerSugestoesDoTexto = (texto: string): string => {
  if (!texto) return texto;
  
  let textoLimpo = texto;
  
  // Remover seção completa de sugestões - padrão mais amplo
  // Remove desde "4. SUGESTÕES" até encontrar "5." ou fim do texto
  textoLimpo = textoLimpo.replace(
    /4\.[\s\*\-\d\.]*[Ss]ugest[õo]es?[\s\*\-\d\.]*([Dd]e[\s\*\-\d\.]*[Mm]elhoria)?[:\s]*[\s\S]*?(?=\n\s*(?:5\.|\*\*5\.|ANÁLISE\s+DETALHADA|$))/i,
    ''
  );
  
  // Remover linhas individuais de sugestões em vários formatos
  const linhas = textoLimpo.split('\n');
  const linhasFiltradas = linhas.filter(linha => {
    const linhaTrimmed = linha.trim();
    const linhaLower = linhaTrimmed.toLowerCase();
    
    // Pular linhas vazias
    if (!linhaTrimmed) return true;
    
    // Remover linhas que começam com "Sugestão 1:", "Sugestão 2:", etc.
    if (/^[Ss]ugest[ãa]o\s+\d+[:.]\s/.test(linhaTrimmed)) return false;
    
    // Remover linhas que começam com número seguido de "Sugestão:"
    if (/^\d+[\.\)]\s*[Ss]ugest[ãa]o:\s/.test(linhaTrimmed)) return false;
    
    // Remover linhas que começam com "- Sugestão:" ou "• Sugestão:"
    if (/^[-•]\s*[Ss]ugest[ãa]o:\s/.test(linhaTrimmed)) return false;
    
    // Remover seção de sugestões (título)
    if (linhaLower.includes('sugestões de melhoria') || linhaLower.includes('sugestoes de melhoria')) {
      return false;
    }
    
    return true;
  });
  
  textoLimpo = linhasFiltradas.join('\n');
  
  // Remover linhas vazias duplicadas
  textoLimpo = textoLimpo.replace(/\n{3,}/g, '\n\n');
  
  return textoLimpo.trim();
};

const formatarTextoParaExibicao = (texto: string): string => {
  return limparMarkdown(texto)
    .split('\n')
    .map(linha => linha.trim())
    .filter(linha => linha.length > 0)
    .join('\n');
};

const Projeto = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isStreaming = searchParams.get('streaming') === 'true';
  const [projeto, setProjeto] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analisando, setAnalisando] = useState(false);
  const [analise, setAnalise] = useState<string | null>(null);
  const [erroIA, setErroIA] = useState<string | null>(null);
  const [etapaAtual, setEtapaAtual] = useState<number>(1); // 1 = Avaliar com IA
  const [statusIA, setStatusIA] = useState<string>('');
  const [subEtapasIA, setSubEtapasIA] = useState<string[]>([]);
  const [dicaAtual, setDicaAtual] = useState<number>(0);
  
  // Dicas para criação de projetos culturais
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
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [descricaoEditada, setDescricaoEditada] = useState<string>('');
  const [aprovacoes, setAprovacoes] = useState<boolean[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [gerandoSugestao, setGerandoSugestao] = useState<number | null>(null); // Armazena o índice da sugestão sendo processada
  const [sugestaoPersonalizada, setSugestaoPersonalizada] = useState<string>('');
  const [aplicandoSugestaoPersonalizada, setAplicandoSugestaoPersonalizada] = useState(false);
  const [textoAnterior, setTextoAnterior] = useState<string>(''); // Armazena o texto antes de aplicar sugestão
  const [aguardandoAprovacao, setAguardandoAprovacao] = useState(false); // Indica se há mudança aguardando aprovação
  const [isPremium, setIsPremium] = useState(false);
  const [creditos, setCreditos] = useState<number>(0);
  const [mostrarAlterarIA, setMostrarAlterarIA] = useState(false);
  const [mostrarAnalise, setMostrarAnalise] = useState(false);
  const [mostrarSucesso, setMostrarSucesso] = useState(false);
  const [mostrarAprovacaoSucesso, setMostrarAprovacaoSucesso] = useState(false);
  const [mostrarModalApagar, setMostrarModalApagar] = useState(false);
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('');
  const [primeiraAnaliseCompleta, setPrimeiraAnaliseCompleta] = useState(false);
  const [analiseIniciada, setAnaliseIniciada] = useState(false); // Para evitar iniciar análise múltiplas vezes
  const [streamingAnaliseContent, setStreamingAnaliseContent] = useState(''); // Conteúdo da análise em streaming
  const [user] = useAuthState(auth);
  const navigate = useNavigate();

  // Check premium status
  useEffect(() => {
    const checkPremiumStatus = async () => {
      if (!user) return;
      try {
        const db = getFirestore();
        const userRef = doc(db, 'usuarios', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setIsPremium(userData.isPremium === true);
          setCreditos(typeof userData.creditos === 'number' ? userData.creditos : 0);
        }
      } catch (error) {
        console.error('Erro ao verificar status premium:', error);
      }
    };
    checkPremiumStatus();
  }, [user]);

  // Alternar dicas a cada 5 segundos quando estiver analisando
  useEffect(() => {
    if (!analisando || !mostrarAnalise) return;
    
    const interval = setInterval(() => {
      setDicaAtual((prev) => (prev + 1) % dicasProjetos.length);
    }, 5000); // 5 segundos
    
    return () => clearInterval(interval);
  }, [analisando, mostrarAnalise, dicasProjetos.length]);

  // Acesso: premium sempre liberado; sem plano usa créditos (avaliação = 5 créditos)
  const CREDITOS_ANALISE = 5;
  const checkPremiumAccess = () => {
    if (isPremium) return true;
    if ((creditos ?? 0) < CREDITOS_ANALISE) {
      navigate('/cadastro-premium?motivo=creditos_insuficientes');
      return false;
    }
    return true;
  };

  useEffect(() => {
    document.title = 'Oráculo Cultural';
  }, []);

  useEffect(() => {
    if (!id) return;
    
    setLoading(true);
    setAnaliseIniciada(false); // Reset quando carregar novo projeto
    const db = getFirestore();
    const ref = doc(db, 'projetos', id);
    
    // Se está em modo streaming (veio do Criar Projeto), não mostrar modal; exibir página com caixa de análise em tempo real
    if (isStreaming) {
      setMostrarAnalise(false);
      setAnalisando(true);
      setStatusIA('Recebendo análise da IA...');
      setSubEtapasIA(['A IA está escrevendo a análise...']);
      
      const unsubscribe = onSnapshot(ref, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProjeto({ id: snap.id, ...data });
          
          // Se há análise sendo escrita, atualizar em tempo real e fechar o modal "consultando as musas"
          if (data.analise_ia) {
            setMostrarAnalise(false);
            setAnalise(data.analise_ia);
            
            // Extrair sugestões conforme a análise vai sendo escrita
            const matches = extrairSugestoes(data.analise_ia);
            setSugestoes(matches);
            setAprovacoes(Array(matches.length).fill(false));
            
            // Se a análise parece completa (tem mais de 500 caracteres e termina com pontuação), considerar concluída
            if (data.analise_ia.length > 500 && /[.!?]$/.test(data.analise_ia.trim().slice(-10))) {
              setAnalisando(false);
              setStatusIA('Análise concluída!');
              setSubEtapasIA([]);
              if (etapaAtual < 2) setEtapaAtual(2);
              
              // Remover parâmetro streaming da URL
              navigate(`/projeto/${id}`, { replace: true });
            }
          }
        }
        setLoading(false);
      });
      
      return () => unsubscribe();
    } else {
      // Modo normal: buscar uma vez
      const fetchProjeto = async () => {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = { id: snap.id, ...(snap.data() as any) };
          setProjeto(data);
          setEtapaAtual(typeof data.etapa_atual === 'number' ? data.etapa_atual : 1);
          setDescricaoEditada(data.descricao || '');
          
          // Check if first analysis was already completed
          // Se já existe análise mas não tem o campo, considerar como primeira análise completa (para projetos antigos)
          if (data.analise_ia && data.primeira_analise_completa === undefined) {
            // Projeto antigo com análise mas sem campo - marcar como primeira análise completa
            const ref = doc(db, 'projetos', id);
            await updateDoc(ref, { primeira_analise_completa: true });
            setPrimeiraAnaliseCompleta(true);
          } else {
            setPrimeiraAnaliseCompleta(data.primeira_analise_completa === true);
          }
          
          // If analysis exists, process it
          if (data.analise_ia) {
            setAnalise(data.analise_ia);
            setStatusIA('Análise carregada');
            
            // Extract suggestions using the new robust function
            const matches = extrairSugestoes(data.analise_ia);
            console.log('Sugestões extraídas em Projeto.tsx:', matches);
            console.log('Total de sugestões:', matches.length);
            setSugestoes(matches);
            
            // Initialize approvals
            setAprovacoes(Array(matches.length).fill(false));
          }
          
          // Track project viewed
          if (user) {
            const db = getFirestore();
            const userRef = doc(db, 'usuarios', user.uid);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.exists() ? userSnap.data() : {};
            const planType = userData?.planType || 'free';
            
            trackProjectViewed({
              projectId: id,
              hasAnalysis: !!data.analise_ia,
              hasTexts: !!data.textos,
              planType: planType,
            });
          }
        }
        setLoading(false);
      };
      fetchProjeto();
    }
  }, [id, user, isStreaming]);

  // Iniciar análise automaticamente quando o projeto é carregado sem análise
  useEffect(() => {
    if (!loading && projeto && !projeto.analise_ia && !analisando && !analiseIniciada && user) {
      setAnaliseIniciada(true); // Marcar como iniciada para evitar múltiplas chamadas
      // Pequeno delay para garantir que o componente está totalmente renderizado
      const timer = setTimeout(() => {
        analisarComIA();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [loading, projeto, analisando, analiseIniciada, user]);

  // Handler for approving a suggestion
  const handleAprovar = async (idx: number) => {
    if (!checkPremiumAccess()) return;
    
    // Mark suggestion as approved
    const novasAprovacoes = [...aprovacoes];
    novasAprovacoes[idx] = true;
    setAprovacoes(novasAprovacoes);
    setGerandoSugestao(idx); // Usa o índice específico da sugestão
    
    try {
      // Use the current edited description as base, or fallback to original
      const textoBase = descricaoEditada || projeto?.descricao || '';
      
      if (!textoBase.trim() || !sugestoes[idx]?.trim()) {
        console.error('Texto ou sugestão vazios');
        alert('Erro: texto ou sugestão inválidos');
        setGerandoSugestao(null);
        return;
      }
      
      // Buscar portfolio do usuário
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
      
      const endpoint = 'https://us-central1-culturalapp-fb9b0.cloudfunctions.net/alterarTextoComIA';
      
      console.log('Enviando texto e sugestão para o backend...');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          textoAtual: textoBase,
          sugestao: sugestoes[idx],
          portfolio: portfolioTexto,
          userId: user?.uid, // Adicionar userId para buscar portfolio do Firestore
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro ao alterar texto: ${response.status} - ${JSON.stringify(errorData)}`);
      }
      
      // Processar resposta streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let novoTexto = '';
      
      if (!reader) {
        throw new Error('Não foi possível ler a resposta do servidor');
      }
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                novoTexto += parsed.content;
                setDescricaoEditada(novoTexto);
              }
            } catch (e) {
              // Ignorar erros de parsing
            }
          }
        }
      }
      
      // Não salvar imediatamente - aguardar aprovação do usuário
      if (id && novoTexto.trim()) {
        // Salvar versão anterior antes de mostrar a nova
        setTextoAnterior(textoBase);
        setDescricaoEditada(novoTexto);
        setAguardandoAprovacao(true);
        
        // Scroll para a seção "Texto do Projeto" para ver a mudança
        setTimeout(() => {
          const elemento = document.getElementById('texto-do-projeto');
          if (elemento) {
            elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);
      }
      
    } catch (e) {
      console.error('Erro ao processar sugestão:', e);
      alert(`Erro ao aplicar sugestão: ${e instanceof Error ? e.message : 'Erro desconhecido'}`);
      // Reverter a aprovação em caso de erro
      const novasAprovacoes = [...aprovacoes];
      novasAprovacoes[idx] = false;
      setAprovacoes(novasAprovacoes);
    } finally {
      setGerandoSugestao(null); // Limpa o estado de loading
    }
  };

  // Função para aprovar a mudança e salvar no Firestore
  const aprovarMudanca = async () => {
    if (!id || !descricaoEditada.trim()) {
      alert('Erro: não há mudança para aprovar');
      return;
    }

    setSalvando(true);
    try {
      const db = getFirestore();
      const ref = doc(db, 'projetos', id);
      await updateDoc(ref, { descricao: descricaoEditada });
      setProjeto((prev: any) => ({ ...prev, descricao: descricaoEditada }));
      
      // Track suggestion applied se houver user
      if (user) {
        const userRef = doc(db, 'usuarios', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        const planType = userData?.planType || 'free';
        
        trackSuggestionApplied({
          projectId: id,
          suggestionIndex: -1, // Indica sugestão personalizada
          suggestionText: 'Sugestão personalizada aprovada',
          planType: planType,
        });
      }
      
      // Limpar estados de aprovação
      setAguardandoAprovacao(false);
      setTextoAnterior('');
      
      setMostrarAprovacaoSucesso(true);
    } catch (error) {
      console.error('Erro ao aprovar mudança:', error);
      alert('Erro ao salvar a mudança. Por favor, tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  // Função para reverter para a versão anterior
  const reverterMudanca = () => {
    if (!textoAnterior) {
      alert('Erro: não há versão anterior para reverter');
      return;
    }

    setDescricaoEditada(textoAnterior);
    setAguardandoAprovacao(false);
    setTextoAnterior('');
    
    // Scroll para a seção "Texto do Projeto"
    setTimeout(() => {
      const elemento = document.getElementById('texto-do-projeto');
      if (elemento) {
        elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  };

  // Função para copiar o texto do projeto
  const copiarTextoProjeto = async () => {
    const textoParaCopiar = descricaoEditada || projeto?.descricao || '';
    
    if (!textoParaCopiar.trim()) {
      alert('Não há texto para copiar.');
      return;
    }

    try {
      await navigator.clipboard.writeText(textoParaCopiar);
      alert('Texto copiado para a área de transferência!');
    } catch (error) {
      console.error('Erro ao copiar texto:', error);
      // Fallback para navegadores mais antigos
      const textarea = document.createElement('textarea');
      textarea.value = textoParaCopiar;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        alert('Texto copiado para a área de transferência!');
      } catch (err) {
        alert('Erro ao copiar texto. Por favor, selecione o texto manualmente.');
      }
      document.body.removeChild(textarea);
    }
  };

  // Função para baixar o texto do projeto
  const baixarTextoProjeto = () => {
    const textoParaBaixar = descricaoEditada || projeto?.descricao || '';
    
    if (!textoParaBaixar.trim()) {
      alert('Não há texto para baixar.');
      return;
    }

    const elemento = document.createElement('a');
    const arquivo = new Blob([textoParaBaixar], { type: 'text/plain;charset=utf-8' });
    elemento.href = URL.createObjectURL(arquivo);
    elemento.download = `${projeto?.nome || 'projeto'}_texto.txt`;
    document.body.appendChild(elemento);
    elemento.click();
    document.body.removeChild(elemento);
  };

  // Handler para aplicar sugestão personalizada do usuário
  const handleAplicarSugestaoPersonalizada = async () => {
    if (!checkPremiumAccess()) return;
    
    if (!sugestaoPersonalizada.trim()) {
      alert('Por favor, digite uma sugestão antes de aplicar.');
      return;
    }
    
    setAplicandoSugestaoPersonalizada(true);
    
    try {
      // Use the current edited description as base, or fallback to original
      const textoBase = descricaoEditada || projeto?.descricao || '';
      
      if (!textoBase.trim()) {
        console.error('Texto do projeto vazio');
        alert('Erro: texto do projeto inválido');
        setAplicandoSugestaoPersonalizada(false);
        return;
      }
      
      // Buscar portfolio do usuário
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
      
      const endpoint = 'https://us-central1-culturalapp-fb9b0.cloudfunctions.net/alterarTextoComIA';
      
      console.log('Enviando texto e sugestão personalizada para o backend...');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          textoAtual: textoBase,
          sugestao: sugestaoPersonalizada,
          portfolio: portfolioTexto,
          userId: user?.uid,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro ao alterar texto: ${response.status} - ${JSON.stringify(errorData)}`);
      }
      
      // Processar resposta streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let novoTexto = '';
      
      if (!reader) {
        throw new Error('Não foi possível ler a resposta do servidor');
      }
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                novoTexto += parsed.content;
                setDescricaoEditada(novoTexto);
              }
            } catch (e) {
              // Ignorar erros de parsing
            }
          }
        }
      }
      
      // Não salvar imediatamente - aguardar aprovação do usuário
      if (id && novoTexto.trim()) {
        // Salvar versão anterior antes de mostrar a nova
        setTextoAnterior(textoBase);
        setDescricaoEditada(novoTexto);
        setAguardandoAprovacao(true);
        
        // Limpar o campo de sugestão personalizada após aplicar
        setSugestaoPersonalizada('');
        
        // Scroll para a seção "Texto do Projeto" para ver a mudança
        setTimeout(() => {
          const elemento = document.getElementById('texto-do-projeto');
          if (elemento) {
            elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);
      }
      
    } catch (e) {
      console.error('Erro ao processar sugestão personalizada:', e);
      alert(`Erro ao aplicar sugestão: ${e instanceof Error ? e.message : 'Erro desconhecido'}`);
    } finally {
      setAplicandoSugestaoPersonalizada(false);
    }
  };

  // Função para abrir modal de confirmação de exclusão
  const abrirModalApagar = () => {
    setConfirmacaoTexto('');
    setMostrarModalApagar(true);
  };

  // Função para deletar um projeto
  const handleDeleteProjeto = async () => {
    if (!id || !user) return;
    
    if (confirmacaoTexto.toLowerCase().trim() !== 'apagar') {
      alert('Por favor, digite "apagar" para confirmar a exclusão.');
      return;
    }
    
    try {
      const db = getFirestore();
      const ref = doc(db, 'projetos', id);
      const projetoSnap = await getDoc(ref);
      const projetoData = projetoSnap.exists() ? projetoSnap.data() : null;
      
      await deleteDoc(ref);
      
      // Track project deleted
      trackProjectDeleted({
        projectId: id,
        projectName: projetoData?.nome,
        hadAnalysis: !!projetoData?.analise_ia,
      });
      
      navigate('/oraculo-ai');
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      alert('Erro ao excluir o projeto. Tente novamente.');
    }
  };

  // Save changes to Firestore
  const handleSalvar = async () => {
    if (!id) return;
    
    setSalvando(true);
    try {
      const db = getFirestore();
      const ref = doc(db, 'projetos', id);
      await updateDoc(ref, { 
        descricao: descricaoEditada, 
        sugestoes_aprovadas: aprovacoes 
      });
      
      // Update local project state
      setProjeto((prev: any) => ({
        ...prev,
        descricao: descricaoEditada,
        sugestoes_aprovadas: aprovacoes
      }));
      
      // Show success popup
      setMostrarSucesso(true);
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        setMostrarSucesso(false);
      }, 3000);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      alert('Erro ao salvar as alterações. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  // Toggle Alterar com IA view
  const toggleAlterarIA = () => {
    setMostrarAlterarIA(!mostrarAlterarIA);
  };

  // Function to advance to the next step
  const avancarEtapa = async (novaEtapa: number) => {
    if (!id) return;
    setEtapaAtual(novaEtapa);
    const db = getFirestore();
    const ref = doc(db, 'projetos', id);
    await updateDoc(ref, { etapa_atual: novaEtapa });
  };

  // Função para buscar textos do edital e selecionados
  const fetchEditalESelecionados = async (editalNome: string) => {
    const db = getFirestore();
    // Busca o edital pelo nome
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

  // Função auxiliar para adicionar delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Função para atualizar status com delay
  const updateStatusWithDelay = async (status: string, subEtapas: string[] = [], delayMs: number = 1500) => {
    if (status) {
      setStatusIA(status);
      // Adiciona uma nova subetapa apenas se for diferente da última
      setSubEtapasIA(prev => {
        const lastItem = prev[prev.length - 1];
        if (status !== lastItem) {
          return [...prev, status];
        }
        return prev;
      });
    }
    
    // Adiciona subetapas adicionais se fornecidas
    if (subEtapas.length > 0) {
      setSubEtapasIA(prev => [...prev, ...subEtapas.filter(s => !prev.includes(s))]);
    }
    
    // Pequeno delay para permitir a atualização da UI
    await delay(delayMs);
  };

  // Função para analisar com IA
  const analisarComIA = async () => {
    if (!checkPremiumAccess()) return;

    // Track analysis started
    if (id && user) {
      const db = getFirestore();
      const userRef = doc(db, 'usuarios', user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : {};
      const planType = userData?.planType || 'free';
      const projetoSnap = await getDoc(doc(db, 'projetos', id));
      const projetoData = projetoSnap.exists() ? projetoSnap.data() : null;
      const isFirstAnalysis = !projetoData?.analise_ia;
      
      trackAnalysisStarted({
        projectId: id,
        planType: planType,
        isFirstAnalysis: isFirstAnalysis,
      });
    }
    
    // Primeiro, mostra o modal e configura os estados iniciais
    setMostrarAnalise(true);
    setAnalise(null);
    setErroIA(null);
    setStatusIA('O Oráculo está consultando as musas...');
    setSubEtapasIA(['Consultando as musas da inspiração...']);
    setAnalisando(true);
    
    // Força uma atualização síncrona do DOM
    await new Promise(resolve => {
      // Usa requestAnimationFrame para garantir que o React tenha tempo de renderizar
      requestAnimationFrame(() => {
        // Usa um pequeno timeout para garantir que o navegador tenha tempo de renderizar
        setTimeout(resolve, 100);
      });
    });
    
    // Processamento real: buscar edital e portfolio em paralelo (sem atrasos artificiais)
    try {
      setStatusIA('Coletando dados do projeto e edital...');
      setSubEtapasIA(['Lendo edital e critérios...']);

      const db = getFirestore();
      let dadosConsolidados = {
        texto_edital: '',
        criterios: '',
        texto_selecionados: '',
        nome_edital: projeto.edital_associado || '',
        resumo_projeto: projeto.resumo || projeto.descricao?.slice(0, 2000) || '',
      };

      // Buscar edital e portfolio em paralelo para reduzir tempo total
      const portfolioPromise = user
        ? getDoc(doc(db, 'usuarios', user.uid)).then(snap => (snap.exists() ? (snap.data()?.portfolio || '') : ''))
        : Promise.resolve('');
      const [editalResult, portfolioTexto] = await Promise.all([
        projeto.edital_associado ? fetchEditalESelecionados(projeto.edital_associado) : Promise.resolve(null),
        portfolioPromise,
      ]);

      if (editalResult) {
        dadosConsolidados.texto_edital = editalResult.texto_edital;
        dadosConsolidados.criterios = editalResult.criterios;
        dadosConsolidados.texto_selecionados = editalResult.texto_selecionados;
      }

      if (!dadosConsolidados.criterios || dadosConsolidados.criterios.trim() === '') {
        throw new Error('O edital selecionado não possui critérios cadastrados. Por favor, certifique-se de que o edital possui critérios de avaliação cadastrados.');
      }

      setStatusIA('Enviando para análise da IA...');
      setSubEtapasIA(['Aguardando resposta da IA...']);
      
      const endpoint = 'https://us-central1-culturalapp-fb9b0.cloudfunctions.net/avaliarProjetoIA';
      const payload = {
        projetoId: id,
        textoProjeto: dadosConsolidados.resumo_projeto,
        nomeProjeto: projeto.nome,
        nomeEdital: dadosConsolidados.nome_edital,
        criteriosEdital: dadosConsolidados.criterios,
        textoEdital: dadosConsolidados.texto_edital,
        portfolio: portfolioTexto,
        projetosSelecionados: dadosConsolidados.texto_selecionados ? dadosConsolidados.texto_selecionados.slice(0, 2000) : '',
        userId: user?.uid,
        stream: true,
      };

      setStreamingAnaliseContent('');
      setStatusIA('Recebendo análise em tempo real...');
      setSubEtapasIA(['A IA está escrevendo a análise...']);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(payload),
      });

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

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Stream não disponível');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let streamDone = false;
      let rafScheduled = false;
      let lastFlush = '';

      const flushToUi = () => {
        if (lastFlush === fullContent) return;
        lastFlush = fullContent;
        setStreamingAnaliseContent(fullContent);
        setMostrarAnalise(false);
      };
      const scheduleFlush = () => {
        if (rafScheduled) return;
        rafScheduled = true;
        requestAnimationFrame(() => {
          rafScheduled = false;
          flushToUi();
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              fullContent += data.content;
              scheduleFlush();
            }
            if (data.done) {
              fullContent = data.fullContent ?? fullContent;
              streamDone = true;
              break;
            }
          } catch {
            // ignorar linhas inválidas
          }
        }
        if (streamDone) break;
      }
      flushToUi();
      if (buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.slice(6));
          if (data.done && data.fullContent) fullContent = data.fullContent;
        } catch {
          // manter fullContent acumulado
        }
      }

      const analiseIA = fullContent;
      if (!analiseIA) throw new Error('Nenhum conteúdo recebido da IA.');

      if (id) {
        const db = getFirestore();
        const ref = doc(db, 'projetos', id);
        const projetoSnap = await getDoc(ref);
        const projetoData = projetoSnap.exists() ? projetoSnap.data() : null;
        const jaTinhaAnalise = projetoData?.analise_ia;

        const updateData: any = { analise_ia: analiseIA };
        if (jaTinhaAnalise) {
          updateData.primeira_analise_completa = true;
          setPrimeiraAnaliseCompleta(true);
        } else {
          setPrimeiraAnaliseCompleta(false);
        }

        await updateDoc(ref, updateData);

        if (user) {
          try {
            const userRef = doc(db, 'usuarios', user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists() && userSnap.data()?.isPremium !== true) {
              await updateDoc(userRef, { creditos: increment(-CREDITOS_ANALISE) });
              setCreditos((c) => Math.max(0, c - CREDITOS_ANALISE));
            }
          } catch (e) {
            console.error('Erro ao descontar créditos:', e);
          }
        }

        setStreamingAnaliseContent('');
        setProjeto((prev: any) => ({ ...prev, analise_ia: analiseIA, primeira_analise_completa: updateData.primeira_analise_completa ?? prev?.primeira_analise_completa }));
        const matches = extrairSugestoes(analiseIA);
        setSugestoes(matches);
        setAprovacoes(Array(matches.length).fill(false));
        setAnalise(analiseIA);
        if (etapaAtual < 2) await avancarEtapa(2);
        setMostrarAnalise(false);
      }
      setAnalisando(false);
    } catch (e: any) {
      // Track analysis failed
      if (id && user) {
        const db = getFirestore();
        const userRef = doc(db, 'usuarios', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        const planType = userData?.planType || 'free';
        
        trackAnalysisFailed({
          projectId: id,
          error: e.message || 'Erro desconhecido',
          planType: planType,
        });
      }
      
      setErroIA(e.message || 'Ocorreu um erro desconhecido ao processar a análise.');
      setStreamingAnaliseContent('');
      console.error(e);
    } finally {
      setAnalisando(false);
      setStatusIA('');
    }
  };

  // Function to handle step navigation
  const navigateToStep = (stepIndex: number) => {
    // Permitir navegação para "Gerar Textos" se já existe análise
    // Permitir navegação se for para o passo atual ou anterior
    // Permitir navegação para próximo passo em casos específicos
    if (stepIndex > etapaAtual) {
      // Se está tentando ir para "Gerar Textos" (step 3) e já tem análise, permitir
      if (stepIndex === 3 && projeto?.analise_ia) {
        // Permitir
      } 
      // Se está em 'Alterar com IA' (step 2) e vai para 'Gerar textos' (step 3), permitir
      else if (etapaAtual === 2 && stepIndex === 3) {
        // Permitir
      }
      // Caso contrário, bloquear
      else {
        return;
      }
    }
    
    const routes = [
      '/criar-projeto',
      `/projeto/${id}`,
      `/projeto/${id}/alterar-com-ia`,
      `/projeto/${id}/gerar-textos`,
      `/projeto/${id}/criar-orcamento`,
      `/projeto/${id}/criar-cronograma`,
      `/projeto/${id}/documentos-inscricao`,
      `/projeto/${id}/preencher-anexos`
    ];
    
    if (routes[stepIndex]) {
      navigate(routes[stepIndex]);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 flex items-center justify-center p-8 animate-fade-in">
            <p>Carregando projeto...</p>
          </main>
        </div>
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 flex items-center justify-center p-8 animate-fade-in">
            <p>Projeto não encontrado.</p>
          </main>
        </div>
      </div>
    );
  }

  // Modal de Análise com IA - Versão simplificada
  const AnaliseModal = () => {
    if (erroIA) {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Erro na Análise</h2>
            <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm mb-6">
              <p className="font-medium">Ocorreu um erro:</p>
              <p className="mt-1">{erroIA}</p>
            </div>
            <button
              onClick={analisarComIA}
              className="px-4 py-2 bg-oraculo-blue text-white rounded-lg hover:bg-oraculo-blue/90 transition"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Loader2 className="h-12 w-12 animate-spin text-oraculo-blue" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Analisando Projeto</h2>
            <p className="text-gray-600 mb-6">
              Aguarde enquanto analisamos seu projeto com IA. 
              Este processo pode levar alguns instantes.
            </p>
            
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div 
                className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (subEtapasIA.length / 8) * 100)}%` }}
              ></div>
            </div>
            
            <p className="text-sm text-gray-500">
              {statusIA || 'Iniciando análise...'}
            </p>
        </div>
      </div>
    </div>
  );
};

  const temConteudoAnalise = (streamingAnaliseContent?.trim().length ?? 0) > 0 || (projeto?.analise_ia?.trim().length ?? 0) > 0;
  const mostrarModalMusas = mostrarAnalise && analisando && !temConteudoAnalise;

  // Show loading popup only while analyzing and no content yet; as soon as content arrives, show page with analysis
  if (mostrarModalMusas) {
    return (
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
            
            <button
              onClick={() => {
                setMostrarAnalise(false);
                setAnalisando(false);
              }}
              className="mt-4 px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all backdrop-blur-sm font-medium"
            >
              Cancelar
            </button>
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
      </div>
    );
  }

  // Success popup component
  const SuccessPopup = () => {
    if (!mostrarSucesso) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Sucesso!</h3>
          <p className="text-gray-600 mb-6">Alterações salvas com sucesso!</p>
          <Button 
            onClick={() => setMostrarSucesso(false)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium"
          >
            Entendi
          </Button>
        </div>
      </div>
    );
  };

  // Popup estilizado: mudança aprovada e salva
  const AprovacaoSuccessPopup = () => {
    if (!mostrarAprovacaoSucesso) return null;
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl border-2 border-oraculo-blue/20 animate-in zoom-in-95 duration-300">
          <div className="flex justify-center mb-5">
            <div className="w-20 h-20 bg-gradient-to-br from-oraculo-blue/20 to-oraculo-purple/20 rounded-full flex items-center justify-center ring-4 ring-oraculo-blue/30">
              <CheckCircle className="h-10 w-10 text-oraculo-blue" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Mudança Aprovada</h3>
          <p className="text-gray-600 mb-6 leading-relaxed">Mudança aprovada e salva com sucesso!</p>
          <Button
            onClick={() => setMostrarAprovacaoSucesso(false)}
            className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg"
          >
            Entendi
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <DashboardHeader />
        
        <main className="flex-1 p-3 md:p-4 overflow-x-hidden pb-20 md:pb-8 min-h-0">
          <div className="max-w-5xl mx-auto min-w-0">
            <div className="mb-6">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 min-w-0">
                  {projeto?.nome || 'Carregando projeto...'}
                </h1>
                {projeto?.analise_ia && (
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Próximo passo</span>
                    <Button
                      size="lg"
                      onClick={() => navigateToStep(3)}
                      className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white px-6 py-2.5 text-base font-semibold"
                    >
                      Próximo: Gerar Textos <span className="ml-2 opacity-90">→</span>
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-1">
                {projeto?.descricao ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-oraculo-blue/5 border border-oraculo-blue/20">
                    <span className="text-xs font-semibold uppercase tracking-wide text-oraculo-blue/80">Edital de avaliação</span>
                    <span className="text-oraculo-blue/60 font-medium">·</span>
                    <span className="text-gray-700 text-sm md:text-base font-medium break-words">{projeto?.edital_associado || 'Nenhum edital associado'}</span>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Carregando detalhes...</p>
                )}
              </div>
            </div>

            {/* Progress Bar with Clickable Steps - scroll horizontal no mobile */}
            <div className="mb-6 md:mb-8 overflow-hidden">
              <div className="flex items-center gap-2 md:justify-between mb-2 overflow-x-auto pb-2 md:pb-0 min-w-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                {steps.map((step, index) => {
                  const podeNavegar = index <= etapaAtual || (index === 3 && projeto?.analise_ia);
                  const creditosStep: Record<number, number> = { 1: 5, 3: 1, 4: 3, 5: 3 };
                  const cred = creditosStep[index];
                  return (
                    <div key={index} className="flex flex-col items-center flex-shrink-0 min-w-[3.5rem] md:min-w-0">
                      <button 
                        onClick={() => navigateToStep(index)}
                        className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          podeNavegar
                            ? 'bg-oraculo-blue text-white hover:bg-oraculo-blue/90 cursor-pointer' 
                            : 'bg-gray-200 text-gray-600 cursor-not-allowed'
                        }`}
                        disabled={!podeNavegar}
                        aria-label={`Ir para ${step}`}
                      >
                        {index + 1}
                      </button>
                      <button 
                        onClick={() => navigateToStep(index)}
                        disabled={!podeNavegar}
                        className={`text-xs mt-1 text-center whitespace-nowrap ${
                          index === etapaAtual 
                            ? 'font-medium text-oraculo-blue' 
                            : podeNavegar
                              ? 'text-oraculo-blue hover:underline cursor-pointer' 
                              : 'text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {step}
                        {typeof cred === 'number' && <span className="block text-[10px] text-gray-500 font-normal">{cred} {cred === 1 ? 'crédito' : 'créditos'}</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 min-w-0">
                <div 
                  className="bg-oraculo-blue h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${((etapaAtual + 1) / steps.length) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8 border-t-4 border-oraculo-blue">
              {/* Como funciona a análise (só quando não há análise) - em cima do breadcrumb e do nome do projeto */}
              {!projeto.analise_ia && !analisando && (
                <div className="mb-0 mx-4 md:mx-6 mt-4 md:mt-6 p-4 md:p-6 bg-gradient-to-br from-oraculo-blue/5 to-oraculo-purple/5 border-2 border-oraculo-blue rounded-xl">
                  <h2 className="text-lg md:text-2xl font-bold mb-3 md:mb-4 text-oraculo-blue flex items-center gap-2 md:gap-3">
                    <span role="img" aria-label="Dica">🤖</span> Como funciona a análise do Oráculo
                  </h2>
                  <p className="text-gray-700 text-sm md:text-base mb-4 md:mb-6 leading-relaxed">
                    Agora chegou a hora de avaliar seu projeto. O Oráculo analisa seu projeto como um avaliador, levando em conta não só os critérios do edital, mas também os últimos selecionados e uma base grande de projetos culturais bem-sucedidos.
                  </p>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-base md:text-xl px-6 md:px-12 py-4 md:py-6 flex items-center gap-2 md:gap-3 w-full justify-center font-bold"
                    onClick={analisarComIA}
                    disabled={analisando}
                  >
                    <Brain className="h-6 w-6 md:h-8 md:w-8" />
                    {analisando ? 'Analisando...' : 'Analisar com IA'}
                  </Button>
                  {analisando && (
                    <div className="mt-4 bg-white border border-gray-200 rounded-lg px-4 py-3 text-gray-700 text-sm font-medium text-center animate-pulse">
                      {statusIA || 'Iniciando análise...'}
                      {subEtapasIA.length > 0 && (
                        <ul className="mt-2 text-left text-xs text-gray-600 list-disc list-inside">
                          {subEtapasIA.map((etapa, idx) => (
                            <li key={idx}>{etapa}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="mb-4 px-4 md:px-6 flex flex-wrap gap-2 min-w-0">
                <span className="inline-block bg-oraculo-blue/10 text-oraculo-blue px-3 py-1 rounded-full text-xs font-semibold break-words max-w-full">
                  {projeto.categoria}
                </span>
              </div>
              <div className="mb-8">
                {/* Seção de Análise em streaming (exibe conforme chega da IA) */}
                {analisando && (
                  <div className="mb-8">
                    <div className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white px-4 md:px-8 py-4 md:py-6 rounded-t-xl flex items-center gap-3 md:gap-4">
                      <Brain className="h-6 w-6 md:h-8 md:w-8 text-white flex-shrink-0 animate-pulse" />
                      <div>
                        <h2 className="text-lg md:text-2xl font-bold">Análise do Oráculo</h2>
                        <p className="text-white/80 text-sm mt-0.5">Gerando em tempo real...</p>
                      </div>
                    </div>
                    <div className="bg-white border-2 border-gray-200 rounded-b-xl shadow-xl overflow-hidden">
                      <div className="p-4 md:p-8 max-h-[70vh] overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-sans text-gray-800 text-sm md:text-base leading-relaxed">
                          {streamingAnaliseContent || projeto?.analise_ia || '\u00A0'}
                          <span className="inline-block w-2 h-4 bg-oraculo-blue animate-pulse align-middle ml-0.5" />
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
                {/* Seção de Análise completa (após conclusão) */}
                {projeto.analise_ia && !analisando && (
                  <div className="mb-8">
                    <div className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white px-4 md:px-8 py-4 md:py-6 rounded-t-xl flex items-center gap-3 md:gap-4">
                      <Brain className="h-6 w-6 md:h-8 md:w-8 text-white flex-shrink-0" />
                      <h2 className="text-lg md:text-2xl font-bold">Análise do Oráculo</h2>
                    </div>
                    <div className="bg-white border-2 border-gray-200 rounded-b-xl shadow-xl overflow-hidden">
                      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
                        {/* Nota Estimada - Card Especial - SEMPRE VISÍVEL */}
                        {(() => {
                          // Extrair todas as notas no formato "Nota: X/Y" ou "Nota: X/Y."
                          const notaPattern = /Nota:\s*(\d+)\/(\d+)\.?/gi;
                          const notas: Array<{ obtida: number; maxima: number }> = [];
                          let match;
                          
                          while ((match = notaPattern.exec(projeto.analise_ia)) !== null) {
                            const obtida = parseInt(match[1]);
                            const maxima = parseInt(match[2]);
                            if (!isNaN(obtida) && !isNaN(maxima) && maxima > 0) {
                              notas.push({ obtida, maxima });
                            }
                          }
                          
                          // Calcular nota global
                          let notaGlobal = 0;
                          let notaMaximaTotal = 0;
                          
                          if (notas.length > 0) {
                            const somaObtidas = notas.reduce((acc, n) => acc + n.obtida, 0);
                            const somaMaximas = notas.reduce((acc, n) => acc + n.maxima, 0);
                            notaGlobal = Math.round((somaObtidas / somaMaximas) * 100);
                            notaMaximaTotal = somaMaximas;
                          }
                          
                          // Se não encontrou notas no formato X/Y, tenta buscar nota estimada direta
                          if (notas.length === 0) {
                            const notaSection = projeto.analise_ia.match(/5\.\s*\*\*Nota estimada.*?:\*\*\s*(\d+)/i);
                            if (notaSection && notaSection[1]) {
                              notaGlobal = parseInt(notaSection[1]);
                              notaMaximaTotal = 100;
                            } else {
                              const patterns = [
                                /Nota estimada.*?:\s*(\d+)/i,
                                /Nota estimada.*?\):\s*(\d+)/i,
                              ];
                              
                              for (const pattern of patterns) {
                                const match = projeto.analise_ia.match(pattern);
                                if (match && match[1]) {
                                  const nota = parseInt(match[1]);
                                  if (nota >= 0 && nota <= 100) {
                                    notaGlobal = nota;
                                    notaMaximaTotal = 100;
                                    break;
                                  }
                                }
                              }
                            }
                          }
                          
                          // Só exibe se encontrou alguma nota
                          if (notaGlobal === 0 && notaMaximaTotal === 0) return null;
                          
                          return (
                            <div className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple rounded-2xl p-8 text-white text-center mb-8">
                              <div className="flex items-center justify-center mb-4">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                                  <span className="text-3xl font-bold">📊</span>
                                </div>
                              </div>
                              <h3 className="text-2xl font-bold mb-2">Nota Estimada</h3>
                              <div className="text-6xl font-black mb-4">
                                {notaGlobal}
                              </div>
                              <div className="text-lg opacity-90">
                                de {notaMaximaTotal} pontos
                                {notas.length > 0 && (
                                  <span className="block text-sm mt-1 opacity-75">
                                    ({notas.reduce((acc, n) => acc + n.obtida, 0)}/{notaMaximaTotal} pontos obtidos)
                                  </span>
                                )}
                              </div>
                              <div className="mt-4 w-full bg-white/20 rounded-full h-3">
                                <div 
                                  className="bg-white rounded-full h-3 transition-all duration-1000 ease-out"
                                  style={{ 
                                    width: `${notaGlobal}%` 
                                  }}
                                ></div>
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Extrair notas dos critérios para exibir sem blur */}
                        {(() => {
                          // Extrair notas dos critérios
                          const criterios = [
                            { nome: 'Adequação aos critérios do edital', peso: 40, pattern: /Adequação aos critérios do edital.*?(\d+)%.*?:\s*(\d+)/i },
                            { nome: 'Viabilidade e capacidade de execução', peso: 30, pattern: /Viabilidade e capacidade de execução.*?(\d+)%.*?:\s*(\d+)/i },
                            { nome: 'Qualidade técnica e inovação', peso: 20, pattern: /Qualidade técnica e inovação.*?(\d+)%.*?:\s*(\d+)/i },
                            { nome: 'Impacto cultural e relevância', peso: 10, pattern: /Impacto cultural e relevância.*?(\d+)%.*?:\s*(\d+)/i }
                          ];
                          
                          const criteriosComNotas = criterios.map(criterio => {
                            const match = projeto.analise_ia.match(criterio.pattern);
                            if (match && match[2]) {
                              return {
                                ...criterio,
                                nota: parseInt(match[2]),
                                notaMaxima: criterio.peso
                              };
                            }
                            return null;
                          }).filter(Boolean);
                          
                          if (criteriosComNotas.length === 0) return null;
                          
                          return (
                            <div className="mb-8">
                              {/* Grid de Critérios - SEM BLUR para mostrar as notas */}
                              {criteriosComNotas.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {criteriosComNotas.map((criterio: any, idx) => {
                                const percentual = (criterio.nota / criterio.notaMaxima) * 100;
                                const cor = percentual >= 75 ? 'bg-green-500' : percentual >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                                
                                return (
                                  <div key={idx} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative min-w-0">
                                    <div className="flex items-start justify-between gap-3 mb-3 min-w-0">
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-gray-800 text-sm leading-tight break-words">{criterio.nome}</h4>
                                        <p className="text-xs text-gray-500 mt-1">Peso: {criterio.peso}%</p>
                                      </div>
                                      <div className="flex-shrink-0 text-right w-12 md:w-auto">
                                        <div className="text-xl md:text-2xl font-bold text-oraculo-blue">{criterio.nota}</div>
                                        <div className="text-xs text-gray-500">de {criterio.notaMaxima}</div>
                                      </div>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden min-w-0">
                                      <div 
                                        className={`${cor} h-2 rounded-full transition-all duration-500`}
                                        style={{ width: `${percentual}%` }}
                                      ></div>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-600 text-right pr-0">
                                      {percentual.toFixed(0)}% do peso máximo
                                    </div>
                                  </div>
                                );
                              })}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Renderizar conteúdo da análise */}
                          {(() => {
                            // Primeiro remover sugestões do texto completo
                            const textoSemSugestoes = removerSugestoesDoTexto(projeto.analise_ia);
                            
                            // Processar o texto da análise removendo markdown e seções já exibidas
                            const textoProcessado = formatarTextoParaExibicao(textoSemSugestoes);
                            console.log('[Projeto] Texto processado para exibição (sem sugestões):', textoProcessado.substring(0, 200));
                            
                            // Remover partes já exibidas (nota)
                            let textoLimpo = textoProcessado;
                            const linhas = textoLimpo.split('\n');
                            const linhasFiltradas = linhas.filter(linha => {
                              const linhaLower = linha.toLowerCase();
                              return !linhaLower.includes('nota estimada');
                            });
                            textoLimpo = linhasFiltradas.join('\n');
                            
                            // Dividir texto em seções (parágrafos separados por \n\n)
                            // Primeiro, vamos preservar seções numeradas que podem ter múltiplos parágrafos
                            let secoesBrutas = textoLimpo.split('\n\n').filter(sec => sec.trim().length > 0);
                            
                            // Agrupar seções que pertencem a um mesmo item numerado
                            const secoesAgrupadas: string[] = [];
                            let secaoAtual = '';
                            
                            for (let i = 0; i < secoesBrutas.length; i++) {
                              const sec = secoesBrutas[i].trim();
                              const secLower = sec.toLowerCase();
                              
                              // Verificar se deve exibir esta seção
                              const deveExibir = !secLower.includes('nota estimada') && 
                                     !secLower.includes('sugestões de melhoria') &&
                                     !secLower.includes('sugestoes de melhoria') &&
                                     !secLower.match(/^sugest[ãa]o\s+\d+[:.]/i) &&
                                     !secLower.match(/^\d+[\.\)]\s*sugest[ãa]o:/i);
                              
                              if (!deveExibir) continue;
                              
                              // Verificar se é início de nova seção numerada
                              const isInicioNumerado = /^\d+[.)]\s/.test(sec);
                              
                              if (isInicioNumerado && secaoAtual) {
                                // Se já temos uma seção acumulada, salvar ela e começar nova
                                secoesAgrupadas.push(secaoAtual.trim());
                                secaoAtual = sec;
                              } else if (isInicioNumerado) {
                                // Iniciar nova seção numerada
                                secaoAtual = sec;
                              } else if (secaoAtual && /^\d+[.)]\s/.test(secaoAtual)) {
                                // Se estamos dentro de uma seção numerada, continuar acumulando
                                secaoAtual += '\n\n' + sec;
                              } else {
                                // Seção normal (não numerada), adicionar diretamente
                                if (secaoAtual) {
                                  secoesAgrupadas.push(secaoAtual.trim());
                                  secaoAtual = '';
                                }
                                secoesAgrupadas.push(sec);
                              }
                            }
                            
                            // Adicionar última seção se houver
                            if (secaoAtual) {
                              secoesAgrupadas.push(secaoAtual.trim());
                            }
                            
                            const secoes = secoesAgrupadas;
                            
                            // Primeiras seções e resto (toda a análise visível)
                            const primeirasSecoes = secoes.slice(0, 2);
                            const restoSecoes = secoes.slice(2);
                            
                            // Função para renderizar uma seção
                            const renderizarSecao = (section: string, index: number) => {
                              const secaoLimpa = limparMarkdown(section);
                              
                              // Verificar se começa com título específico seguido de conteúdo na mesma seção
                              // Padrão: "1. ADEQUAÇÃO..." ou "2. PONTOS FORTES..." seguido de \n ou \n\n e conteúdo
                              // Primeiro tenta com \n\n, depois com \n
                              let tituloComConteudo = secaoLimpa.trim().match(/^((\d+[.)]\s*)?(ADEQUAÇÃO AOS CRITÉRIOS DO EDITAL|PONTOS FORTES DO PROJETO|PONTOS FRACOS E GAPS):?\s*)\n\n(.+)/is);
                              let conteudoRestante = '';
                              if (tituloComConteudo) {
                                conteudoRestante = tituloComConteudo[4] || '';
                              } else {
                                tituloComConteudo = secaoLimpa.trim().match(/^((\d+[.)]\s*)?(ADEQUAÇÃO AOS CRITÉRIOS DO EDITAL|PONTOS FORTES DO PROJETO|PONTOS FRACOS E GAPS):?\s*)\n([^\n].+)/is);
                                if (tituloComConteudo) {
                                  conteudoRestante = tituloComConteudo[4] || '';
                                }
                              }
                              
                              if (tituloComConteudo) {
                                const [, , , tituloBase] = tituloComConteudo;
                                const tituloLimpo = tituloBase.replace(/[:.]$/, '').trim();
                                
                                return (
                                  <React.Fragment key={index}>
                                    <div className="border-b-2 border-gray-300 pb-4 mb-6 mt-8 first:mt-0">
                                      <h2 className="text-2xl font-bold text-gray-900 uppercase">
                                        {tituloLimpo}
                                      </h2>
                                    </div>
                                    {/* Renderizar o conteúdo restante */}
                                    {conteudoRestante.split('\n\n').filter(s => s.trim()).map((subSec, subIdx) => 
                                      renderizarSecao(subSec, index * 1000 + subIdx)
                                    )}
                                  </React.Fragment>
                                );
                              }
                              
                              // Títulos específicos que devem ser em negrito (quando são apenas o título, sem conteúdo)
                              const tituloLimpo = secaoLimpa.trim().replace(/[:.]$/, '').trim();
                              
                              // Verificar se é um dos títulos específicos (verificação mais flexível)
                              if (
                                /^(\d+[.)]\s*)?ADEQUAÇÃO AOS CRITÉRIOS DO EDITAL\s*$/i.test(tituloLimpo) ||
                                /^(\d+[.)]\s*)?PONTOS FORTES DO PROJETO\s*$/i.test(tituloLimpo) ||
                                /^(\d+[.)]\s*)?PONTOS FRACOS E GAPS\s*$/i.test(tituloLimpo) ||
                                /^Sugestões de Melhoria\s*$/i.test(tituloLimpo)
                              ) {
                                const titulo = tituloLimpo.replace(/^\d+[.)]\s*/, '').trim();
                                return (
                                  <div key={index} className="border-b-2 border-gray-300 pb-4 mb-6 mt-8 first:mt-0">
                                    <h2 className="text-2xl font-bold text-gray-900 uppercase">
                                      {titulo}
                                    </h2>
                                  </div>
                                );
                              }
                              
                              // Verificar se é um cabeçalho de seção menor (uma linha em maiúsculas) - SEM negrito
                              const isSectionHeader = secaoLimpa.trim().endsWith(':') && 
                                                     /^[A-Z][A-Z\s]+:?\s*$/.test(secaoLimpa.trim());
                              
                              if (isSectionHeader) {
                                return (
                                  <div key={index} className="border-b border-gray-200 pb-3 mb-4 mt-6 first:mt-0">
                                    <h3 className="text-xl text-gray-900">
                                      {secaoLimpa.replace(/[:.]$/, '').trim()}
                                    </h3>
                                  </div>
                                );
                              }
                              
                              // Verificar se é um critério numerado (ex: "1. Relevância artístico-cultural da proposta (0 a 30 pontos):")
                              const criterioMatch = secaoLimpa.trim().match(/^(\d+)[.)]\s*(.+?)\s*\([^)]+\):?\s*(.*)$/);
                              if (criterioMatch) {
                                const [, numero, tituloCriterio, conteudo] = criterioMatch;
                                const linhasConteudo = conteudo.trim().split('\n').filter(l => l.trim());
                                
                                return (
                                  <div key={index} className="mb-6">
                                    <h4 className="text-lg font-bold text-gray-900 mb-3">
                                      {numero}. {tituloCriterio.trim()}
                                    </h4>
                                    {linhasConteudo.length > 0 && (
                                      <div className="text-gray-700 leading-relaxed text-base ml-4">
                                        {linhasConteudo.map((line, lineIndex) => {
                                          const linhaLimpa = line.trim();
                                          if (!linhaLimpa) return null;
                                          // Verificar se a linha termina com "Nota: X/Y"
                                          const notaMatch = linhaLimpa.match(/^(.+?)\s*(Nota:\s*\d+\/\d+\.?)$/i);
                                          if (notaMatch) {
                                            return (
                                              <p key={lineIndex} className={lineIndex > 0 ? 'mt-3' : ''}>
                                                {notaMatch[1].trim()}{' '}
                                                <span className="font-bold text-oraculo-blue">{notaMatch[2]}</span>
                                              </p>
                                            );
                                          }
                                          return (
                                            <p key={lineIndex} className={lineIndex > 0 ? 'mt-3' : ''}>
                                              {linhaLimpa}
                                            </p>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              // Verificar se é um item numerado genérico
                              const isNumberedItem = /^\d+[.)]\s/.test(secaoLimpa.trim());
                              if (isNumberedItem) {
                                const numero = secaoLimpa.match(/^\d+/)?.[0];
                                const conteudo = secaoLimpa.replace(/^\d+[.)]\s*/, '').trim();
                                const partes = conteudo.split(':');
                                const titulo = partes[0].trim();
                                const restoConteudo = partes.slice(1).join(':').trim();
                                const tituloUpper = titulo.toUpperCase();
                                const ehTituloPrincipal =
                                  tituloUpper === 'ADEQUAÇÃO AOS CRITÉRIOS DO EDITAL' ||
                                  tituloUpper === 'PONTOS FORTES DO PROJETO' ||
                                  tituloUpper === 'PONTOS FRACOS E GAPS' ||
                                  tituloUpper === 'SUGESTÕES DE MELHORIA';
                                if (ehTituloPrincipal) {
                                  return (
                                    <React.Fragment key={index}>
                                      <div className="border-b-2 border-gray-300 pb-4 mb-6 mt-8 first:mt-0">
                                        <h2 className="text-2xl font-bold text-gray-900 uppercase">
                                          {numero}. {titulo}
                                        </h2>
                                      </div>
                                      {restoConteudo && (
                                        <div className="text-gray-700 leading-relaxed text-base mb-4 mt-2">
                                          {restoConteudo.split('\n').map((line, lineIndex) => {
                                            const linhaLimpa = line.trim();
                                            if (!linhaLimpa) return null;
                                            return (
                                              <p key={lineIndex} className={lineIndex > 0 ? 'mt-2' : ''}>
                                                {linhaLimpa}
                                              </p>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </React.Fragment>
                                  );
                                }
                                return (
                                  <div key={index} className="mb-5">
                                    <h4 className="text-lg font-bold text-gray-900 mb-2">
                                      {numero}. {titulo}
                                    </h4>
                                    {restoConteudo && (
                                      <div className="text-gray-700 leading-relaxed text-base ml-4">
                                        {restoConteudo.split('\n').map((line, lineIndex) => {
                                          const linhaLimpa = line.trim();
                                          if (!linhaLimpa) return null;
                                          return (
                                            <p key={lineIndex} className={lineIndex > 0 ? 'mt-2' : ''}>
                                              {linhaLimpa}
                                            </p>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              // Verificar se é uma lista com bullets
                              const linhas = secaoLimpa.split('\n');
                              const temBullets = linhas.some(l => /^[-•]\s/.test(l.trim()));
                              if (temBullets) {
                                return (
                                  <div key={index} className="text-gray-700 leading-relaxed text-base mb-4">
                                    {linhas.map((line, lineIndex) => {
                                      const linhaLimpa = line.trim();
                                      if (!linhaLimpa) return null;
                                      const bulletMatch = linhaLimpa.match(/^[-•]\s*(.+?):\s*(.+)$/);
                                      if (bulletMatch) {
                                        return (
                                          <p key={lineIndex} className={lineIndex > 0 ? 'mt-3' : 'mt-2'}>
                                            <span className="font-bold text-gray-900">{bulletMatch[1]}:</span> {bulletMatch[2]}
                                          </p>
                                        );
                                      }
                                      return (
                                        <p key={lineIndex} className={lineIndex > 0 ? 'mt-2' : ''}>
                                          {linhaLimpa.replace(/^[-•]\s*/, '')}
                                        </p>
                                      );
                                    })}
                                  </div>
                                );
                              }
                              
                              // Conteúdo normal (parágrafo)
                              return (
                                <div key={index} className="text-gray-700 leading-relaxed text-base mb-4">
                                  {secaoLimpa.split('\n').map((line, lineIndex) => {
                                    const linhaLimpa = line.trim();
                                    if (!linhaLimpa) return null;
                                    return (
                                      <p key={lineIndex} className={lineIndex > 0 ? 'mt-3' : ''}>
                                        {linhaLimpa}
                                      </p>
                                    );
                                  })}
                                </div>
                              );
                            };
                            
                            // Verificar se há seção "PONTOS FRACOS E GAPS" e encontrar o primeiro critério após ela
                            let encontrouPontosFracos = false;
                            let primeiroCriterioIndex = -1;
                            
                            const todasSecoes = [...primeirasSecoes, ...restoSecoes];
                            for (let i = 0; i < todasSecoes.length; i++) {
                              const secaoLimpaTeste = limparMarkdown(todasSecoes[i]).trim();
                              if (/PONTOS FRACOS E GAPS/i.test(secaoLimpaTeste)) {
                                encontrouPontosFracos = true;
                              }
                              if (encontrouPontosFracos && /^\d+[.)]\s*(.+?)\s*\([^)]+\)/.test(secaoLimpaTeste)) {
                                primeiroCriterioIndex = i;
                                break;
                              }
                            }
                            
                            return (
                              <>
                                {/* Primeiras seções - VISÍVEIS (se houver) */}
                                {primeirasSecoes.map((section, index) => {
                                  // Se este é o primeiro critério após PONTOS FRACOS, adicionar título antes
                                  if (index === primeiroCriterioIndex && primeiroCriterioIndex < primeirasSecoes.length) {
                                    return (
                                      <React.Fragment key={`fragment-${index}`}>
                                        <div className="border-b-2 border-gray-300 pb-4 mb-6 mt-8">
                                          <h2 className="text-2xl font-bold text-gray-900">
                                            Avaliação final
                                          </h2>
                                        </div>
                                        {renderizarSecao(section, index)}
                                      </React.Fragment>
                                    );
                                  }
                                  return renderizarSecao(section, index);
                                })}
                                
                                {/* Resto do conteúdo da análise (sem blur) */}
                                <div className="relative">
                                  <div>
                                  {restoSecoes.map((section, index) => {
                                    const idxGlobal = primeirasSecoes.length + index;
                                    // Se este é o primeiro critério após PONTOS FRACOS, adicionar título antes
                                    if (idxGlobal === primeiroCriterioIndex && primeiroCriterioIndex >= primeirasSecoes.length) {
                                      return (
                                        <React.Fragment key={`fragment-${idxGlobal}`}>
                                          <div className="border-b-2 border-gray-300 pb-4 mb-6 mt-8">
                                            <h2 className="text-2xl font-bold text-gray-900">
                                              Avaliação final
                                            </h2>
                                          </div>
                                          {renderizarSecao(section, idxGlobal)}
                                        </React.Fragment>
                                      );
                                    }
                                    return renderizarSecao(section, idxGlobal);
                                  })}
                                  
                                  {/* Sugestões de Melhoria - Todas as sugestões */}
                        {sugestoes.length > 0 && (
                          <>
                            <div className="border-b-2 border-gray-300 pb-4 mb-6 mt-8">
                              <h2 className="text-2xl font-bold text-gray-900">
                                Sugestões de Melhoria
                              </h2>
                            </div>
                            {sugestoes.map((sugestao, idx) => (
                              <div key={`sugestao-${idx}`} className={`bg-gradient-to-r from-oraculo-blue/5 to-oraculo-purple/5 p-6 rounded-xl border-l-4 shadow-sm mb-4 ${aprovacoes[idx] ? 'border-green-500 bg-green-50/50' : 'border-oraculo-blue'}`}>
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                <div className="text-base text-gray-800 leading-relaxed">
                                  <span className={`text-lg font-medium ${aprovacoes[idx] ? 'text-green-700' : 'text-gray-800'}`}>
                                    💡 Sugestão {idx + 1}: {limparMarkdown(sugestao)}
                                  </span>
                                </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    className={aprovacoes[idx] 
                                      ? 'bg-green-500 hover:bg-green-600 text-white px-4 py-2 text-sm font-medium' 
                                      : 'bg-oraculo-blue hover:bg-oraculo-blue/90 text-white px-4 py-2 text-sm font-medium'}
                                    onClick={() => handleAprovar(idx)}
                                    disabled={gerandoSugestao !== null || aprovacoes[idx]}
                                  >
                                    {gerandoSugestao === idx ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Aplicando...
                                      </>
                                    ) : aprovacoes[idx] ? (
                                      <>
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Sugestão aplicada
                                      </>
                                    ) : (
                                      <>
                                        <Check className="h-4 w-4 mr-1" />
                                        Aplicar
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                      </div>
                      
                      {/* Campo para sugestão personalizada */}
                      {projeto.analise_ia && (
                        <div className="mt-16 pt-16 border-t-2 border-gray-200 px-4">
                          <h3 className="text-xl font-bold text-gray-900 mb-5">
                            Ou ajuste o texto com suas próprias sugestões
                          </h3>
                          <p className="text-sm text-gray-600 mb-6">
                            Digite abaixo e o texto será alterado de acordo com seu pedido:
                          </p>
                          <textarea
                            className="w-full border-2 border-gray-300 rounded-lg px-5 py-4 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition min-h-[120px] text-gray-800 leading-relaxed resize-y mb-6"
                            value={sugestaoPersonalizada}
                            onChange={(e) => setSugestaoPersonalizada(e.target.value)}
                            placeholder="Ex: Adicione mais detalhes sobre o cronograma de execução..."
                            disabled={aplicandoSugestaoPersonalizada}
                          />
                          <div className="flex justify-end mb-4">
                            <Button
                              onClick={handleAplicarSugestaoPersonalizada}
                              disabled={aplicandoSugestaoPersonalizada || !sugestaoPersonalizada.trim()}
                              className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white px-6 py-2"
                            >
                              {aplicandoSugestaoPersonalizada ? 'Aplicando...' : 'Aplicar Sugestão'}
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* Campo editável com o texto do projeto */}
                      {projeto.analise_ia && (
                        <div id="texto-do-projeto" className="mt-8 pt-8 border-t-2 border-gray-200 px-4">
                          <div className="flex items-center justify-between mb-6">
                            <div>
                              <h3 className="text-xl font-bold text-gray-900 mb-2">Texto do Projeto</h3>
                              <p className="text-sm text-gray-600">
                                Revise e edite o texto do seu projeto conforme necessário:
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                onClick={copiarTextoProjeto}
                                className="border-oraculo-blue text-oraculo-blue hover:bg-oraculo-blue/10"
                                title="Copiar texto do projeto"
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copiar
                              </Button>
                              <Button
                                variant="outline"
                                onClick={baixarTextoProjeto}
                                className="border-oraculo-purple text-oraculo-purple hover:bg-oraculo-purple/10"
                                title="Baixar texto do projeto"
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Baixar
                              </Button>
                            </div>
                          </div>
                          <textarea
                            className="w-full border-2 border-gray-300 rounded-lg px-5 py-4 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition min-h-[600px] text-gray-800 leading-relaxed resize-y"
                            value={descricaoEditada || projeto.descricao || ''}
                            onChange={(e) => setDescricaoEditada(e.target.value)}
                            placeholder="Cole aqui todas as informações do seu projeto cultural..."
                          />
                          
                          {/* Banner de aprovação quando há mudança aguardando */}
                          {aguardandoAprovacao && (
                            <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">⚠️</span>
                                  <h4 className="text-lg font-semibold text-yellow-900">
                                    Mudança aplicada - Aprove ou reverta
                                  </h4>
                                </div>
                              </div>
                              <p className="text-sm text-yellow-800 mb-4">
                                O texto foi modificado com a sugestão aplicada. Revise as alterações acima e decida:
                              </p>
                              <div className="flex gap-3">
                                <Button
                                  onClick={aprovarMudanca}
                                  disabled={salvando}
                                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
                                >
                                  {salvando ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Salvando...
                                    </>
                                  ) : (
                                    <>
                                      <Check className="mr-2 h-4 w-4" />
                                      Aprovar e Salvar
                                    </>
                                  )}
                                </Button>
                                <Button
                                  onClick={reverterMudanca}
                                  disabled={salvando}
                                  variant="outline"
                                  className="border-red-500 text-red-600 hover:bg-red-50 px-6 py-2"
                                >
                                  <X className="mr-2 h-4 w-4" />
                                  Reverter para Versão Anterior
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {/* Barra de ações: Salvar / Avaliar de novo — separada do próximo passo */}
                            <div className="mt-8 pt-6 pb-8 mb-6 border-t border-gray-200 flex flex-wrap gap-3 justify-start">
                              <Button
                                onClick={async () => {
                                  setSalvando(true);
                                  try {
                                    if (!id) return;
                                    const db = getFirestore();
                                    const ref = doc(db, 'projetos', id);
                                    await updateDoc(ref, { 
                                      descricao: descricaoEditada || projeto.descricao,
                                      data_atualizacao: serverTimestamp()
                                    });
                                    
                                    setProjeto((prev: any) => ({
                                      ...prev,
                                      descricao: descricaoEditada || projeto.descricao
                                    }));
                                    
                                    setMostrarSucesso(true);
                                    setTimeout(() => {
                                      setMostrarSucesso(false);
                                    }, 3000);
                                  } catch (error) {
                                    console.error('Erro ao salvar texto do projeto:', error);
                                    alert('Erro ao salvar as alterações. Tente novamente.');
                                  } finally {
                                    setSalvando(false);
                                  }
                                }}
                                disabled={salvando}
                                variant="outline"
                                className="border-oraculo-blue text-oraculo-blue hover:bg-oraculo-blue/10 px-5 py-2.5"
                              >
                                {salvando ? 'Salvando...' : 'Salvar Texto'}
                              </Button>
                              <Button
                                onClick={() => {
                                  if (!checkPremiumAccess()) return;
                                  analisarComIA();
                                }}
                                disabled={analisando}
                                variant="outline"
                                className="border-oraculo-purple text-oraculo-purple hover:bg-oraculo-purple/10 px-5 py-2.5"
                              >
                                {analisando ? 'Avaliando...' : 'Avaliar de novo com IA'}
                                <span className="ml-1.5 opacity-80 text-xs">(5 créditos)</span>
                              </Button>
                            </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Section de Como Funciona (só aparece quando não há análise) */}
                {!projeto.analise_ia && !analisando && (
                  <div className="mb-8 p-12 bg-gradient-to-br from-oraculo-blue/5 to-oraculo-purple/5 border-2 border-oraculo-blue rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold mb-6 text-oraculo-blue flex items-center gap-3">
                      <span role="img" aria-label="Dica">🤖</span> Como funciona a análise do Oráculo
                    </h2>
                    <p className="text-gray-700 text-base mb-8 leading-relaxed">
                      Agora chegou a hora de avaliar seu projeto. O Oráculo analisa seu projeto como um avaliador, levando em conta não só os critérios do edital, mas também os últimos selecionados e uma base grande de projetos culturais bem-sucedidos.
                    </p>
                    <Button 
                      size="lg" 
                      className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-xl px-12 py-6 flex items-center gap-3 w-full justify-center font-bold" 
                      onClick={analisarComIA} 
                      disabled={analisando}
                    >
                      <Brain className="h-8 w-8" />
                      {analisando ? 'Analisando...' : 'Analisar com IA'}
                      <span className="ml-1.5 text-white/80 font-normal text-sm">(5 créditos)</span>
                    </Button>
                    {analisando && (
                      <div className="mt-4 bg-white border border-gray-200 rounded-lg px-4 py-3 text-gray-700 text-sm font-medium text-center animate-pulse">
                        {statusIA || 'Iniciando análise...'}
                        {subEtapasIA.length > 0 && (
                          <ul className="mt-2 text-left text-xs text-gray-600 list-disc list-inside">
                            {subEtapasIA.map((etapa, idx) => (
                              <li key={idx}>{etapa}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Próximo passo: Gerar Textos — seção distinta, sem conflito com Salvar/Avaliar */}
                {projeto?.analise_ia && (
                  <div className="flex flex-col items-end gap-2 pt-8 pb-6 px-4 md:px-8 mt-10 border-t-2 border-oraculo-blue/20 bg-gradient-to-r from-transparent to-oraculo-purple/5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Próximo passo</span>
                    <Button
                      size="lg"
                      onClick={() => navigateToStep(3)}
                      className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white px-8 md:px-10 py-4 text-base md:text-lg font-semibold"
                    >
                      Próximo: Gerar Textos <span className="ml-2 text-xl" aria-hidden>→</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
      
      {/* Success Popup */}
      <SuccessPopup />
      <AprovacaoSuccessPopup />

      {/* Modal de Confirmação para Apagar Projeto */}
      <Dialog open={mostrarModalApagar} onOpenChange={setMostrarModalApagar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 text-xl font-bold">⚠️ Confirmar Exclusão</DialogTitle>
            <DialogDescription className="text-gray-600">
              Esta ação não pode ser desfeita. Todos os dados do projeto serão permanentemente removidos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-semibold text-sm mb-2">
                ⚠️ ATENÇÃO: Esta ação é irreversível!
              </p>
              <p className="text-red-700 text-sm">
                Ao confirmar, o projeto será permanentemente excluído e não poderá ser recuperado.
              </p>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="confirmacao-projeto" className="text-sm font-medium text-gray-700">
                Digite <span className="font-bold text-red-600">"apagar"</span> para confirmar:
              </label>
              <Input
                id="confirmacao-projeto"
                type="text"
                value={confirmacaoTexto}
                onChange={(e) => setConfirmacaoTexto(e.target.value)}
                placeholder="Digite 'apagar' aqui"
                className="w-full"
                autoFocus
              />
            </div>
          </div>
          
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setMostrarModalApagar(false);
                setConfirmacaoTexto('');
              }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteProjeto}
              disabled={confirmacaoTexto.toLowerCase().trim() !== 'apagar'}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apagar Projeto
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Projeto; 