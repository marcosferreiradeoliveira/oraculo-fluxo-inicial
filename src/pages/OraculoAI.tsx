
import React, { useEffect, useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Brain, FileText, Target, Lightbulb, FolderOpen, Calendar, MapPin, Clock, DollarSign, Plus } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
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

  useEffect(() => {
    const fetchEditais = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, "editais"));
        const editais: any[] = [];
        querySnapshot.forEach((doc) => {
          editais.push({ id: doc.id, ...doc.data() });
        });
        setEditaisAbertos(editais);
      } catch (error) {
        console.error("Erro ao buscar editais:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEditais();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoggedIn(true);
        setLoadingProjetos(true);
        const q = query(
          collection(db, "projetos"),
          where("user_id", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);
        const projetos: any[] = [];
        querySnapshot.forEach((doc) => {
          projetos.push({ id: doc.id, ...doc.data() });
        });
        setMeusProjetos(projetos);
        setLoadingProjetos(false);
      } else {
        setIsLoggedIn(false);
        setMeusProjetos([]);
        setLoadingProjetos(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const getDificuldadeColor = (dificuldade: string) => {
    switch (dificuldade) {
      case 'Baixa': return 'bg-green-500';
      case 'Média': return 'bg-oraculo-gold';
      case 'Alta': return 'bg-red-500';
      default: return 'bg-gray-500';
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

      setEtapaLog(log => [...log, "Gerando análise dos aprovados com IA..."]);
      // Criar instância do OpenAI antes de qualquer uso
      const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY, dangerouslyAllowBrowser: true });
      // 2b. Gerar análise dos aprovados com a IA
      let analiseAprovadosTextoFinal = '';
      const promptAprovados = `Com base no edital abaixo, gere uma análise simulada de projetos aprovados, destacando os principais pontos que costumam ser valorizados, exemplos de boas práticas e estratégias vencedoras. Seja objetivo e use linguagem de avaliador de editais.\n\nEDITAL:\n${textoExtraido}`;
      const completionAprovados = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Você é um avaliador de editais culturais.' },
          { role: 'user', content: promptAprovados },
        ],
        max_tokens: 800,
        temperature: 0.3,
      });
      analiseAprovadosTextoFinal = completionAprovados.choices[0].message?.content || '';

      setEtapaLog(log => [...log, "Extraindo campos do edital com IA..."]);
      // Novo prompt detalhado conforme instruções do usuário
      const prompt = `Extraia do texto do edital abaixo apenas as seguintes informações cruciais, no formato JSON com as chaves: nome, escopo, criterios, categorias, data_encerramento, textos_exigidos (array), valor_maximo_premiacao.\n\nRegras para extração:\n- O campo 'data_encerramento' geralmente está no artigo ou seção chamada 'Inscrição', mas também pode aparecer como 'Período de inscrições', 'Prazo para inscrição', 'Datas importantes', 'Cronograma', ou menções a datas finais para envio de propostas.\n- Os 'criterios' geralmente estão em 'Critérios de avaliação', mas também podem aparecer como 'Avaliação', 'Julgamento', 'Parâmetros de avaliação', 'Pontuação', ou tabelas/listas de critérios.\n- O 'valor_maximo_premiacao' geralmente está em 'Recursos Financeiros', mas pode aparecer como 'Valor total disponível', 'Valor máximo por projeto', 'Premiação', 'Recursos destinados', 'Montante', ou menções a valores em reais (R$).\n- O campo 'nome' não pode ser 'Edital de chamada pública' ou similar, mas sim o nome subsequente, mais específico.\n- Para 'textos_exigidos', coloque automaticamente: Resumo, Objetivos, Justificativa, Plano de Divulgação, Plano de Acessibilidade, Plano de Democratização do Acesso, Medidas de Sustentabilidade.\n- Se algum campo não for encontrado, retorne uma string vazia.\n\nExemplo de saída:\n{\n  "nome": "Prêmio Cultura Viva 2024",\n  "escopo": "Fomento a projetos culturais de impacto social",\n  "criterios": "Adequação ao tema, relevância social, viabilidade técnica, originalidade",\n  "categorias": "Artes Visuais, Música, Teatro",\n  "data_encerramento": "15/08/2024",\n  "textos_exigidos": ["Resumo", "Objetivos", "Justificativa", "Plano de Divulgação", "Plano de Acessibilidade", "Plano de Democratização do Acesso", "Medidas de Sustentabilidade"],\n  "valor_maximo_premiacao": "R$ 100.000,00"\n}\n\nTexto do edital:\n${textoExtraido}`;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Você é um especialista em editais culturais.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1200,
        temperature: 0.2,
      });
      let dadosExtraidos = {};
      try {
        dadosExtraidos = JSON.parse(completion.choices[0].message?.content || '{}');
      } catch {
        dadosExtraidos = { erro: 'Não foi possível extrair os dados.' };
      }

      setEtapaLog(log => [...log, "Salvando edital no Firestore..."]);
      // 4. Salvar no Firestore
      const docRef = await addDoc(collection(db, 'editais'), {
        pdf_url: pdfUrl,
        analise_aprovados_texto: analiseAprovadosTextoFinal,
        ...dadosExtraidos,
        criado_em: new Date(),
      });
      setEtapaLog(log => [...log, "Cadastro concluído!"]);
      setResumoEdital({
        ...dadosExtraidos,
        analise_aprovados_texto: analiseAprovadosTextoFinal,
        pdf_url: pdfUrl,
      });
      // Não fecha o modal nem redireciona imediatamente
      setPdfEdital(null);
      // Remover o navigate daqui, só redirecionar se o usuário clicar em editar
      // navigate(`/editar-edital/${docRef.id}`);
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
      
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        
        <main className="flex-1 p-8 animate-fade-in">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <Brain className="h-8 w-8 text-oraculo-blue" />
                Oráculo AI
              </h1>
              <p className="text-gray-600">
                Sua inteligência artificial especializada em projetos culturais. Analise editais, desenvolva propostas e otimize suas estratégias.
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
                  <Button className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90" onClick={() => navigate('/criar-projeto')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Projeto
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {loadingProjetos ? (
                  <p>Carregando projetos...</p>
                ) : isLoggedIn === false ? (
                  <div className="flex flex-col items-start gap-1">
                    <span>Nenhum projeto ainda.</span>
                    <span className="text-base font-bold">Crie seu primeiro projeto com a ajuda da IA</span>
                    <Button className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90" onClick={() => navigate('/criar-projeto')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Projeto
                    </Button>
                  </div>
                ) : meusProjetos.length === 0 ? (
                  <div className="flex flex-col items-start gap-2">
                    <p>Projetos não encontrados. Crie seu primeiro projeto</p>
                    <Button className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90" onClick={() => navigate('/criar-projeto')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Projeto
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
                <Button className="ml-2 bg-oraculo-blue text-white" onClick={() => setOpenCadastro(true)}>
                  Cadastrar Edital
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {loading ? (
                  <p>Carregando editais...</p>
                ) : (
                  editaisAbertos.map((edital, index) => {
                    let diffDays = null;
                    if (edital.deadline) {
                      let deadlineDate;
                      if (edital.deadline.seconds) {
                        deadlineDate = new Date(edital.deadline.seconds * 1000);
                      } else {
                        deadlineDate = new Date(edital.deadline);
                      }
                      const now = new Date();
                      const diffTime = deadlineDate.getTime() - now.getTime();
                      diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    }
                    const prioridade = diffDays !== null ? getPrioridade(diffDays) : null;
                    return (
                      <Card key={edital.id || index} className="hover:shadow-lg transition-shadow cursor-pointer">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between mb-2">
                            <CardTitle className="text-lg flex-1">{edital.nome}</CardTitle>
                            {/* Badge de prioridade automática */}
                            {prioridade && prioridade.label && (
                              <Badge className={`${prioridade.color} text-white`}>
                                Prioridade: {prioridade.label}
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="space-y-2">
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3" />
                              {edital.institution}
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {typeof edital.value === 'number' ? edital.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : edital.value}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {(() => {
                                  if (!edital.deadline) return null;
                                  let deadlineDate;
                                  if (edital.deadline.seconds) {
                                    deadlineDate = new Date(edital.deadline.seconds * 1000);
                                  } else {
                                    deadlineDate = new Date(edital.deadline);
                                  }
                                  const now = new Date();
                                  const diffTime = deadlineDate.getTime() - now.getTime();
                                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                  if (diffDays < 0) return 'Encerrado';
                                  if (diffDays === 0) return 'Último dia';
                                  if (diffDays === 1) return '1 dia restante';
                                  return `${diffDays} dias restantes`;
                                })()}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">{edital.area}</div>
                            {/* Exemplo: link para documento */}
                            {edital.modelos_documentos && edital.modelos_documentos["Carta de Anuência"] && (
                              <a
                                href={edital.modelos_documentos["Carta de Anuência"].url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline text-xs"
                              >
                                Baixar Carta de Anuência
                              </a>
                            )}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <Button variant="outline" className="w-full">
                            Escrever com IA para este Edital
                          </Button>
                        </CardContent>
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

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Chat com o Oráculo AI</CardTitle>
                <CardDescription>
                  Faça perguntas sobre seu projeto ou cole um edital para análise
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Cole aqui o texto do edital ou faça sua pergunta sobre projetos culturais..."
                  className="min-h-[150px] resize-none"
                />
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">
                    Máximo 10.000 caracteres
                  </p>
                  <Button className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90">
                    Analisar com IA
                  </Button>
                </div>
              </CardContent>
            </Card>

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
                  <div><span className="font-semibold">Análise dos Aprovados (IA):</span>
                    <div className="bg-white border rounded p-2 mt-1 text-sm text-gray-700 whitespace-pre-line">{resumoEdital.analise_aprovados_texto || <span className="text-gray-400">(não gerada)</span>}</div>
                  </div>
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
    </div>
  );
};

export default OraculoAI;
