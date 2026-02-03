import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc, DocumentData } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Brain, Loader2, CheckCircle, Check, X, Copy, Download } from 'lucide-react';
import AnalisarImg from '@/assets/Analisar.jpeg';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';

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
const currentStep: number = 2; // Alterar com IA

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

interface Projeto extends DocumentData {
  id: string;
  descricao?: string;
  edital_associado?: string;
  analise_ia?: string;
  // Add other properties as needed
}

const AlterarComIA = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [editalNome, setEditalNome] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [analise, setAnalise] = useState<string | null>(null);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [descricaoEditada, setDescricaoEditada] = useState<string>('');
  const [aprovacoes, setAprovacoes] = useState<boolean[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [textoAnterior, setTextoAnterior] = useState<string>(''); // Armazena o texto antes de aplicar sugestão
  const [aguardandoAprovacao, setAguardandoAprovacao] = useState(false); // Indica se há mudança aguardando aprovação

  useEffect(() => {
    document.title = 'Alterar com IA - Oráculo Cultural';
  }, []);

  // Verificar status premium e redirecionar se necessário
  useEffect(() => {
    const checkPremiumAndRedirect = async () => {
      if (!user) {
        navigate('/');
        return;
      }
      
      try {
        const db = getFirestore();
        const userRef = doc(db, 'usuarios', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          console.log('User data from Firestore:', userData);
          const isPremiumStatus = userData.isPremium === true;
          setIsPremium(isPremiumStatus);
          
          if (!isPremiumStatus) {
            console.log('Usuário não premium tentando acessar Alterar com IA, redirecionando para assinatura...');
            navigate('/cadastro-premium');
            return;
          }
        } else {
          // Se o usuário não tem documento, não é premium
          navigate('/cadastro-premium');
          return;
        }
      } catch (error) {
        console.error('Erro ao verificar status premium:', error);
        navigate('/cadastro-premium');
      }
    };
    
    checkPremiumAndRedirect();
  }, [user, navigate]);

  // Função para verificar premium e redirecionar se necessário
  const checkPremiumAccess = () => {
    if (!isPremium) {
      navigate('/cadastro-premium');
      return false;
    }
    return true;
  };

  useEffect(() => {
    const fetchProjeto = async () => {
      if (!id) return;
      setLoading(true);
      const db = getFirestore();
      try {
        console.log('Fetching project with ID:', id);
        const ref = doc(db, 'projetos', id);
        const snap = await getDoc(ref);
        
        if (!snap.exists()) {
          console.error('Project not found');
          setLoading(false);
          return;
        }

        const data = { id: snap.id, ...snap.data() } as Projeto;
        console.log('Project data:', data);
        setProjeto(data);
        setAnalise((data as any).analise_ia || null);
        setDescricaoEditada(data.descricao || '');
        
        // Fetch edital name if edital_associado exists
        if (data.edital_associado) {
          console.log('Fetching edital with ID:', data.edital_associado);
          try {
            const editalRef = doc(db, 'editais', data.edital_associado);
            console.log('Edital ref path:', editalRef.path);
            const editalSnap = await getDoc(editalRef);
            
            console.log('Edital document exists:', editalSnap.exists());
            if (editalSnap.exists()) {
              const editalData = editalSnap.data();
              console.log('Edital document data:', editalData);
              
              // Check all possible name fields
              const possibleNameFields = ['nome', 'titulo', 'name', 'title', 'editalName'];
              const nameField = possibleNameFields.find(field => field in editalData);
              console.log('Available fields in edital document:', Object.keys(editalData));
              
              const name = nameField ? editalData[nameField] : `Edital: ${data.edital_associado}`;
              console.log('Using field for name:', nameField, 'Value:', name);
              setEditalNome(name);
            } else {
              console.warn('Edital document not found, using ID as fallback');
              setEditalNome(`Edital: ${data.edital_associado}`);
            }
          } catch (error) {
            console.error('Error fetching edital:', error);
            setEditalNome(`Edital: ${data.edital_associado}`);
          }
        }
        
        // Load saved approvals
        if (Array.isArray(data.sugestoes_aprovadas)) {
          setAprovacoes(data.sugestoes_aprovadas);
        }
      } catch (error) {
        console.error('Error in fetchProjeto:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProjeto();
  }, [id]);

  useEffect(() => {
    if (analise) {
      // Extract suggestions using the new robust function
      const matches = extrairSugestoes(analise);
      console.log('Sugestões extraídas em AlterarComIA:', matches);
      console.log('Total de sugestões:', matches.length);
      setSugestoes(matches);
      // Se já há aprovações salvas, mantém, senão inicializa tudo como false
      setAprovacoes(prev => prev.length === matches.length ? prev : matches.map(() => false));
    }
  }, [analise]);

  const handleAprovar = async (idx: number) => {
    // Verificar se o usuário é premium
    if (!checkPremiumAccess()) {
      return;
    }
    
    // Marca sugestão como aprovada
    const novasAprovacoes = [...aprovacoes];
    novasAprovacoes[idx] = true;
    setAprovacoes(novasAprovacoes);
    setGerando(true);
    
    try {
      const textoBase = descricaoEditada || projeto?.descricao || '';
      
      if (!textoBase.trim() || !sugestoes[idx]?.trim()) {
        console.error('Texto ou sugestão vazios');
        alert('Erro: texto ou sugestão inválidos');
        setGerando(false);
        // Reverter a aprovação em caso de erro
        const novasAprovacoes = [...aprovacoes];
        novasAprovacoes[idx] = false;
        setAprovacoes(novasAprovacoes);
        return;
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
      
      // Não salvar imediatamente - mostrar nova versão e aguardar aprovação
      if (novoTexto.trim()) {
        setTextoAnterior(textoBase);
        setDescricaoEditada(novoTexto);
        setAguardandoAprovacao(true);
      }
      
      setGerando(false);
    } catch (e) {
      console.error('Erro ao processar sugestão:', e);
      alert(`Erro ao aplicar sugestão: ${e instanceof Error ? e.message : 'Erro desconhecido'}`);
      setGerando(false);
      // Reverter a aprovação em caso de erro
      const novasAprovacoes = [...aprovacoes];
      novasAprovacoes[idx] = false;
      setAprovacoes(novasAprovacoes);
    }
  };

  // Função para aprovar a mudança
  const aprovarMudanca = () => {
    setAguardandoAprovacao(false);
    setTextoAnterior('');
    // O texto já está em descricaoEditada, será salvo quando clicar em "Salvar"
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

  const handleSalvar = async () => {
    // Verificar se o usuário é premium
    if (!checkPremiumAccess()) {
      return;
    }
    
    if (!id) return;
    setSalvando(true);
    try {
      const db = getFirestore();
      const ref = doc(db, 'projetos', id);
      await updateDoc(ref, { descricao: descricaoEditada, sugestoes_aprovadas: aprovacoes });
      // Navega para a página de Gerar Textos após salvar
      navigate(`/projeto/${id}/gerar-textos`);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      alert('Ocorreu um erro ao salvar as alterações. Por favor, tente novamente.');
    } finally {
      setSalvando(false);
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
      
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Alterar com IA
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Use a IA para melhorar seu projeto com base nas sugestões fornecidas.
              </p>
            </div>

            {/* Barra de progresso */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                {steps.map((step, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${index <= currentStep ? 'bg-oraculo-blue text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {index + 1}
                    </div>
                    <span className={`text-xs mt-1 text-center ${index === currentStep ? 'font-medium text-oraculo-blue' : 'text-gray-500'}`}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-oraculo-blue h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-oraculo-blue">Texto do Projeto</h2>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copiarTextoProjeto}
                      className="border-oraculo-blue text-oraculo-blue hover:bg-oraculo-blue/10"
                      title="Copiar texto do projeto"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
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
                  className="w-full border-2 border-gray-300 rounded-lg p-4 text-gray-700 min-h-[300px] focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue outline-none resize-y"
                  value={descricaoEditada}
                  onChange={e => setDescricaoEditada(e.target.value)}
                  disabled={gerando}
                  placeholder="Digite o texto do seu projeto aqui..."
                />
                {gerando && (
                  <div className="flex items-center gap-2 text-oraculo-blue mt-3 animate-pulse">
                    <Loader2 className="animate-spin h-5 w-5" />
                    Produzindo o texto...
                  </div>
                )}
                
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
                        <Check className="mr-2 h-4 w-4" />
                        Aprovar Mudança
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
              </div>
              
              <div className="p-6">
                <div className="flex gap-3">
                  <Button 
                    onClick={handleSalvar} 
                    disabled={salvando || gerando} 
                    className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white px-6 py-3 flex items-center gap-2"
                  >
                    {salvando ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Alterações'
                    )}
                  </Button>
                  <Button 
                    onClick={() => id && navigate(`/projeto/${id}/gerar-textos`)}
                    className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white px-6 py-3 flex items-center gap-2"
                  >
                    Gerar Textos
                  </Button>
                </div>
              </div>
              
              {/* Diagnóstico e Análise da IA */}
              {analise && (
                <div className="p-6 border-t">
                  <h2 className="text-lg font-semibold mb-4 text-oraculo-blue flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Diagnóstico do Oráculo
                  </h2>
                  
                  {/* Nota Estimada - Card Especial */}
                  {analise.includes('Nota estimada') && (
                    <div className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple rounded-2xl p-6 text-white text-center mb-6">
                      <div className="flex items-center justify-center mb-3">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                          <span className="text-2xl">📊</span>
                        </div>
                      </div>
                      <h3 className="text-xl font-bold mb-2">Nota Estimada</h3>
                      <div className="text-5xl font-black mb-3">
                        {(() => {
                          // Busca por diferentes padrões de nota
                          const patterns = [
                            /5\.\s*\*\*Nota estimada.*?:\*\*\s*(\d+)/i,
                            /Nota estimada.*?:\s*(\d+)/i,
                            /Nota estimada.*?\):\s*(\d+)/i,
                            /Nota.*?:\s*(\d+)/i,
                            /(\d+)\s*de\s*100/i,
                            /(\d+)\/100/i
                          ];
                          
                          for (const pattern of patterns) {
                            const match = analise.match(pattern);
                            if (match && match[1]) {
                              const nota = parseInt(match[1]);
                              if (nota >= 0 && nota <= 100) {
                                return nota;
                              }
                            }
                          }
                          return '?';
                        })()}
                      </div>
                      <p className="text-sm opacity-90">de 100 pontos</p>
                      <div className="mt-4 bg-white/20 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-white rounded-full h-2 transition-all duration-1000"
                          style={{ 
                            width: `${(() => {
                              const patterns = [
                                /5\.\s*\*\*Nota estimada.*?:\*\*\s*(\d+)/i,
                                /Nota estimada.*?:\s*(\d+)/i,
                                /Nota estimada.*?\):\s*(\d+)/i,
                                /Nota.*?:\s*(\d+)/i,
                                /(\d+)\s*de\s*100/i,
                                /(\d+)\/100/i
                              ];
                              
                              for (const pattern of patterns) {
                                const match = analise.match(pattern);
                                if (match && match[1]) {
                                  const nota = parseInt(match[1]);
                                  if (nota >= 0 && nota <= 100) {
                                    return nota;
                                  }
                                }
                              }
                              return 0;
                            })()}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  {/* Dashboard de Critérios */}
                  {analise && (() => {
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
                      const match = analise.match(pattern);
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
                      const match = analise.match(criterio.pattern);
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
                      <div className="mb-6">
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
                  
                  <div className="prose max-w-none">
                    <div className="bg-gradient-to-r from-oraculo-blue/5 to-oraculo-purple/5 rounded-lg p-6 text-gray-800 leading-relaxed">
                      {(() => {
                        // Processar o texto da análise removendo markdown e seções já exibidas
                        const textoProcessado = formatarTextoParaExibicao(analise);
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
                              <div key={index} className="font-semibold text-gray-900 text-lg mb-3 mt-6 first:mt-0 border-b border-gray-300 pb-2">
                                {secaoLimpa.replace(/[:\.]$/, '').trim()}
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
                    </div>
                  </div>
                </div>
              )}
              
              {sugestoes.length > 0 && (
                <div className="p-6 border-t">
                  <h2 className="text-lg font-semibold mb-4 text-oraculo-blue">Sugestões de Alteração da IA</h2>
                  <ul className="space-y-3">
                    {sugestoes.map((sug, idx) => (
                      <li key={idx} className={`flex items-start gap-3 p-3 rounded-lg ${aprovacoes[idx] ? 'bg-green-50 border-2 border-green-200' : 'bg-gradient-to-r from-oraculo-blue/5 to-oraculo-purple/5'}`}>
                        <Button 
                          size="sm" 
                          variant={aprovacoes[idx] ? 'default' : 'outline'} 
                          disabled={aprovacoes[idx] || gerando} 
                          onClick={() => handleAprovar(idx)}
                          className={aprovacoes[idx] ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
                        >
                          {gerando && !aprovacoes[idx] ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Aplicando...
                            </>
                          ) : aprovacoes[idx] ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Sugestão aplicada
                            </>
                          ) : (
                            'Aprovar'
                          )}
                        </Button>
                        <span className={`flex-1 ${aprovacoes[idx] ? 'text-green-700 font-medium' : 'text-gray-800'}`}>
                          {limparMarkdown(sug)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AlterarComIA;