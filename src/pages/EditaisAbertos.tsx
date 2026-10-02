import React, { useEffect, useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, deleteDoc, getDoc, getFirestore } from 'firebase/firestore';
import { auth } from '../lib/firebase';
import { getEditaisDb, getEditaisWriteDb, isEditaisCatalogExternal } from '@/lib/editaisDb';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar, DollarSign, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuthState } from 'react-firebase-hooks/auth';
import { toast } from 'sonner';

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
  destaque?: boolean;
  thumbnail?: string;
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
  useEffect(() => {
    const fetchEditais = async () => {
      try {
        setLoading(true);
        
        // Fetch Editais - apenas os que ainda não encerraram
        const editaisSnapshot = await getDocs(collection(getEditaisDb(), 'editais'));
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

        // destaque true no topo
        editais.sort((a, b) => (a.destaque ? 0 : 1) - (b.destaque ? 0 : 1));
        
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
        if (isEditaisCatalogExternal()) {
          toast.error('Edital vem do catálogo Oráculo Cultural — não pode excluir daqui.');
          return;
        }
        await deleteDoc(doc(getEditaisWriteDb(), 'editais', editalId));
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
      
      window.open('https://extratordeeditais.web.app/', '_blank');
    } catch (error) {
      console.error('Erro ao abrir extrator de editais:', error);
      toast.error('Não foi possível abrir o extrator. Tente novamente.');
    }
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
                        className="relative hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer overflow-hidden"
                        onClick={() => navigate(`/edital/${edital.id}`)}
                      >
                        {edital.thumbnail && (
                          <div className="w-full aspect-video bg-gray-100">
                            <img
                              src={edital.thumbnail}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
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
                        <CardContent className="space-y-2">
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!user) {
                                navigate(`/cadastro?redirect=/edital/${edital.id}`);
                              } else {
                                navigate(`/edital/${edital.id}`);
                              }
                            }}
                          >
                            Ver Detalhes
                          </Button>
                          <Button 
                            className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/criar-projeto?edital=${edital.id}`);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Formatar Projeto
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </main>
      </div>

    </div>
  );
};

export default EditaisAbertos;