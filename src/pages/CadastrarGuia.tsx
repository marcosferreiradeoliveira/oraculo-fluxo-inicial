import React, { useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const CadastrarGuia = () => {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [pdf, setPdf] = useState<File | null>(null);
  const [imagem, setImagem] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!titulo || !descricao || !pdf || !imagem) {
      setErro('Preencha todos os campos e selecione os arquivos.');
      return;
    }
    setUploading(true);
    try {
      const storage = getStorage();
      // Upload PDF
      const pdfRef = storageRef(storage, `guias/${Date.now()}_${pdf.name}`);
      await uploadBytes(pdfRef, pdf);
      const pdfUrl = await getDownloadURL(pdfRef);
      // Upload Imagem
      const imgRef = storageRef(storage, `guias/${Date.now()}_${imagem.name}`);
      await uploadBytes(imgRef, imagem);
      const imgUrl = await getDownloadURL(imgRef);
      // Salvar no Firestore
      await addDoc(collection(db, 'guias'), {
        titulo,
        descricao,
        pdfUrl,
        imgUrl,
        criadoEm: new Date(),
      });
      navigate('/biblioteca');
    } catch (e: any) {
      setErro('Erro ao cadastrar guia: ' + (e.message || e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 p-8 animate-fade-in flex items-center justify-center">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Cadastrar Novo Guia</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-sm font-medium mb-1">Título</label>
                  <Input value={titulo} onChange={e => setTitulo(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Descrição</label>
                  <Input value={descricao} onChange={e => setDescricao(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">PDF do Guia</label>
                  <Input type="file" accept="application/pdf" onChange={e => setPdf(e.target.files?.[0] || null)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Imagem de Capa</label>
                  <Input type="file" accept="image/*" onChange={e => setImagem(e.target.files?.[0] || null)} required />
                </div>
                {erro && <div className="text-red-500 text-sm">{erro}</div>}
                <Button type="submit" className="w-full bg-oraculo-blue text-white" disabled={uploading}>
                  {uploading ? 'Cadastrando...' : 'Cadastrar Guia'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default CadastrarGuia; 