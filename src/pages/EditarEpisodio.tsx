import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { db, storage } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const EditarEpisodio = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [capaUrl, setCapaUrl] = useState('');
  const [mp3Url, setMp3Url] = useState('');
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [mp3File, setMp3File] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadEpisodio, setLoadEpisodio] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'podcast_episodios', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const d = snap.data();
          setTitulo(d.titulo || '');
          setDescricao(d.descricao || '');
          setCapaUrl(d.capaUrl || '');
          setMp3Url(d.mp3Url || '');
        }
      } catch (e) {
        setError('Erro ao carregar episódio.');
      } finally {
        setLoadEpisodio(false);
      }
    };
    load();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!id || !titulo || !descricao) {
      setError('Preencha título e descrição.');
      return;
    }
    setLoading(true);
    try {
      let finalCapaUrl = capaUrl;
      let finalMp3Url = mp3Url;
      if (capaFile) {
        const capaRef = ref(storage, `podcast/capas/${Date.now()}_${capaFile.name}`);
        await uploadBytes(capaRef, capaFile);
        finalCapaUrl = await getDownloadURL(capaRef);
      }
      if (mp3File) {
        const mp3Ref = ref(storage, `podcast/episodios/${Date.now()}_${mp3File.name}`);
        await uploadBytes(mp3Ref, mp3File);
        finalMp3Url = await getDownloadURL(mp3Ref);
      }
      const docRef = doc(db, 'podcast_episodios', id);
      await updateDoc(docRef, {
        titulo,
        descricao,
        capaUrl: finalCapaUrl,
        mp3Url: finalMp3Url,
      });
      navigate('/podcast');
    } catch (err) {
      setError('Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (loadEpisodio) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 p-8 flex items-center justify-center">
            <p className="text-gray-600">Carregando...</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 p-8 animate-fade-in">
          <div className="max-w-xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Editar Episódio</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <Input
                    type="text"
                    placeholder="Título do episódio"
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    required
                  />
                  <Textarea
                    placeholder="Descrição do episódio"
                    value={descricao}
                    onChange={e => setDescricao(e.target.value)}
                    required
                  />
                  <div>
                    <label className="block text-sm font-medium mb-1">Capa (deixe em branco para manter a atual)</label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={e => setCapaFile(e.target.files?.[0] || null)}
                    />
                    {capaUrl && !capaFile && (
                      <p className="text-xs text-gray-500 mt-1">Capa atual em uso.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Áudio (deixe em branco para manter o atual)</label>
                    <Input
                      type="file"
                      accept="audio/mp3,audio/mpeg"
                      onChange={e => setMp3File(e.target.files?.[0] || null)}
                    />
                    {mp3Url && !mp3File && (
                      <p className="text-xs text-gray-500 mt-1">Áudio atual em uso.</p>
                    )}
                  </div>
                  {error && <div className="text-red-600 text-sm">{error}</div>}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => navigate('/podcast')}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1 bg-oraculo-blue text-white" disabled={loading}>
                      {loading ? 'Salvando...' : 'Salvar alterações'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EditarEpisodio;
