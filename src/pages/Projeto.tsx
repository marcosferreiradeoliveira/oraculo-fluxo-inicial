import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Brain, Loader2, Check, X } from 'lucide-react';
import AnalisarImg from '@/assets/Analisar.jpeg';
import OpenAI from 'openai';

const steps = [
  'Criar Projeto',
  'Avaliar com IA',
  'Alterar com IA',
  'Gerar Textos'
];
const currentStep: number = 1; // Avaliar com IA

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
  const [isPremium, setIsPremium] = useState(false);
  const [mostrarAlterarIA, setMostrarAlterarIA] = useState(false);
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
          
          // Extract suggestions from analysis
          const regex = /Sugestão: ?(.+)/gi;
          const matches = [...data.analise_ia.matchAll(regex)].map(m => m[1].trim());
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
    setGerando(true);
    
    try {
      const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY, dangerouslyAllowBrowser: true });
      const prompt = `Você é um especialista em projetos culturais. Reescreva o texto do projeto abaixo, incorporando a seguinte sugestão de alteração para aumentar as chances de aprovação em editais. Mantenha o texto claro, objetivo e profissional.\n\nTEXTO ATUAL DO PROJETO:\n${descricaoEditada}\n\nSUGESTÃO DE ALTERAÇÃO:\n${sugestoes[idx]}\n\nNOVO TEXTO DO PROJETO:`;
      
      let novoTexto = '';
      const stream = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Você é um especialista em projetos culturais.' },
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
      setGerando(false);
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
      
      // Show success message
      alert('Alterações salvas com sucesso!');
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
  const updateStatusWithDelay = async (status: string, subEtapas: string[] = [], delayMs: number = 1000) => {
    if (status) setStatusIA(status);
    if (subEtapas.length > 0) {
      setSubEtapasIA(prev => [...prev, ...subEtapas]);
    }
    await delay(delayMs);
  };

  // Função para analisar com IA
  const analisarComIA = async () => {
    setAnalisando(true);
    setAnalise(null);
    setErroIA(null);
    setSubEtapasIA([]);
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
      const endpoint = 'https://analisarprojeto-665760404958.us-central1.run.app/analisarProjeto';
      const payload = { prompt };
      console.log('[Oraculo] Chamando endpoint:', endpoint);
      console.log('[Oraculo] Payload enviado:', payload);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log('[Oraculo] Status da resposta:', response.status);
      let data;
      const text = await response.text();
      console.log('[Oraculo] Texto da resposta:', text);
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        console.error('[Oraculo] Erro ao fazer parse do JSON:', text);
        throw new Error('Resposta inválida do servidor: ' + text);
      }
      if (!response.ok) {
        console.error('[Oraculo] Erro HTTP:', response.status, data && data.error);
        throw new Error((data && data.error) || `Erro HTTP: ${response.status}`);
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
    if (stepIndex > etapaAtual) return; // Only allow navigation to previous or current steps
    
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col md:ml-64">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8">
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
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-oraculo-blue mb-3 flex items-center gap-2">
                      <Brain className="h-5 w-5" /> Análise do Oráculo
                    </h2>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow">
                      <div className="whitespace-pre-line text-gray-800 text-sm">
                        {projeto.analise_ia}
                      </div>
                      <div className="mt-3 text-xs text-gray-500 flex justify-end">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={toggleAlterarIA}
                          className="text-oraculo-blue hover:bg-oraculo-blue/10"
                        >
                          Ver sugestões de melhoria →
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                <h2 className="text-lg font-semibold mb-1">Resumo do Projeto</h2>
                {mostrarAlterarIA ? (
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                      <h2 className="text-xl font-semibold text-oraculo-blue">Editor de Texto</h2>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={toggleAlterarIA}
                          className="text-gray-700"
                        >
                          Voltar para visualização
                        </Button>
                        <Button 
                          onClick={handleSalvar} 
                          disabled={salvando}
                          className="bg-oraculo-blue hover:bg-oraculo-blue/90 text-white"
                        >
                          {salvando ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Salvando...
                            </>
                          ) : 'Salvar alterações'}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="border border-gray-200 rounded-lg p-4 mb-6 bg-white">
                      <textarea
                        value={descricaoEditada}
                        onChange={(e) => setDescricaoEditada(e.target.value)}
                        className="w-full min-h-[300px] p-3 border rounded-md focus:ring-2 focus:ring-oraculo-blue/50 focus:border-oraculo-blue outline-none"
                        placeholder="Digite o texto do seu projeto aqui..."
                      />
                    </div>
                    
                    {sugestoes.length > 0 && (
                      <div className="mt-8">
                        <h3 className="text-lg font-semibold mb-3 text-oraculo-blue">Sugestões de Melhoria</h3>
                        <div className="space-y-4">
                          {sugestoes.map((sugestao, idx) => (
                            <div key={idx} className={`p-4 border rounded-lg ${aprovacoes[idx] ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                              <div className="flex justify-between items-start">
                                <p className="flex-1 text-gray-800">
                                  <span className="font-medium">Sugestão {idx + 1}:</span> {sugestao}
                                </p>
                                <div className="ml-4 flex-shrink-0">
                                  {aprovacoes[idx] ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      <Check className="h-3 w-3 mr-1" /> Aprovada
                                    </span>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleAprovar(idx)}
                                      disabled={gerando}
                                      className="text-oraculo-blue border-oraculo-blue/50 hover:bg-oraculo-blue/10"
                                    >
                                      {gerando ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      ) : (
                                        <Check className="h-4 w-4 mr-1" />
                                      )}
                                      Aplicar
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-700 whitespace-pre-line mb-6">{projeto.resumo || projeto.descricao}</p>
                )}
              </div>
            </div>
          </div>
          <aside className="hidden lg:block w-full max-w-sm ml-4">
            <div className="bg-gradient-to-br from-oraculo-blue/10 to-oraculo-purple/10 border-l-4 border-oraculo-blue rounded-xl p-8 shadow flex flex-col gap-2">
              <img src={AnalisarImg} alt="Análise do Oráculo" className="rounded-lg mb-3 w-full object-cover max-h-40" />
              <h2 className="text-lg font-semibold mb-2 text-oraculo-blue flex items-center gap-2">
                <span role="img" aria-label="Dica">🤖</span> Como funciona a análise do Oráculo
              </h2>
              <p className="text-gray-700 text-sm mb-2">
                Agora chegou a hora de avaliar seu projeto.<br/><br/>
                O Oráculo olha seu projeto como um avaliador, levando em conta não só os critérios do edital, mas também os últimos selecionados e uma base grande de projetos culturais bem-sucedidos.<br/><br/>
                Ele não vai alterar seu projeto, mas sim sugerir mudanças, que você pode aceitar ou não.
              </p>
              <Button size="lg" className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-lg px-8 py-4 flex items-center gap-2 mt-2" onClick={analisarComIA} disabled={analisando}>
                <Brain className="h-6 w-6" />
                {analisando ? 'Analisando...' : 'Analisar com IA'}
              </Button>
              {analisando && statusIA && (
                <div className="mt-4 mb-2 bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 text-gray-700 text-sm font-medium text-center animate-pulse">
                  {statusIA}
                  <ul className="mt-2 text-left text-xs text-gray-600 list-disc list-inside">
                    {subEtapasIA.map((etapa, idx) => (
                      <li key={idx}>{etapa}</li>
                    ))}
                  </ul>
                </div>
              )}
              {analise && (
                <div className="mt-6 bg-white border rounded-lg p-4 text-gray-800 whitespace-pre-line text-sm shadow">
                  <strong className="block text-oraculo-blue mb-2">Análise do Oráculo:</strong>
                  {analise}
                </div>
              )}
              {erroIA && (
                <div className="mt-4 text-red-500 text-sm text-center">{erroIA}</div>
              )}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
};

export default Projeto; 