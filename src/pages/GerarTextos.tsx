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
    'Gerar Textos',
    'Gerar Orçamento',
    'Gerar Cronograma',
    'Gerar Cartas de anuência'
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

  const copiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(textos[textoSelecionado]);
      alert('Texto copiado para a área de transferência!');
    } catch (error) {
      console.error('Erro ao copiar texto:', error);
      alert('Erro ao copiar texto');
    }
  };

  const baixarTexto = () => {
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
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <nav className="mb-6">
              <ol className="flex flex-wrap items-center gap-2 text-sm">
                {steps.map((step, idx) => (
                  <li key={step} className="flex items-center gap-2">
                    {idx === 0 ? (
                      <Link to="/criar-projeto" className={`px-3 py-1 rounded-full font-medium ${idx === currentStep ? 'bg-oraculo-blue text-white' : 'bg-gray-200 text-gray-700'} hover:underline`}>
                        {step}
                      </Link>
                    ) : idx === 1 ? (
                      <Link to={`/projeto/${id}`} className={`px-3 py-1 rounded-full font-medium ${idx === currentStep ? 'bg-oraculo-blue text-white' : 'bg-gray-200 text-gray-700'} hover:underline`}>
                        {step}
                      </Link>
                    ) : idx === 2 ? (
                      <Link to={`/projeto/${id}/alterar-ia`} className={`px-3 py-1 rounded-full font-medium ${idx === currentStep ? 'bg-oraculo-blue text-white' : 'bg-gray-200 text-gray-700'} hover:underline`}>
                        {step}
                      </Link>
                    ) : (
                      <span className={`px-3 py-1 rounded-full font-medium ${idx === currentStep ? 'bg-oraculo-blue text-white' : 'bg-gray-200 text-gray-700'}`}>
                        {step}
                      </span>
                    )}
                    {idx < steps.length - 1 && <span className="text-gray-400">→</span>}
                  </li>
                ))}
              </ol>
            </nav>

            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Gerar Textos</h1>
              <p className="text-gray-600 mt-1">
                Gere textos para o projeto: <span className="font-medium">{projeto?.nome || 'Carregando...'}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                {Object.entries({
                  justificativa: 'Justificativa',
                  objetivos: 'Objetivos',
                  metodologia: 'Metodologia',
                  resultados_esperados: 'Resultados Esperados',
                  cronograma: 'Cronograma'
                }).map(([key, label]) => {
                  const tipo = key as TextoTipo;
                  const temTexto = !!textos[tipo];
                  
                  return (
                    <button
                      key={tipo}
                      onClick={() => setTextoSelecionado(tipo)}
                      className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-2 ${
                        textoSelecionado === tipo
                          ? 'bg-oraculo-blue text-white'
                          : 'bg-white hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      <FileText className="h-5 w-5" />
                      <span>{label}</span>
                      {temTexto && <CheckCircle className="h-4 w-4 ml-auto text-green-500" />}
                    </button>
                  );
                })}
              </div>

              <div className="lg:col-span-3 space-y-4">
                <div className="bg-white rounded-xl shadow-sm border p-6 min-h-[500px]">
                  {textos[textoSelecionado] ? (
                    <div className="h-full flex flex-col">
                      <div className="flex-1 overflow-auto whitespace-pre-wrap mb-4">
                        {textos[textoSelecionado]}
                      </div>
                      <div className="flex gap-2 pt-4 border-t">
                        <Button
                          variant="outline"
                          onClick={copiarTexto}
                          className="flex items-center gap-2"
                        >
                          <Copy className="h-4 w-4" />
                          Copiar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={baixarTexto}
                          className="flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Baixar
                        </Button>
                        <Button
                          onClick={() => gerarTexto(textoSelecionado)}
                          className="ml-auto bg-oraculo-blue hover:bg-oraculo-blue/90 text-white"
                          disabled={gerando === textoSelecionado}
                        >
                          {gerando === textoSelecionado ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Gerando...
                            </>
                          ) : (
                            'Regenerar'
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
                      <FileText className="h-12 w-12 text-gray-300 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhum texto gerado</h3>
                      <p className="mb-6 max-w-md">
                        Clique no botão abaixo para gerar um texto para esta seção.
                      </p>
                      <Button
                        onClick={() => gerarTexto(textoSelecionado)}
                        className="bg-oraculo-blue hover:bg-oraculo-blue/90 text-white"
                        disabled={!!gerando}
                      >
                        {gerando === textoSelecionado ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Gerando...
                          </>
                        ) : (
                          'Gerar Texto'
                        )}
                      </Button>
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
