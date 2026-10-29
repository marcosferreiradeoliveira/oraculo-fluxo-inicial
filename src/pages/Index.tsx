import React, { useEffect, useMemo, useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { FeaturedGuides } from '@/components/FeaturedGuides';
import { RecentContent } from '@/components/RecentContent';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit, doc, getDoc, setDoc, updateDoc, arrayUnion, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Download, Play, TrendingUp, FileText, Headphones, Sparkles, Eye } from 'lucide-react';
import { EditalCard, type EditalCardModel } from '@/components/editais/EditalCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { trackNewsletterSubscribed, trackCtaVerComoFunciona } from '@/lib/analytics';
import analisarImage from '@/assets/Analisar.jpeg';
import { DashboardPremiumHero } from '@/components/home/DashboardPremiumHero';
import { filterEditaisAbertos, findEditalMaisUrgente, type EditalUrgenteInfo } from '@/lib/editalDates';
import { contentCardDescription } from '@/lib/contentExcerpt';
import { CadastroCelebrationModal } from '@/components/CadastroCelebrationModal';
import {
  peekCadastroCelebrationPending,
  type CadastroCelebrationPayload,
} from '@/lib/cadastroCelebration';

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [guias, setGuias] = useState<any[]>([]);
  const [loadingGuias, setLoadingGuias] = useState(true);
  const [podcasts, setPodcasts] = useState<any[]>([]);
  const [loadingPodcasts, setLoadingPodcasts] = useState(true);
  const [editaisAbertosTodos, setEditaisAbertosTodos] = useState<any[]>([]);
  const [loadingEditais, setLoadingEditais] = useState(true);
  const { user, loading: profileLoading, isPremium, profile, planLabel } = useUserProfile();
  /** Demo na home — só visitantes sem conta */
  const showVisitorDemoBanner = !profileLoading && !user;
  /** Usuário logado (Starter): um único CTA principal */
  const showLoggedInEvalHero = Boolean(user && !profileLoading && !isPremium);
  const showPremiumDashboard = Boolean(user && !profileLoading && isPremium && profile);

  const editaisAbertosCount = editaisAbertosTodos.length;
  const editalUrgente: EditalUrgenteInfo | null = useMemo(
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [redirectPremium, setRedirectPremium] = useState(false);
  const [emailNewsletter, setEmailNewsletter] = useState('');
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const [showCadastroCelebration, setShowCadastroCelebration] = useState(false);
  const [cadastroCelebrationPayload, setCadastroCelebrationPayload] =
    useState<CadastroCelebrationPayload | null>(null);

  useEffect(() => {
    if (profileLoading || !user) return;
    const pending = peekCadastroCelebrationPending();
    if (!pending) return;
    setCadastroCelebrationPayload(pending);
    setShowCadastroCelebration(true);
  }, [user, profileLoading]);

  // Scroll para seções quando a URL tiver hash (#editais-abertos)
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash === 'editais-abertos') {
      const el = document.getElementById(hash);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [location.hash]);

  useEffect(() => {
    const fetchGuias = async () => {
      setLoadingGuias(true);
      try {
        // Busca apenas 2 guias
        let snapshot;
        try {
          const qGuias = query(collection(db, 'guias'), orderBy('criadoEm', 'desc'), limit(10));
          snapshot = await getDocs(qGuias);
        } catch (orderError) {
          console.log('Erro ao ordenar, buscando sem ordenação:', orderError);
          const qGuias = query(collection(db, 'guias'), limit(10));
          snapshot = await getDocs(qGuias);
        }
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Ordenar: especiais primeiro, depois os normais, e pegar apenas 2
        const guiasEspeciais = data.filter((g: any) => g.especial === true);
        const guiasNormais = data.filter((g: any) => !g.especial || g.especial === false);
        const guiasOrdenados = [...guiasEspeciais, ...guiasNormais].slice(0, 2);
        
        setGuias(guiasOrdenados);
      } catch (e) {
        console.error('Erro ao buscar guias:', e);
        setGuias([]);
      } finally {
        setLoadingGuias(false);
      }
    };
    fetchGuias();
  }, []);

  useEffect(() => {
    const fetchPodcasts = async () => {
      setLoadingPodcasts(true);
      try {
        // Busca apenas 2 podcasts
        let snapshot;
        try {
          const qPodcasts = query(collection(db, 'podcast_episodios'), orderBy('criadoEm', 'desc'), limit(2));
          snapshot = await getDocs(qPodcasts);
        } catch (orderError) {
          console.log('Erro ao ordenar, buscando sem ordenação:', orderError);
          const qPodcasts = query(collection(db, 'podcast_episodios'), limit(2));
          snapshot = await getDocs(qPodcasts);
        }
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPodcasts(data);
      } catch (e) {
        console.error('Erro ao buscar podcasts:', e);
        setPodcasts([]);
      } finally {
        setLoadingPodcasts(false);
      }
    };
    fetchPodcasts();
  }, []);

  useEffect(() => {
    const fetchEditais = async () => {
      setLoadingEditais(true);
      try {
        // Busca editais abertos (máximo 4)
        let snapshot;
        try {
          const qEditais = query(collection(db, 'editais'), orderBy('data_encerramento', 'desc'), limit(100));
          snapshot = await getDocs(qEditais);
        } catch (orderError) {
          console.log('Erro ao ordenar editais, buscando sem ordenação:', orderError);
          const qEditais = query(collection(db, 'editais'), limit(100));
          snapshot = await getDocs(qEditais);
        }
        
        const raw = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        const abertos = filterEditaisAbertos(raw);
        setEditaisAbertosTodos(abertos);
      } catch (e) {
        console.error('Erro ao buscar editais:', e);
        setEditaisAbertosTodos([]);
      } finally {
        setLoadingEditais(false);
      }
    };
    fetchEditais();
  }, []);

  const handleDownloadGuia = async (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, guiaId: string, pdfUrl: string) => {
    if (!user) {
      e.preventDefault();
      setShowAuthModal(true);
      return;
    }
    try {
      const userRef = doc(db, 'usuarios', user.uid);
      const userSnap = await getDoc(userRef);
      let guiasBaixados: string[] = [];
      let isPremium = false;
      if (userSnap.exists()) {
        const data = userSnap.data();
        guiasBaixados = data.guiasBaixados || [];
        // Use entitlements to check Criação access (content access)
        isPremium = data.entitlements?.criacao === true ||
                   data.isPremium === true; // legacy fallback
      }
      // Se não for premium e já baixou 1 guia diferente
      if (!isPremium && guiasBaixados.length >= 1 && !guiasBaixados.includes(guiaId)) {
        e.preventDefault();
        setRedirectPremium(true);
        return;
      }
      // Registra o guia baixado
      if (!guiasBaixados.includes(guiaId)) {
        if (userSnap.exists()) {
          await updateDoc(userRef, { guiasBaixados: arrayUnion(guiaId) });
        } else {
          await setDoc(userRef, { guiasBaixados: [guiaId] });
        }
      }
      // Permite o download
    } catch (err) {
      e.preventDefault();
      alert('Erro ao registrar download do guia. Tente novamente.');
    }
  };

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
            {showPremiumDashboard && profile && (
              <DashboardPremiumHero
                userName={profile.nome}
                planLabel={planLabel}
                editaisAbertosCount={editaisAbertosCount}
                metrics={profile.metrics}
                editalUrgente={editalUrgente}
                onCriarProjeto={() => navigate('/criar-projeto')}
                onVerEditais={() => navigate('/editais-abertos')}
                onContinuarProjeto={(projectId) => navigate(`/projeto/${projectId}`)}
                onAvaliarEditalUrgente={(editalId) => navigate(`/criar-projeto?edital=${editalId}`)}
              />
            )}

            {showLoggedInEvalHero && (
              <div className="mb-8 rounded-2xl overflow-hidden bg-gradient-to-r from-oraculo-blue to-oraculo-purple shadow-lg border border-oraculo-purple/20">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 p-6 md:p-7">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                      Avaliar um projeto
                    </h2>
                    <p className="text-white/90 text-sm md:text-base leading-relaxed max-w-2xl">
                      Descreva seu projeto e receba um parecer da IA alinhado ao edital — depois ajuste textos, orçamento e cronograma no mesmo fluxo.
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={() => navigate('/criar-projeto')}
                    className="flex-shrink-0 w-full md:w-auto bg-white text-oraculo-blue hover:bg-white/95 font-bold text-base px-8 py-5 shadow-md border-0"
                  >
                    <Sparkles className="h-5 w-5 mr-2" />
                    Avaliar um projeto
                  </Button>
                </div>
              </div>
            )}

            {showVisitorDemoBanner && (
              <div className="mb-8 rounded-2xl overflow-hidden bg-gradient-to-r from-oraculo-blue to-oraculo-purple shadow-lg border border-oraculo-purple/20">
                <div className="flex flex-col sm:flex-row sm:items-stretch">
                  <div className="flex-1 p-6 md:p-7 flex flex-col justify-center">
                    <p className="text-white/80 text-xs font-semibold uppercase tracking-wide mb-2">
                      Demonstração · sem cadastro
                    </p>
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                      Veja como um projeto é avaliado
                    </h2>
                    <p className="text-white/90 text-sm md:text-base leading-relaxed mb-5 max-w-xl">
                      Projeto fictício, análise completa em ~2 minutos. Crie sua conta depois para avaliar o seu com créditos Starter.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                      <Button
                        size="lg"
                        onClick={() => {
                          trackCtaVerComoFunciona();
                          navigate('/avaliar-projeto?iniciar=1');
                        }}
                        className="w-full sm:w-auto bg-[#FFCB05] hover:bg-[#e6b800] text-[#1A1A1A] font-bold text-base px-7 py-5 shadow-md border-0"
                      >
                        <Sparkles className="h-5 w-5 mr-2" />
                        Ver como funciona
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => navigate('/cadastro')}
                        className="w-full sm:w-auto border-white/40 bg-white/10 text-white hover:bg-white/20 font-semibold text-base px-7 py-5"
                      >
                        Criar conta grátis
                      </Button>
                    </div>
                  </div>
                  <div className="sm:w-48 md:w-56 min-h-[140px] sm:min-h-0 relative hidden sm:block flex-shrink-0">
                    <img
                      src={analisarImage}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            )}

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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                {loadingEditais ? (
                  <div className="text-center text-gray-500 py-12 col-span-4">Carregando editais...</div>
                ) : editais.length === 0 ? (
                  <div className="text-center text-gray-500 py-12 col-span-4">Nenhum edital aberto no momento.</div>
                ) : (
                  editais.map((edital, index) => (
                    <EditalCard
                      key={edital.id || index}
                      edital={edital as EditalCardModel}
                      primaryActionLabel="Avaliar neste edital"
                      onOpenDetails={(id) => navigate(`/edital/${id}`)}
                      onCreateProject={(id) => navigate(`/criar-projeto?edital=${id}`)}
                    />
                  ))
                )}
              </div>
              <Button 
                variant="outline" 
                onClick={() => navigate('/editais-abertos')}
                className="w-full mt-6 md:hidden"
              >
                Ver Mais Editais
              </Button>
              
              {/* Formulário de cadastro de email para receber editais */}
              <div className="mt-8 bg-gradient-to-r from-oraculo-blue/10 to-oraculo-purple/10 rounded-xl p-4 md:p-6 border-2 border-oraculo-blue/20">
                <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
                  <div className="flex-1 w-full min-w-0">
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
                            origem: 'home_editais_abertos'
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
                          
                          // Track newsletter subscription
                          trackNewsletterSubscribed({
                            source: 'home_editais_abertos',
                            isLoggedIn: !!user,
                          });
                          
                          toast.success('Email cadastrado com sucesso! Você receberá os editais mais recentes.');
                          setEmailNewsletter('');
                        } catch (error) {
                          console.error('Erro ao salvar email:', error);
                          toast.error('Erro ao cadastrar email. Tente novamente.');
                        } finally {
                          setSalvandoEmail(false);
                        }
                      }}
                      className="flex flex-col sm:flex-row gap-2 w-full max-w-2xl"
                    >
                      <Input
                        type="email"
                        placeholder="Seu melhor email"
                        value={emailNewsletter}
                        onChange={(e) => setEmailNewsletter(e.target.value)}
                        className="text-sm bg-white border-gray-200 flex-1 min-w-0 h-10"
                        disabled={salvandoEmail}
                        required
                      />
                      <Button
                        type="submit"
                        className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white px-6 h-10 whitespace-nowrap text-sm shrink-0 w-full sm:w-auto"
                        disabled={salvandoEmail}
                      >
                        {salvandoEmail ? 'Cadastrando...' : 'Cadastrar'}
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            </div>

            {/* Inteligência de Mercado */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-oraculo-blue" />
                  Inteligência de Mercado
                </h2>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/inteligencia-mercado')}
                  className="hidden md:flex"
                >
                  Ver Mais
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {loadingGuias || loadingPodcasts ? (
                  <div className="text-center text-gray-500 py-12 col-span-4">Carregando conteúdos...</div>
                ) : guias.length === 0 && podcasts.length === 0 ? (
                  <div className="text-center text-gray-500 py-12 col-span-4">Nenhum conteúdo disponível ainda.</div>
                ) : (
                  <>
                    {/* Guias */}
                    {guias.map((guia, index) => {
                      // Verificação mais robusta para isEspecial (pode vir como true, "true", 1, etc)
                    const isEspecial = Boolean(guia.especial) && (guia.especial === true || String(guia.especial).toLowerCase() === 'true' || Number(guia.especial) === 1);
                      return (
                      <Card key={`guia-${guia.id || index}`} className="hover:shadow-lg transition-all hover:-translate-y-1">
                        <div className="aspect-video relative overflow-hidden rounded-t-lg">
                          <img 
                            src={guia.imgUrl} 
                            alt={guia.titulo}
                            className="w-full h-full object-cover"
                          />
                          {isEspecial ? (
                            <Badge className="absolute top-2 right-2 bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white">
                              <FileText className="h-3 w-3 mr-1" />
                              ESPECIAL
                            </Badge>
                          ) : (
                            <Badge className="absolute top-2 right-2 bg-blue-600 text-white">
                              <FileText className="h-3 w-3 mr-1" />
                              Guia
                            </Badge>
                          )}
                        </div>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg leading-snug text-clamp-2 break-words">
                            {guia.titulo}
                          </CardTitle>
                          <CardDescription className="text-clamp-3 break-words mt-1.5">
                            {contentCardDescription(guia.descricao) || 'Guia disponível na plataforma.'}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <Button 
                            className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
                            onClick={(e) => {
                              e.preventDefault();
                              // Guias especiais podem ser acessados sem login
                              if (isEspecial) {
                                navigate(`/guia-especial/${guia.id}`);
                                return;
                              }
                              
                              // Guias normais precisam de login
                              if (!user) {
                                setShowAuthModal(true);
                                return;
                              }
                              
                              if (guia.pdfUrl) {
                                window.open(guia.pdfUrl, '_blank');
                                handleDownloadGuia(e as any, guia.id, guia.pdfUrl);
                              }
                            }}
                          >
                            {isEspecial ? (
                              <Eye className="h-4 w-4 mr-2" />
                            ) : (
                              <Download className="h-4 w-4 mr-2" />
                            )}
                            {isEspecial ? 'Ver Detalhes' : 'Baixar Guia'}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                    })}

                    {/* Podcasts */}
                    {podcasts.map((ep, index) => (
                      <Card key={`podcast-${ep.id || index}`} className="hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer" onClick={() => navigate(`/podcast/${ep.id}`)}>
                        <div className="aspect-video relative overflow-hidden rounded-t-lg">
                          {ep.capaUrl && (
                            <img 
                              src={ep.capaUrl}
                              alt={ep.titulo}
                              className="w-full h-full object-cover"
                            />
                          )}
                          <Badge className="absolute top-2 right-2 bg-purple-600 text-white">
                            <Headphones className="h-3 w-3 mr-1" />
                            Podcast
                          </Badge>
                        </div>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg leading-snug text-clamp-2 break-words">
                            {ep.titulo}
                          </CardTitle>
                          <CardDescription className="text-clamp-3 break-words">
                            {contentCardDescription(ep.descricao) || ep.descricao || 'Episódio disponível na plataforma.'}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <Button 
                            className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Ouvir Episódio
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}
              </div>
              <Button 
                variant="outline" 
                onClick={() => navigate('/inteligencia-mercado')}
                className="w-full mt-6 md:hidden"
              >
                Ver Mais Conteúdos
              </Button>
            </div>

           
          </div>
        </main>
      </div>
      <CadastroCelebrationModal
        open={showCadastroCelebration}
        payload={cadastroCelebrationPayload}
        onClose={() => setShowCadastroCelebration(false)}
      />
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle>Crie sua conta</DialogTitle>
            <DialogDescription>
              Para acessar este conteúdo, é preciso se cadastrar ou fazer login.
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
      {/* Redirecionamento para premium */}
      {redirectPremium && (
        navigate('/cadastro-premium'), null
      )}
    </div>
  );
};

export default Index;
