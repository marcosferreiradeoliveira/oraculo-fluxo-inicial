import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, Upload, FileText, CheckCircle, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { toast } from 'sonner';

interface ProjetoDocument {
  id: string;
  nome?: string;
  edital_id?: string;
  documentos_inscricao?: Array<{ documento: string; url?: string; nomeArquivo?: string }>;
  [key: string]: unknown;
}

interface EditalDocument {
  id: string;
  nome?: string;
  documentacao_exigida?: Array<string | { nome: string; fase?: string }>;
  [key: string]: unknown;
}

const steps = ['Criar Projeto', 'Avaliar com IA', 'Alterar com IA', 'Gerar Textos', 'Criar Orçamento', 'Criar Cronograma', 'Documentos de Inscrição', 'Preencher Anexos'];
const currentStep = 6; // Documentos de Inscrição = bolinha 7

const DocumentosInscricao = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [projeto, setProjeto] = useState<ProjetoDocument | null>(null);
  const [edital, setEdital] = useState<EditalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const documentacaoExigida: string[] = edital?.documentacao_exigida
    ? edital.documentacao_exigida.map((item) =>
        typeof item === 'string' ? item : (item as { nome: string; fase?: string }).nome || String(item)
      )
    : [];

  const documentosSalvos = projeto?.documentos_inscricao ?? [];

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !user) {
        setLoading(false);
        return;
      }
      try {
        const db = getFirestore();
        const projetoRef = doc(db, 'projetos', id);
        const projetoSnap = await getDoc(projetoRef);
        if (!projetoSnap.exists()) {
          setLoading(false);
          return;
        }
        const projetoData = { id: projetoSnap.id, ...projetoSnap.data() } as ProjetoDocument;
        setProjeto(projetoData);

        if (projetoData.edital_id) {
          const editalRef = doc(db, 'editais', projetoData.edital_id as string);
          const editalSnap = await getDoc(editalRef);
          if (editalSnap.exists()) {
            setEdital({ id: editalSnap.id, ...editalSnap.data() } as EditalDocument);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, user]);

  const handleUpload = async (index: number, file: File) => {
    if (!id || !user || !projeto) return;
    setUploadingIndex(index);
    try {
      const storage = getStorage();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `projetos/${id}/documentos_inscricao/${index}_${Date.now()}_${safeName}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const docLabel = documentacaoExigida[index] ?? `Documento ${index + 1}`;
      const novosDocumentos = documentacaoExigida.map((doc, i) =>
        i === index
          ? { documento: docLabel, url, nomeArquivo: file.name }
          : (documentosSalvos[i] ?? { documento: doc })
      );

      const db = getFirestore();
      await updateDoc(doc(db, 'projetos', id), {
        documentos_inscricao: novosDocumentos,
      });
      setProjeto((prev) => (prev ? { ...prev, documentos_inscricao: novosDocumentos } : null));
      toast.success('Documento enviado com sucesso.');
    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error('Erro ao enviar documento.');
    } finally {
      setUploadingIndex(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 flex items-center justify-center p-8">
            <p className="text-gray-600">Carregando...</p>
          </main>
        </div>
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 flex items-center justify-center p-8">
            <p className="text-gray-600">Projeto não encontrado.</p>
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
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            {/* Barra de progresso (bolinhas) - mesmo padrão das outras páginas */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                {steps.map((step, index) => {
                  const isClickable = index <= currentStep;
                  const routes = [
                    `/projeto/${id}`,
                    `/projeto/${id}`,
                    `/projeto/${id}/alterar-com-ia`,
                    `/projeto/${id}/gerar-textos`,
                    `/projeto/${id}/criar-orcamento`,
                    `/projeto/${id}/criar-cronograma`,
                    `/projeto/${id}/documentos-inscricao`,
                    `/projeto/${id}/preencher-anexos`,
                  ];
                  return (
                    <div
                      key={index}
                      className={`flex flex-col items-center flex-1 min-w-0 ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                      onClick={() => {
                        if (isClickable && routes[index]) navigate(routes[index] as string);
                      }}
                    >
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                          index <= currentStep
                            ? 'bg-oraculo-blue text-white hover:bg-oraculo-blue/90'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <span
                        className={`text-xs mt-1 text-center transition-colors truncate w-full ${
                          index === currentStep
                            ? 'font-medium text-oraculo-blue'
                            : index < currentStep
                              ? 'text-oraculo-blue'
                              : 'text-gray-500'
                        }`}
                      >
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-oraculo-blue h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(`/projeto/${id}/criar-cronograma`)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Documentos de Inscrição</h1>
                  <p className="text-gray-600 text-sm md:text-base mt-1">
                    Projeto: {projeto.nome || 'sem nome'}
                    {edital?.nome && ` · Edital: ${edital.nome}`}
                  </p>
                </div>
              </div>
              <Button
                className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white shrink-0"
                onClick={() => navigate(`/projeto/${id}/preencher-anexos`)}
              >
                Preencher Anexos
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>

            {documentacaoExigida.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-600">
                  {edital
                    ? 'Este edital não possui lista de documentação exigida cadastrada.'
                    : 'Associe um edital ao projeto para ver os documentos exigidos para inscrição.'}
                  <div className="mt-4">
                    <Button variant="outline" onClick={() => navigate(`/projeto/${id}/criar-cronograma`)}>
                      Voltar ao Cronograma
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-6 w-6 text-oraculo-blue" />
                    Documentação exigida pelo edital
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {documentacaoExigida.map((label, index) => {
                    const salvo = documentosSalvos[index];
                    const isUploading = uploadingIndex === index;
                    return (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50/50"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <FileText className="h-5 w-5 text-oraculo-blue flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900">{label}</p>
                            {salvo?.url && (
                              <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" />
                                {salvo.nomeArquivo || 'Arquivo enviado'}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <input
                            type="file"
                            id={`doc-${index}`}
                            className="hidden"
                            accept=".pdf,.doc,.docx,image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(index, file);
                              e.target.value = '';
                            }}
                          />
                          <Button
                            type="button"
                            variant={salvo?.url ? 'outline' : 'default'}
                            size="sm"
                            className={!salvo?.url ? 'bg-oraculo-blue hover:bg-oraculo-blue/90' : ''}
                            disabled={isUploading}
                            onClick={() => document.getElementById(`doc-${index}`)?.click()}
                          >
                            {isUploading ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            {salvo?.url ? 'Substituir' : 'Enviar'}
                          </Button>
                          {salvo?.url && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(salvo.url, '_blank')}
                            >
                              Ver
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => navigate(`/projeto/${id}/criar-cronograma`)}>
                Voltar ao Cronograma
              </Button>
              <Button
                className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
                onClick={() => navigate(`/projeto/${id}/preencher-anexos`)}
              >
                Ir para Preencher Anexos
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DocumentosInscricao;
