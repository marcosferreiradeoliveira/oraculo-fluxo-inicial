import React, { useEffect, useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Download, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const Biblioteca = () => {
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [guias, setGuias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const fetchGuias = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, 'guias'));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGuias(data);
      } catch (e) {
        setGuias([]);
      } finally {
        setLoading(false);
      }
    };
    fetchGuias();
  }, []);

  const handleDownload = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, pdfUrl: string) => {
    if (!user) {
      e.preventDefault();
      setShowAuthModal(true);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col md:ml-64">
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
              {user && user.uid === 'sCacAc0ShPfafYjpy0t4pBp77Tb2' && (
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
                guias.map((guia, index) => (
                  <Card key={guia.id || index} className="hover:shadow-lg transition-all hover:-translate-y-1">
                    <div className="aspect-video relative overflow-hidden rounded-t-lg">
                      <img 
                        src={guia.imgUrl} 
                        alt={guia.titulo}
                        className="w-full h-full object-cover"
                      />
                      <Badge 
                        className="absolute top-3 left-3 bg-oraculo-magenta/90 text-white"
                      >
                        Guia
                      </Badge>
                    </div>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg leading-tight">
                        {guia.titulo}
                      </CardTitle>
                      <CardDescription>
                        {guia.descricao && guia.descricao.length > 120
                          ? guia.descricao.slice(0, 120) + '...'
                          : guia.descricao}
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
                      <Button className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90" asChild>
                        <a
                          href={user ? guia.pdfUrl : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => handleDownload(e, guia.pdfUrl)}
                        >
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
