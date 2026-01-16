import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Brain, Loader2, Check, X, CheckCircle, Trash2 } from 'lucide-react';
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
  
  // Remove duplicatas e retorna
  return matches.filter((s, i, arr) => {
    // Remove duplicatas exatas
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
  const [isPremium, setIsPremium] = useState(false);
  const [mostrarAlterarIA, setMostrarAlterarIA] = useState(false);
  const [mostrarAnalise, setMostrarAnalise] = useState(false);
  const [mostrarSucesso, setMostrarSucesso] = useState(false);
  const [mostrarModalApagar, setMostrarModalApagar] = useState(false);
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('');
  const [primeiraAnaliseCompleta, setPrimeiraAnaliseCompleta] = useState(false);
  const [analiseIniciada, setAnaliseIniciada] = useState(false); // Para evitar iniciar análise múltiplas vezes
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

  // Check premium access
  const checkPremiumAccess = () => {
    if (!isPremium) {
      navigate('/cadastro-premium');
      return false;
    }
    return true;
  };

  useEffect(() => {
    document.title = 'Oráculo Cultural';
  }, []);

  useEffect(() => {
    const fetchProjeto = async () => {
      if (!id) return;
      setLoading(true);
      setAnaliseIniciada(false); // Reset quando carregar novo projeto
      const db = getFirestore();
      const ref = doc(db, 'projetos', id);
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
  }, [id, user]);

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
      
      // Update the project with the new description (texto original + sugestão adicionada)
      if (id && novoTexto.trim()) {
        const db = getFirestore();
        const ref = doc(db, 'projetos', id);
        await updateDoc(ref, { descricao: novoTexto });
        setProjeto((prev: any) => ({ ...prev, descricao: novoTexto }));
        
        // Track suggestion applied
        if (user) {
          const userRef = doc(db, 'usuarios', user.uid);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() : {};
          const planType = userData?.planType || 'free';
          
          trackSuggestionApplied({
            projectId: id,
            suggestionIndex: idx,
            suggestionText: sugestoes[idx],
            planType: planType,
          });
        }
      }
      
      // Scroll para a seção "Texto do Projeto"
      setTimeout(() => {
        const elemento = document.getElementById('texto-do-projeto');
        if (elemento) {
          elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
      
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
      
      // Update the project with the new description
      if (id && novoTexto.trim()) {
        const db = getFirestore();
        const ref = doc(db, 'projetos', id);
        await updateDoc(ref, { descricao: novoTexto });
        setProjeto((prev: any) => ({ ...prev, descricao: novoTexto }));
        
        // Limpar o campo de sugestão personalizada após aplicar
        setSugestaoPersonalizada('');
        
        // Scroll para a seção "Texto do Projeto"
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
    
    // Agora começa o processamento real
    try {
      await updateStatusWithDelay('Iniciando análise do projeto...', ['Preparando ambiente de análise...']);
      await updateStatusWithDelay('Coletando dados do projeto e edital...', 
        ['Lendo o texto do projeto...', 'Lendo o edital...', 'Lendo critérios do edital...'], 1500);
      let dadosConsolidados = {
        texto_edital: '',
        criterios: '',
        texto_selecionados: '',
        nome_edital: projeto.edital_associado || '',
        resumo_projeto: projeto.resumo || projeto.descricao?.slice(0, 2000) || '',
      };
      if (projeto.edital_associado) {
        const res = await fetchEditalESelecionados(projeto.edital_associado);
        console.log('[Oraculo] Dados do edital associado:', res);
        dadosConsolidados.texto_edital = res.texto_edital;
        dadosConsolidados.criterios = res.criterios;
        dadosConsolidados.texto_selecionados = res.texto_selecionados;
      }
      // Validação dos critérios - apenas usar o campo criterios do documento
      // Não fazer fallback para texto_edital pois os critérios devem estar no campo criterios
      await updateStatusWithDelay('Processando informações...', 
        ['Cruzando projeto com critérios do edital...'], 1200);
      await updateStatusWithDelay('', 
        ['Comparando com projetos selecionados anteriores...'], 1200);
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
      
      const endpoint = 'https://us-central1-culturalapp-fb9b0.cloudfunctions.net/avaliarProjetoIA';
      const startTime = Date.now();
      
      const payload = {
        textoProjeto: dadosConsolidados.resumo_projeto,
        nomeProjeto: projeto.nome,
        nomeEdital: dadosConsolidados.nome_edital,
        criteriosEdital: dadosConsolidados.criterios, // Usar apenas o campo criterios do documento
        textoEdital: dadosConsolidados.texto_edital,
        portfolio: portfolioTexto,
        projetosSelecionados: dadosConsolidados.texto_selecionados ? dadosConsolidados.texto_selecionados.slice(0, 2000) : '',
        userId: user?.uid // Adicionar userId para buscar equipeBio e portfolio do Firestore
      };
      
      console.log('[Oraculo] Chamando endpoint:', endpoint);
      console.log('[Oraculo] Payload enviado:', payload);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Oraculo] Erro HTTP:', response.status, errorText);
        throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
      }
      
      const text = await response.text();
      console.log('[Oraculo] Texto da resposta:', text);
      
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        console.error('[Oraculo] Erro ao fazer parse do JSON:', e);
        throw new Error('Resposta inválida do servidor');
      }
      
      await updateStatusWithDelay('', ['Recebendo análise da IA...'], 1000);
      await updateStatusWithDelay('', ['Processando resultado...'], 1200);
      const analiseIA = data.analise;
      
      if (id) {
        const db = getFirestore();
        const ref = doc(db, 'projetos', id);
        
        // Verificar se já existe uma análise anterior para determinar se é a primeira
        const projetoSnap = await getDoc(ref);
        const projetoData = projetoSnap.exists() ? projetoSnap.data() : null;
        const jaTinhaAnalise = projetoData?.analise_ia;
        
        // Se não tinha análise anterior, é a primeira análise - não marcar primeira_analise_completa ainda
        // Se já tinha análise, é uma análise subsequente - marcar primeira_analise_completa = true
        const updateData: any = { analise_ia: analiseIA };
        if (jaTinhaAnalise) {
          // Análise subsequente - marcar que primeira análise foi completada
          updateData.primeira_analise_completa = true;
          setPrimeiraAnaliseCompleta(true);
        } else {
          // Primeira análise - não marcar ainda (será marcado apenas quando fizer segunda análise)
          setPrimeiraAnaliseCompleta(false);
        }
        
        await updateDoc(ref, updateData);
        
        // Atualiza o estado local do projeto para exibir imediatamente
        setProjeto((prev: any) => ({ ...prev, analise_ia: analiseIA, primeira_analise_completa: updateData.primeira_analise_completa || prev.primeira_analise_completa }));
        
        // Extrai sugestões e atualiza o estado
        const matches = extrairSugestoes(analiseIA);
        console.log('[Projeto] Sugestões extraídas após análise:', matches);
        console.log('[Projeto] Total de sugestões:', matches.length);
        setSugestoes(matches);
        setAprovacoes(Array(matches.length).fill(false));
        
        // Define a análise para exibição
        setAnalise(analiseIA);
        
        if (etapaAtual < 2) await avancarEtapa(2);
        
        await updateStatusWithDelay('Finalizando...', [], 800);
        await updateStatusWithDelay('Análise concluída!', ['Análise concluída!'], 500);
        
        // Fecha o modal de análise para mostrar os resultados
        setMostrarAnalise(false);
      }
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
      `/projeto/${id}/gerar-textos`
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

  // Show loading popup when analyzing
  if (mostrarAnalise && analisando) {
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        
        <main className="flex-1 p-2 md:p-4">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                  {projeto?.nome || 'Carregando projeto...'}
                </h1>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={abrirModalApagar}
                  className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Apagar Projeto
                </Button>
              </div>
              <p className="text-gray-600 text-sm md:text-base">
                {projeto?.descricao ? 'Gerenciamento do projeto' : 'Carregando detalhes...'}
              </p>
            </div>

            {/* Progress Bar with Clickable Steps */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                {steps.map((step, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <button 
                      onClick={() => navigateToStep(index)}
                      className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        index <= etapaAtual 
                          ? 'bg-oraculo-blue text-white hover:bg-oraculo-blue/90 cursor-pointer' 
                          : 'bg-gray-200 text-gray-600 cursor-not-allowed'
                      }`}
                      disabled={index > etapaAtual}
                      aria-label={`Ir para ${step}`}
                    >
                      {index + 1}
                    </button>
                    <button 
                      onClick={() => navigateToStep(index)}
                      disabled={index > etapaAtual}
                      className={`text-xs mt-1 text-center ${
                        index === etapaAtual 
                          ? 'font-medium text-oraculo-blue' 
                          : index < etapaAtual 
                            ? 'text-oraculo-blue hover:underline cursor-pointer' 
                            : 'text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {step}
                    </button>
                  </div>
                ))}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-oraculo-blue h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${(etapaAtual + 1) * 25}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8 border-t-4 border-oraculo-blue">
              {/* Breadcrumbs/Stepper */}
              <nav className="mb-8 border-b-4 border-gray-200 pb-6 px-6 pt-6">
                <ol className="flex flex-wrap items-center gap-2 text-sm">
                  {steps.map((step, idx) => (
                    <li key={step} className="flex items-center gap-2">
                      {idx < etapaAtual ? (
                        <button 
                          onClick={() => navigateToStep(idx)}
                          className="px-3 py-1 rounded-full font-medium bg-green-100 text-green-700 flex items-center gap-1 hover:bg-green-200"
                        >
                          <span className="font-bold">✓</span> {step}
                        </button>
                      ) : idx === etapaAtual ? (
                        <span className="px-3 py-1 rounded-full font-medium bg-oraculo-blue text-white">
                          {step}
                        </span>
                      ) : (
                        <button 
                          disabled
                          className="px-3 py-1 rounded-full font-medium bg-gray-200 text-gray-700 cursor-not-allowed"
                        >
                          {step}
                        </button>
                      )}
                      {idx < steps.length - 1 && <span className="text-gray-400">→</span>}
                    </li>
                  ))}
                </ol>
              </nav>
              <div className="px-6 pb-4 border-l-4 border-oraculo-blue pl-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-4 text-left">{projeto.nome}</h1>
              </div>
              <div className="mb-4">
                <span className="inline-block bg-oraculo-blue/10 text-oraculo-blue px-3 py-1 rounded-full text-xs font-semibold mr-2">
                  {projeto.categoria}
                </span>
                {projeto.edital_associado && (
                  <span className="inline-block bg-oraculo-purple/10 text-oraculo-purple px-3 py-1 rounded-full text-xs font-semibold">
                    Edital: {projeto.edital_associado}
                  </span>
                )}
              </div>
              <div className="mb-8">
                {/* Seção de Análise */}
                {projeto.analise_ia && !analisando && (
                  <div className="mb-8">
                    <div className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white px-8 py-6 rounded-t-xl flex items-center gap-4">
                      <Brain className="h-8 w-8 text-white" />
                      <h2 className="text-2xl font-bold">Análise do Oráculo</h2>
                    </div>
                    <div className="bg-white border-2 border-gray-200 rounded-b-xl shadow-xl overflow-hidden">
                      <div className="p-8 space-y-8">
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
                        
                        {/* Botão Gerar Textos */}
                        <div className="flex justify-center mb-8">
                          <Button 
                            variant="default" 
                            size="lg" 
                            onClick={() => navigateToStep(3)}
                            className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white px-8 py-3 text-lg font-semibold"
                          >
                            Gerar textos <span className="ml-1">→</span>
                          </Button>
                        </div>
                        
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
                                  <div key={idx} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative">
                                    {/* Aplicar blur nos critérios apenas se não for premium E não for a primeira análise */}
                                    {!isPremium && primeiraAnaliseCompleta && (
                                      <div className="absolute inset-0 bg-white/30 backdrop-blur-sm rounded-xl z-10 pointer-events-none"></div>
                                    )}
                                    <div className={`flex items-start justify-between mb-3 ${!isPremium && primeiraAnaliseCompleta ? 'relative z-20' : ''}`}>
                                      <div className={`flex-1 ${!isPremium && primeiraAnaliseCompleta ? 'opacity-40' : ''}`}>
                                        <h4 className="font-semibold text-gray-800 text-sm leading-tight">{criterio.nome}</h4>
                                        <p className="text-xs text-gray-500 mt-1">Peso: {criterio.peso}%</p>
                                      </div>
                                      <div className="ml-3 text-right relative z-30">
                                        <div className="text-2xl font-bold text-oraculo-blue">{criterio.nota}</div>
                                        <div className="text-xs text-gray-500">de {criterio.notaMaxima}</div>
                                      </div>
                                    </div>
                                    <div className={`w-full bg-gray-200 rounded-full h-2 overflow-hidden ${!isPremium && primeiraAnaliseCompleta ? 'opacity-40 relative z-20' : ''}`}>
                                      <div 
                                        className={`${cor} h-2 rounded-full transition-all duration-500`}
                                        style={{ width: `${percentual}%` }}
                                      ></div>
                                    </div>
                                    <div className={`mt-2 text-xs text-gray-600 text-right ${!isPremium && primeiraAnaliseCompleta ? 'opacity-40 relative z-20' : ''}`}>
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

                        {/* Container relativo para posicionar o box de upgrade sobre o blur */}
                        <div className="relative">
                          {/* Box de upgrade sobre o blur - FORA do div com blur */}
                          {/* Mostrar blur apenas se não for premium E não for a primeira análise */}
                          {!isPremium && primeiraAnaliseCompleta && (
                            <div className="absolute top-0 left-0 right-0 z-20 flex justify-center p-8 pointer-events-auto">
                              <div className="bg-white rounded-2xl shadow-2xl border-4 border-oraculo-blue max-w-2xl w-full p-8">
                                <div className="flex flex-col md:flex-row items-center gap-6">
                                  <div className="flex-shrink-0">
                                    <img 
                                      src={CriarImg} 
                                      alt="Produtora Cultural" 
                                      className="w-48 h-48 object-cover rounded-xl shadow-lg"
                                    />
                                  </div>
                                  <div className="flex-1 text-center md:text-left">
                                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                                      Assine agora mesmo o Oráculo Cultural
                                    </h3>
                                    <p className="text-gray-700 mb-6 leading-relaxed">
                                      Tenha acesso à avaliação completa do seu projeto, com notas por critérios, sugestões de alteração e geração automática de textos e anexos.
                                    </p>
                                    <Button 
                                      onClick={() => navigate('/cadastro-premium')}
                                      className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white px-8 py-3 text-lg font-semibold"
                                    >
                                      Ver Planos e Preços
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
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
                            
                            // Separar primeiras seções (visíveis) do resto (com blur)
                            const primeirasSecoes = secoes.slice(0, 2); // Primeiras 2 seções visíveis
                            const restoSecoes = secoes.slice(2); // Resto com blur
                            
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
                                      <h2 className="text-2xl font-bold text-gray-900">
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
                                    <h2 className="text-2xl font-bold text-gray-900">
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
                                
                                // Separar título e conteúdo se houver dois pontos
                                const partes = conteudo.split(':');
                                const titulo = partes[0].trim();
                                const restoConteudo = partes.slice(1).join(':').trim();
                                
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
                                
                                {/* Resto do conteúdo com blur se não for premium E não for a primeira análise */}
                                <div className={`${!isPremium && primeiraAnaliseCompleta ? 'blur-lg select-none pointer-events-none' : ''}`} style={!isPremium && primeiraAnaliseCompleta ? { filter: 'blur(12px)' } : {}}>
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
                              </>
                            );
                          })()}
                        </div>
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
                          <h3 className="text-xl font-bold text-gray-900 mb-6">Texto do Projeto</h3>
                          <p className="text-sm text-gray-600 mb-6">
                            Revise e edite o texto do seu projeto conforme necessário:
                          </p>
                          <textarea
                            className="w-full border-2 border-gray-300 rounded-lg px-5 py-4 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition min-h-[600px] text-gray-800 leading-relaxed resize-y"
                            value={descricaoEditada || projeto.descricao || ''}
                            onChange={(e) => setDescricaoEditada(e.target.value)}
                            placeholder="Cole aqui todas as informações do seu projeto cultural..."
                          />
                          <div className="mt-6 mb-16 flex gap-4 justify-start">
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
                              className="bg-oraculo-blue hover:bg-oraculo-blue/90 text-white px-6 py-2"
                            >
                              {salvando ? 'Salvando...' : 'Salvar Texto'}
                            </Button>
                            
                            <Button
                              onClick={analisarComIA}
                              disabled={analisando}
                              className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white px-6 py-2"
                            >
                              {analisando ? 'Avaliando...' : 'Avaliar de novo com IA'}
                            </Button>
                            
                            <Button
                              onClick={() => navigateToStep(3)}
                              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
                            >
                              Gerar Textos
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
              </div>
            </div>
          </div>
        </main>
      </div>
      
      {/* Success Popup */}
      <SuccessPopup />

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