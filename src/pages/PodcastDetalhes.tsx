// In src/pages/PodcastDetalhes.tsx, replace the entire content with:

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Calendar, Download, Pause, Play, Home, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';

const PodcastDetalhes = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [episodio, setEpisodio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [user] = useAuthState(auth);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [podcastsBaixados, setPodcastsBaixados] = useState<string[]>([]);

  useEffect(() => {
    const fetchEpisodio = async () => {
      setLoading(true);
      const docRef = doc(db, 'podcast_episodios', id!);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setEpisodio({ id: docSnap.id, ...docSnap.data() });
      }
      setLoading(false);
    };
    if (id) fetchEpisodio();
  }, [id]);

  useEffect(() => {
    const checkPremiumStatus = async () => {
      if (!user) return;
      try {
        const userRef = doc(db, 'usuarios', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setIsPremium(userData.isPremium === true);
          setPodcastsBaixados(userData.podcastsBaixados || []);
        }
      } catch (error) {
        console.error('Erro ao verificar status premium:', error);
      }
    };
    
    if (user) {
      checkPremiumStatus();
    }
  }, [user]);

  useEffect(() => {
    if (!audioRef) return;
    const handleTimeUpdate = () => setCurrentTime(audioRef!.currentTime);
    const handleLoadedMetadata = () => setDuration(audioRef!.duration);
    const handleEnded = () => setIsPlaying(false);
    
    audioRef.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioRef.addEventListener('ended', handleEnded);
    
    return () => {
      audioRef.removeEventListener('timeupdate', handleTimeUpdate);
      audioRef.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioRef.removeEventListener('ended', handleEnded);
    };
  }, [audioRef]);

  const handlePlayPause = () => {
    if (!audioRef) return;
    if (isPlaying) {
      audioRef.pause();
    } else {
      audioRef.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef) return;
    const time = Number(e.target.value);
    audioRef.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!user) {
      e.preventDefault();
      setShowAuthModal(true);
      return;
    }

    try {
      const userRef = doc(db, 'usuarios', user.uid);
      const userSnap = await getDoc(userRef);
      
      let currentDownloads = [...podcastsBaixados];
      let isUserPremium = isPremium;
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        isUserPremium = userData.isPremium === true;
        currentDownloads = userData.podcastsBaixados || [];
      }

      // Check download limit for non-premium users
      if (!isUserPremium && currentDownloads.length >= 2 && !currentDownloads.includes(id!)) {
        e.preventDefault();
        setShowUpgradeModal(true);
        return;
      }

      // Register the download if not already registered
      if (!currentDownloads.includes(id!)) {
        if (userSnap.exists()) {
          await updateDoc(userRef, { 
            podcastsBaixados: arrayUnion(id!) 
          });
        } else {
          await setDoc(userRef, { 
            podcastsBaixados: [id!] 
          }, { merge: true });
        }
        setPodcastsBaixados([...currentDownloads, id!]);
      }
      // Allow the download to proceed
    } catch (err) {
      console.error('Erro ao registrar download do podcast:', err);
      alert('Erro ao processar o download. Tente novamente.');
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 p-8 animate-fade-in">
          <div className="max-w-2xl pl-8 text-left">
            <nav className="flex items-center text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
              <Link to="/" className="flex items-center hover:text-oraculo-blue">
                <Home className="h-4 w-4 mr-1" />Início
              </Link>
              <ChevronRight className="h-4 w-4 mx-1" />
              <Link to="/podcast" className="hover:text-oraculo-blue">Podcast</Link>
              <ChevronRight className="h-4 w-4 mx-1" />
              <span className="text-oraculo-blue font-medium truncate max-w-[180px]" title={episodio?.titulo}>
                {episodio?.titulo || 'Detalhes'}
              </span>
            </nav>
            
            {loading ? (
              <div className="p-8 text-gray-500 text-left">Carregando...</div>
            ) : !episodio ? (
              <div className="p-8 text-gray-500 text-left">Episódio não encontrado.</div>
            ) : (
              <>
                <h1 className="text-2xl font-bold mb-4 text-left">{episodio.titulo}</h1>
                <div className="flex flex-row gap-8 items-start mb-6">
                  {episodio.capaUrl && (
                    <img 
                      src={episodio.capaUrl} 
                      alt="Capa do episódio" 
                      className="h-56 w-56 rounded object-cover border" 
                    />
                  )}
                  <div className="flex-1 text-left">
                    <div className="text-lg mb-2">
                      {showFullDescription
                        ? episodio.descricao
                        : (episodio.descricao?.split('. ')[0] + (episodio.descricao?.split('. ').length > 1 ? '...' : ''))}
                      {episodio.descricao?.split('. ').length > 1 && (
                        <button
                          className="ml-2 text-oraculo-blue underline text-sm"
                          onClick={(e) => { e.preventDefault(); setShowFullDescription(v => !v); }}
                        >
                          {showFullDescription ? 'Mostrar menos' : 'Mostrar mais'}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {episodio.criadoEm && episodio.criadoEm.toDate 
                          ? episodio.criadoEm.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) 
                          : (episodio.criadoEm 
                              ? new Date(episodio.criadoEm.seconds * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) 
                              : 'N/A')}
                      </span>
                    </div>
                    {episodio.mp3Url && (
                      <div className="mt-4 flex flex-col gap-2">
                        <audio
                          src={episodio.mp3Url}
                          ref={el => setAudioRef(el)}
                          preload="metadata"
                        />
                        <div className="flex items-center gap-4">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              if (!user) {
                                setShowAuthModal(true);
                              } else {
                                handlePlayPause();
                              }
                            }}
                          >
                            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                          </Button>
                          <input
                            type="range"
                            min={0}
                            max={duration || 0}
                            value={currentTime}
                            onChange={handleSeek}
                            className="w-48 h-1 accent-oraculo-blue"
                            step={0.1}
                            disabled={!user}
                          />
                          <span className="text-xs tabular-nums text-gray-700">
                            {formatTime(currentTime)} / {formatTime(duration)}
                          </span>
                          <a
                            href={user ? episodio.mp3Url : undefined}
                            download={user ? true : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleDownload}
                          >
                            <Button type="button" size="icon" variant="outline">
                              <Download className="h-5 w-5" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
        
        {/* Auth Required Modal */}
        <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
          <DialogContent className="max-w-xs text-center">
            <DialogHeader>
              <DialogTitle>Crie sua conta</DialogTitle>
              <DialogDescription>
                Para ter acesso ao conteúdo completo do Oráculo Cultural, é preciso se cadastrar.
              </DialogDescription>
            </DialogHeader>
            <Button 
              className="mt-4 w-full bg-oraculo-blue text-white" 
              onClick={() => {
                setShowAuthModal(false);
                navigate('/cadastro');
              }}
            >
              Criar conta
            </Button>
          </DialogContent>
        </Dialog>

        {/* Upgrade Required Modal */}
        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="max-w-xs text-center">
            <DialogHeader>
              <DialogTitle>Limite de downloads atingido</DialogTitle>
              <DialogDescription>
                Você atingiu o limite de 2 downloads com a conta gratuita. Faça upgrade para Premium para baixar podcasts e ebooks ilimitados.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 mt-4">
              <Button 
                className="bg-oraculo-gold text-white hover:bg-oraculo-gold/90"
                onClick={() => {
                  setShowUpgradeModal(false);
                  navigate('/cadastro-premium');
                }}
              >
                Fazer upgrade para Premium
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowUpgradeModal(false)}
              >
                Continuar com conta gratuita
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default PodcastDetalhes;