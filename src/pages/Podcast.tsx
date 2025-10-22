import React, { useEffect, useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Headphones, Play, Clock, Calendar, Download, Pause } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const Podcast = () => {
  const navigate = useNavigate();

  // Episódios do Firestore
  const [episodios, setEpisodios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [user] = useAuthState(auth);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const fetchEpisodios = async () => {
      setLoading(true);
      const episodiosRef = collection(db, 'podcast_episodios');
      const episodiosQuery = query(episodiosRef, orderBy('criadoEm', 'desc'));
      const snapshot = await getDocs(episodiosQuery);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEpisodios(data);
      setLoading(false);
    };
    fetchEpisodios();
  }, []);

  useEffect(() => {
    if (!audioRef) return;
    const handleTimeUpdate = () => setCurrentTime(audioRef.currentTime);
    const handleLoadedMetadata = () => setDuration(audioRef.duration);
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
      setIsPlaying(false);
    } else {
      audioRef.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef) return;
    const time = Number(e.target.value);
    audioRef.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (s: number) => {
    if (isNaN(s)) return '00:00';
    const min = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

  const handleAuthRedirect = () => {
    setShowAuthModal(true);
    setTimeout(() => {
      navigate('/cadastro');
    }, 1200);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <Headphones className="h-8 w-8 text-oraculo-blue" />
                Podcast Oráculo Cultural
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Acompanhe nossos episódios e fique por dentro das novidades do mundo cultural.
              </p>
            </div>

            {loading ? (
              <div className="text-center text-gray-500 py-12">Carregando episódios...</div>
            ) : episodios.length === 0 ? (
              <div className="text-center text-gray-500 py-12">Nenhum episódio cadastrado ainda.</div>
            ) : (
              <>
                {/* Episódio em Destaque */}
                <Card className="mb-8 bg-gradient-to-r from-oraculo-blue/5 to-oraculo-purple/5 border-oraculo-blue/20">
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-oraculo-magenta text-white">Mais Recente</Badge>
                    </div>
                    <CardTitle className="text-2xl mb-2">
                      <Link to={`/podcast/${episodios[0].id}`} className="hover:underline">
                        {episodios[0].titulo}
                      </Link>
                    </CardTitle>
                    <div className="flex flex-row gap-8 items-start">
                      {episodios[0].capaUrl && (
                        <Link to={`/podcast/${episodios[0].id}`}> <img src={episodios[0].capaUrl} alt="Capa do episódio" className="h-56 w-56 rounded object-cover border hover:opacity-80 transition" /> </Link>
                      )}
                      <div className="flex-1">
                        <CardDescription className="text-lg mb-2">
                          {showFullDescription
                            ? episodios[0].descricao
                            : (episodios[0].descricao?.split('. ')[0] + (episodios[0].descricao?.split('. ').length > 1 ? '...' : ''))}
                          {episodios[0].descricao?.split('. ').length > 1 && (
                            <button
                              className="ml-2 text-oraculo-blue underline text-sm"
                              onClick={e => { e.preventDefault(); setShowFullDescription(v => !v); }}
                            >
                              {showFullDescription ? 'Mostrar menos' : 'Mostrar mais'}
                            </button>
                          )}
                        </CardDescription>
                        <div className="flex items-center gap-4 text-gray-600 mb-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{episodios[0].criadoEm && episodios[0].criadoEm.toDate ? episodios[0].criadoEm.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : (episodios[0].criadoEm ? new Date(episodios[0].criadoEm.seconds * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'N/A')}</span>
                          </div>
                        </div>
                        {episodios[0].mp3Url && (
                          <div className="mt-4 flex flex-col gap-2">
                            <audio
                              src={episodios[0].mp3Url}
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
                                max={duration}
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
                                href={user ? episodios[0].mp3Url : undefined}
                                download={user ? true : undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => {
                                  if (!user) {
                                    e.preventDefault();
                                    setShowAuthModal(true);
                                  }
                                }}
                              >
                                <Button type="button" size="icon" variant="outline">
                                  <Download className="h-5 w-5" />
                                </Button>
                              </a>
                            </div>
                            {!user && (
                              <span className="text-oraculo-blue font-medium text-sm mt-2">Acesse todos os conteúdos e ferramentas do Oráculo Cultural criando sua conta</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Lista de Episódios */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Todos os Episódios</h2>
                  {episodios.map((episodio, index) => (
                    <Card key={episodio.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6 flex items-start gap-6">
                        {episodio.capaUrl && (
                          <Link to={`/podcast/${episodio.id}`}> <img src={episodio.capaUrl} alt="Capa do episódio" className="h-20 w-20 rounded object-cover border hover:opacity-80 transition" /> </Link>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {index === 0 ? 'Destaque' : `#${episodio.id.slice(-4)}`}
                            </Badge>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            <Link to={`/podcast/${episodio.id}`} className="hover:underline">
                              {episodio.titulo}
                            </Link>
                          </h3>
                          <p className="text-gray-600 mb-3">
                            {episodio.descricao}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{episodio.duracao || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{episodio.criadoEm && episodio.criadoEm.toDate ? episodio.criadoEm.toDate().toLocaleDateString() : (episodio.criadoEm ? new Date(episodio.criadoEm.seconds * 1000).toLocaleDateString() : 'N/A')}</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" className="ml-4" asChild>
                          <a href={episodio.mp3Url} target="_blank" rel="noopener noreferrer">
                            <Play className="h-4 w-4 mr-2" />
                            Ouvir
                          </a>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle>Crie sua conta</DialogTitle>
            <DialogDescription>
              Para ter acesso ao conteúdo completo do Oráculo Cultural, é preciso se cadastrar.
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

export default Podcast;
