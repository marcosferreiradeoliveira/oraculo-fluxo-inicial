import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Calendar, ArrowLeft, ExternalLink, Sparkles, FileText, Edit, Play } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuthState } from 'react-firebase-hooks/auth';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';

interface Guia {
  id: string;
  titulo: string;
  descricao: string;
  imgUrl: string;
  pdfUrl?: string;
  landingPageUrl?: string;
  especial?: boolean;
  valorOriginal?: number;
  valorPromocional?: number;
  youtubeUrl?: string;
  criadoEm?: any;
}

const DetalhesGuiaEspecial = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [guia, setGuia] = useState<Guia | null>(null);
  const [loading, setLoading] = useState(true);
  const [user] = useAuthState(auth);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    // Verificar email do usuário
    if (user?.email) {
      setUserEmail(user.email);
    } else if (user?.uid) {
      // Se não tiver email no auth, buscar do Firestore
      const fetchUserEmail = async () => {
        try {
          const userDocRef = doc(db, 'usuarios', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserEmail(userData.email || null);
          }
        } catch (error) {
          console.error('Erro ao buscar email do usuário:', error);
        }
      };
      fetchUserEmail();
    } else {
      setUserEmail(null);
    }
  }, [user]);

  useEffect(() => {
    const fetchGuia = async () => {
      setLoading(true);
      try {
        if (!id) {
          setLoading(false);
          return;
        }
        
        const docRef = doc(db, 'guias', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Guia;
          setGuia(data);
        } else {
          // Se não encontrar, redirecionar para página de guias
          navigate('/inteligencia-mercado');
        }
      } catch (error) {
        console.error('Erro ao buscar guia:', error);
        navigate('/inteligencia-mercado');
      } finally {
        setLoading(false);
      }
    };
    
    fetchGuia();
  }, [id, navigate]);

  const formatDate = (date: any) => {
    if (!date) return '';
    
    if (date.toDate) {
      return date.toDate().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    }
    
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  // Função para extrair o ID do vídeo do YouTube
  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  };

  const handleAcessarLandingPage = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    if (guia?.landingPageUrl) {
      window.open(guia.landingPageUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto">
          <DashboardHeader />
          <main className="p-8">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oraculo-blue"></div>
              <span className="ml-4 text-lg">Carregando guia...</span>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!guia) {
    return (
      <div className="flex h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto">
          <DashboardHeader />
          <main className="p-8">
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">Guia não encontrado</p>
              <Button 
                onClick={() => navigate('/inteligencia-mercado')}
                className="mt-4"
              >
                Voltar para Guias
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 overflow-auto">
        <DashboardHeader />
        <main className="p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            {/* Botão Voltar e Editar */}
            <div className="flex items-center justify-between mb-6">
              <Button
                variant="ghost"
                onClick={() => navigate('/inteligencia-mercado')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para Guias
              </Button>
              
              {/* Botão Editar - Apenas para marcosferreira@mobcontent.com.br */}
              {userEmail === 'marcosferreira@mobcontent.com.br' && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/editar-guia/${id}`)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar Guia
                </Button>
              )}
            </div>

            {/* Card Principal */}
            <Card className="overflow-hidden">
              {/* Imagem de Capa */}
              <div className="relative w-full h-64 md:h-96 overflow-hidden">
                <img 
                  src={guia.imgUrl} 
                  alt={guia.titulo}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      ESPECIAL
                    </div>
                  </div>
                  <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">
                    {guia.titulo}
                  </h1>
                  {guia.criadoEm && (
                    <div className="flex items-center text-white/80 text-sm">
                      <Calendar className="h-4 w-4 mr-1" />
                      {formatDate(guia.criadoEm)}
                    </div>
                  )}
                </div>
              </div>

              {/* Conteúdo */}
              <CardContent className="p-6 md:p-8">
                {/* Vídeo do YouTube (se disponível) */}
                {guia.youtubeUrl && getYouTubeVideoId(guia.youtubeUrl) && (
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                      <Play className="h-5 w-5 text-oraculo-blue" />
                      <h2 className="text-xl font-semibold text-gray-900">Vídeo</h2>
                    </div>
                    <div className="w-full rounded-xl overflow-hidden shadow-lg">
                      <div className="relative" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                          className="absolute top-0 left-0 w-full h-full"
                          src={`https://www.youtube.com/embed/${getYouTubeVideoId(guia.youtubeUrl)}`}
                          title={guia.titulo}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Descrição Completa */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-5 w-5 text-oraculo-blue" />
                    <h2 className="text-xl font-semibold text-gray-900">Sobre este Guia</h2>
                  </div>
                  <div 
                    className="prose max-w-none text-gray-700 leading-relaxed text-base md:text-lg"
                    dangerouslySetInnerHTML={{ __html: guia.descricao }}
                  />
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 my-8" />

                {/* Preço e Call to Action */}
                <div className="bg-gradient-to-r from-oraculo-blue/10 to-oraculo-purple/10 rounded-xl p-6 md:p-8">
                  {/* Exibição de Preço */}
                  {guia.valorOriginal && guia.valorPromocional && (
                    <div className="text-center mb-6">
                      <div className="flex items-center justify-center gap-3 mb-2">
                        <span className="text-2xl md:text-3xl text-gray-400 line-through">
                          R$ {guia.valorOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-3xl md:text-4xl font-bold text-oraculo-purple">
                          R$ {guia.valorPromocional.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {guia.valorOriginal > guia.valorPromocional && (
                        <p className="text-sm text-gray-600">
                          Economia de R$ {(guia.valorOriginal - guia.valorPromocional).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  )}
                  
                  <div className="text-center mb-6">
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                      Acesse o Conteúdo Completo
                    </h3>
                    <p className="text-gray-600 text-sm md:text-base">
                      Clique no botão abaixo para acessar e fazer o download.
                    </p>
                  </div>
                  <Button
                    onClick={handleAcessarLandingPage}
                    className="w-full md:w-auto mx-auto flex items-center justify-center gap-2 bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white px-8 py-6 text-lg font-semibold"
                    size="lg"
                  >
                    <ExternalLink className="h-5 w-5" />
                    Acessar Landing Page
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Modal de Autenticação */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle>Acesso Restrito</DialogTitle>
            <DialogDescription>
              Para acessar este guia especial, é necessário fazer login ou criar uma conta.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <Button 
              className="w-full bg-oraculo-blue text-white" 
              onClick={() => {
                setShowAuthModal(false);
                navigate('/cadastro');
              }}
            >
              Criar Conta / Entrar
            </Button>
            <Button 
              variant="outline"
              className="w-full" 
              onClick={() => setShowAuthModal(false)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DetalhesGuiaEspecial;
