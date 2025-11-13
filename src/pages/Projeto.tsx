import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Brain, Loader2, Check, X, CheckCircle } from 'lucide-react';
import AnalisarImg from '@/assets/Analisar.jpeg';
import OpenAI from 'openai';

const steps = [
  'Criar Projeto',
  'Avaliar com IA',
  'Alterar com IA',
  'Gerar Textos'
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
  
  // Remove seções que não são sugestões
  const textoLimpo = analiseTexto
    .replace(/###?\s*\d+\.\s*NOTA\s+ESTIMADA.*?(?=###?\s*\d+\.|$)/is, '')
    .replace(/###?\s*\d+\.\s*PONTOS\s+FORTES.*?(?=###?\s*\d+\.|$)/is, '')
    .replace(/###?\s*\d+\.\s*PONTOS\s+FRACOS.*?(?=###?\s*\d+\.|$)/is, '')
    .replace(/###?\s*\d+\.\s*ADEQUAÇÃO.*?(?=###?\s*\d+\.|$)/is, '');
  
  // Padrão 1: "Sugestão:" ou "- Sugestão:" no início da linha
  const padrao1 = /(?:^|\n)[-•]\s*Sugestão:\s*(.+?)(?=\n\n|\n[-•]\s*Sugestão:|$)/gis;
  let match;
  while ((match = padrao1.exec(textoLimpo)) !== null) {
    const sugestao = limparMarkdown(match[1].trim());
    if (sugestao.length > 15 && !sugestao.match(/\d+\/\d+/) && !sugestao.match(/^###/)) {
      matches.push(sugestao);
    }
  }
  
  // Padrão 2: Números seguidos de "Sugestão:"
  if (matches.length === 0) {
    const padrao2 = /\d+[\.\)]\s*Sugestão:\s*(.+?)(?=\n\n|\d+[\.\)]\s*Sugestão:|$)/gis;
    while ((match = padrao2.exec(textoLimpo)) !== null) {
      const sugestao = limparMarkdown(match[1].trim());
      if (sugestao.length > 15 && !sugestao.match(/\d+\/\d+/) && !sugestao.match(/^###/)) {
        matches.push(sugestao);
      }
    }
  }
  
  // Padrão 3: Seção "Sugestões de Melhoria" com lista
  if (matches.length === 0) {
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
  }
  
  // Padrão 4: Linhas que começam com "-" ou "•" após a palavra "Sugestão"
  if (matches.length === 0) {
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
  }
  
  return matches.filter((s, i, arr) => arr.indexOf(s) === i); // Remove duplicatas
};

// Função para formatar texto para exibição
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
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [descricaoEditada, setDescricaoEditada] = useState<string>('');
  const [aprovacoes, setAprovacoes] = useState<boolean[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [gerandoSugestao, setGerandoSugestao] = useState<number | null>(null); // Armazena o índice da sugestão sendo processada
  const [isPremium, setIsPremium] = useState(false);
  const [mostrarAlterarIA, setMostrarAlterarIA] = useState(false);
  const [mostrarAnalise, setMostrarAnalise] = useState(false);
  const [mostrarSucesso, setMostrarSucesso] = useState(false);
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
      const db = getFirestore();
      const ref = doc(db, 'projetos', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = { id: snap.id, ...(snap.data() as any) };
        setProjeto(data);
        setEtapaAtual(typeof data.etapa_atual === 'number' ? data.etapa_atual : 1);
        setDescricaoEditada(data.descricao || '');
        
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
      }
      setLoading(false);
    };
    fetchProjeto();
  }, [id]);

  // Handler for approving a suggestion
  const handleAprovar = async (idx: number) => {
    if (!checkPremiumAccess()) return;
    
    // Mark suggestion as approved
    const novasAprovacoes = [...aprovacoes];
    novasAprovacoes[idx] = true;
    setAprovacoes(novasAprovacoes);
    setGerandoSugestao(idx); // Usa o índice específico da sugestão
    
    try {
      const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY, dangerouslyAllowBrowser: true });
      
      // Use the original project description as base, not the edited one
      const textoBase = projeto?.descricao || '';
      const prompt = `Você é um especialista em projetos culturais. Reescreva o texto do projeto abaixo, incorporando APENAS a seguinte sugestão de alteração para aumentar as chances de aprovação em editais. Mantenha o texto claro, objetivo e profissional. Aplique apenas esta sugestão específica, não outras.\n\nTEXTO ORIGINAL DO PROJETO:\n${textoBase}\n\nSUGESTÃO ESPECÍFICA PARA APLICAR:\n${sugestoes[idx]}\n\nNOVO TEXTO DO PROJETO (aplicando apenas esta sugestão):`;
      
      let novoTexto = '';
      const stream = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Você é um especialista em projetos culturais. Aplique apenas a sugestão específica fornecida, sem modificar outras partes do texto.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1200,
        temperature: 0.3,
        stream: true,
      });
      
      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          novoTexto += content;
          setDescricaoEditada(novoTexto);
        }
      }
      
      // Update the project with the new description
      if (id) {
        const db = getFirestore();
        const ref = doc(db, 'projetos', id);
        await updateDoc(ref, { descricao: novoTexto });
      }
      
    } catch (e) {
      console.error('Erro ao processar sugestão:', e);
      // If there's an error, just append the suggestion to the end of the text
      setDescricaoEditada(prev => prev + '\n' + sugestoes[idx]);
    } finally {
      setGerandoSugestao(null); // Limpa o estado de loading
    }
  };

  // Save changes to Firestore
  const handleSalvar = async () => {
    if (!checkPremiumAccess() || !id) return;
    
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
      // Validação e fallback dos critérios
      if (!dadosConsolidados.criterios) {
        // Tenta extrair critérios do texto do edital (simplesmente pega um trecho, pode ser melhorado com IA no futuro)
        if (dadosConsolidados.texto_edital) {
          // Exemplo: tenta pegar linhas que contenham "critério" ou "avaliação"
          const possiveis = dadosConsolidados.texto_edital.split('\n').filter(l => /crit[eé]rio|avalia[cç][aã]o|pontua[cç][aã]o/i.test(l));
          if (possiveis.length > 0) {
            dadosConsolidados.criterios = possiveis.join(' ');
          }
        }
      }
      await updateStatusWithDelay('Processando informações...', 
        ['Cruzando projeto com critérios do edital...'], 1200);
      await updateStatusWithDelay('', 
        ['Comparando com projetos selecionados anteriores...'], 1200);
      await updateStatusWithDelay('Construindo prompt para análise...', 
        ['Preparando dados para IA...'], 1500);
      
      // Monta o prompt só agora, com todos os dados já consolidados
      const prompt = `Você é um avaliador de projetos culturais. Avalie o projeto abaixo considerando especialmente o edital selecionado: "${dadosConsolidados.nome_edital}". Utilize os critérios desse edital de forma recorrente em sua análise, citando-os explicitamente sempre que possível.\n\nPROJETO:\n${dadosConsolidados.resumo_projeto}\n\nEDITAL SELECIONADO: ${dadosConsolidados.nome_edital || 'Nenhum'}\nCRITÉRIOS DO EDITAL:\n${dadosConsolidados.criterios || dadosConsolidados.texto_edital || 'Nenhum critério de edital fornecido.'}\n\nPROJETOS SELECIONADOS ANTERIORES (para contexto comparativo):\n${dadosConsolidados.texto_selecionados ? dadosConsolidados.texto_selecionados.slice(0, 3000) : 'Nenhum texto de projetos selecionados fornecido.'}\n\nForneça uma análise detalhada com:\n1. Adequação aos critérios do edital (✅/❌) - cite o edital e os critérios\n2. Pontos fortes do projeto\n3. Pontos fracos do projeto\n4. Sugestões de melhoria: Liste as sugestões para aumentar a chance de aprovação, cada uma começando explicitamente com \"Sugestão: \" e relacionando com o edital quando possível\n5. Nota estimada (0-100)\n\nANÁLISE DETALHADA:`;
      
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
      
      const payload = {
        textoProjeto: dadosConsolidados.resumo_projeto,
        nomeProjeto: projeto.nome,
        nomeEdital: dadosConsolidados.nome_edital,
        criteriosEdital: dadosConsolidados.criterios || 'Não especificados',
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
      setAnalise(analiseIA);
      await updateStatusWithDelay('Finalizando...', [], 800);
      await updateStatusWithDelay('Análise concluída!', ['Análise concluída!'], 500);
      if (id) {
        const db = getFirestore();
        const ref = doc(db, 'projetos', id);
        await updateDoc(ref, { analise_ia: analiseIA });
        if (etapaAtual < 2) await avancarEtapa(2);
        setAnalise(null); // Limpa a análise antes de redirecionar
        navigate(`/projeto/${id}/alterar-com-ia`);
      }
    } catch (e: any) {
      setErroIA(e.message || 'Ocorreu um erro desconhecido ao processar a análise.');
      console.error(e);
    } finally {
      setAnalisando(false);
      setStatusIA('');
    }
  };

  // Function to handle step navigation
  const navigateToStep = (stepIndex: number) => {
    // Allow navigation to next step if current step is 'Alterar com IA' (step 2) and target is 'Gerar textos' (step 3)
    if (stepIndex > etapaAtual && !(etapaAtual === 2 && stepIndex === 3)) {
      return; // Only allow navigation to previous, current, or next step from 'Alterar com IA'
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
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                {projeto?.nome || 'Carregando projeto...'}
              </h1>
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

            <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
              {/* Breadcrumbs/Stepper */}
              <nav className="mb-8">
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
              <h1 className="text-3xl font-bold text-gray-900 mb-4 text-left">{projeto.nome}</h1>
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
                        {/* Nota Estimada - Card Especial */}
                        {projeto.analise_ia.includes('Nota estimada') && (
                          <div className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple rounded-2xl p-8 text-white text-center mb-8">
                            <div className="flex items-center justify-center mb-4">
                              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                                <span className="text-3xl font-bold">📊</span>
                              </div>
                            </div>
                            <h3 className="text-2xl font-bold mb-2">Nota Estimada</h3>
                            <div className="text-6xl font-black mb-4">
                              {(() => {
                                console.log('Texto da análise:', projeto.analise_ia);
                                
                                // Busca especificamente pela seção "Nota estimada"
                                const notaSection = projeto.analise_ia.match(/5\.\s*\*\*Nota estimada.*?:\*\*\s*(\d+)/i);
                                console.log('Seção nota encontrada:', notaSection);
                                
                                if (notaSection && notaSection[1]) {
                                  const nota = parseInt(notaSection[1]);
                                  console.log('Nota extraída:', nota);
                                  return nota;
                                }
                                
                                // Busca por diferentes padrões de nota como fallback
                                const patterns = [
                                  /Nota estimada.*?:\s*(\d+)/i,
                                  /Nota estimada.*?\):\s*(\d+)/i,
                                  /Nota.*?:\s*(\d+)/i
                                ];
                                
                                for (const pattern of patterns) {
                                  const match = projeto.analise_ia.match(pattern);
                                  console.log('Tentando padrão:', pattern, 'Resultado:', match);
                                  if (match && match[1]) {
                                    const nota = parseInt(match[1]);
                                    if (nota >= 0 && nota <= 100) {
                                      console.log('Nota encontrada:', nota);
                                      return nota;
                                    }
                                  }
                                }
                                
                                // Se não encontrar, busca por qualquer número entre 0-100
                                const numberMatch = projeto.analise_ia.match(/(\d+)/g);
                                console.log('Números encontrados:', numberMatch);
                                if (numberMatch) {
                                  for (const num of numberMatch) {
                                    const nota = parseInt(num);
                                    if (nota >= 0 && nota <= 100) {
                                      console.log('Nota válida encontrada:', nota);
                                      return nota;
                                    }
                                  }
                                }
                                
                                console.log('Usando fallback: 70');
                                return '70'; // Fallback
                              })()}
                            </div>
                            <div className="text-lg opacity-90">de 100 pontos</div>
                            <div className="mt-4 w-full bg-white/20 rounded-full h-3">
                              <div 
                                className="bg-white rounded-full h-3 transition-all duration-1000 ease-out"
                                style={{ 
                                  width: `${(() => {
                                    // Mesma lógica para a barra de progresso
                                    const notaSection = projeto.analise_ia.match(/5\.\s*\*\*Nota estimada.*?:\*\*\s*(\d+)/i);
                                    
                                    if (notaSection && notaSection[1]) {
                                      const nota = parseInt(notaSection[1]);
                                      return nota;
                                    }
                                    
                                    const patterns = [
                                      /Nota estimada.*?:\s*(\d+)/i,
                                      /Nota estimada.*?\):\s*(\d+)/i,
                                      /Nota.*?:\s*(\d+)/i
                                    ];
                                    
                                    for (const pattern of patterns) {
                                      const match = projeto.analise_ia.match(pattern);
                                      if (match && match[1]) {
                                        const nota = parseInt(match[1]);
                                        if (nota >= 0 && nota <= 100) {
                                          return nota;
                                        }
                                      }
                                    }
                                    
                                    const numberMatch = projeto.analise_ia.match(/(\d+)/g);
                                    if (numberMatch) {
                                      for (const num of numberMatch) {
                                        const nota = parseInt(num);
                                        if (nota >= 0 && nota <= 100) {
                                          return nota;
                                        }
                                      }
                                    }
                                    
                                    return 70; // Fallback
                                  })()}%` 
                                }}
                              ></div>
                            </div>
                          </div>
                        )}
                        
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
                        
                        {/* Dashboard de Critérios */}
                        {(() => {
                          // Extrair nota global
                          const notaGlobalPatterns = [
                            /5\.\s*\*\*Nota estimada.*?:\*\*\s*(\d+)/i,
                            /Nota estimada.*?:\s*(\d+)/i,
                            /Nota estimada.*?\):\s*(\d+)/i,
                            /Nota.*?:\s*(\d+)/i,
                            /(\d+)\s*de\s*100/i,
                            /(\d+)\/100/i
                          ];
                          
                          let notaGlobal = null;
                          for (const pattern of notaGlobalPatterns) {
                            const match = projeto.analise_ia.match(pattern);
                            if (match && match[1]) {
                              const nota = parseInt(match[1]);
                              if (nota >= 0 && nota <= 100) {
                                notaGlobal = nota;
                                break;
                              }
                            }
                          }
                          
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
                          
                          if (criteriosComNotas.length === 0 && !notaGlobal) return null;
                          
                          return (
                            <div className="mb-8">
                              {/* Card de Nota Global */}
                              {notaGlobal !== null && (
                                <div className="mb-4">
                                  <div className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple rounded-2xl p-6 text-white shadow-lg">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                                          <span className="text-3xl">🎯</span>
                                        </div>
                                        <div>
                                          <h3 className="text-lg font-bold">Nota Global do Projeto</h3>
                                          <p className="text-sm opacity-90">Avaliação geral considerando todos os critérios</p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-5xl font-black">{notaGlobal}</div>
                                        <div className="text-sm opacity-90">de 100 pontos</div>
                                      </div>
                                    </div>
                                    <div className="mt-4 bg-white/20 rounded-full h-3 overflow-hidden">
                                      <div 
                                        className="bg-white rounded-full h-3 transition-all duration-1000"
                                        style={{ width: `${notaGlobal}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Grid de Critérios */}
                              {criteriosComNotas.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {criteriosComNotas.map((criterio: any, idx) => {
                                const percentual = (criterio.nota / criterio.notaMaxima) * 100;
                                const cor = percentual >= 75 ? 'bg-green-500' : percentual >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                                
                                return (
                                  <div key={idx} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex-1">
                                        <h4 className="font-semibold text-gray-800 text-sm leading-tight">{criterio.nome}</h4>
                                        <p className="text-xs text-gray-500 mt-1">Peso: {criterio.peso}%</p>
                                      </div>
                                      <div className="ml-3 text-right">
                                        <div className="text-2xl font-bold text-oraculo-blue">{criterio.nota}</div>
                                        <div className="text-xs text-gray-500">de {criterio.notaMaxima}</div>
                                      </div>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                      <div 
                                        className={`${cor} h-2 rounded-full transition-all duration-500`}
                                        style={{ width: `${percentual}%` }}
                                      ></div>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-600 text-right">
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
                        
                        {(() => {
                          // Processar o texto da análise removendo markdown e seções já exibidas
                          const textoProcessado = formatarTextoParaExibicao(projeto.analise_ia);
                          const secoes = textoProcessado.split('\n\n').filter(sec => {
                            const secLower = sec.toLowerCase();
                            return !secLower.includes('nota estimada') && 
                                   !secLower.includes('sugestões de melhoria') &&
                                   !secLower.includes('sugestoes de melhoria') &&
                                   sec.trim().length > 0;
                          });
                          
                          return secoes.map((section, index) => {
                            const secaoLimpa = limparMarkdown(section);
                            
                            // Verificar se é um cabeçalho de seção
                            const isSectionHeader = secaoLimpa.trim().endsWith(':') || 
                                                   /^[A-Z][A-Z\s]+:?\s*$/.test(secaoLimpa.trim());
                            
                            // Verificar se é um item numerado
                            const isNumberedItem = /^\d+[\.\)]\s/.test(secaoLimpa.trim());
                            
                            if (isSectionHeader) {
                              return (
                                <div key={index} className="border-b border-gray-300 pb-3 mb-5 mt-6 first:mt-0">
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    {secaoLimpa.replace(/[:\.]$/, '').trim()}
                                  </h3>
                                </div>
                              );
                            } else if (isNumberedItem) {
                              const numero = secaoLimpa.match(/^\d+/)?.[0];
                              const conteudo = secaoLimpa.replace(/^\d+[\.\)]\s*/, '').trim();
                              
                              return (
                                <div key={index} className="flex gap-3 mb-4">
                                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-semibold mt-0.5">
                                    {numero}
                                  </div>
                                  <div className="text-gray-800 text-sm leading-relaxed flex-1">
                                    {conteudo.split('\n').map((line, lineIndex) => (
                                      <p key={lineIndex} className={lineIndex > 0 ? 'mt-2' : ''}>
                                        {line.trim()}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            
                            return (
                              <div key={index} className="text-gray-800 leading-relaxed text-sm mb-4">
                                {secaoLimpa.split('\n').map((line, lineIndex) => {
                                  const linhaLimpa = line.trim();
                                  if (!linhaLimpa) return null;
                                  return (
                                    <p key={lineIndex} className={lineIndex > 0 ? 'mt-2' : ''}>
                                      {linhaLimpa}
                                    </p>
                                  );
                                })}
                              </div>
                            );
                          });
                        })()}
                        
                        {/* Sugestões de Melhoria - Todas as sugestões */}
                        {sugestoes.length > 0 && (
                          <>
                            <div className="border-b border-gray-300 pb-3 mb-5 mt-6">
                              <h3 className="text-lg font-semibold text-gray-900">
                                Sugestões de Melhoria
                              </h3>
                            </div>
                            {sugestoes.map((sugestao, idx) => (
                              <div key={`sugestao-${idx}`} className="bg-gradient-to-r from-oraculo-blue/5 to-oraculo-purple/5 p-6 rounded-xl border-l-4 border-oraculo-blue shadow-sm mb-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                <div className="text-base text-gray-800 leading-relaxed">
                                  <span className="text-gray-800 text-lg font-medium">
                                    💡 Sugestão {idx + 1}: {limparMarkdown(sugestao)}
                                  </span>
                                </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    className="bg-oraculo-blue hover:bg-oraculo-blue/90 text-white px-4 py-2 text-sm font-medium"
                                    onClick={() => handleAprovar(idx)}
                                    disabled={gerandoSugestao !== null || aprovacoes[idx]}
                                  >
                                    {gerandoSugestao === idx ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : aprovacoes[idx] ? (
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                    ) : (
                                      <Check className="h-4 w-4 mr-1" />
                                    )}
                                    {gerandoSugestao === idx ? 'Aplicando...' : aprovacoes[idx] ? 'Aplicado' : 'Aplicar'}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                        <div className="flex gap-2">
                        <Button 
                          variant="default" 
                          size="lg" 
                          onClick={() => navigateToStep(3)}
                          className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white px-8 py-3 text-lg font-semibold"
                        >
                          Gerar textos <span className="ml-1">→</span>
                        </Button>
                      </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Texto do Projeto em Campo Editável */}
                <div className="mb-8 bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="p-6 border-b">
                    <h2 className="text-lg font-semibold mb-3 text-oraculo-blue">Texto do Projeto</h2>
                    <textarea
                      className="w-full border-2 border-gray-300 rounded-lg p-4 text-gray-700 min-h-[300px] focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue outline-none resize-y"
                      value={descricaoEditada}
                      onChange={(e) => setDescricaoEditada(e.target.value)}
                      disabled={gerandoSugestao !== null}
                      placeholder="Digite o texto do seu projeto aqui..."
                    />
                    {gerandoSugestao !== null && (
                      <div className="flex items-center gap-2 text-oraculo-blue mt-3 animate-pulse">
                        <Loader2 className="animate-spin h-5 w-5" />
                        Aplicando sugestão {gerandoSugestao + 1}...
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6">
                    <div className="flex gap-3">
                      <Button 
                        onClick={handleSalvar} 
                        disabled={salvando || gerandoSugestao !== null} 
                        className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white px-6 py-3 flex items-center gap-2"
                      >
                        {salvando ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : 'Salvar Alterações'}
                      </Button>
                      <Button 
                        size="lg" 
                        onClick={analisarComIA} 
                        disabled={analisando || !descricaoEditada}
                        className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white px-6 py-3 flex items-center gap-2"
                      >
                        {analisando ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Analisando...
                          </>
                        ) : (
                          <>
                            <Brain className="h-4 w-4" />
                            Analisar com IA
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                
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
                      {analisando ? 'Analisando...' : 'Analisar novamente com IA'}
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
    </div>
  );
};

export default Projeto; 