import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Editar/Edital</h1>
      <div className="space-y-4">
        <label className="block font-medium mb-1">Nome</label>
        <Input value={edital.nome || ''} onChange={e => handleChange('nome', e.target.value)} />
        <label className="block font-medium mb-1">Escopo</label>
        <Input value={edital.escopo || ''} onChange={e => handleChange('escopo', e.target.value)} />
        <label className="block font-medium mb-1">Critérios</label>
        <Input value={edital.criterios || ''} onChange={e => handleChange('criterios', e.target.value)} />
        <label className="block font-medium mb-1">Categorias</label>
        <Input value={edital.categorias || ''} onChange={e => handleChange('categorias', e.target.value)} />
        <label className="block font-medium mb-1">Data de Encerramento</label>
        <Input value={edital.data_encerramento || ''} onChange={e => handleChange('data_encerramento', e.target.value)} />
        <label className="block font-medium mb-1">Valor Máximo de Premiação</label>
        <Input value={edital.valor_maximo_premiacao || ''} onChange={e => handleChange('valor_maximo_premiacao', e.target.value)} />
        {/* Removido: Documentos Exigidos, Modelo de Orçamento, Cronograma, Carta de Anuência */}
        <label className="block font-medium mb-1">Textos Exigidos</label>
        <Input value={Array.isArray(edital.textos_exigidos) ? edital.textos_exigidos.join(', ') : edital.textos_exigidos || ''} onChange={e => handleChange('textos_exigidos', e.target.value.split(','))} />
        <Button className="mt-4" onClick={handleSalvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Alterações'}</Button>
      </div>
    </div>
  );
};

export default EditarEdital; 