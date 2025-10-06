

import React, { useEffect, useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Brain, FileText, Target, Lightbulb, FolderOpen, Calendar, MapPin, Clock, DollarSign, Plus, Trash2 } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, query, where, addDoc, deleteDoc, doc, orderBy, limit, Timestamp } from 'firebase/firestore';
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


const OraculoAI = () => {
  // Novo state para os editais vindos do Firestore
  const [editaisAbertos, setEditaisAbertos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setLoadingProjetos(true);
        
        // Fetch Editais
        const editaisSnapshot = await getDocs(collection(db, "editais"));
        const editais: Edital[] = [];
        const now = new Date();
        
        editaisSnapshot.forEach((doc) => {
          const edital = { id: doc.id, ...doc.data() } as Edital;
          
          if (edital.deadline) {
            let deadlineDate: Date;
            
            if (edital.deadline && typeof edital.deadline === 'object' && 'toDate' in edital.deadline) {
              deadlineDate = edital.deadline.toDate();
            } else if (edital.deadline && typeof edital.deadline === 'object' && 'seconds' in edital.deadline) {
              deadlineDate = new Date(edital.deadline.seconds * 1000);
            } else if (typeof edital.deadline === 'string') {
              deadlineDate = new Date(edital.deadline);
            } else {
              deadlineDate = new Date();
            }
            
            if (!isNaN(deadlineDate.getTime()) && deadlineDate >= now) {
              editais.push(edital);
            }
          } else {
            editais.push(edital);
          }
        });
        
        setEditaisAbertos(editais);
        
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
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
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

  const handleDeleteEdital = async (editalId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este edital?')) {
      try {
        await deleteDoc(doc(db, 'editais', editalId));
        setEditaisAbertos(editaisAbertos.filter(edital => edital.id !== editalId));
        alert('Edital excluído com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir edital:', error);
        alert('Erro ao excluir edital. Tente novamente.');
      }
    }
  };

  const getPrioridade = (diffDays: number) => {
    if (diffDays <= 3) return { label: 'Alta', color: 'bg-red-500' };
    if (diffDays <= 7) return { label: 'Média', color: 'bg-oraculo-gold' };
    if (diffDays > 7) return { label: 'Baixa', color: 'bg-green-500' };
    return { label: '', color: 'bg-gray-500' };
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
      
      <div className="flex-1 flex flex-col md:ml-64">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
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
                    <Link to={`/projeto/${projeto.id}`} key={projeto.id || index} className="block hover:no-underline">
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
                  ))
                )}
              </div>
            </div>

            {/* Seção Editais Abertos */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="h-6 w-6 text-oraculo-magenta" />
                  Editais Abertos
                </h2>
                <Button variant="outline">
                  Ver todos os editais
                </Button>
                {user && (
                  <Button className="ml-2 bg-oraculo-blue text-white" onClick={() => setOpenCadastro(true)}>
                    Cadastrar Edital
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {loading ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oraculo-blue"></div>
                    <span className="ml-2">Carregando editais...</span>
                  </div>
                ) : editaisAbertos.length === 0 ? (
                  <div className="text-center p-4 text-gray-500">
                    Nenhum edital aberto no momento.
                  </div>
                ) : (
                  editaisAbertos.map((edital, index) => {let diffDays = null;
                    if (edital.deadline) {
                      let deadlineDate: Date;
                      if (typeof edital.deadline === 'object' && 'seconds' in edital.deadline) {
                        // Handle Firestore Timestamp
                        deadlineDate = new Date(edital.deadline.seconds * 1000);
                      } else if (typeof edital.deadline === 'string') {
                        // Handle string date
                        deadlineDate = new Date(edital.deadline);
                      } else {
                        // Handle other cases or throw an error
                        console.error('Unexpected deadline format:', edital.deadline);
                        return null; // or handle the error case appropriately
                      }
                      const now = new Date();
                      const diffTime = deadlineDate.getTime() - now.getTime();
                      diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    }
                    const prioridade = diffDays !== null ? getPrioridade(diffDays) : null;
                    return (
                      <Card key={edital.id || index} className="relative hover:shadow-lg transition-shadow cursor-pointer">
                      {/* Action Buttons - Only visible to admin */}
                      {user?.uid === 'sCacAc0ShPfafYjpy0t4pBp77Tb2' && (
                        <div className="absolute top-2 right-2 flex gap-1 z-10">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              // Navigate to edit page with edital ID
                              navigate(`/editar-edital/${edital.id}`);
                            }}
                            className="p-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 transition-colors"
                            title="Editar edital"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEdital(edital.id);
                            }}
                            className="p-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 transition-colors"
                            title="Excluir edital"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between mb-2">
                          <CardTitle className="text-lg flex-1">{edital.nome || 'Edital sem nome'}</CardTitle>
                          {prioridade && prioridade.label && (
                            <Badge className={`${prioridade.color} text-white`}>
                              Prioridade: {prioridade.label}
                            </Badge>
                          )}
                        </div>
                        {edital.descricao && (
                          <p className="text-sm text-gray-600 mb-2">{edital.descricao}</p>
                        )}
                        <div className="flex items-center text-sm text-gray-500 gap-4">
                          {edital.data_encerramento && (
                            <span className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              {edital.data_encerramento?.toDate ? 
                                edital.data_encerramento.toDate().toLocaleDateString('pt-BR') :
                                new Date(edital.data_encerramento).toLocaleDateString('pt-BR')
                              }
                            </span>
                          )}
                          {edital.valor_maximo_premiacao && (
                            <span className="flex items-center">
                              <DollarSign className="h-4 w-4 mr-1" />
                              {edital.valor_maximo_premiacao}
                            </span>
                          )}
                        </div>
                      </CardHeader>
                    </Card>
                    );
                  })
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-oraculo-magenta" />
                    Análise de Editais
                  </CardTitle>
                  <CardDescription>
                    Cole o texto do edital e receba insights estratégicos
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5 text-oraculo-blue" />
                    Desenvolvimento de Propostas
                  </CardTitle>
                  <CardDescription>
                    Crie propostas alinhadas com os critérios do edital
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lightbulb className="h-5 w-5 text-oraculo-gold" />
                    Otimização de Estratégias
                  </CardTitle>
                  <CardDescription>
                    Melhore suas chances de aprovação
                  </CardDescription>
                </CardHeader>
              </Card>
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
    </div>
  );
};

export default OraculoAI;
