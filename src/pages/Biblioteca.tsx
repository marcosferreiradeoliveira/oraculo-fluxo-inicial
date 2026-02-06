import React, { useEffect, useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Download, Star, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { trackGuiaDownloaded } from '@/lib/analytics';

const Biblioteca = () => {
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [guias, setGuias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Função para remover tags HTML e retornar texto puro
  const stripHtmlTags = (html: string): string => {
    if (!html) return '';
    // Remove tags HTML usando regex
    const text = html.replace(/<[^>]*>/g, '');
    // Decodifica entidades HTML comuns
    return text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  };

  useEffect(() => {
    const checkSuperAdmin = async () => {
      if (user?.uid) {
        try {
          // Verificar email do usuário
          if (user?.email) {
            setUserEmail(user.email);
          }
          
          const userDocRef = doc(db, 'usuarios', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setIsSuperAdmin(userData.role === 'super_admin');
            if (!user?.email && userData.email) {
              setUserEmail(userData.email);
            }
          }
        } catch (error) {
          console.error('Erro ao verificar role do usuário:', error);
        }
      }
    };

    checkSuperAdmin();
  }, [user]);

  useEffect(() => {
    const fetchGuias = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, 'guias'));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Especiais primeiro; depois normais ordenados por data de criação (mais recente primeiro)
        const guiasEspeciais = data.filter((g: any) => g.especial === true);
        const guiasNormais = data.filter((g: any) => !g.especial || g.especial === false);
        const toDate = (v: any): number => {
          if (!v) return 0;
          if (v && typeof v.toDate === 'function') return v.toDate().getTime();
          if (v && typeof v.seconds === 'number') return v.seconds * 1000;
          if (typeof v === 'string' || typeof v === 'number') return new Date(v).getTime();
          return 0;
        };
        guiasNormais.sort((a: any, b: any) => toDate(b.criadoEm) - toDate(a.criadoEm));
        const guiasOrdenados = [...guiasEspeciais, ...guiasNormais];
        
        setGuias(guiasOrdenados);
      } catch (e) {
        setGuias([]);
      } finally {
        setLoading(false);
      }
    };
    fetchGuias();
  }, []);

  const handleDownload = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, pdfUrl: string, guiaTitulo: string) => {
    if (!user) {
      e.preventDefault();
      setShowAuthModal(true);
      return;
    }
    
    // Track guia download
    // Extrair nome do guia (tentar identificar tipo: PNAB, RioFilme, etc)
    const guiaNome = guiaTitulo.toLowerCase().includes('pnab') ? 'PNAB' :
                     guiaTitulo.toLowerCase().includes('riofilme') ? 'RioFilme' :
                     guiaTitulo.toLowerCase().includes('aldir') ? 'Aldir_Blanc' :
                     guiaTitulo;
    
    trackGuiaDownloaded({
      guiaNome: guiaNome,
      conversaoTipo: user ? 'lead' : undefined, // Lead já está autenticado
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8 animate-fade-in">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                  <BookOpen className="h-8 w-8 text-oraculo-blue" />
                  Biblioteca de Guias
                </h1>
                <p className="text-gray-600 text-sm md:text-base">
                  Acesse nossa coleção completa de guias estratégicos, ebooks e estudos especializados em cultura.
                </p>
              </div>
              {isSuperAdmin && (
                <Button className="bg-oraculo-blue text-white" onClick={() => navigate('/cadastrar-guia')}>
                  + Cadastrar Guia
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                <div className="text-center text-gray-500 py-12 col-span-3">Carregando guias...</div>
              ) : guias.length === 0 ? (
                <div className="text-center text-gray-500 py-12 col-span-3">Nenhum guia cadastrado ainda.</div>
              ) : (
                guias.map((guia, index) => {
                  // Verificação mais robusta para isEspecial (pode vir como true, "true", 1, etc)
                  const isEspecial = Boolean(guia.especial) && (guia.especial === true || String(guia.especial).toLowerCase() === 'true' || Number(guia.especial) === 1);
                  return (
                  <Card key={guia.id || index} className="hover:shadow-lg transition-all hover:-translate-y-1">
                    <div className="aspect-video relative overflow-hidden rounded-t-lg">
                      <img 
                        src={guia.imgUrl} 
                        alt={guia.titulo}
                        className="w-full h-full object-cover"
                      />
                      {isEspecial ? (
                        <Badge 
                          className="absolute top-3 left-3 bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white"
                        >
                          ESPECIAL
                        </Badge>
                      ) : (
                        <Badge 
                          className="absolute top-3 left-3 bg-oraculo-magenta/90 text-white"
                        >
                          Guia
                        </Badge>
                      )}
                      {/* Botão Editar - Apenas para marcosferreira@mobcontent.com.br */}
                      {userEmail === 'marcosferreira@mobcontent.com.br' && (
                        <div className="absolute top-3 right-3">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-white/90 hover:bg-white shadow-md"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate(`/editar-guia/${guia.id}`);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg leading-tight">
                        {guia.titulo}
                      </CardTitle>
                      <CardDescription>
                        {(() => {
                          const descricaoLimpa = stripHtmlTags(guia.descricao || '');
                          return descricaoLimpa.length > 120
                            ? descricaoLimpa.slice(0, 120) + '...'
                            : descricaoLimpa;
                        })()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between mb-4">
                        {/* Se quiser adicionar rating/downloads, descomente e ajuste conforme os dados salvos */}
                        {/* <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-oraculo-gold text-oraculo-gold" />
                          <span className="text-sm font-medium">{guia.rating}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {guia.downloads} downloads
                        </span> */}
                      </div>
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
                            handleDownload(e as any, guia.pdfUrl, guia.titulo);
                          }
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {isEspecial ? 'Ver Detalhes' : 'Baixar Guia'}
                      </Button>
                    </CardContent>
                  </Card>
                );
                })
              )}
            </div>
          </div>
        </main>
      </div>
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle>Crie sua conta</DialogTitle>
            <DialogDescription>
              Para baixar os guias do Oráculo Cultural, é preciso se cadastrar ou fazer login.
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
    </div>
  );
};

export default Biblioteca;
