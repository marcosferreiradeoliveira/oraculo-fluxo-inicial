import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, CheckCircle, Copy, Download } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';

type TextoTipo = 'justificativa' | 'objetivos' | 'metodologia' | 'resultados_esperados' | 'cronograma';

interface ProjetoDocument {
  id: string;
  textos_gerados?: Record<TextoTipo, string>;
  [key: string]: any;
}

const GERAR_TEXTO_PROMPT = `Você é um especialista em elaboração de projetos culturais para leis de incentivo. 
Gere um texto claro, objetivo e bem estruturado para o seguinte item do projeto: `;

const GerarTextos = () => {
  // Force update hook
  const [, forceUpdate] = useState<{} | undefined>();
  const { id } = useParams<{ id: string }>();
  console.log('Current route id:', id); // Debug log
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [projeto, setProjeto] = useState<ProjetoDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [textos, setTextos] = useState<Record<TextoTipo, string>>({
    justificativa: '',
    objetivos: '',
    metodologia: '',
    resultados_esperados: '',
    cronograma: ''
  });
  const [gerando, setGerando] = useState<TextoTipo | null>(null);
  const [progresso, setProgresso] = useState<string>('');
  const [textoSelecionado, setTextoSelecionado] = useState<TextoTipo>('justificativa');
  const [mostrarCaixaTexto, setMostrarCaixaTexto] = useState(false);
  const isMounted = useRef(true);

  const steps = ['Criação do Projeto', 'Detalhamento', 'Alterar com IA', 'Gerar Textos'];
  const currentStep = 3; // This page is the 4th step

  // Initialize and cleanup
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Debug effect to log state changes
  useEffect(() => {
    console.log('[DEBUG] gerando state changed to:', gerando);
  }, [gerando]);
  
  // Debug effect to log text changes
  useEffect(() => {
    console.log('[DEBUG] textos state changed:', textos);
    if (textoSelecionado && textos[textoSelecionado]) {
      console.log(`[DEBUG] Current text for ${textoSelecionado}:`, textos[textoSelecionado]);
    }
  }, [textos, textoSelecionado]);
  
  // Show text box when a text type is selected or when generating
  useEffect(() => {
    if (textoSelecionado || gerando) {
      setMostrarCaixaTexto(true);
    }
  }, [textoSelecionado, gerando]);
  // Buscar projeto ao carregar o componente
  useEffect(() => {
    const fetchProjeto = async () => {
      if (!id || !user) {
        setLoading(false);
        navigate('/'); // Redirect to home if no user or id
        return;
      }
      
      setLoading(true);
      try {
        const db = getFirestore();
        const projetoRef = doc(db, 'projetos', id);
        
        // First check if the project exists and user has access
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
        
        // Set the project data
        setProjeto(projetoData);
        setLoading(false);
        
      } catch (error) {
        console.error('Erro ao carregar projeto:', error);
        setLoading(false);
        // Don't redirect on error, just show an error state
      }
    };
    
    fetchProjeto();
  }, [id, navigate, user]);

  const salvarNoFirestore = async (tipo: TextoTipo, texto: string) => {
    if (!id) {
      console.error('ID do projeto não encontrado');
      return;
    }
    
    try {
      console.log(`[DEBUG] Salvando texto para ${tipo} no Firestore`);
      const db = getFirestore();
      const projetoRef = doc(db, 'projetos', id);
      
      // First update the local state
      setTextos(prev => {
        const newTexts = {
          ...prev,
          [tipo]: texto
        };
        console.log('[DEBUG] Estado local atualizado:', newTexts);
        return newTexts;
      });
      
      // Then update Firestore with the complete textos_gerados object
      await updateDoc(projetoRef, {
        textos_gerados: {
          ...textos, // Include all existing texts
          [tipo]: texto // Update the current text
        },
        atualizado_em: serverTimestamp()
      });
      
      console.log(`[DEBUG] Texto salvo com sucesso para ${tipo}`);
      return true;
    } catch (error) {
      console.error('Erro ao salvar no Firestore:', error);
      // Revert the local state if Firestore update fails
      setTextos(prev => ({
        ...prev
      }));
      return false;
    }
  };

  const gerarTexto = async (tipo: TextoTipo): Promise<boolean> => {
    const log = (message: string, data?: any) => {
      const timestamp = new Date().toISOString();
      if (data !== undefined) {
        console.log(`[${timestamp}] ${message}`, data);
      } else {
        console.log(`[${timestamp}] ${message}`);
      }
    };

    log('Iniciando geração de texto para:', { tipo, projetoId: id });
    
    try {
      // 1. Validações iniciais
      if (!projeto) {
        const errorMsg = 'Projeto não carregado';
        log(errorMsg);
        alert('Erro: Projeto não carregado. Por favor, recarregue a página.');
        throw new Error(errorMsg);
      }
      
      if (gerando) {
        const errorMsg = `Já existe uma geração em andamento para: ${gerando}`;
        log(errorMsg);
        return false; // Indica que não foi possível iniciar a geração
      }
      
      // 2. Inicialização do estado
      setProgresso('Inicializando geração...');
      setGerando(tipo);
      
      // 3. Limpeza do texto existente
      log('Limpando texto existente...');
      setTextos(prev => ({
        ...prev,
        [tipo]: ''
      }));
      
      // 4. Aguarda atualização do estado
      await new Promise(resolve => setTimeout(resolve, 50));
      log('Estado limpo com sucesso');
      
      // 5. Prepara a requisição
      setProgresso('Preparando dados...');
      const requestData = {
        projetoId: id,
        tipo,
        dadosProjeto: projeto,
        prompt: GERAR_TEXTO_PROMPT + tipo
      };
      
      log('Dados da requisição:', { 
        ...requestData, 
        dadosProjeto: '[...]' // Não logar o projeto inteiro
      });
      
      // 6. Envia a requisição
      setProgresso('Conectando ao servidor...');
      const startTime = Date.now();
      
      const response = await fetch('https://analisarprojeto-665760404958.us-central1.run.app/gerar-texto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });
      
      const requestTime = Date.now() - startTime;
      log(`Resposta recebida em ${requestTime}ms`, {
        status: response.status,
        statusText: response.statusText
      });
      console.log(`[${new Date().toISOString()}] Resposta recebida em ${requestTime}ms`, response);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[${new Date().toISOString()}] Erro na resposta:`, response.status, errorData);
        throw new Error(errorData.error || 'Erro ao gerar texto');
      }
      
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        console.log('[DEBUG] Recebida resposta JSON');
        console.log('[DEBUG] Dados recebidos:', data);
        
        if (data.texto) {
          setProgresso('Gerando texto...');
          const fullTextData = data.texto.trim();
          console.log('[DEBUG] Texto recebido via JSON:', fullTextData);
          if (isMounted.current) {
            setTextos(prev => {
              const newTexts = {
                ...prev,
                [tipo]: fullTextData
              };
              console.log('[DEBUG] Atualizando textos com novo valor:', newTexts);
              return newTexts;
            });
            await salvarNoFirestore(tipo, fullTextData);
            setGerando(null); // Clear loading state after successful update
            return true; // Indica sucesso
          }
        } else {
          throw new Error('Resposta do servidor não contém texto');
          return false; // This line is unreachable but satisfies TypeScript's return type
        }
    } else if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
        console.log('[DEBUG] Iniciando leitura do stream de texto');
        const decoder = new TextDecoder('utf-8');
        const reader = response.body?.getReader();
        let generationComplete = false;
        let buffer = '';
        let fullText = ''; // Moved outside to maintain state across chunks
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              
              try {
                const data = JSON.parse(line.substring(6).trim());
                console.log('[STREAM] Received data:', data);
                
                if (data.type === 'chunk' && data.content) {
                  console.log('[STREAM] Received chunk:', data.content);
                  // Append new content to the full text
                  fullText += data.content;
                  
                  console.log('[STREAM] Updating UI with new text length:', fullText.length);
                  // Update the state with the latest text
                  setTextos(prev => {
                    const newTexts = {
                      ...prev,
                      [tipo]: fullText
                    };
                    console.log('[STREAM] State updated with text length:', fullText.length);
                    return newTexts;
                  });
                  
                  // Update the textarea directly for better performance
                  const textarea = document.querySelector('.text-display') as HTMLTextAreaElement;
                  if (textarea) {
                    textarea.value = fullText;
                    textarea.scrollTop = textarea.scrollHeight;
                  }
                  
                  // Save to Firestore every 3 seconds or when text is complete
                  if (Date.now() % 3000 < 50) { // Roughly every 3 seconds
                    salvarNoFirestore(tipo, fullText).catch(console.error);
                  }
                } else if (data.type === 'complete') {
                  const finalText = data.fullText || fullText;
                  console.log('[DEBUG] Geração completa, texto final:', finalText);
                  
                  if (finalText) {
                    console.log('[DEBUG] Final text received, updating state and saving to Firestore');
                    // Update state first
                    setTextos(prev => ({
                      ...prev,
                      [tipo]: finalText
                    }));
                    // Then save to Firestore and wait for completion
                    const saved = await salvarNoFirestore(tipo, finalText);
                    if (!saved) {
                      console.error('Falha ao salvar o texto final no Firestore');
                    }
                  }
                  generationComplete = true;
                  break; // Exit the loop when complete
                }
              } catch (e) {
                console.error('Erro ao processar chunk:', e, 'Linha:', line);
              }
            }
            
            if (generationComplete) break; // Exit the while loop if complete
          }
          
          // If we get here, the stream ended
          if (!generationComplete) {
            console.log('[DEBUG] Stream finalizado sem evento complete');
            if (fullText) {
              console.log('[DEBUG] Salvando texto final do stream:', fullText);
              setTextos(prev => ({
                ...prev,
                [tipo]: fullText
              }));
              await salvarNoFirestore(tipo, fullText);
            } else {
              console.error('[ERROR] Nenhum texto foi recebido do servidor');
              throw new Error('Nenhum texto foi recebido do servidor');
            }
          }
          
        } catch (error) {
          console.error('Erro durante o processamento do stream:', error);
          throw error;
        } finally {
          // Ensure the reader is released
          if (reader) {
            try { 
              await reader.cancel(); 
            } catch (e) { 
              console.error('Erro ao cancelar reader:', e); 
            }
          }
        }
      } else {
        throw new Error(`Tipo de resposta não suportado: ${contentType}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`[${new Date().toISOString()}] Erro ao gerar texto para ${tipo}:`, error);
      
      // Only show alert for non-cancellation errors
      if (!errorMsg.includes('cancel') && !errorMsg.includes('Já existe')) {
        alert(`Erro ao gerar texto: ${errorMsg}`);
      }
      
      // In case of error, ensure the text is not left empty
      if (isMounted.current) {
        setTextos(prev => ({
          ...prev,
          [tipo]: prev[tipo] || 'Ocorreu um erro ao gerar o texto. Por favor, tente novamente.'
        }));
      }
      throw error; // Re-throw to be caught by the outer catch if needed
    } finally {
      console.log(`[${new Date().toISOString()}] Finalizando geração para:`, tipo);
      // Always clear the loading state
      if (isMounted.current) {
        console.log('[DEBUG] Clearing loading state in finally');
        // Use requestAnimationFrame to ensure React has finished its current render cycle
        requestAnimationFrame(() => {
          if (isMounted.current) {
            setGerando(null);
            forceUpdate({});
          }
        }, );
      }
    }
  };

  const handleGerarTexto = async () => {
    if (!textoSelecionado) {
      console.error('Nenhum texto selecionado');
      return;
    }
    
    // Show the text box immediately
    setMostrarCaixaTexto(true);

    console.log('[DEBUG] handleGerarTexto started for:', textoSelecionado);
    
    // Set loading state
    setGerando(textoSelecionado);
    
    try {
      console.log('[DEBUG] Current state before generation:', {
        gerando,
        currentText: textos[textoSelecionado],
        hasText: !!textos[textoSelecionado]
      });
      
      // Clear any existing text for the selected type
      setTextos(prev => ({
        ...prev,
        [textoSelecionado]: ''
      }));
      
      // Small delay to ensure state updates
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Generate the text
      const success = await gerarTexto(textoSelecionado);
      
      if (success) {
        console.log('[DEBUG] Text generation successful');
        // Force a re-render to ensure the text is displayed
        forceUpdate({});
      }
      
    } catch (error) {
      console.error('Error in handleGerarTexto:', error);
      alert(`Erro ao gerar texto: ${error.message}`);
    } finally {
      console.log('[DEBUG] handleGerarTexto completed for:', textoSelecionado);
      
      // Always clear loading state
      if (isMounted.current) {
        setGerando(null);
      }
      
      // Log final state
      console.log('[DEBUG] Final state after handleGerarTexto:', {
        gerando,
        currentText: textos[textoSelecionado],
        hasText: !!textos[textoSelecionado]
      });
    }
  };

  const handleCopiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(textos[textoSelecionado]);
      alert('Texto copiado para a área de transferência!');
    } catch (error) {
      console.error('Erro ao copiar texto:', error);
      alert('Erro ao copiar texto');
    }
  };

  const handleDownloadTexto = () => {
    const element = document.createElement('a');
    const file = new Blob([textos[textoSelecionado]], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${projeto?.nome || 'projeto'}_${textoSelecionado}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-oraculo-blue mb-4" />
            <p className="text-gray-600">{progresso || 'Carregando projeto...'}</p>
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
            <p className="text-gray-600 mb-4">Não foi possível carregar as informações do projeto. Verifique sua conexão ou tente novamente mais tarde.</p>
            <Button 
              onClick={() => window.location.reload()}
              className="bg-oraculo-blue hover:bg-oraculo-blue/90"
            >
              Tentar novamente
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // No longer using a separate loading page - showing the text box instead

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col md:ml-64">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Gerar Textos
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Gere textos para as diferentes seções do seu projeto cultural
              </p>
            </div>

            {/* Barra de progresso */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                {steps.map((step, index) => {
                  const isClickable = index <= currentStep;
                  const route = index === 0 
                    ? '/criar-projeto' 
                    : index === 1 
                      ? `/projeto/${id}` 
                      : index === 2 
                        ? `/projeto/${id}/alterar-com-ia` 
                        : `#`;
                  
                  return (
                    <button
                      key={index}
                      onClick={() => isClickable && navigate(route)}
                      className={`flex flex-col items-center ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                      disabled={!isClickable}
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
                        className={`text-xs mt-1 text-center transition-colors ${
                          index === currentStep 
                            ? 'font-medium text-oraculo-blue' 
                            : index < currentStep 
                              ? 'text-oraculo-blue hover:underline' 
                              : 'text-gray-500'
                        }`}
                      >
                        {step}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-oraculo-blue h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${(currentStep + 1) * 25}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">Selecione o tipo de texto</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {Object.entries({
                  justificativa: 'Justificativa',
                  objetivos: 'Objetivos',
                  metodologia: 'Metodologia',
                  resultados_esperados: 'Resultados Esperados',
                  cronograma: 'Cronograma'
                }).map(([tipo, titulo]) => (
                  <button
                    key={tipo}
                    onClick={() => setTextoSelecionado(tipo as TextoTipo)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      textoSelecionado === tipo
                        ? 'border-oraculo-blue bg-oraculo-blue/5'
                        : 'border-gray-200 hover:border-oraculo-blue/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-oraculo-blue" />
                      <span className="font-medium text-gray-800">{titulo}</span>
                      {textos[tipo as TextoTipo] && (
                        <CheckCircle className="ml-auto h-5 w-5 text-green-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="p-4 border-t">
                <div className="flex flex-col md:flex-row gap-4">
                  <Button
                    onClick={handleGerarTexto}
                    disabled={!!gerando}
                    className="bg-oraculo-blue hover:bg-oraculo-blue/90 text-white"
                  >
                    {gerando === textoSelecionado ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      'Gerar Texto'
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleCopiarTexto}
                    className="border-oraculo-blue text-oraculo-blue hover:bg-oraculo-blue/10"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Texto
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleDownloadTexto}
                    className="border-oraculo-purple text-oraculo-purple hover:bg-oraculo-purple/10 ml-auto"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Baixar .TXT
                  </Button>
                </div>
              </div>
              
              {mostrarCaixaTexto && (
                <div className="p-4 border-t bg-gray-50">
                  <div className="min-h-[300px] max-h-[500px] overflow-y-auto p-4 bg-white border rounded-lg">
                    {gerando === textoSelecionado ? (
                      <div className="relative h-full">
                        <textarea
                          className="w-full h-full p-4 border rounded text-gray-800 bg-white text-display min-h-[300px]"
                          readOnly
                          value={textos[textoSelecionado] || ''}
                          placeholder={gerando ? 'Gerando texto, aguarde...' : `Digite ou gere o texto para ${textoSelecionado.replace('_', ' ').toLowerCase()}...`}
                        />
                        <div className="absolute bottom-4 right-4 flex items-center bg-white/90 px-3 py-1.5 rounded-full shadow-sm border text-sm">
                          <Loader2 className="h-4 w-4 animate-spin text-oraculo-blue mr-2" />
                          <span className="text-gray-700">Gerando texto...</span>
                        </div>
                      </div>
                    ) : textos[textoSelecionado] ? (
                      <div className="prose max-w-none">
                        <textarea
                          className="w-full h-full min-h-[300px] p-4 border rounded text-gray-800 bg-white"
                          value={textos[textoSelecionado]}
                          onChange={(e) => {
                            setTextos(prev => ({
                              ...prev,
                              [textoSelecionado]: e.target.value
                            }));
                          }}
                          placeholder={`Digite ou gere o texto para ${textoSelecionado.replace('_', ' ').toLowerCase()}...`}
                        />
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-500">
                        <p>Selecione um tipo de texto e clique em "Gerar Texto" para começar.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default GerarTextos;
