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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [projeto, setProjeto] = useState<ProjetoDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [textos, setTextos] = useState<Record<TextoTipo, string>>({
    justificativa: '',
    objetivos: '',
    metodologia: '',
    resultados_esperados: '',
    cronograma: ''
  });
  const [gerando, setGerando] = useState<TextoTipo | null>(null);
  const [textoSelecionado, setTextoSelecionado] = useState<TextoTipo>('justificativa');
  const isMounted = useRef(true);

  const steps = [
    'Criar Projeto',
    'Avaliar com IA',
    'Alterar com IA',
    'Gerar Textos'
  ];
  const currentStep: number = 3; 

  useEffect(() => {
    const checkPremiumStatus = async () => {
      if (!user) {
        navigate('/login');
        return;
      }
      
      try {
        const db = getFirestore();
        const userRef = doc(db, 'usuarios', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.isPremium !== true) {
            navigate('/cadastro-premium');
          }
        } else {
          navigate('/cadastro-premium');
        }
      } catch (error) {
        console.error('Erro ao verificar status premium:', error);
        navigate('/cadastro-premium');
      }
    };

    checkPremiumStatus();
  }, [user, navigate]);

  useEffect(() => {
    const fetchProjeto = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const db = getFirestore();
        const projetoRef = doc(db, 'projetos', id);
        const projetoSnap = await getDoc(projetoRef);
        
        if (projetoSnap.exists()) {
          const data = { id: projetoSnap.id, ...projetoSnap.data() } as ProjetoDocument;
          setProjeto(data);
          
          // Initialize textos state with empty strings for all required fields
          setTextos(prev => ({
            justificativa: '',
            objetivos: '',
            metodologia: '',
            resultados_esperados: '',
            cronograma: '',
            // Merge with any existing texts from the database
            ...(data.textos_gerados || {})
          }));
        } else {
          navigate('/projetos');
        }
      } catch (error) {
        console.error('Erro ao carregar projeto:', error);
        alert('Erro ao carregar o projeto');
      } finally {
        setLoading(false);
      }
    };

    fetchProjeto();

    return () => {
      isMounted.current = false;
    };
  }, [id, navigate]);

  const salvarNoFirestore = async (tipo: TextoTipo, texto: string) => {
    if (!id) return;
    
    try {
      const db = getFirestore();
      const projetoRef = doc(db, 'projetos', id);
      
      await updateDoc(projetoRef, {
        [`textos_gerados.${tipo}`]: texto,
        atualizado_em: serverTimestamp()
      });
      
      console.log(`Texto salvo no Firestore para ${tipo}`);
    } catch (error) {
      console.error('Erro ao salvar no Firestore:', error);
    }
  };

  const gerarTexto = async (tipo: TextoTipo) => {
    console.log(`[${new Date().toISOString()}] gerarTexto iniciado para:`, tipo);
    
    if (gerando) {
      console.log(`[${new Date().toISOString()}] Já existe uma geração em andamento para:`, gerando);
      return;
    }
    
    try {
      console.log(`[${new Date().toISOString()}] Iniciando geração para:`, tipo);
      setGerando(tipo);
      
      // Clear previous text
      console.log(`[${new Date().toISOString()}] Limpando texto anterior`);
      setTextos(prev => ({
        ...prev,
        [tipo]: ''
      }));
      
      console.log(`[${new Date().toISOString()}] Enviando requisição para o servidor`);
      const startTime = Date.now();
      
      const response = await fetch('https://analisarprojeto-665760404958.us-central1.run.app/gerar-texto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projetoId: id,
          tipo,
          dadosProjeto: projeto,
          prompt: GERAR_TEXTO_PROMPT + tipo
        }),
      });
      
      const requestTime = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] Resposta recebida em ${requestTime}ms`, response);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[${new Date().toISOString()}] Erro na resposta:`, response.status, errorData);
        throw new Error(errorData.error || 'Erro ao gerar texto');
      }
      
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        console.log('[DEBUG] Recebida resposta JSON');
        const data = await response.json();
        console.log('[DEBUG] Dados recebidos:', data);
        
        if (data.texto) {
          console.log('[DEBUG] Texto recebido:', data.texto);
          if (isMounted.current) {
            setTextos(prev => ({
              ...prev,
              [tipo]: data.texto
            }));
            await salvarNoFirestore(tipo, data.texto);
          }
        } else {
          throw new Error('Resposta do servidor não contém texto');
        }
      } else if (contentType.includes('text/event-stream')) {
        console.log('[DEBUG] Iniciando leitura do stream');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';
        
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
              
              if (data.type === 'chunk' && data.content) {
                fullText += data.content;
                
                if (isMounted.current) {
                  setTextos(prev => ({
                    ...prev,
                    [tipo]: fullText
                  }));
                }
                
              } else if (data.type === 'complete') {
                const finalText = data.fullText || fullText;
                
                if (finalText) {
                  if (isMounted.current) {
                    setTextos(prev => ({
                      ...prev,
                      [tipo]: finalText
                    }));
                  }
                  await salvarNoFirestore(tipo, finalText);
                }
                return;
              }
            } catch (e) {
              console.error('Erro ao processar chunk:', e);
            }
          }
        }
      } else {
        throw new Error(`Tipo de resposta não suportado: ${contentType}`);
      }
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Erro ao gerar texto:`, error);
      alert(`Erro ao gerar texto: ${error.message}`);
    } finally {
      console.log(`[${new Date().toISOString()}] Finalizando geração para:`, tipo);
      if (isMounted.current) {
        setGerando(null);
      }
    }
  };

  const handleGerarTexto = async () => {
    await gerarTexto(textoSelecionado);
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
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 p-8 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-oraculo-blue" />
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
                Gerar Textos
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Gere textos para as diferentes seções do seu projeto cultural
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
              
              <div className="p-4 border-t bg-gray-50">
                <div className="min-h-[300px] max-h-[500px] overflow-y-auto p-4 bg-white border rounded-lg">
                  {textos[textoSelecionado] ? (
                    <div className="prose max-w-none">
                      {textos[textoSelecionado].split('\n').map((paragraph, idx) => (
                        <p key={idx}>{paragraph}</p>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">
                      {gerando === textoSelecionado ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-oraculo-blue" />
                          <p>Gerando texto, aguarde...</p>
                        </div>
                      ) : (
                        <p>Clique em "Gerar Texto" para criar o conteúdo.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default GerarTextos;
