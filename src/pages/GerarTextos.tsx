import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, CheckCircle, Copy, Download, DollarSign, Edit } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';

type TextoTipo = 'justificativa' | 'objetivos' | 'metodologia' | 'resultados_esperados' | 'cronograma' | 'orcamento' | string;

interface ProjetoDocument {
  id: string;
  textos_gerados?: Record<string, string>;
  edital_id?: string;
  [key: string]: any;
}

interface EditalDocument {
  id: string;
  nome: string;
  textos_exigidos?: string[];
  [key: string]: any;
}

const GERAR_TEXTO_PROMPT = `Você é um especialista em elaboração de projetos culturais para leis de incentivo. 
Gere um texto claro, objetivo e bem estruturado para o seguinte item do projeto: `;

// Mapeamento de tipos para compatibilidade com backend
const TIPO_MAP: Record<TextoTipo, string> = {
  justificativa: 'justificativa',
  objetivos: 'objetivos',
  metodologia: 'metodologia',
  resultados_esperados: 'resultados_esperados',
  cronograma: 'cronograma',
  orcamento: 'orcamento'
};

const GerarTextos = () => {
  // Force update hook
  const [, forceUpdate] = useState<{} | undefined>();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [projeto, setProjeto] = useState<ProjetoDocument | null>(null);
  const [edital, setEdital] = useState<EditalDocument | null>(null);
  const [tiposTextoDisponiveis, setTiposTextoDisponiveis] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [gerando, setGerando] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<string>('');
  const [textoSelecionado, setTextoSelecionado] = useState<string>('justificativa');
  const [mostrarCaixaTexto, setMostrarCaixaTexto] = useState(false);
  const [categoriaPersonalizada, setCategoriaPersonalizada] = useState('');
  const [mostrarInputCategoria, setMostrarInputCategoria] = useState(false);
  const [categoriasCustom, setCategoriasCustom] = useState<string[]>([]);
  const [rubricas, setRubricas] = useState<Array<{ id: string; nome: string; valor: string }>>([]);
  const [mostrarModalRubricas, setMostrarModalRubricas] = useState(false);
  const [sugestaoTexto, setSugestaoTexto] = useState<string>('');
  const [aplicandoSugestao, setAplicandoSugestao] = useState(false);
  const isMounted = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const steps = ['Criar Projeto', 'Avaliar com IA', 'Alterar com IA', 'Gerar Textos', 'Criar Orçamento', 'Criar Cronograma', 'Preencher Anexos'];
  const currentStep = 3; // Gerar Textos

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
          const isPremium = userData.isPremium === true;
          
          if (!isPremium) {
            console.log('Usuário não premium tentando acessar Gerar Textos, redirecionando para assinatura...');
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
        
        // Buscar edital se o projeto tiver um edital_id
        if (projetoData.edital_id) {
          try {
            const editalRef = doc(db, 'editais', projetoData.edital_id);
            const editalSnap = await getDoc(editalRef);
            
            if (editalSnap.exists()) {
              const editalData = {
                id: editalSnap.id,
                ...editalSnap.data()
              } as EditalDocument;
              
              setEdital(editalData);
              
              // Definir tipos de texto baseado no edital
              if (editalData.textos_exigidos && Array.isArray(editalData.textos_exigidos) && editalData.textos_exigidos.length > 0) {
                setTiposTextoDisponiveis(editalData.textos_exigidos);
                // Selecionar o primeiro tipo por padrão
                setTextoSelecionado(editalData.textos_exigidos[0]);
              } else {
                // Fallback para tipos padrão se o edital não tiver textos_exigidos
                setTiposTextoDisponiveis(['justificativa', 'objetivos', 'metodologia', 'resultados_esperados', 'cronograma', 'orcamento']);
                setTextoSelecionado('justificativa');
              }
            } else {
              // Edital não encontrado, usar tipos padrão
              setTiposTextoDisponiveis(['justificativa', 'objetivos', 'metodologia', 'resultados_esperados', 'cronograma', 'orcamento']);
              setTextoSelecionado('justificativa');
            }
          } catch (error) {
            console.error('Erro ao buscar edital:', error);
            // Em caso de erro, usar tipos padrão
            setTiposTextoDisponiveis(['justificativa', 'objetivos', 'metodologia', 'resultados_esperados', 'cronograma', 'orcamento']);
            setTextoSelecionado('justificativa');
          }
        } else {
          // Projeto sem edital, usar tipos padrão
          setTiposTextoDisponiveis(['justificativa', 'objetivos', 'metodologia', 'resultados_esperados', 'cronograma', 'orcamento']);
          setTextoSelecionado('justificativa');
        }
        
        // Carregar textos gerados se existirem
        if (projetoData.textos_gerados) {
          setTextos(projetoData.textos_gerados);
        }
        
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
      
      // RECARREGAR OS DADOS MAIS RECENTES DO PROJETO DO FIRESTORE
      // para garantir que estamos usando as alterações das etapas anteriores
      let projetoAtualizado = projeto;
      try {
        const db = getFirestore();
        const projetoRef = doc(db, 'projetos', id!);
        const projetoSnap = await getDoc(projetoRef);
        
        if (projetoSnap.exists()) {
          projetoAtualizado = { 
            id: projetoSnap.id, 
            ...projetoSnap.data() 
          } as ProjetoDocument;
          
          log('Projeto recarregado do Firestore:', { 
            hasDescricao: !!projetoAtualizado.descricao,
            descricaoLength: projetoAtualizado.descricao?.length || 0 
          });
          
          // Atualizar o estado local também
          setProjeto(projetoAtualizado);
        } else {
          log('Aviso: Projeto não encontrado no Firestore, usando estado local');
        }
      } catch (err) {
        console.error('Erro ao recarregar projeto do Firestore:', err);
        log('Erro ao recarregar projeto, usando estado local');
      }
      
      // Buscar dados do usuário (portfolio, equipeBio e dadosCadastrais) para incluir na geração
      // mas apenas como complemento, não sobrescrevendo dados do projeto
      let userPortfolio = '';
      let equipeBio = '';
      let dadosCadastrais = '';
      if (user) {
        try {
          const db = getFirestore();
          const userDocRef = doc(db, 'usuarios', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            userPortfolio = userData.portfolio || '';
            equipeBio = userData.equipeBio || '';
            dadosCadastrais = userData.dadosCadastrais || '';
          }
        } catch (err) {
          console.error('Erro ao buscar dados do usuário:', err);
        }
      }
      
      const tipoMapeado = TIPO_MAP[tipo] || tipo; // Use o tipo original se não houver mapeamento (categorias personalizadas)
      const requestData = {
        projetoId: id,
        tipo: tipoMapeado,
        dadosProjeto: {
          ...projetoAtualizado, // Usar o projeto atualizado recarregado do Firestore
          // Adicionar dados do usuário apenas se não existirem no projeto
          portfolio: projetoAtualizado.portfolio || userPortfolio,
          equipeBio: projetoAtualizado.equipeBio || equipeBio,
          dadosCadastrais: projetoAtualizado.dadosCadastrais || dadosCadastrais
        },
        prompt: GERAR_TEXTO_PROMPT + tipoMapeado,
        userId: user?.uid // Adicionar userId para buscar dados do usuário do Firestore
      };
      
      log('Dados da requisição:', { 
        ...requestData, 
        dadosProjeto: '[...]' // Não logar o projeto inteiro
      });
      
      // Debug específico para orçamento
      if (tipo === 'orcamento') {
        log('Gerando orçamento - tipo original:', tipo);
        log('Gerando orçamento - tipo mapeado:', tipoMapeado);
        log('Projeto atualizado data keys:', Object.keys(projetoAtualizado));
        log('Projeto atualizado descricao length:', projetoAtualizado.descricao?.length || 0);
      }
      
      // 6. Envia a requisição
      console.log('[DEBUG] Preparando para enviar requisição...');
      setProgresso('Conectando ao servidor...');
      const startTime = Date.now();
      
      console.log('[DEBUG] Enviando requisição para gerarTextosProjeto');
      console.log('[DEBUG] Request data keys:', Object.keys(requestData));
      
      // Tenta primeiro a nova função, se falhar usa a antiga
      let response;
      try {
        console.log('[DEBUG] Tentando fetch para Firebase Function...');
        response = await fetch('https://us-central1-culturalapp-fb9b0.cloudfunctions.net/gerarTextosProjeto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        });
        console.log('[DEBUG] Resposta recebida do Firebase Function, status:', response.status);
      } catch (err) {
        console.error('[ERROR] Erro ao chamar Firebase Function:', err);
        // Fallback para a URL do Cloud Run
        console.log('[DEBUG] Tentando fallback para Cloud Run...');
        response = await fetch('https://gerartexto-v3odkawqzq-uc.a.run.app', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        });
        console.log('[DEBUG] Resposta recebida do Cloud Run, status:', response.status);
      }
      
      const requestTime = Date.now() - startTime;
      log(`Resposta recebida em ${requestTime}ms`, {
        status: response.status,
        statusText: response.statusText
      });
      console.log(`[${new Date().toISOString()}] Resposta recebida em ${requestTime}ms`, response);
      
      if (!response.ok) {
        let errorData: { error?: string } | null = null;
        try {
          const text = await response.text();
          if (text) {
            errorData = JSON.parse(text) as { error?: string };
          }
        } catch (e) {
          console.error('Erro ao parsear resposta de erro:', e);
        }
        console.error(`[${new Date().toISOString()}] Erro na resposta:`, response.status, errorData);
        const errorMsg = errorData?.error || `Erro ao gerar texto (status: ${response.status})`;
        throw new Error(errorMsg);
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
        const decoder = new TextDecoder('utf-8');
        const reader = response.body?.getReader();
        let generationComplete = false;
        let buffer = '';
        let fullText = '';
        
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
                
                if (data.type === 'chunk' && data.content) {
                  // Append new content to the full text - preserva espaços
                  fullText += data.content;
                  
                  // Update the state with the latest text
                  setTextos(prev => ({
                    ...prev,
                    [tipo]: fullText
                  }));
                  
                  // Update the textarea directly for immediate visual feedback
                  if (textareaRef.current) {
                    textareaRef.current.value = fullText;
                    textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
                  }
                  
                  // Also use requestAnimationFrame to ensure smooth updates
                  requestAnimationFrame(() => {
                    if (textareaRef.current) {
                      textareaRef.current.value = fullText;
                      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
                    }
                  });
                  
                  // Save to Firestore every 3 seconds or when text is complete
                  if (Date.now() % 3000 < 50) { // Roughly every 3 seconds
                    salvarNoFirestore(tipo, fullText).catch(console.error);
                  }
                } else if (data.type === 'complete') {
                  const finalText = data.fullText || fullText;
                  
                  if (finalText) {
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
            if (fullText && fullText.trim()) {
              setTextos(prev => ({
                ...prev,
                [tipo]: fullText
              }));
              await salvarNoFirestore(tipo, fullText);
            } else {
              throw new Error('Nenhum texto foi recebido do servidor');
            }
          }
          
          setGerando(null);
          return true;
          
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
      alert('Por favor, selecione um tipo de texto para gerar.');
      return;
    }
    
    if (gerando) {
      return;
    }
    
    // Show the text box immediately
    setMostrarCaixaTexto(true);
    
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

  // Função para extrair rubricas do texto do orçamento
  const extrairRubricas = (textoOrcamento: string): Array<{ id: string; nome: string; valor: string }> => {
    const rubricas: Array<{ id: string; nome: string; valor: string }> = [];
    
    // Padrões para encontrar rubricas no texto
    // Formato comum: "Nome da Rubrica: R$ 1.000,00" ou "1. Nome da Rubrica - R$ 1.000,00"
    const linhas = textoOrcamento.split('\n');
    
    linhas.forEach((linha, index) => {
      // Remove espaços extras
      const linhaLimpa = linha.trim();
      
      // Padrão 1: "Nome: R$ valor" ou "Nome - R$ valor"
      const padrao1 = /^(.+?)\s*[:\-]\s*R\$\s*([\d.,]+)/i;
      const match1 = linhaLimpa.match(padrao1);
      
      if (match1) {
        const nome = match1[1].trim().replace(/^\d+[\.\)]\s*/, ''); // Remove numeração inicial
        const valor = match1[2].trim();
        if (nome && valor) {
          rubricas.push({
            id: `rubrica-${index}`,
            nome,
            valor: `R$ ${valor}`
          });
        }
      }
      
      // Padrão 2: Linhas que contêm valores monetários
      const padrao2 = /R\$\s*([\d.,]+)/i;
      const match2 = linhaLimpa.match(padrao2);
      
      if (match2 && !match1) {
        // Se não encontrou pelo padrão 1, tenta extrair nome antes do valor
        const partes = linhaLimpa.split(/R\$/i);
        if (partes.length >= 2) {
          const nome = partes[0].trim().replace(/^\d+[\.\)]\s*/, '').replace(/[:\-]\s*$/, '');
          const valor = match2[1].trim();
          if (nome && valor && nome.length > 2) {
            rubricas.push({
              id: `rubrica-${index}`,
              nome,
              valor: `R$ ${valor}`
            });
          }
        }
      }
    });
    
    return rubricas;
  };

  // Atualizar rubricas quando o texto do orçamento mudar
  useEffect(() => {
    if (textoSelecionado && (textoSelecionado.toLowerCase().includes('orcamento') || textoSelecionado.toLowerCase().includes('orçamento'))) {
      const textoOrcamento = textos[textoSelecionado] || '';
      if (textoOrcamento) {
        const rubricasExtraidas = extrairRubricas(textoOrcamento);
        setRubricas(rubricasExtraidas);
      }
    }
  }, [textos, textoSelecionado]);


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
      <div className="flex-1 flex flex-col">
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
                {/* Tipos de texto do edital */}
                {tiposTextoDisponiveis.map((tipo) => {
                  // Capitalizar primeira letra e substituir underscores por espaços
                  const titulo = tipo
                    .split('_')
                    .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
                    .join(' ');
                  
                  return (
                    <button
                      key={tipo}
                      onClick={() => setTextoSelecionado(tipo)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        textoSelecionado === tipo
                          ? 'border-oraculo-blue bg-oraculo-blue/5'
                          : 'border-gray-200 hover:border-oraculo-blue/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {tipo.toLowerCase().includes('orcamento') || tipo.toLowerCase().includes('orçamento') ? (
                          <DollarSign className="h-5 w-5 text-oraculo-blue" />
                        ) : (
                          <FileText className="h-5 w-5 text-oraculo-blue" />
                        )}
                        <span className="font-medium text-gray-800">{titulo}</span>
                        {textos[tipo] && (
                          <CheckCircle className="ml-auto h-5 w-5 text-green-500" />
                        )}
                      </div>
                    </button>
                  );
                })}
                
                {/* Categorias personalizadas */}
                {categoriasCustom.map((categoria) => {
                  return (
                    <button
                      key={categoria}
                      onClick={() => setTextoSelecionado(categoria)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        textoSelecionado === categoria
                          ? 'border-oraculo-purple bg-oraculo-purple/5'
                          : 'border-oraculo-purple/50 hover:border-oraculo-purple'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-oraculo-purple" />
                        <span className="font-medium text-gray-800">{categoria}</span>
                        {textos[categoria] && (
                          <CheckCircle className="ml-auto h-5 w-5 text-green-500" />
                        )}
                      </div>
                    </button>
                  );
                })}
                
                {/* Botão para adicionar categoria personalizada */}
                <button
                  onClick={() => setMostrarInputCategoria(true)}
                  className="p-4 rounded-lg border-2 border-dashed border-oraculo-purple hover:border-oraculo-purple/70 transition-all bg-oraculo-purple/5"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-oraculo-purple" />
                    <span className="font-medium text-oraculo-purple">+ Categoria Personalizada</span>
                  </div>
                </button>
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
                  
                  {/* Botão Editar Rubricas - só aparece para orçamento */}
                  {(textoSelecionado.toLowerCase().includes('orcamento') || textoSelecionado.toLowerCase().includes('orçamento')) && 
                   textos[textoSelecionado] && rubricas.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => setMostrarModalRubricas(true)}
                      className="border-oraculo-purple text-oraculo-purple hover:bg-oraculo-purple/10"
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Editar Rubricas
                    </Button>
                  )}
                  
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
                  <div className="p-4 bg-white border rounded-lg">
                    {gerando === textoSelecionado ? (
                      <div className="relative">
                        <textarea
                          ref={textareaRef}
                          className="w-full min-h-[300px] max-h-[500px] p-4 border rounded text-gray-800 bg-white text-display resize-none overflow-y-auto"
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
                      <>
                        <div className="prose max-w-none">
                          <textarea
                            className="w-full min-h-[300px] max-h-[500px] p-4 border rounded text-gray-800 bg-white resize-none overflow-y-auto"
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
                        
                        {/* Campo para sugestão de alteração */}
                        <div className="mt-8 pt-8 border-t-2 border-gray-200">
                          <h3 className="text-xl font-bold text-gray-900 mb-4">
                            Dê uma sugestão para a IA alterar o texto
                          </h3>
                          <textarea
                            className="w-full border-2 border-gray-300 rounded-lg px-5 py-4 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition min-h-[120px] text-gray-800 leading-relaxed resize-y mb-4"
                            value={sugestaoTexto}
                            onChange={(e) => setSugestaoTexto(e.target.value)}
                            placeholder="Ex: Adicione mais detalhes sobre o cronograma de execução..."
                            disabled={aplicandoSugestao}
                          />
                          <div className="flex justify-end">
                            <Button
                              onClick={async () => {
                                if (!sugestaoTexto.trim()) {
                                  alert('Por favor, digite uma sugestão antes de aplicar.');
                                  return;
                                }

                                setAplicandoSugestao(true);

                                try {
                                  const textoBase = textos[textoSelecionado] || '';
                                  
                                  if (!textoBase.trim()) {
                                    alert('Erro: texto do projeto inválido');
                                    setAplicandoSugestao(false);
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
                                  
                                  const response = await fetch(endpoint, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                      textoAtual: textoBase,
                                      sugestao: sugestaoTexto,
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
                                            setTextos(prev => ({
                                              ...prev,
                                              [textoSelecionado]: novoTexto
                                            }));
                                          }
                                        } catch (e) {
                                          // Ignorar erros de parsing
                                        }
                                      }
                                    }
                                  }
                                  
                                  // Salvar o novo texto no Firestore
                                  if (id && novoTexto.trim()) {
                                    await salvarNoFirestore(textoSelecionado as TextoTipo, novoTexto);
                                  }
                                  
                                  // Limpar o campo de sugestão
                                  setSugestaoTexto('');
                                  
                                } catch (e) {
                                  console.error('Erro ao processar sugestão:', e);
                                  alert(`Erro ao aplicar sugestão: ${e instanceof Error ? e.message : 'Erro desconhecido'}`);
                                } finally {
                                  setAplicandoSugestao(false);
                                }
                              }}
                              disabled={aplicandoSugestao || !sugestaoTexto.trim()}
                              className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white px-6 py-2"
                            >
                              {aplicandoSugestao ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Aplicando...
                                </>
                              ) : (
                                'Aplicar Sugestão'
                              )}
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-500">
                        <p>Selecione um tipo de texto e clique em "Gerar Texto" para começar.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Botões de ação */}
            <div className="mt-8 flex justify-end items-center">
              <Button
                onClick={() => navigate(`/projeto/${id}/criar-orcamento`)}
                className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white px-6 py-3"
                size="lg"
              >
                Próximo: Criar Orçamento
                <DollarSign className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </main>
      </div>
      
      {/* Modal para categoria personalizada */}
      {mostrarInputCategoria && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Criar Categoria Personalizada</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome da Categoria
              </label>
              <input
                type="text"
                value={categoriaPersonalizada}
                onChange={(e) => setCategoriaPersonalizada(e.target.value)}
                placeholder="Ex: Parcerias, Contrapartida, etc."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-oraculo-purple focus:border-oraculo-purple outline-none"
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  if (categoriaPersonalizada.trim()) {
                    const novaCategoria = categoriaPersonalizada.trim();
                    setCategoriasCustom([...categoriasCustom, novaCategoria]);
                    setTextoSelecionado(novaCategoria);
                    setTextos({ ...textos, [novaCategoria]: '' });
                    setCategoriaPersonalizada('');
                    setMostrarInputCategoria(false);
                  }
                }}
                className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white"
              >
                Adicionar
              </Button>
              <Button
                onClick={() => {
                  setCategoriaPersonalizada('');
                  setMostrarInputCategoria(false);
                }}
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Edição de Rubricas */}
      <Dialog open={mostrarModalRubricas} onOpenChange={setMostrarModalRubricas}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Rubricas</DialogTitle>
            <DialogDescription>
              Edite o nome e o valor de cada rubrica do orçamento
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {rubricas.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Nenhuma rubrica encontrada no texto do orçamento.
              </p>
            ) : (
              rubricas.map((rubrica) => (
                <div key={rubrica.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <div>
                      <Label htmlFor={`nome-${rubrica.id}`}>Nome da Rubrica</Label>
                      <Input
                        id={`nome-${rubrica.id}`}
                        value={rubrica.nome}
                        onChange={(e) => {
                          setRubricas(prev => 
                            prev.map(r => r.id === rubrica.id ? { ...r, nome: e.target.value } : r)
                          );
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`valor-${rubrica.id}`}>Valor</Label>
                      <Input
                        id={`valor-${rubrica.id}`}
                        value={rubrica.valor}
                        onChange={(e) => {
                          let valor = e.target.value;
                          // Garantir formato R$ se não tiver
                          if (!valor.startsWith('R$')) {
                            valor = `R$ ${valor}`;
                          }
                          setRubricas(prev => 
                            prev.map(r => r.id === rubrica.id ? { ...r, valor } : r)
                          );
                        }}
                        className="mt-1"
                        placeholder="R$ 0,00"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setMostrarModalRubricas(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                // Atualizar o texto do orçamento com as rubricas editadas
                if (textoSelecionado && textos[textoSelecionado]) {
                  let textoAtualizado = textos[textoSelecionado];
                  
                  // Substituir cada rubrica no texto
                  rubricas.forEach(rubrica => {
                    // Buscar padrões comuns e substituir
                    const padroes = [
                      new RegExp(`(${rubrica.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]*?R\\$[^\\n]*)`, 'gi'),
                      new RegExp(`(\\d+[\.\\)]?\\s*${rubrica.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]*?R\\$[^\\n]*)`, 'gi')
                    ];
                    
                    padroes.forEach(padrao => {
                      textoAtualizado = textoAtualizado.replace(padrao, `${rubrica.nome}: ${rubrica.valor}`);
                    });
                  });
                  
                  setTextos(prev => ({
                    ...prev,
                    [textoSelecionado]: textoAtualizado
                  }));
                  
                  // Salvar no Firestore
                  salvarNoFirestore(textoSelecionado as TextoTipo, textoAtualizado);
                }
                
                setMostrarModalRubricas(false);
              }}
              className="bg-oraculo-blue hover:bg-oraculo-blue/90 text-white"
            >
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GerarTextos;
