import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, CheckCircle, Copy, Download } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';

// Interface para o tipo de texto
type TextoTipo = 'justificativa' | 'objetivos' | 'metodologia' | 'resultados_esperados' | 'cronograma';

// Interface para o documento do projeto no Firestore
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
  const [projeto, setProjeto] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState<TextoTipo | null>(null);
  const [textos, setTextos] = useState<Record<TextoTipo, string>>({
    justificativa: '',
    objetivos: '',
    metodologia: '',
    resultados_esperados: '',
    cronograma: ''
  });
  const [textoSelecionado, setTextoSelecionado] = useState<TextoTipo>('justificativa');

  // Verificar status premium
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

  // Carregar dados do projeto
  useEffect(() => {
    const fetchProjeto = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const db = getFirestore();
        const projetoRef = doc(db, 'projetos', id);
        const projetoSnap = await getDoc(projetoRef);
        
        if (projetoSnap.exists()) {
          const data = { id: projetoSnap.id, ...projetoSnap.data() };
          setProjeto(data);
          
          // Carregar textos existentes se houver
          if (data.textos_gerados) {
            setTextos(prev => ({
              ...prev,
              ...data.textos_gerados
            }));
          }
        } else {
          navigate('/projetos');
        }
      } catch (error) {
        console.error('Erro ao carregar projeto:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProjeto();
    }
  }, [id, navigate]);

  // Referência para controlar se o componente ainda está montado
  const isMounted = useRef(true);
  
  // Efeito para limpar a referência quando o componente desmontar
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

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
    if (!id || !projeto) return;
    
    setGerando(tipo);
    
    // Iniciar com texto vazio para o tipo selecionado
    const textoInicial = '';
    setTextos(prev => ({
      ...prev,
      [tipo]: textoInicial
    }));
    
    // Salvar o texto vazio inicial
    await salvarNoFirestore(tipo, textoInicial);
    
    // Variável para acumular o texto completo
    let textoCompleto = '';
    
    try {
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
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao gerar texto');
      }
      
      if (!response.body) {
        throw new Error('Não foi possível ler o corpo da resposta');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      // Função para processar o stream
      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              // Garantir que o texto final seja salvo
              const finalText = textos[tipo] || '';
              if (finalText) {
                await salvarNoFirestore(tipo, finalText);
              }
              break;
            }
            
            // Decodificar os dados recebidos
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // Processar cada linha do buffer
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || ''; // A última linha pode estar incompleta
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.substring(6).trim());
                
                if (data.type === 'chunk' && data.content) {
                  // Atualizar o texto com o novo chunk
                  textoCompleto += data.content;
                  
                  // Atualizar o estado local
                  if (isMounted.current) {
                    setTextos(prev => ({
                      ...prev,
                      [tipo]: textoCompleto
                    }));
                  }
                  
                  // Salvar no Firestore após cada chunk significativo
                  // (a cada 100 caracteres ou no final de uma linha)
                  if (data.content.length >= 100 || data.content.endsWith('\n')) {
                    await salvarNoFirestore(tipo, textoCompleto);
                  }
                } else if (data.type === 'complete') {
                  // Usar o texto completo acumulado ou o que veio no evento
                  const finalText = data.fullText || textoCompleto;
                  
                  if (finalText) {
                    // Garantir que temos o texto completo
                    if (isMounted.current) {
                      setTextos(prev => ({
                        ...prev,
                        [tipo]: finalText
                      }));
                    }
                    // Salvar o texto completo
                    await salvarNoFirestore(tipo, finalText);
                  }
                } else if (data.type === 'error') {
                  throw new Error(data.error || 'Erro ao gerar texto');
                }
              }
            }
          }
        } catch (error) {
          console.error('Erro ao processar o stream:', error);
          throw error;
        } finally {
          setGerando(null);
        }
      };
      
      // Iniciar o processamento do stream
      await processStream();
      
    } catch (error) {
      console.error('Erro ao gerar texto:', error);
      alert(`Erro ao gerar texto: ${error.message}`);
      setGerando(null);
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
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Gerar Textos</h1>
              <p className="text-gray-600 mt-1">
                Gere textos para o projeto: <span className="font-medium">{projeto?.nome || 'Carregando...'}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Menu lateral */}
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

              {/* Área de texto */}
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
                
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        Os textos gerados são sugestões baseadas nas informações do seu projeto. 
                        Revise e ajuste conforme necessário antes de enviar para análise.
                      </p>
                    </div>
                  </div>
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
