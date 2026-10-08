import React, { useEffect, useMemo, useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { getEditaisDb } from '@/lib/editaisDb';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar, DollarSign, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackSignUp } from '@/lib/analytics';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DashboardPremiumHero } from '@/components/home/DashboardPremiumHero';
import { useUserProfile } from '@/hooks/useUserProfile';
import { filterEditaisAbertos, findEditalMaisUrgente } from '@/lib/editalDates';
import { FornecedoresPainel } from '@/components/fornecedores/FornecedoresPainel';
import { projetoEntryPath } from '@/lib/projetoWizard';

const capitalizarTitulo = (titulo: string): string => {
  if (!titulo) return '';
  return titulo.charAt(0).toUpperCase() + titulo.slice(1).toLowerCase();
};

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [editaisAbertosTodos, setEditaisAbertosTodos] = useState<any[]>([]);
  const [loadingEditais, setLoadingEditais] = useState(true);
  const { user, loading: profileLoading, profile } = useUserProfile();

  const editaisAbertosCount = editaisAbertosTodos.length;
  const editalUrgente = useMemo(
    () => findEditalMaisUrgente(editaisAbertosTodos),
    [editaisAbertosTodos]
  );
  const editais = useMemo(
    () =>
      [...editaisAbertosTodos]
        .sort((a: any, b: any) => (a.destaque ? 0 : 1) - (b.destaque ? 0 : 1))
        .slice(0, 4),
    [editaisAbertosTodos]
  );

  const showDashboard = Boolean(user && profile && !profileLoading);

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash === 'fornecedores') {
      navigate('/fornecedores', { replace: true });
      return;
    }
    if (hash === 'editais-abertos') {
      const el = document.getElementById(hash);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [location.hash, navigate]);

  useEffect(() => {
    if (location.state?.showCadastroSuccess === true) {
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'CompleteRegistration', {
          content_name: 'Cadastro de Usuário',
          status: true,
        });
        (window as any).fbq('track', 'Lead', { content_name: 'Cadastro de Usuário' });
      }
      trackSignUp({ method: 'email' });
    }
  }, [location.state?.showCadastroSuccess]);

  useEffect(() => {
    const fetchEditais = async () => {
      setLoadingEditais(true);
      try {
        let snapshot;
        try {
          const editaisDb = getEditaisDb();
          const qEditais = query(collection(editaisDb, 'editais'), orderBy('data_encerramento', 'desc'), limit(40));
          snapshot = await getDocs(qEditais);
        } catch {
          snapshot = await getDocs(query(collection(getEditaisDb(), 'editais'), limit(40)));
        }

        const raw = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setEditaisAbertosTodos(filterEditaisAbertos(raw));
      } catch (e) {
        console.error('Erro ao buscar editais:', e);
        setEditaisAbertosTodos([]);
      } finally {
        setLoadingEditais(false);
      }
    };
    fetchEditais();
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />

      <div className="flex-1 flex flex-col">
        <DashboardHeader />

        <main className="flex-1 p-2 md:p-4 animate-fade-in">
          <div className="max-w-7xl mx-auto">
            {showDashboard && profile && (
              <DashboardPremiumHero
                userName={profile.nome}
                editaisAbertosCount={editaisAbertosCount}
                metrics={profile.metrics}
                editalUrgente={editalUrgente}
                onCriarProjeto={() => navigate('/criar-projeto')}
                onVerEditais={() => navigate('/editais-abertos')}
                onContinuarProjeto={(proj) => navigate(projetoEntryPath(proj.id, proj))}
                onAvaliarEditalUrgente={(editalId) => navigate(`/criar-projeto?edital=${editalId}`)}
              />
            )}

            {!user && (
              <div className="mb-8 rounded-xl border border-oraculo-blue/20 bg-white p-6 text-center">
                <p className="text-gray-700 mb-4">
                  Entre na sua conta para ver seus projetos e continuar de onde parou.
                </p>
                <Button className="gradient-brand text-white" onClick={() => navigate('/cadastro')}>
                  Entrar
                </Button>
              </div>
            )}

            <FornecedoresPainel />

            <div id="editais-abertos" className="mb-12 scroll-mt-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Editais abertos</h2>
                <Button
                  variant="outline"
                  onClick={() => navigate('/editais-abertos')}
                  className="hidden md:flex"
                >
                  Ver mais
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
                      if (date.toDate) return date.toDate().toLocaleDateString('pt-BR');
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
                            <CardDescription className="line-clamp-1">{edital.proponente}</CardDescription>
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
                              className="w-full gradient-brand text-white hover:opacity-90"
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
                              Ver detalhes
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
                Ver mais editais
              </Button>
            </div>
          </div>
        </main>
      </div>

      <Dialog
        open={location.state?.showCadastroSuccess === true}
        onOpenChange={(open) => {
          if (!open) navigate('/', { replace: true, state: {} });
        }}
      >
        <DialogContent className="max-w-md text-center border-2 border-oraculo-blue/20 shadow-xl">
          <div className="flex flex-col items-center py-2">
            <div className="w-14 h-14 gradient-brand rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Conta criada com sucesso!</DialogTitle>
            </DialogHeader>
            <div className="my-4 p-5 rounded-2xl bg-oraculo-blue/5 border border-oraculo-blue/20">
              <p className="text-base text-gray-800 font-medium leading-relaxed">
                Sua conta foi criada. Você já pode começar a usar a plataforma!
              </p>
            </div>
            <Button
              className="w-full gradient-brand text-white font-semibold"
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
