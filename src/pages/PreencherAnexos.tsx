import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, FileText, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { toast } from 'sonner';
import { trackProjectStepViewed } from '@/lib/analytics';

interface ProjetoDocument {
  id: string;
  nome?: string;
  [key: string]: any;
}

interface UserDocument {
  dadosCadastrais?: string;
  [key: string]: any;
}

const PreencherAnexos = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [projeto, setProjeto] = useState<ProjetoDocument | null>(null);
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [filledPdfUrl, setFilledPdfUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const steps = ['Criar Projeto', 'Avaliar com IA', 'Alterar com IA', 'Gerar Textos', 'Criar Orçamento', 'Criar Cronograma', 'Documentos de Inscrição', 'Preencher Anexos'];
  const currentStep = 7;

  // Analytics: etapa "Preencher Anexos" visualizada (Mixpanel/Firebase/GTM) — uma vez ao carregar
  const stepViewedRef = React.useRef(false);
  useEffect(() => {
    if (id && projeto && !stepViewedRef.current) {
      stepViewedRef.current = true;
      trackProjectStepViewed({
        projectId: id,
        step: 'preencher_anexos',
      });
    }
  }, [id, projeto]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !user) {
        setLoading(false);
        return;
      }

      try {
        const db = getFirestore();
        
        // Buscar projeto
        const projetoRef = doc(db, 'projetos', id);
        const projetoSnap = await getDoc(projetoRef);
        
        if (projetoSnap.exists()) {
          setProjeto({ id: projetoSnap.id, ...projetoSnap.data() } as ProjetoDocument);
        }

        // Buscar dados cadastrais do usuário
        const userRef = doc(db, 'usuarios', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setUserData(userSnap.data() as UserDocument);
        }

        setLoading(false);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados');
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user]);

  const validateAndSetFile = (file: File) => {
    // Validar se é PDF
    if (file.type !== 'application/pdf') {
      toast.error('Por favor, selecione um arquivo PDF');
      return false;
    }
    
    // Validar tamanho (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 10MB');
      return false;
    }

    setSelectedFile(file);
    // Não criar blob URL aqui - vamos fazer upload primeiro
    setFileUrl(null);
    setFilledPdfUrl(null);
    return true;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (uploading || processing) {
      return;
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      validateAndSetFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user || !id) {
      toast.error('Selecione um arquivo primeiro');
      return;
    }

    setUploading(true);
    setProgress('Fazendo upload do arquivo...');

    try {
      const storage = getStorage();
      const fileName = `anexos/${user.uid}/${id}/${Date.now()}_${selectedFile.name}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, selectedFile);
      const downloadURL = await getDownloadURL(storageRef);
      
      // Usar a URL pública do Storage, não blob URL
      setFileUrl(downloadURL);
      toast.success('Arquivo enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao fazer upload do arquivo');
    } finally {
      setUploading(false);
      setProgress('');
    }
  };

  const handleProcessarPDF = async () => {
    // Se não tiver fileUrl mas tiver selectedFile, fazer upload primeiro
    let urlParaProcessar = fileUrl;
    
    if (!urlParaProcessar && selectedFile) {
      setProcessing(true);
      setProgress('Fazendo upload do arquivo...');
      
      try {
        const storage = getStorage();
        const fileName = `anexos/${user!.uid}/${id}/${Date.now()}_${selectedFile.name}`;
        const storageRef = ref(storage, fileName);
        
        await uploadBytes(storageRef, selectedFile);
        urlParaProcessar = await getDownloadURL(storageRef);
        setFileUrl(urlParaProcessar);
        toast.success('Arquivo enviado com sucesso!');
      } catch (error) {
        console.error('Erro ao fazer upload:', error);
        toast.error('Erro ao fazer upload do arquivo');
        setProcessing(false);
        setProgress('');
        return;
      }
    }

    if (!urlParaProcessar || !user || !id || !projeto) {
      toast.error('Dados incompletos para processar. Faça upload do arquivo primeiro.');
      setProcessing(false);
      setProgress('');
      return;
    }

    // Verificar se a URL é válida (não pode ser blob URL)
    if (urlParaProcessar.startsWith('blob:')) {
      toast.error('Por favor, faça upload do arquivo primeiro clicando em "Enviar Arquivo"');
      setProcessing(false);
      setProgress('');
      return;
    }

    if (!userData?.dadosCadastrais) {
      toast.error('Por favor, preencha os dados cadastrais na página Minha Conta primeiro');
      return;
    }

    setProcessing(true);
    setProgress('Processando PDF com IA...');

    try {
      const endpoint = 'https://us-central1-culturalapp-fb9b0.cloudfunctions.net/preencherAnexoPDF';
      
      console.log('Enviando para processar:', {
        pdfUrl: fileUrl,
        nomeProjeto: projeto.nome,
        userId: user.uid,
        projetoId: id
      });
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfUrl: urlParaProcessar,
          dadosCadastrais: userData.dadosCadastrais,
          nomeProjeto: projeto.nome || 'Projeto',
          userId: user.uid,
          projetoId: id,
        }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `Erro ${response.status}`, message: 'Erro ao processar requisição' };
        }
        
        const errorMessage = errorData.message || errorData.error || `Erro ${response.status}`;
        console.error('Erro da API:', errorData);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (data.pdfPreenchidoUrl) {
        setFilledPdfUrl(data.pdfPreenchidoUrl);
        toast.success('PDF preenchido com sucesso!');
        setProgress('');
      } else {
        throw new Error('URL do PDF preenchido não retornada');
      }
    } catch (error: any) {
      console.error('Erro ao processar PDF:', error);
      const errorMessage = error.message || 'Erro ao processar PDF. Verifique se o PDF possui campos de formulário preenchíveis.';
      toast.error(errorMessage);
      setProgress('');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!filledPdfUrl) return;
    
    const link = document.createElement('a');
    link.href = filledPdfUrl;
    link.download = `${projeto?.nome || 'projeto'}_anexo_preenchido.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 p-4 md:p-8">
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-oraculo-blue mb-4" />
              <p className="text-gray-600">Carregando...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <DashboardHeader />
        <main className="flex-1 p-3 md:p-8 overflow-x-hidden overflow-y-auto pb-20 md:pb-8 min-h-0 animate-fade-in">
          <div className="max-w-4xl mx-auto min-w-0">
            {/* Barra de progresso - scroll horizontal no mobile */}
            <div className="mb-6 md:mb-8 overflow-hidden">
              <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-2 min-w-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                {steps.map((step, index) => {
                  const isClickable = index <= currentStep;
                  const routes = [
                    '/criar-projeto',
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
                      className={`flex flex-col items-center flex-shrink-0 min-w-[3.5rem] md:min-w-0 md:flex-1 ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                      onClick={() => {
                        if (isClickable && routes[index]) navigate(routes[index]);
                      }}
                    >
                      <div
                        className={`h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center text-xs md:text-sm transition-colors flex-shrink-0 ${
                          index <= currentStep
                            ? 'bg-oraculo-blue text-white hover:bg-oraculo-blue/90'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <span
                        className={`text-[10px] md:text-xs mt-1 text-center transition-colors whitespace-nowrap ${
                          index === currentStep
                            ? 'font-medium text-oraculo-blue'
                            : index < currentStep
                              ? 'text-oraculo-blue'
                              : 'text-gray-500'
                        }`}
                        title={step}
                      >
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 min-w-0">
                <div
                  className="bg-oraculo-blue h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl md:text-3xl font-bold text-gray-900 mb-2 flex flex-wrap items-center gap-2 break-words">
                  <FileText className="h-7 w-7 md:h-8 md:w-8 text-oraculo-blue flex-shrink-0" />
                  <span className="break-words">Preencher Anexos</span>
                  <span className="px-2 py-1 text-xs font-semibold bg-gradient-to-r from-orange-400 to-orange-600 text-white rounded-full flex-shrink-0">
                    BETA
                  </span>
                </h1>
                <p className="text-gray-600 text-sm md:text-base break-words">
                  Faça upload de documentos em PDF e deixe a IA preencher automaticamente com os dados cadastrais e nome do projeto
                </p>
              </div>
              <div className="flex flex-col items-stretch sm:items-end gap-1.5 flex-shrink-0 w-full sm:w-auto">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Próximo passo</span>
                <Button
                  size="lg"
                  onClick={() => navigate(`/projeto/${id}/resumo`)}
                  className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white w-full sm:w-auto px-4 sm:px-6 md:px-8 py-3 sm:py-2.5 text-sm sm:text-base font-semibold"
                >
                  Próximo: Resumo do Projeto <span className="ml-2 opacity-90">→</span>
                </Button>
              </div>
            </div>

            {/* Card principal */}
            <div className="bg-white rounded-xl shadow-lg p-4 md:p-8 space-y-6 overflow-hidden">
              {/* Informações do projeto */}
              {projeto && (
                <div className="bg-gradient-to-r from-oraculo-blue/5 to-oraculo-purple/5 rounded-lg p-4 border-l-4 border-oraculo-blue min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-2 break-words">Projeto: {projeto.nome || 'Sem nome'}</h3>
                  {!userData?.dadosCadastrais && (
                    <div className="flex items-start gap-2 mt-2 text-sm text-orange-600">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span className="break-words">
                        Você precisa preencher os dados cadastrais na página{' '}
                        <button
                          onClick={() => navigate('/conta')}
                          className="underline font-medium"
                        >
                          Minha Conta
                        </button>
                        {' '}primeiro
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Upload de arquivo */}
              <div className="space-y-4 min-w-0">
                <h3 className="text-base md:text-lg font-semibold text-gray-900">1. Selecione o arquivo PDF</h3>
                
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-6 md:p-8 text-center transition-all min-w-0 ${
                    isDragging
                      ? 'border-oraculo-blue bg-oraculo-blue/5 scale-[1.02] md:scale-105'
                      : 'border-gray-300 hover:border-oraculo-blue'
                  } ${uploading || processing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                    disabled={uploading || processing}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <Upload className={`h-10 w-10 md:h-12 md:w-12 mx-auto mb-3 md:mb-4 ${isDragging ? 'text-oraculo-blue' : 'text-gray-400'}`} />
                    <p className={`mb-2 text-sm md:text-base ${isDragging ? 'text-oraculo-blue font-medium' : 'text-gray-600'}`}>
                      {isDragging
                        ? 'Solte o arquivo PDF aqui'
                        : 'Clique para selecionar ou arraste um arquivo PDF'}
                    </p>
                    <p className="text-xs md:text-sm text-gray-500">
                      Máximo 10MB
                    </p>
                  </label>
                </div>

                {selectedFile && (
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-8 w-8 text-oraculo-blue flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate break-all">{selectedFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    {!fileUrl && (
                      <Button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="bg-oraculo-blue hover:bg-oraculo-blue/90 w-full sm:w-auto flex-shrink-0"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          'Enviar Arquivo'
                        )}
                      </Button>
                    )}
                  </div>
                )}

                {fileUrl && !fileUrl.startsWith('blob:') && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start sm:items-center gap-3 min-w-0">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                    <span className="text-green-800 font-medium text-sm md:text-base break-words">Arquivo enviado com sucesso! Agora você pode processar o PDF.</span>
                  </div>
                )}
              </div>

              {/* Processar com IA */}
              {fileUrl && userData?.dadosCadastrais && (
                <div className="space-y-4 min-w-0">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900">2. Preencher com IA</h3>
                  
                  <div className="bg-gradient-to-r from-oraculo-blue/10 to-oraculo-purple/10 rounded-lg p-4 md:p-6 border border-oraculo-blue/20">
                    <p className="text-gray-700 mb-4 text-sm md:text-base">
                      A IA irá analisar o PDF e preencher automaticamente os campos com:
                    </p>
                    <ul className="space-y-2 text-gray-700 mb-6 text-sm md:text-base">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        Dados cadastrais da empresa
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        Nome do projeto
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        Outras informações relevantes
                      </li>
                    </ul>

                    <Button
                      onClick={handleProcessarPDF}
                      disabled={processing || !fileUrl}
                      className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white"
                      size="lg"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          <span className="truncate">{progress || 'Processando...'}</span>
                        </>
                      ) : (
                        <>
                          <FileText className="h-5 w-5 mr-2" />
                          Preencher PDF com IA
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Download do PDF preenchido */}
              {filledPdfUrl && (
                <div className="space-y-4 min-w-0">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900">3. Download do PDF preenchido</h3>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 md:p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                      <span className="text-green-800 font-medium text-sm md:text-base break-words">PDF preenchido com sucesso!</span>
                    </div>
                    
                    <Button
                      onClick={handleDownloadPDF}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      size="lg"
                    >
                      <Download className="h-5 w-5 mr-2" />
                      Baixar PDF Preenchido
                    </Button>
                  </div>
                </div>
              )}

              {/* Progress indicator */}
              {progress && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 min-w-0">
                  <p className="text-blue-800 text-sm break-words">{progress}</p>
                </div>
              )}
            </div>
          </div>

          {/* Próximo passo: Resumo do Projeto — mesmo formato das outras páginas */}
          <div className="flex flex-col items-stretch sm:items-end gap-2 pt-6 sm:pt-8 pb-6 px-4 md:px-8 mt-8 sm:mt-10 border-t-2 border-oraculo-blue/20 bg-gradient-to-r from-transparent to-oraculo-purple/5 rounded-b-xl">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Próximo passo</span>
            <Button
              size="lg"
              onClick={() => navigate(`/projeto/${id}/resumo`)}
              className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white w-full sm:w-auto px-4 sm:px-8 md:px-10 py-3 sm:py-4 text-sm sm:text-base md:text-lg font-semibold"
            >
              Próximo: Resumo do Projeto <span className="ml-2 text-lg sm:text-xl" aria-hidden>→</span>
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PreencherAnexos;

