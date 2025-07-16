import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [showFullDescription, setShowFullDescription] = useState(false);

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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 p-8 animate-fade-in">
          <div className="max-w-2xl pl-8 text-left">
            {/* Breadcrumb */}
            <nav className="flex items-center text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
              <Link to="/" className="flex items-center hover:text-oraculo-blue"><Home className="h-4 w-4 mr-1" />Início</Link>
              <ChevronRight className="h-4 w-4 mx-1" />
              <Link to="/podcast" className="hover:text-oraculo-blue">Podcast</Link>
              <ChevronRight className="h-4 w-4 mx-1" />
              <span className="text-oraculo-blue font-medium truncate max-w-[180px]" title={episodio?.titulo}>{episodio?.titulo || 'Detalhes'}</span>
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
                    <img src={episodio.capaUrl} alt="Capa do episódio" className="h-56 w-56 rounded object-cover border" />
                  )}
                  <div className="flex-1 text-left">
                    <div className="text-lg mb-2">
                      {showFullDescription
                        ? episodio.descricao
                        : (episodio.descricao?.split('. ')[0] + (episodio.descricao?.split('. ').length > 1 ? '...' : ''))}
                      {episodio.descricao?.split('. ').length > 1 && (
                        <button
                          className="ml-2 text-oraculo-blue underline text-sm"
                          onClick={e => { e.preventDefault(); setShowFullDescription(v => !v); }}
                        >
                          {showFullDescription ? 'Mostrar menos' : 'Mostrar mais'}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <Calendar className="h-4 w-4" />
                      <span>{episodio.criadoEm && episodio.criadoEm.toDate ? episodio.criadoEm.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : (episodio.criadoEm ? new Date(episodio.criadoEm.seconds * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'N/A')}</span>
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
                            href={user ? episodio.mp3Url : undefined}
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
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
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
    </div>
  );
};

export default PodcastDetalhes; 