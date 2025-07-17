import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';

const EditarEdital = () => {
  const { id } = useParams();
  const [edital, setEdital] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [orcamentoFile, setOrcamentoFile] = useState<File | null>(null);
  const [cronogramaFile, setCronogramaFile] = useState<File | null>(null);
  const [cartaFile, setCartaFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchEdital = async () => {
      if (!id) return;
      setLoading(true);
      const db = getFirestore();
      const ref = doc(db, 'editais', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setEdital({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    };
    fetchEdital();
  }, [id]);

  const handleChange = (field: string, value: any) => {
    setEdital((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleUpload = async (field: string, file: File) => {
    const storage = getStorage();
    const fileRef = storageRef(storage, `editais/${id}/${field}_${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    setEdital((prev: any) => ({ ...prev, [field]: url }));
  };

  const handleSalvar = async () => {
    if (!id) return;
    setSalvando(true);
    const db = getFirestore();
    const ref = doc(db, 'editais', id);
    await updateDoc(ref, edital);
    setSalvando(false);
    alert('Edital atualizado com sucesso!');
  };

  if (loading || !edital) return <div className="p-8">Carregando...</div>;

  // Conversão para exibir deadline como string yyyy-mm-dd
  const deadlineStr = edital.deadline
    ? (edital.deadline.seconds
        ? new Date(edital.deadline.seconds * 1000)
        : new Date(edital.deadline)
      ).toISOString().slice(0, 10)
    : '';

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 flex items-start justify-start p-8 gap-8 animate-fade-in">
          <div className="w-full max-w-md">
            {/* Breadcrumb ao estilo CriarProjeto */}
            <nav className="mb-8">
              <ol className="flex flex-wrap items-center gap-2 text-sm">
                <li>
                  <a href="/" className="text-oraculo-blue hover:underline">Início</a>
                </li>
                <li className="text-gray-400">/</li>
                <li>
                  <a href="/oraculo-ai" className="text-oraculo-blue hover:underline">Oráculo AI</a>
                </li>
                <li className="text-gray-400">/</li>
                <li className="font-semibold text-gray-700">Editar Edital</li>
              </ol>
            </nav>
            <h1 className="text-2xl font-bold text-gray-900 mb-6 text-left">Editar Edital</h1>
            <div className="space-y-4 text-left">
              <label className="block font-medium mb-1">Nome</label>
              <Input value={edital.nome || ''} onChange={e => handleChange('nome', e.target.value)} />
              <label className="block font-medium mb-1">Escopo</label>
              <Input value={edital.escopo || ''} onChange={e => handleChange('escopo', e.target.value)} />
              <label className="block font-medium mb-1">Critérios</label>
              <Input value={edital.criterios || ''} onChange={e => handleChange('criterios', e.target.value)} />
              <label className="block font-medium mb-1">Categorias</label>
              <Input value={edital.categorias || ''} onChange={e => handleChange('categorias', e.target.value)} />
              <label className="block font-medium mb-1">Data de Encerramento</label>
              <Input
                type="date"
                value={deadlineStr}
                onChange={e => {
                  const date = new Date(e.target.value);
                  handleChange('deadline', date);
                }}
              />
              <label className="block font-medium mb-1">Valor Máximo de Premiação</label>
              <Input
                type="number"
                value={edital.value || ''}
                onChange={e => handleChange('value', Number(e.target.value))}
                min={0}
                step={1}
              />
              <label className="block font-medium mb-1">Textos Exigidos</label>
              <Input value={Array.isArray(edital.textos_exigidos) ? edital.textos_exigidos.join(', ') : edital.textos_exigidos || ''} onChange={e => handleChange('textos_exigidos', e.target.value.split(','))} />
              <Button className="mt-4" onClick={handleSalvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Alterações'}</Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EditarEdital; 