import React, { useEffect, useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, deleteDoc, addDoc, Timestamp, getDoc, getFirestore } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar, DollarSign, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuthState } from 'react-firebase-hooks/auth';
import { toast } from 'sonner';
import emailImage from '@/assets/email.png';

interface Edital {
  id: string;
  deadline?: {
    seconds: number;
    nanoseconds: number;
    toDate: () => Date;
  } | string | null;
  nome?: string;
  descricao?: string;
  data_encerramento?: any;
  valor_maximo_premiacao?: string;
  criado_em?: any;
}

// Função para capitalizar apenas a primeira letra do título
const capitalizarTitulo = (titulo: string): string => {
  if (!titulo) return '';
  // Converte para minúsculas e depois capitaliza a primeira letra
  return titulo.charAt(0).toUpperCase() + titulo.slice(1).toLowerCase();
};

const EditaisAbertos = () => {
  const [editaisAbertos, setEditaisAbertos] = useState<Edital[]>([]);
  const [loading, setLoading] = useState(true);
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [emailNewsletter, setEmailNewsletter] = useState('');
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);

  useEffect(() => {
    const fetchEditais = async () => {
      try {
        setLoading(true);
        
        // Fetch Editais - apenas os que ainda não encerraram
        const editaisSnapshot = await getDocs(collection(db, "editais"));
        const editais: Edital[] = [];
        const now = new Date();
        
        editaisSnapshot.forEach((doc) => {
          const edital = { id: doc.id, ...doc.data() } as Edital;
          
          // Verifica data_encerramento primeiro (campo principal)
          let dataEncerramento: Date | null = null;
          
          if (edital.data_encerramento) {
            if (edital.data_encerramento?.toDate) {
              dataEncerramento = edital.data_encerramento.toDate();
            } else if (edital.data_encerramento?.seconds) {
              dataEncerramento = new Date(edital.data_encerramento.seconds * 1000);
            } else if (typeof edital.data_encerramento === 'string') {
              dataEncerramento = new Date(edital.data_encerramento);
            }
          }
          
          // Se não tem data_encerramento ou se já passou, verifica dataEncerramento (com E maiúsculo)
          if ((!dataEncerramento || (dataEncerramento && dataEncerramento <= now)) && (edital as any).dataEncerramento) {
            const dataEncerramentoAlt = (edital as any).dataEncerramento;
            if (dataEncerramentoAlt?.toDate) {
              dataEncerramento = dataEncerramentoAlt.toDate();
            } else if (dataEncerramentoAlt?.seconds) {
              dataEncerramento = new Date(dataEncerramentoAlt.seconds * 1000);
            } else if (typeof dataEncerramentoAlt === 'string') {
              dataEncerramento = new Date(dataEncerramentoAlt);
            }
          }
          
          // Se ainda não tem data válida ou já passou, verifica deadline como fallback
          if ((!dataEncerramento || (dataEncerramento && dataEncerramento <= now)) && edital.deadline) {
            if (edital.deadline && typeof edital.deadline === 'object' && 'toDate' in edital.deadline) {
              dataEncerramento = edital.deadline.toDate();
            } else if (edital.deadline && typeof edital.deadline === 'object' && 'seconds' in edital.deadline) {
              dataEncerramento = new Date(edital.deadline.seconds * 1000);
            } else if (typeof edital.deadline === 'string') {
              dataEncerramento = new Date(edital.deadline);
            }
          }
          
          // Só adiciona se a data de encerramento for válida e ainda não passou
          if (dataEncerramento && !isNaN(dataEncerramento.getTime()) && dataEncerramento > now) {
            editais.push(edital);
          }
        });
        
        setEditaisAbertos(editais);
      } catch (error) {
        console.error("Error fetching editais:", error);
        toast.error('Erro ao carregar editais');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEditais();
  }, []);

  const getPrioridade = (diffDays: number) => {
    if (diffDays <= 3) return { label: 'Alta', color: 'bg-red-500' };
    if (diffDays <= 7) return { label: 'Média', color: 'bg-oraculo-gold' };
    if (diffDays > 7) return { label: 'Baixa', color: 'bg-green-500' };
    return { label: '', color: 'bg-gray-500' };
  };

  const handleDeleteEdital = async (editalId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este edital?')) {
      try {
        await deleteDoc(doc(db, 'editais', editalId));
        setEditaisAbertos(editaisAbertos.filter(edital => edital.id !== editalId));
        toast.success('Edital excluído com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir edital:', error);
        toast.error('Erro ao excluir edital. Tente novamente.');
      }
    }
  };

  const handleCadastrarEdital = async () => {
    if (!user) {
      return;
    }

    try {
      const firestore = getFirestore();
      const userRef = doc(firestore, 'usuarios', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const isPremium = userData.isPremium === true;
        
        if (!isPremium) {
          // Mostrar dialog de premium
          setShowPremiumDialog(true);
          return;
        }
      } else {
        // Se o usuário não tem documento, não é premium
        setShowPremiumDialog(true);
        return;
      }
      
      // Se chegou aqui, é premium - abrir link
      window.open('https://extratordeeditais.web.app/', '_blank');
    } catch (error) {
      console.error('Erro ao verificar status premium:', error);
      // Em caso de erro, mostrar dialog também para segurança
      setShowPremiumDialog(true);
    }
  };

  const handleGoToPricing = () => {
    setShowPremiumDialog(false);
    navigate('/cadastro-premium');
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <Calendar className="h-8 w-8 text-oraculo-magenta" />
                Editais Abertos
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Explore todos os editais culturais em aberto e encontre oportunidades para seus projetos.
              </p>
            </div>

            {/* Seção Editais Abertos */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="h-6 w-6 text-oraculo-magenta" />
                  Todos os Editais
                </h2>
                {user && (
                  <Button 
                    className="ml-2 bg-oraculo-blue text-white" 
                    onClick={handleCadastrarEdital}
                  >
                    Cadastrar Edital
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {loading ? (
                  <div className="flex items-center justify-center p-4 col-span-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oraculo-blue"></div>
                    <span className="ml-2">Carregando editais...</span>
                  </div>
                ) : editaisAbertos.length === 0 ? (
                  <div className="text-center p-4 text-gray-500 col-span-full">
                    Nenhum edital aberto no momento.
                  </div>
                ) : (
                  editaisAbertos.map((edital, index) => {
                    let diffDays = null;
                    if (edital.deadline) {
                      let deadlineDate: Date;
                      if (typeof edital.deadline === 'object' && 'seconds' in edital.deadline) {
                        // Handle Firestore Timestamp
                        deadlineDate = new Date(edital.deadline.seconds * 1000);
                      } else if (typeof edital.deadline === 'string') {
                        // Handle string date
                        deadlineDate = new Date(edital.deadline);
                      } else {
                        console.error('Unexpected deadline format:', edital.deadline);
                        return null;
                      }
                      const now = new Date();
                      const diffTime = deadlineDate.getTime() - now.getTime();
                      diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    } else if (edital.data_encerramento) {
                      let deadlineDate: Date;
                      if (edital.data_encerramento?.toDate) {
                        deadlineDate = edital.data_encerramento.toDate();
                      } else if (edital.data_encerramento?.seconds) {
                        deadlineDate = new Date(edital.data_encerramento.seconds * 1000);
                      } else if (typeof edital.data_encerramento === 'string') {
                        deadlineDate = new Date(edital.data_encerramento);
                      } else {
                        return null;
                      }
                      const now = new Date();
                      const diffTime = deadlineDate.getTime() - now.getTime();
                      diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    }
                    const prioridade = diffDays !== null ? getPrioridade(diffDays) : null;
                    return (
                      <Card 
                        key={edital.id || index} 
                        className="relative hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer"
                        onClick={() => navigate(`/edital/${edital.id}`)}
                      >
                        {/* Action Buttons - Only visible to admin */}
                        {user?.uid === 'sCacAc0ShPfafYjpy0t4pBp77Tb2' && (
                          <div className="absolute top-2 right-2 flex gap-1 z-10">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
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
                            <CardTitle className="text-lg flex-1">{edital.nome ? capitalizarTitulo(edital.nome) : 'Edital sem nome'}</CardTitle>
                            {prioridade && prioridade.label && (
                              <Badge className={`${prioridade.color} text-white`}>
                                Prioridade: {prioridade.label}
                              </Badge>
                            )}
                          </div>
                          {edital.descricao && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{edital.descricao}</p>
                          )}
                          <div className="flex items-center text-sm text-gray-500 gap-4 flex-wrap">
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
                        <CardContent>
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/edital/${edital.id}`);
                            }}
                          >
                            Ver Detalhes
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })
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
                              nome: user?.displayName || null
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
                      className="text-sm"
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
          </div>
        </main>
      </div>

      {/* Dialog para usuário não premium */}
      <Dialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recurso Exclusivo</DialogTitle>
            <DialogDescription>
              Este recurso é exclusivo para assinantes da plataforma.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-4">
            <p className="text-gray-700">
              Para cadastrar editais, você precisa ser um assinante premium. Assine agora e tenha acesso a todos os recursos da plataforma!
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowPremiumDialog(false)}>
                Cancelar
              </Button>
              <Button 
                className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90" 
                onClick={handleGoToPricing}
              >
                Ver Planos
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EditaisAbertos;