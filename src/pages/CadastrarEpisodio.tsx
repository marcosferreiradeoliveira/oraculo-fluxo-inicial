import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { db, storage } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const CadastrarEpisodio = () => {
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [mp3, setMp3] = useState<File | null>(null);
  const [capa, setCapa] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!titulo || !descricao || !mp3 || !capa) {
      setError('Preencha todos os campos e selecione os arquivos.');
      return;
    }
    setLoading(true);
    try {
      // Upload da capa
      const capaRef = ref(storage, `podcast/capas/${Date.now()}_${capa.name}`);
      await uploadBytes(capaRef, capa);
      const capaUrl = await getDownloadURL(capaRef);
      // Upload do mp3
      const mp3Ref = ref(storage, `podcast/episodios/${Date.now()}_${mp3.name}`);
      await uploadBytes(mp3Ref, mp3);
      const mp3Url = await getDownloadURL(mp3Ref);
      // Salvar no Firestore
      await addDoc(collection(db, 'podcast_episodios'), {
        titulo,
        descricao,
        capaUrl,
        mp3Url,
        criadoEm: new Date()
      });
      navigate('/podcast');
    } catch (err) {
      setError('Erro ao cadastrar episódio. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 p-8 animate-fade-in">
          <div className="max-w-xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Cadastrar Novo Episódio</CardTitle>
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
                    <label className="block text-sm font-medium mb-1">Capa (jpg/png)</label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={e => setCapa(e.target.files?.[0] || null)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Áudio (mp3)</label>
                    <Input
                      type="file"
                      accept="audio/mp3,audio/mpeg"
                      onChange={e => setMp3(e.target.files?.[0] || null)}
                      required
                    />
                  </div>
                  {error && <div className="text-red-600 text-sm">{error}</div>}
                  <Button type="submit" className="w-full bg-oraculo-blue text-white" disabled={loading}>
                    {loading ? 'Salvando...' : 'Cadastrar Episódio'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CadastrarEpisodio; 