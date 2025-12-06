import React, { useEffect, useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { QuickAccessCards } from '@/components/QuickAccessCards';
import { FeaturedGuides } from '@/components/FeaturedGuides';
import { RecentContent } from '@/components/RecentContent';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit, doc, getDoc, setDoc, updateDoc, arrayUnion, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Brain, Download, Play, Calendar, DollarSign, TrendingUp, FileText, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import emailImage from '@/assets/email.png';
import logo from '@/assets/logo.png';

const Index = () => {
  const navigate = useNavigate();
  const [guias, setGuias] = useState<any[]>([]);
  const [loadingGuias, setLoadingGuias] = useState(true);
  const [podcasts, setPodcasts] = useState<any[]>([]);
  const [loadingPodcasts, setLoadingPodcasts] = useState(true);
  const [editais, setEditais] = useState<any[]>([]);
  const [loadingEditais, setLoadingEditais] = useState(true);
  const [user] = useAuthState(auth);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [redirectPremium, setRedirectPremium] = useState(false);
  const [emailNewsletter, setEmailNewsletter] = useState('');
  const [salvandoEmail, setSalvandoEmail] = useState(false);

  useEffect(() => {
    const fetchGuias = async () => {
      setLoadingGuias(true);
      try {
        // Busca apenas 2 guias
        let snapshot;
        try {
          const qGuias = query(collection(db, 'guias'), orderBy('criadoEm', 'desc'), limit(2));
          snapshot = await getDocs(qGuias);
        } catch (orderError) {
          console.log('Erro ao ordenar, buscando sem ordenação:', orderError);
          const qGuias = query(collection(db, 'guias'), limit(2));
          snapshot = await getDocs(qGuias);
        }
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGuias(data);
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
            if (!edital.data_encerramento) return false;
            
            let dataEncerramento: Date;
            if (edital.data_encerramento?.toDate) {
              dataEncerramento = edital.data_encerramento.toDate();
            } else if (edital.data_encerramento?.seconds) {
              dataEncerramento = new Date(edital.data_encerramento.seconds * 1000);
            } else if (typeof edital.data_encerramento === 'string') {
              dataEncerramento = new Date(edital.data_encerramento);
            } else {
              return false;
            }
            
            return !isNaN(dataEncerramento.getTime()) && dataEncerramento > now;
          })
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
        isPremium = data.isPremium || false;
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
            {/* Welcome Message */}
            <div className="mb-8 flex flex-col md:flex-row items-center md:items-start gap-4">
              <div className="flex-shrink-0">
                <img 
                  src={logo} 
                  alt="Oráculo Cultural Logo" 
                  className="w-24 h-24 md:w-32 md:h-32 object-contain"
                />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  Bem-vinda ao seu Oráculo Cultural! ✨
                </h1>
                <p className="text-gray-600 text-sm md:text-base">
                  Aqui você encontra todas as ferramentas e conteúdos para transformar seus projetos culturais em realidade.
                </p>
              </div>
            </div>

            {/* Quick Access Section */}
            <QuickAccessCards />

            {/* Editais Abertos */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  Editais Abertos
                </h2>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/oraculo-ai')}
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
                        className="hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer"
                        onClick={() => navigate(`/edital/${edital.id}`)}
                      >
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg leading-tight line-clamp-2">
                            {edital.nome || 'Edital sem nome'}
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
                          <Button 
                            variant="outline" 
                            className="w-full mt-2"
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
              <Button 
                variant="outline" 
                onClick={() => navigate('/oraculo-ai')}
                className="w-full mt-6 md:hidden"
              >
                Ver Mais Editais
              </Button>
              
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
                            origem: 'home_editais_abertos'
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
                    {guias.map((guia, index) => (
                      <Card key={`guia-${guia.id || index}`} className="hover:shadow-lg transition-all hover:-translate-y-1">
                        <div className="aspect-video relative overflow-hidden rounded-t-lg">
                          <img 
                            src={guia.imgUrl} 
                            alt={guia.titulo}
                            className="w-full h-full object-cover"
                          />
                          <Badge className="absolute top-2 right-2 bg-blue-600 text-white">
                            <FileText className="h-3 w-3 mr-1" />
                            Guia
                          </Badge>
                        </div>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg leading-tight line-clamp-2">
                            {guia.titulo}
                          </CardTitle>
                          <CardDescription className="line-clamp-2">
                            {guia.descricao}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <Button 
                            className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90" 
                            asChild
                          >
                            <a
                              href={guia.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => handleDownloadGuia(e, guia.id, guia.pdfUrl)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Baixar Guia
                            </a>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}

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
                          <CardTitle className="text-lg leading-tight line-clamp-2">
                            {ep.titulo}
                          </CardTitle>
                          <CardDescription className="line-clamp-2">
                            {ep.descricao}
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
