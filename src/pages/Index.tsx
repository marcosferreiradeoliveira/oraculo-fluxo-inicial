
import React, { useEffect, useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { QuickAccessCards } from '@/components/QuickAccessCards';
import { FeaturedGuides } from '@/components/FeaturedGuides';
import { RecentContent } from '@/components/RecentContent';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Brain, Download, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const navigate = useNavigate();
  const [guias, setGuias] = useState<any[]>([]);
  const [loadingGuias, setLoadingGuias] = useState(true);
  const [podcasts, setPodcasts] = useState<any[]>([]);
  const [loadingPodcasts, setLoadingPodcasts] = useState(true);

  useEffect(() => {
    const fetchGuias = async () => {
      setLoadingGuias(true);
      try {
        const qGuias = query(collection(db, 'guias'), orderBy('criadoEm', 'desc'), limit(3));
        const snapshot = await getDocs(qGuias);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGuias(data);
      } catch (e) {
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
        const qPodcasts = query(collection(db, 'podcast_episodios'), orderBy('criadoEm', 'desc'), limit(3));
        const snapshot = await getDocs(qPodcasts);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPodcasts(data);
      } catch (e) {
        setPodcasts([]);
      } finally {
        setLoadingPodcasts(false);
      }
    };
    fetchPodcasts();
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
        <main className="flex-1 p-8 animate-fade-in">
          <div className="max-w-7xl mx-auto">
            {/* Welcome Message */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Bem-vinda ao seu Oráculo Cultural! ✨
              </h1>
              <p className="text-gray-600">
                Aqui você encontra todas as ferramentas e conteúdos para transformar seus projetos culturais em realidade.
              </p>
            </div>

            {/* Quick Access Section */}
            <QuickAccessCards />

            {/* Decodificando os Editais do Momento */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                Decodificando os Editais do Momento
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loadingGuias ? (
                  <div className="text-center text-gray-500 py-12 col-span-3">Carregando guias...</div>
                ) : guias.length === 0 ? (
                  <div className="text-center text-gray-500 py-12 col-span-3">Nenhum guia cadastrado ainda.</div>
                ) : (
                  guias.map((guia, index) => (
                    <Card key={guia.id || index} className="hover:shadow-lg transition-all hover:-translate-y-1">
                      <div className="aspect-video relative overflow-hidden rounded-t-lg">
                        <img 
                          src={guia.imgUrl} 
                          alt={guia.titulo}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg leading-tight">
                          {guia.titulo}
                        </CardTitle>
                        <CardDescription>
                          {guia.descricao && guia.descricao.length > 100
                            ? guia.descricao.slice(0, 100) + '...'
                            : guia.descricao}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Button className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90" asChild>
                          <a href={guia.pdfUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-2" />
                            Baixar Guia
                          </a>
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Podcasts */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                Podcasts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loadingPodcasts ? (
                  <div className="text-center text-gray-500 py-12 col-span-3">Carregando episódios...</div>
                ) : podcasts.length === 0 ? (
                  <div className="text-center text-gray-500 py-12 col-span-3">Nenhum episódio cadastrado ainda.</div>
                ) : (
                  podcasts.map((ep, index) => (
                    <Card key={ep.id || index} className="hover:shadow-lg transition-all hover:-translate-y-1">
                      <div className="aspect-video relative overflow-hidden rounded-t-lg">
                        {ep.capaUrl && (
                          <img 
                            src={ep.capaUrl}
                            alt={ep.titulo}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg leading-tight">
                          {ep.titulo}
                        </CardTitle>
                        <CardDescription>
                          {ep.descricao && ep.descricao.length > 100
                            ? ep.descricao.slice(0, 100) + '...'
                            : ep.descricao}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Button className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90" asChild>
                          <a href={ep.mp3Url} target="_blank" rel="noopener noreferrer">
                            <Play className="h-4 w-4 mr-2" />
                            Ouvir
                          </a>
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

           
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
