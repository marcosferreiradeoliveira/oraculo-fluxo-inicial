import React, { useEffect, useState } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BookOpen, 
  Headphones, 
  TrendingUp, 
  Clock, 
  Calendar,
  Play,
  FileText,
  Plus
} from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Guia {
  id: string;
  titulo: string;
  descricao: string;
  imgUrl: string;
  pdfUrl: string;
  criadoEm?: any;
}

interface Podcast {
  id: string;
  titulo: string;
  descricao: string;
  mp3Url?: string;
  capaUrl?: string;
  duracao?: string;
  criadoEm?: any;
}

const InteligenciaMercado = () => {
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [guias, setGuias] = useState<Guia[]>([]);
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loadingGuias, setLoadingGuias] = useState(true);
  const [loadingPodcasts, setLoadingPodcasts] = useState(true);

  const isAdmin = user?.uid === 'hrhmpF6bzORxypoL9djAo2HoL1d2';

  useEffect(() => {
    const fetchGuias = async () => {
      try {
        const guiasRef = collection(db, 'guias');
        const q = query(guiasRef, orderBy('criadoEm', 'desc'));
        const snapshot = await getDocs(q);
        const guiasData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Guia[];
        setGuias(guiasData);
      } catch (error) {
        console.error('Erro ao buscar guias:', error);
      } finally {
        setLoadingGuias(false);
      }
    };

    const fetchPodcasts = async () => {
      try {
        const podcastsRef = collection(db, 'podcast_episodios');
        const q = query(podcastsRef, orderBy('criadoEm', 'desc'));
        const snapshot = await getDocs(q);
        const podcastsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Podcast[];
        setPodcasts(podcastsData);
      } catch (error) {
        console.error('Erro ao buscar podcasts:', error);
      } finally {
        setLoadingPodcasts(false);
      }
    };

    fetchGuias();
    fetchPodcasts();
  }, []);

  const formatDate = (date: any) => {
    if (!date) return '';
    
    if (date.toDate) {
      return date.toDate().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
    
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 overflow-auto">
        <DashboardHeader />
        <main className="p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-oraculo-blue to-oraculo-purple rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Inteligência de Mercado</h1>
              </div>
              
              {/* Botão Admin - Cadastrar Conteúdo */}
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Cadastrar Conteúdo
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate('/cadastrar-guia')}>
                      <FileText className="h-4 w-4 mr-2" />
                      Cadastrar Guia
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/cadastrar-episodio')}>
                      <Headphones className="h-4 w-4 mr-2" />
                      Cadastrar Podcast
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <p className="text-gray-600 text-lg">
              Acesse guias especializados e podcasts sobre editais culturais, tendências do mercado e melhores práticas
            </p>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="guias" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
              <TabsTrigger value="guias" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Guias
              </TabsTrigger>
              <TabsTrigger value="podcasts" className="flex items-center gap-2">
                <Headphones className="h-4 w-4" />
                Podcasts
              </TabsTrigger>
            </TabsList>

            {/* Guias Tab */}
            <TabsContent value="guias">
              {loadingGuias ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oraculo-blue"></div>
                  <span className="ml-4 text-lg">Carregando guias...</span>
                </div>
              ) : guias.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Nenhum guia disponível no momento</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {guias.map((guia) => (
                    <Card key={guia.id} className="hover:shadow-lg transition-all hover:-translate-y-1">
                      <div className="aspect-video relative overflow-hidden rounded-t-lg">
                        <img 
                          src={guia.imgUrl} 
                          alt={guia.titulo}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg leading-tight line-clamp-2">
                          {guia.titulo}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {guia.descricao}
                        </CardDescription>
                        {guia.criadoEm && (
                          <div className="flex items-center text-xs text-gray-500 mt-2">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(guia.criadoEm)}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Button 
                          variant="default" 
                          className="w-full"
                          onClick={() => window.open(guia.pdfUrl, '_blank')}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Abrir Guia
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Podcasts Tab */}
            <TabsContent value="podcasts">
              {loadingPodcasts ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oraculo-blue"></div>
                  <span className="ml-4 text-lg">Carregando podcasts...</span>
                </div>
              ) : podcasts.length === 0 ? (
                <div className="text-center py-12">
                  <Headphones className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Nenhum podcast disponível no momento</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {podcasts.map((podcast) => (
                    <Card 
                      key={podcast.id} 
                      className="hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer"
                      onClick={() => navigate(`/podcast/${podcast.id}`)}
                    >
                      <div className="aspect-video relative overflow-hidden rounded-t-lg">
                        {podcast.capaUrl && (
                          <img 
                            src={podcast.capaUrl} 
                            alt={podcast.titulo}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Play className="h-16 w-16 text-white" />
                        </div>
                      </div>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg leading-tight line-clamp-2">
                          {podcast.titulo}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {podcast.descricao}
                        </CardDescription>
                        <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                          {podcast.criadoEm && (
                            <div className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {formatDate(podcast.criadoEm)}
                            </div>
                          )}
                          {podcast.duracao && (
                            <div className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {podcast.duracao}
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Button 
                          variant="outline" 
                          className="w-full"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Ouvir Episódio
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default InteligenciaMercado;

