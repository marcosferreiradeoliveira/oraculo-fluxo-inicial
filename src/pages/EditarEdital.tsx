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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col md:ml-64">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                {loading ? 'Carregando...' : `Editar Edital: ${edital?.nome || ''}`}
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Atualize as informações do edital conforme necessário
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-oraculo-blue"></div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md overflow-hidden p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Nome do Edital</label>
                    <Input
                      value={edital?.nome || ''}
                      onChange={(e) => handleChange('nome', e.target.value)}
                      placeholder="Nome do edital"
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Data de Encerramento</label>
                    <Input
                      type="date"
                      value={edital?.dataEncerramento || ''}
                      onChange={(e) => handleChange('dataEncerramento', e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Descrição</label>
                  <textarea
                    value={edital?.descricao || ''}
                    onChange={(e) => handleChange('descricao', e.target.value)}
                    placeholder="Descrição do edital"
                    className="w-full border rounded-md p-2 min-h-[100px] focus:ring-2 focus:ring-oraculo-blue/50 focus:border-oraculo-blue outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FileUpload
                    label="Arquivo de Orçamento"
                    file={orcamentoFile}
                    setFile={setOrcamentoFile}
                    currentFileUrl={edital?.orcamentoUrl}
                    onUpload={() => orcamentoFile && handleUpload('orcamentoUrl', orcamentoFile)}
                  />

                  <FileUpload
                    label="Cronograma"
                    file={cronogramaFile}
                    setFile={setCronogramaFile}
                    currentFileUrl={edital?.cronogramaUrl}
                    onUpload={() => cronogramaFile && handleUpload('cronogramaUrl', cronogramaFile)}
                  />

                  <FileUpload
                    label="Carta de Anuência"
                    file={cartaFile}
                    setFile={setCartaFile}
                    currentFileUrl={edital?.cartaAprovacaoUrl}
                    onUpload={() => cartaFile && handleUpload('cartaAprovacaoUrl', cartaFile)}
                  />
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => window.history.back()}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSalvar}
                    disabled={salvando}
                    className="bg-oraculo-blue hover:bg-oraculo-blue/90 text-white"
                  >
                    {salvando ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

// Componente auxiliar para upload de arquivos
const FileUpload = ({ label, file, setFile, currentFileUrl, onUpload }: any) => (
  <div className="space-y-2">
    <label className="block text-sm font-medium text-gray-700">{label}</label>
    <div className="flex items-center gap-2">
      <Input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-oraculo-blue/10 file:text-oraculo-blue hover:file:bg-oraculo-blue/20"
      />
      {file && (
        <Button
          type="button"
          onClick={onUpload}
          className="bg-oraculo-blue hover:bg-oraculo-blue/90 text-white text-sm"
        >
          Upload
        </Button>
      )}
    </div>
    {currentFileUrl && (
      <a
        href={currentFileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-oraculo-blue hover:underline inline-block mt-1"
      >
        Ver arquivo atual
      </a>
    )}
  </div>
);

export default EditarEdital;