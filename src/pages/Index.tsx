import React, { useEffect, useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar, DollarSign, Sparkles, PlusCircle, FolderOpen, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { trackCtaVerComoFunciona, trackSignUp } from '@/lib/analytics';
import analisarImage from '@/assets/Analisar.jpeg';

// Função para capitalizar apenas a primeira letra do título
const capitalizarTitulo = (titulo: string): string => {
  if (!titulo) return '';
  // Converte para minúsculas e depois capitaliza a primeira letra
  return titulo.charAt(0).toUpperCase() + titulo.slice(1).toLowerCase();
};

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [editais, setEditais] = useState<any[]>([]);
  const [loadingEditais, setLoadingEditais] = useState(true);
  const [user] = useAuthState(auth);
  const [projetos, setProjetos] = useState<any[]>([]);
  const [loadingProjetos, setLoadingProjetos] = useState(false);
  // Buscar projetos do usuário quando logado
  useEffect(() => {
    if (!user?.uid) {
      setProjetos([]);
      return;
    }
    setLoadingProjetos(true);
    const q = query(collection(db, 'projetos'), where('user_id', '==', user.uid), limit(50));
    getDocs(q)
      .then((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a: any, b: any) => {
          const da = a.data_criacao?.toMillis?.() ?? a.data_criacao ?? 0;
          const db_ = b.data_criacao?.toMillis?.() ?? b.data_criacao ?? 0;
          return db_ - da;
        });
        setProjetos(list);
      })
      .catch((err) => {
        console.error('Erro ao buscar projetos:', err);
        setProjetos([]);
      })
      .finally(() => setLoadingProjetos(false));
  }, [user?.uid]);

  // Scroll para a seção de editais quando a URL tiver #editais-abertos
  useEffect(() => {
    if (location.hash === '#editais-abertos') {
      const el = document.getElementById('editais-abertos');
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [location.hash]);

  // Facebook Pixel + GA4: eventos de conversão quando cadastro é concluído
  useEffect(() => {
    if (location.state?.showCadastroSuccess === true) {
      // Facebook Pixel: evento "Complete Registration" / "Lead"
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'CompleteRegistration', {
          content_name: 'Cadastro de Usuário',
          status: true,
        });
        (window as any).fbq('track', 'Lead', {
          content_name: 'Cadastro de Usuário',
        });
      }
      
      // GA4: evento padrão "sign_up" (configurar como conversão "Lead Generated" no GA4)
      trackSignUp({ method: 'email' });
    }
  }, [location.state?.showCadastroSuccess]);



  useEffect(() => {
    const fetchEditais = async () => {
      setLoadingEditais(true);
      try {
        // Busca editais abertos (máximo 4)
        let snapshot;
        try {
          const qEditais = query(collection(db, 'editais'), orderBy('data_encerramento', 'desc'), limit(20));
          snapshot = await getDocs(qEditais);
        } catch (orderError) {
          console.log('Erro ao ordenar editais, buscando sem ordenação:', orderError);
          const qEditais = query(collection(db, 'editais'), limit(20));
          snapshot = await getDocs(qEditais);
        }
        
        const now = new Date();
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(edital => {
            let dataEncerramento: Date | null = null;
            
            // Verifica data_encerramento primeiro
            if (edital.data_encerramento) {
              if (edital.data_encerramento?.toDate) {
                dataEncerramento = edital.data_encerramento.toDate();
              } else if (edital.data_encerramento?.seconds) {
                dataEncerramento = new Date(edital.data_encerramento.seconds * 1000);
              } else if (typeof edital.data_encerramento === 'string') {
                dataEncerramento = new Date(edital.data_encerramento);
              }
            }
            
            // Se não tem data_encerramento ou já passou, verifica dataEncerramento (com E maiúsculo)
            if ((!dataEncerramento || (dataEncerramento && dataEncerramento <= now)) && edital.dataEncerramento) {
              if (edital.dataEncerramento?.toDate) {
                dataEncerramento = edital.dataEncerramento.toDate();
              } else if (edital.dataEncerramento?.seconds) {
                dataEncerramento = new Date(edital.dataEncerramento.seconds * 1000);
              } else if (typeof edital.dataEncerramento === 'string') {
                dataEncerramento = new Date(edital.dataEncerramento);
              }
            }
            
            // Se ainda não tem data válida, retorna false
            if (!dataEncerramento || isNaN(dataEncerramento.getTime())) {
              return false;
            }
            
            return dataEncerramento > now;
          })
          .sort((a: any, b: any) => (a.destaque ? 0 : 1) - (b.destaque ? 0 : 1)) // destaque true no topo
          .slice(0, 4); // Limita a 4 após filtrar
        
        setEditais(data);
      } catch (e) {
        console.error('Erro ao buscar editais:', e);
        setEditais([]);
      } finally {
        setLoadingEditais(false);
      }
    };
    fetchEditais();
  }, []);


  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <DashboardSidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <DashboardHeader />
        
        {/* Main Content */}
        <main className="flex-1 p-2 md:p-4 animate-fade-in">
          <div className="max-w-7xl mx-auto">
            {/* CTA Veja como um projeto é avaliado — deslogado ou logado sem projetos */}
            {(!user || (user && projetos.length === 0)) && (
              <div className="mb-10 rounded-2xl bg-gradient-to-r from-oraculo-blue via-oraculo-blue to-oraculo-purple p-6 md:p-8 shadow-xl border-2 border-oraculo-purple/30">
                <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
                  <div className="flex-1 flex flex-col gap-5">
                    <h2 className="text-xl md:text-2xl font-bold text-white">
                      Veja como um projeto é avaliado antes de enviar o seu
                    </h2>
                    <p className="text-white/95 text-sm md:text-base leading-relaxed max-w-2xl">
                      Em menos de 2 minutos, veja um exemplo real de avaliação feita por IA especializada em editais culturais e descubra o que mais reprova projetos.
                    </p>
                    <Button
                      size="lg"
                      onClick={() => { trackCtaVerComoFunciona(); if (user) { navigate('/avaliar-projeto?iniciar=1'); } else { navigate('/cadastro?redirect=/avaliar-projeto&iniciar=1'); } }}
                      className="w-full md:w-auto self-start font-bold text-base md:text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all border-0 hover:opacity-95"
                      style={{ backgroundColor: '#FF8A00', color: '#1A1A1A' }}
                    >
                      <Sparkles className="h-5 w-5 mr-2" style={{ color: '#1A1A1A' }} />
                      Ver como funciona na prática
                    </Button>
                    <p className="text-white/90 text-sm">
                      Depois você poderá avaliar seu próprio projeto gratuitamente.
                    </p>
                  </div>
                  <div className="flex-shrink-0 w-full md:w-80 md:max-w-sm">
                    <img
                      src={analisarImage}
                      alt="Avaliação de projeto com IA"
                      className="w-full rounded-xl shadow-lg object-cover"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Logado: Meus projetos — card "Crie seu primeiro projeto" ou lista de projetos */}
            {user && (
              <div className="mb-10">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <FolderOpen className="h-6 w-6 text-oraculo-blue" />
                  Meus projetos
                </h2>
                {loadingProjetos ? (
                  <div className="text-center text-gray-500 py-12">Carregando projetos...</div>
                ) : projetos.length === 0 ? (
                  <Card
                    className="cursor-pointer hover:shadow-lg transition-all border-2 border-dashed border-oraculo-blue/30 bg-oraculo-blue/5 overflow-hidden"
                    onClick={() => navigate('/criar-projeto')}
                  >
                    <CardContent className="flex flex-col items-center justify-center py-12 md:py-16 px-6 text-center">
                      <PlusCircle className="h-14 w-14 text-oraculo-blue mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Crie seu primeiro projeto</h3>
                      <p className="text-gray-600 text-sm md:text-base max-w-md mb-6">
                        Avalie seu projeto com IA, gere textos para editais, orçamento e cronograma em poucos cliques.
                      </p>
                      <Button
                        size="lg"
                        className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white"
                        onClick={(e) => { e.stopPropagation(); navigate('/criar-projeto'); }}
                      >
                        <Sparkles className="h-5 w-5 mr-2" />
                        Começar
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projetos.map((projeto) => (
                      <Card
                        key={projeto.id}
                        className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1"
                        onClick={() => navigate(`/projeto/${projeto.id}`)}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg leading-tight line-clamp-2">
                            {projeto.nome || 'Projeto sem nome'}
                          </CardTitle>
                          {projeto.edital_associado && (
                            <CardDescription className="line-clamp-1">{projeto.edital_associado}</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="pt-0">
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={(e) => { e.stopPropagation(); navigate(`/projeto/${projeto.id}`); }}
                          >
                            Abrir projeto
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Editais Abertos */}
            <div id="editais-abertos" className="mb-12 scroll-mt-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  Editais Abertos
                </h2>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/editais-abertos')}
                  className="hidden md:flex"
                >
                  Ver Mais
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {loadingEditais ? (
                  <div className="text-center text-gray-500 py-12 col-span-4">Carregando editais...</div>
                ) : editais.length === 0 ? (
                  <div className="text-center text-gray-500 py-12 col-span-4">Nenhum edital aberto no momento.</div>
                ) : (
                  editais.map((edital, index) => {
                    const formatDate = (date: any) => {
                      if (!date) return '';
                      if (date.toDate) {
                        return date.toDate().toLocaleDateString('pt-BR');
                      }
                      return new Date(date).toLocaleDateString('pt-BR');
                    };

                    return (
                      <Card 
                        key={edital.id || index} 
                        className="hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer overflow-hidden"
                        onClick={() => navigate(`/edital/${edital.id}`)}
                      >
                        {(edital as any).thumbnail && (
                          <div className="w-full aspect-video bg-gray-100">
                            <img
                              src={(edital as any).thumbnail}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg leading-tight line-clamp-2">
                            {edital.nome ? capitalizarTitulo(edital.nome) : 'Edital sem nome'}
                          </CardTitle>
                          {edital.proponente && (
                            <CardDescription className="line-clamp-1">
                              {edital.proponente}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {edital.data_encerramento && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Calendar className="h-4 w-4 mr-2 text-oraculo-blue" />
                              {formatDate(edital.data_encerramento)}
                            </div>
                          )}
                          {edital.valor_maximo_premiacao && (
                            <div className="flex items-center text-sm text-gray-600">
                              <DollarSign className="h-4 w-4 mr-2 text-green-600" />
                              {edital.valor_maximo_premiacao}
                            </div>
                          )}
                          <div className="flex flex-col gap-2 mt-2">
                            <Button 
                              className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white hover:opacity-90"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/criar-projeto?edital=${edital.id}`);
                              }}
                            >
                              Avalie seu projeto neste edital
                            </Button>
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
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
              <Button 
                variant="outline" 
                onClick={() => navigate('/editais-abertos')}
                className="w-full mt-6 md:hidden"
              >
                Ver Mais Editais
              </Button>
              
            </div>


          </div>
        </main>
      </div>
      {/* Overlay: Conta criada com sucesso — exibido sobre a home ao concluir cadastro */}
      <Dialog
        open={location.state?.showCadastroSuccess === true}
        onOpenChange={(open) => { if (!open) navigate('/', { replace: true, state: {} }); }}
      >
        <DialogContent className="max-w-md text-center border-2 border-oraculo-blue/20 shadow-xl">
          <div className="flex flex-col items-center py-2">
            <div className="w-14 h-14 bg-gradient-to-r from-oraculo-blue to-oraculo-purple rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Conta criada com sucesso!</DialogTitle>
            </DialogHeader>
            <div className="my-4 p-5 rounded-2xl bg-gradient-to-r from-oraculo-blue/10 to-oraculo-purple/10 border-2 border-oraculo-blue/20">
              <p className="text-base text-gray-800 font-medium leading-relaxed">
                Sua conta foi criada. Você já pode começar a usar a plataforma!
              </p>
            </div>
            <Button
              className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white font-semibold"
              onClick={() => navigate('/', { replace: true, state: {} })}
            >
              Ir para a plataforma
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Index;
