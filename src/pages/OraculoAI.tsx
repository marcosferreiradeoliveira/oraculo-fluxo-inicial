

import React, { useEffect, useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Brain, FileText, FolderOpen, Calendar, MapPin, Clock, DollarSign, Plus, Trash2 } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, query, where, addDoc, deleteDoc, doc, orderBy, limit, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
// Remover qualquer configuração do workerSrc para o CDN
// pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
import { useAuthState } from 'react-firebase-hooks/auth';
import emailImage from '@/assets/email.png';

interface DadosExtraidos {
  data_encerramento?: string | null;
  // Add other fields that might be present in dadosExtraidos
  [key: string]: any;
}

interface Edital {
  id: string;
  deadline?: {
    seconds: number;
    nanoseconds: number;
    toDate: () => Date;
  } | string | null;
  titulo?: string;
  descricao?: string;
  data_encerramento?: any; // Add data_encerramento to the Edital interface
  pdf_url?: string;
  criado_em?: any;
}


// Função para capitalizar apenas a primeira letra do título
const capitalizarTitulo = (titulo: string): string => {
  if (!titulo) return '';
  // Converte para minúsculas e depois capitaliza a primeira letra
  return titulo.charAt(0).toUpperCase() + titulo.slice(1).toLowerCase();
};

const OraculoAI = () => {
  const [meusProjetos, setMeusProjetos] = useState<any[]>([]);
  const [loadingProjetos, setLoadingProjetos] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const [openCadastro, setOpenCadastro] = useState(false);
  const [nomeEdital, setNomeEdital] = useState('');
  const [pdfEdital, setPdfEdital] = useState<File | null>(null);
  const [analiseAprovados, setAnaliseAprovados] = useState('');
  const [cadastrando, setCadastrando] = useState(false);
  // Remover campo de upload de PDF de análise dos aprovados
  // const [analiseAprovadosPdf, setAnaliseAprovadosPdf] = useState<File | null>(null);
  // const [analiseAprovadosTexto, setAnaliseAprovadosTexto] = useState('');
  const [etapaLog, setEtapaLog] = useState<string[]>([]);
  const [resumoEdital, setResumoEdital] = useState<any | null>(null);
  const [user] = useAuthState(auth);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [emailNewsletter, setEmailNewsletter] = useState('');
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const [mostrarModalApagar, setMostrarModalApagar] = useState(false);
  const [projetoParaApagar, setProjetoParaApagar] = useState<string | null>(null);
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('');

  // Função para abrir modal de confirmação de exclusão
  const abrirModalApagar = (projetoId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setProjetoParaApagar(projetoId);
    setConfirmacaoTexto('');
    setMostrarModalApagar(true);
  };

  // Função para deletar um projeto
  const handleDeleteProjeto = async () => {
    if (!user || !projetoParaApagar) return;
    
    if (confirmacaoTexto.toLowerCase().trim() !== 'apagar') {
      toast.error('Por favor, digite "apagar" para confirmar a exclusão.');
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'projetos', projetoParaApagar));
      // Atualiza a lista de projetos após a exclusão
      setMeusProjetos(prev => prev.filter(proj => proj.id !== projetoParaApagar));
      toast.success('Projeto excluído com sucesso!');
      setMostrarModalApagar(false);
      setProjetoParaApagar(null);
      setConfirmacaoTexto('');
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      toast.error('Erro ao excluir o projeto. Tente novamente.');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingProjetos(true);
        
        // Fetch Projetos
        if (user) {
          console.log('Buscando projetos para o usuário:', user.uid);
          try {
            const projetosRef = collection(db, 'projetos');
            const q = query(
              projetosRef,
              where('user_id', '==', user.uid)
            );
            
            console.log('Query criada:', q);
            const projetosSnapshot = await getDocs(q);
            console.log('Documentos encontrados:', projetosSnapshot.docs.length);
            
            const projetos = projetosSnapshot.docs.map(doc => {
              const data = doc.data();
              console.log(`Projeto ${doc.id}:`, data);
              return {
                id: doc.id,
                ...data
              };
            });
            
            console.log('Projetos carregados:', projetos);
            setMeusProjetos(projetos);
          } catch (error) {
            console.error('Erro ao buscar projetos:', error);
          }
        }
      } catch (error) {
        console.error("Error fetching projetos:", error);
      } finally {
        setLoadingProjetos(false);
      }
    };
    
    fetchData();
    
    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      if (user) {
        // Refresh projects when auth state changes
        fetchData();
      } else {
        setMeusProjetos([]);
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [user]);

  const getDificuldadeColor = (dificuldade: string) => {
    switch (dificuldade) {
      case 'Baixa': return 'bg-green-500';
      case 'Média': return 'bg-oraculo-gold';
      case 'Alta': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };


  const handleCadastrarEdital = async () => {
    setCadastrando(true);
    setEtapaLog(["Iniciando cadastro do edital..."]);
    setResumoEdital(null); // Limpa resumo anterior
    try {
      setEtapaLog(log => [...log, "Fazendo upload do PDF..."]);
      // 1. Upload do PDF para o Storage
      const storage = getStorage();
      const pdfRef = storageRef(storage, `editais/${Date.now()}_${pdfEdital?.name}`);
      await uploadBytes(pdfRef, pdfEdital!);
      const pdfUrl = await getDownloadURL(pdfRef);

      setEtapaLog(log => [...log, "Extraindo texto do PDF..."]);
      // 2. Extrair texto do PDF no frontend usando pdfjs-dist
      const arrayBuffer = await pdfEdital!.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let textoExtraido = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        textoExtraido += content.items
          .filter((item: any) => typeof item.str === 'string')
          .map((item: any) => item.str)
          .join(' ') + '\n';
      }
      if (textoExtraido.length > 10000) {
        textoExtraido = textoExtraido.slice(0, 10000);
      }

      // Remover geração e etapa de análise dos aprovados com IA
      // setEtapaLog(log => [...log, "Gerando análise dos aprovados com IA..."]);
      // const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY, dangerouslyAllowBrowser: true });
      // let analiseAprovadosTextoFinal = '';
      // const promptAprovados = `...`;
      // const completionAprovados = await openai.chat.completions.create({ ... });
      // analiseAprovadosTextoFinal = completionAprovados.choices[0].message?.content || '';

      setEtapaLog(log => [...log, "Extraindo campos do edital com IA..."]);
      // Novo prompt detalhado conforme instruções do usuário
      const prompt = `Extraia do texto do edital abaixo apenas as seguintes informações cruciais, no formato JSON com as chaves: nome, escopo, criterios, categorias, data_encerramento, textos_exigidos (array), valor_maximo_premiacao.\n\nRegras para extração:\n- O campo 'data_encerramento' geralmente está no artigo ou seção chamada 'Inscrição', mas também pode aparecer como 'Período de inscrições', 'Prazo para inscrição', 'Datas importantes', 'Cronograma', ou menções a datas finais para envio de propostas.\n- Os 'criterios' geralmente estão em 'Critérios de avaliação', mas também podem aparecer como 'Avaliação', 'Julgamento', 'Parâmetros de avaliação', 'Pontuação', ou tabelas/listas de critérios.\n- O 'valor_maximo_premiacao' geralmente está em 'Recursos Financeiros', mas pode aparecer como 'Valor total disponível', 'Valor máximo por projeto', 'Premiação', 'Recursos destinados', 'Montante', ou menções a valores em reais (R$).\n- O campo 'nome' não pode ser 'Edital de chamada pública' ou similar, mas sim o nome subsequente, mais específico.\n- Para 'textos_exigidos', coloque automaticamente: Resumo, Objetivos, Justificativa, Plano de Divulgação, Plano de Acessibilidade, Plano de Democratização do Acesso, Medidas de Sustentabilidade.\n- Se algum campo não for encontrado, retorne uma string vazia.\n\nExemplo de saída:\n{\n  "nome": "Prêmio Cultura Viva 2024",\n  "escopo": "Fomento a projetos culturais de impacto social",\n  "criterios": "Adequação ao tema, relevância social, viabilidade técnica, originalidade",\n  "categorias": "Artes Visuais, Música, Teatro",\n  "data_encerramento": "15/08/2024",\n  "textos_exigidos": ["Resumo", "Objetivos", "Justificativa", "Plano de Divulgação", "Plano de Acessibilidade", "Plano de Democratização do Acesso", "Medidas de Sustentabilidade"],\n  "valor_maximo_premiacao": "R$ 100.000,00"\n}\n\nTexto do edital:\n${textoExtraido}`;
      const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY, dangerouslyAllowBrowser: true });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Você é um especialista em editais culturais.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1200,
        temperature: 0.2,
      });
      let dadosExtraidos: DadosExtraidos = {};
      try {
        dadosExtraidos = JSON.parse(completion.choices[0].message?.content || '{}');
      } catch {
        dadosExtraidos = { erro: 'Não foi possível extrair os dados.' };
      }

      setEtapaLog(log => [...log, "Salvando edital no Firestore..."]);
      // 4. Salvar no Firestore
      const editalData: any = {
        ...dadosExtraidos,
        pdf_url: pdfUrl,
        criado_em: Timestamp.now(),
      };

      // Convert data_encerramento to Timestamp if it exists
      if (editalData.data_encerramento) {
        const dataEncerramento = new Date(editalData.data_encerramento);
        if (!isNaN(dataEncerramento.getTime())) {
          editalData.data_encerramento = Timestamp.fromDate(dataEncerramento);
        } else {
          console.warn('Formato de data inválido:', editalData.data_encerramento);
          delete editalData.data_encerramento; // Remove invalid date
        }
      }

      const docRef = await addDoc(collection(db, 'editais'), editalData);
      setEtapaLog(log => [...log, "Cadastro concluído!"]);
      
      // Recarregar a página após 1.5 segundos para mostrar a mensagem de sucesso
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
      const newEdital = {
        ...dadosExtraidos,
        pdf_url: pdfUrl,
      };
      setResumoEdital(newEdital);
      setPdfEdital(null);
      setOpenCadastro(false); // Close the modal after successful registration
    } catch (e) {
      setEtapaLog(log => [...log, 'Erro: ' + (e as any).message]);
      alert('Erro ao cadastrar edital: ' + (e as any).message);
    } finally {
      setCadastrando(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8 overflow-y-auto min-h-0">
          <div className="max-w-7xl mx-auto min-w-0">
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <Brain className="h-8 w-8 text-oraculo-blue" />
                Oráculo AI
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Utilize nossa inteligência artificial para analisar editais e maximizar suas chances de aprovação.
              </p>
            </div>

            {/* Seção Meus Projetos Culturais */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FolderOpen className="h-6 w-6 text-oraculo-blue" />
                  Meus Projetos Culturais
                </h2>
                {meusProjetos.length > 0 && (
                  <Button className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90" onClick={() => {
                    if (!user) {
                      setShowAuthModal(true);
                    } else {
                      navigate('/criar-projeto');
                    }
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Projeto
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {loadingProjetos ? (
                  <div className="flex items-center justify-center p-4 col-span-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oraculo-blue"></div>
                    <span className="ml-2">Carregando projetos...</span>
                  </div>
                ) : !user ? (
                  <div className="flex flex-col items-start gap-1">
                    <span>Nenhum projeto ainda.</span>
                    <span className="text-base font-bold">Crie seu primeiro projeto com a ajuda da IA</span>
                    <Button className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90" onClick={() => {
                      if (!user) {
                        setShowAuthModal(true);
                      } else {
                        navigate('/criar-projeto');
                      }
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Projeto
                    </Button>
                  </div>
                ) : meusProjetos && meusProjetos.length === 0 ? (
                  <div className="col-span-3 text-center">
                    <p className="text-gray-600 mb-4">Você ainda não tem nenhum projeto cadastrado.</p>
                    <Button 
                      className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
                      onClick={() => navigate('/criar-projeto')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Primeiro Projeto
                    </Button>
                  </div>
                ) : (
                  meusProjetos.map((projeto, index) => (
                    <div key={projeto.id || index} className="relative group">
                      <Link to={`/projeto/${projeto.id}`} className="block hover:no-underline">
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-lg mb-2">{projeto.nome}</CardTitle>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm font-medium">{projeto.status}</span>
                                </div>
                              </div>
                            </div>
                            <CardDescription className="space-y-1">
                              <div className="flex items-center gap-1 text-xs">
                                <FileText className="h-3 w-3" />
                                {projeto.edital_associado || 'Sem edital associado'}
                              </div>
                              <div className="flex items-center gap-1 text-xs">
                                <span className="w-2 h-2 rounded-full bg-oraculo-blue inline-block mr-1"></span>
                                <span className="font-semibold">Setor:</span> {projeto.categoria}
                              </div>
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </Link>
                      <button
                        onClick={(e) => abrirModalApagar(projeto.id, e)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600 z-10"
                        title="Excluir projeto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Formulário de cadastro de email para receber editais */}
            <div className="mt-8 bg-gradient-to-r from-oraculo-blue/10 to-oraculo-purple/10 rounded-xl p-4 md:p-6 border-2 border-oraculo-blue/20">
                <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
                  <div className="flex-1 w-full md:w-auto">
                    <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2 md:mb-3">
                      Receba em seu email os últimos editais
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 mb-4 md:mb-4">
                      Todo o conteúdo é destrinchado por nossa inteligência artificial, facilitando sua compreensão e aumentando suas chances de aprovação
                    </p>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!emailNewsletter.trim()) {
                          toast.error('Por favor, insira um email válido');
                          return;
                        }
                        
                        // Validar formato de email
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(emailNewsletter.trim())) {
                          toast.error('Por favor, insira um email válido');
                          return;
                        }
                        
                        setSalvandoEmail(true);
                        try {
                          // Salvar email no Firestore
                          await addDoc(collection(db, 'newsletter_emails'), {
                            email: emailNewsletter.trim(),
                            userId: user?.uid || null,
                            criadoEm: Timestamp.now(),
                            origem: 'editais_abertos'
                          });
                          
                          // Adicionar email ao Brevo
                          try {
                            console.log('[Newsletter] Chamando função Brevo para:', emailNewsletter.trim());
                            const response = await fetch('https://adicionarcontatobrevo-v3odkawqzq-uc.a.run.app', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                email: emailNewsletter.trim(),
                                nome: user?.displayName || null,
                                listId: 15
                              })
                            });
                            
                            console.log('[Newsletter] Resposta do Brevo - Status:', response.status);
                            const result = await response.json();
                            console.log('[Newsletter] Resposta do Brevo - Body:', result);
                            
                            if (!response.ok) {
                              console.error('[Newsletter] Erro ao adicionar ao Brevo:', result);
                              // Não bloquear o fluxo se o Brevo falhar, mas logar o erro
                            } else {
                              console.log('[Newsletter] Email adicionado ao Brevo com sucesso');
                            }
                          } catch (brevoError: any) {
                            console.error('[Newsletter] Erro ao chamar função Brevo:', brevoError);
                            console.error('[Newsletter] Detalhes do erro:', brevoError.message, brevoError.stack);
                            // Não bloquear o fluxo se o Brevo falhar
                          }
                          
                          toast.success('Email cadastrado com sucesso! Você receberá os editais mais recentes.');
                          setEmailNewsletter('');
                        } catch (error) {
                          console.error('Erro ao salvar email:', error);
                          toast.error('Erro ao cadastrar email. Tente novamente.');
                        } finally {
                          setSalvandoEmail(false);
                        }
                      }}
                      className="flex flex-col gap-2 max-w-md"
                    >
<Input
                      type="email"
                      placeholder="Seu melhor email"
                      value={emailNewsletter}
                      onChange={(e) => setEmailNewsletter(e.target.value)}
                      className="text-sm bg-white border-gray-200"
                      disabled={salvandoEmail}
                      required
                    />
                      <Button
                        type="submit"
                        className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white px-4 py-2 whitespace-nowrap text-sm w-1/2"
                        disabled={salvandoEmail}
                      >
                        {salvandoEmail ? 'Cadastrando...' : 'Cadastrar'}
                      </Button>
                    </form>
                  </div>
                  <div className="flex-shrink-0">
                    <img 
                      src={emailImage} 
                      alt="Editais culturais" 
                      className="w-32 h-32 md:w-48 md:h-48 object-contain rounded-lg"
                    />
                  </div>
                </div>
            </div>

            {/* Exibir resumo do edital extraído diretamente na página, fora do Dialog */}
            {resumoEdital && (
              <div className="mb-8">
                <div className="mb-2 text-lg font-bold text-oraculo-blue">Resumo do Edital Extraído</div>
                <div className="bg-gray-50 border rounded-lg p-4 space-y-2">
                  <div><span className="font-semibold">Nome:</span> {resumoEdital.nome || <span className="text-gray-400">(não encontrado)</span>}</div>
                  <div><span className="font-semibold">Escopo:</span> {resumoEdital.escopo || <span className="text-gray-400">(não encontrado)</span>}</div>
                  <div><span className="font-semibold">Critérios:</span> {resumoEdital.criterios || <span className="text-gray-400">(não encontrado)</span>}</div>
                  <div><span className="font-semibold">Categorias:</span> {resumoEdital.categorias || <span className="text-gray-400">(não encontrado)</span>}</div>
                  <div><span className="font-semibold">Data de Encerramento:</span> {resumoEdital.data_encerramento || <span className="text-gray-400">(não encontrado)</span>}</div>
                  <div><span className="font-semibold">Valor Máximo de Premiação:</span> {resumoEdital.valor_maximo_premiacao || <span className="text-gray-400">(não encontrado)</span>}</div>
                  <div><span className="font-semibold">Textos Exigidos:</span> {Array.isArray(resumoEdital.textos_exigidos) ? resumoEdital.textos_exigidos.join(', ') : resumoEdital.textos_exigidos || <span className="text-gray-400">(não encontrado)</span>}</div>
                  <div className="mt-2 flex gap-2">
                    <a href={resumoEdital.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">Ver PDF do Edital</a>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/editar-edital/${resumoEdital.id || ''}`)}>Editar Edital</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal de Cadastro de Edital */}
      <Dialog open={openCadastro} onOpenChange={setOpenCadastro}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Edital</DialogTitle>
            <DialogDescription>Preencha as informações do edital e envie o PDF. A IA irá extrair os dados cruciais automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Remover campo de input manual para Nome do Edital */}
            <div>
              <label htmlFor="pdf-edital-upload">
                <Button asChild type="button" className="mb-2">
                  <span>Selecionar PDF do Edital</span>
                </Button>
              </label>
              <input
                id="pdf-edital-upload"
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={e => setPdfEdital(e.target.files?.[0] || null)}
              />
              {pdfEdital && (
                <span className="ml-2 text-sm text-gray-700">{pdfEdital.name}</span>
              )}
            </div>
            <Button className="w-full" onClick={handleCadastrarEdital} disabled={cadastrando || !pdfEdital}>
              {cadastrando ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
            {cadastrando && (
              <div className="mt-4 flex flex-col gap-2 items-start">
                <span className="flex items-center gap-2 text-oraculo-blue font-medium animate-pulse">⏳ Processando etapas do cadastro...</span>
                <ul className="text-xs bg-gray-50 border rounded p-2 w-full">
                  {etapaLog.map((etapa, idx) => (
                    <li key={idx} className="mb-1">{etapa}</li>
                  ))}
                </ul>
              </div>
            )}
            {/* Não exibir resumo do edital extraído dentro do Dialog/modal */}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle>Crie sua conta</DialogTitle>
            <DialogDescription>
              Para criar um novo projeto, é preciso estar logado.
            </DialogDescription>
          </DialogHeader>
          <Button className="mt-4 w-full bg-oraculo-blue text-white" onClick={() => {
            setShowAuthModal(false);
            navigate('/cadastro');
          }}>
            OK
          </Button>
        </DialogContent>
      </Dialog>

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
              <label htmlFor="confirmacao" className="text-sm font-medium text-gray-700">
                Digite <span className="font-bold text-red-600">"apagar"</span> para confirmar:
              </label>
              <Input
                id="confirmacao"
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
                setProjetoParaApagar(null);
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

export default OraculoAI;
