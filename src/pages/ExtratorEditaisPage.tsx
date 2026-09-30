import React, { useState, useCallback } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { analyzeEdital } from '@/modules/extrator-edital/services/geminiService';
import { extractTextFromPdf } from '@/modules/extrator-edital/services/pdfService';
import { salvarAnalise } from '@/modules/extrator-edital/services/firebaseService';
import { buscarProjetosSelecionados, buscarHistoricoEdital } from '@/modules/extrator-edital/services/webSearchService';
import type { EditalData, ProjetoSelecionado, HistoricoEdital } from '@/modules/extrator-edital/types';
import FileUpload from '@/modules/extrator-edital/components/FileUpload';
import ResultDisplay from '@/modules/extrator-edital/components/ResultDisplay';
import ProjetosSelecionados from '@/modules/extrator-edital/components/ProjetosSelecionados';
import Loader from '@/modules/extrator-edital/components/Loader';
import ErrorMessage from '@/modules/extrator-edital/components/ErrorMessage';
import ExtratorHeader from '@/modules/extrator-edital/components/Header';
import { DocumentIcon } from '@/modules/extrator-edital/components/icons/DocumentIcon';
import { toast } from 'sonner';

export default function ExtratorEditaisPage() {
  const [file, setFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<EditalData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projetosSelecionados, setProjetosSelecionados] = useState<ProjetoSelecionado[]>([]);
  const [historicoEdital, setHistoricoEdital] = useState<HistoricoEdital | undefined>(undefined);
  const [buscandoProjetos, setBuscandoProjetos] = useState(false);
  const [ultimoEditalId, setUltimoEditalId] = useState<string | null>(null);

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    setError(null);
    setExtractedData(null);
    setProjetosSelecionados([]);
    setHistoricoEdital(undefined);
    setUltimoEditalId(null);
  };

  const handleAnalyze = useCallback(async () => {
    if (!file) {
      setError('Por favor, selecione um arquivo PDF primeiro.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setExtractedData(null);

    try {
      const text = await extractTextFromPdf(file);
      if (!text || text.trim().length < 100) {
        throw new Error('Não foi possível extrair texto suficiente do PDF.');
      }

      const resultJsonString = await analyzeEdital(text);
      const cleanedJsonString = resultJsonString.replace(/```json/g, '').replace(/```/g, '').trim();
      const resultData: EditalData = JSON.parse(cleanedJsonString);
      setExtractedData(resultData);

      setBuscandoProjetos(true);
      try {
        const [projetosResult, historicoResult] = await Promise.all([
          buscarProjetosSelecionados(resultData.nome, resultData.proponente),
          buscarHistoricoEdital(resultData.nome, resultData.proponente),
        ]);

        if (projetosResult.sucesso) {
          setProjetosSelecionados(projetosResult.projetosEncontrados);
        }
        setHistoricoEdital(historicoResult);

        setExtractedData({
          ...resultData,
          projetos_selecionados: projetosResult.sucesso ? projetosResult.projetosEncontrados : [],
          historico_edital: historicoResult,
        });
      } catch (webSearchError) {
        console.warn('Erro na busca de projetos selecionados:', webSearchError);
      } finally {
        setBuscandoProjetos(false);
      }

      try {
        const { id: editalId, landingSlug } = await salvarAnalise(
          {
            ...resultData,
            nomeArquivo: file.name,
            status: 'sucesso',
            dataEncerramento: resultData.dataEncerramento,
            data_encerramento: resultData.data_encerramento,
          },
          file
        );
        setUltimoEditalId(editalId);
        if (landingSlug) {
          toast.success('Edital importado — landing de campanha criada', {
            description: getEditalLandingPublicUrl(landingSlug),
          });
        } else {
          toast.success('Edital importado e salvo');
        }
      } catch (firebaseError) {
        console.warn('Erro ao salvar no Firebase:', firebaseError);
        toast.error('Análise ok, mas falhou ao salvar no Firestore.');
      }
    } catch (e: unknown) {
      console.error('Analysis failed:', e);
      let errorMessage = 'Ocorreu um erro desconhecido durante a análise.';
      if (e instanceof Error) {
        errorMessage = `Erro na análise: ${e.message}`;
        if (e.message.includes('JSON')) {
          errorMessage = 'A IA retornou uma resposta em formato inválido. Tente novamente.';
        }
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [file]);

  const resetState = () => {
    setFile(null);
    setExtractedData(null);
    setError(null);
    setIsLoading(false);
    setProjetosSelecionados([]);
    setHistoricoEdital(undefined);
    setBuscandoProjetos(false);
    setUltimoEditalId(null);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <DashboardHeader />
        <main className="flex-1 overflow-auto">
          <div className="min-h-full text-gray-900">
            <ExtratorHeader />
            <div className="flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
              <div className="w-full max-w-6xl mx-auto">
                <>
                  <header className="text-center mb-8">
                      <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-oraculo-blue to-oraculo-purple mb-2">
                        Importar e gerenciar editais
                      </h1>
                      <p className="text-lg text-gray-600">
                        Extraia dados do PDF, salve no Firestore e use no restante do Oráculo.
                      </p>
                    </header>

                    <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-6 sm:p-8 border border-gray-200">
                      {!extractedData && !isLoading && (
                        <FileUpload
                          onFileChange={handleFileChange}
                          onAnalyze={handleAnalyze}
                          file={file}
                          disabled={isLoading}
                        />
                      )}

                      {isLoading && (
                        <div className="flex flex-col items-center justify-center space-y-4 min-h-[200px]">
                          <Loader />
                          <p className="text-gray-600 text-lg animate-pulse">Analisando o documento…</p>
                        </div>
                      )}

                      {error && !isLoading && (
                        <ErrorMessage
                          message={error}
                          onRetry={file ? handleAnalyze : resetState}
                          showRetry={!!file}
                        />
                      )}

                      {extractedData && !isLoading && (
                        <div>
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
                            <div className="flex items-center space-x-3">
                              <DocumentIcon className="w-8 h-8 text-oraculo-purple" />
                              <h2 className="text-2xl font-bold text-gray-900">Resultados da análise</h2>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {ultimoEditalId ? (
                                <a
                                  href={`/edital/${ultimoEditalId}`}
                                  className="bg-oraculo-blue/10 hover:bg-oraculo-blue/20 text-oraculo-blue font-semibold py-2 px-4 rounded-lg transition-colors"
                                >
                                  Ver detalhe no Oráculo
                                </a>
                              ) : null}
                              <button
                                type="button"
                                onClick={resetState}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
                              >
                                Analisar outro
                              </button>
                            </div>
                          </div>
                          <ResultDisplay data={extractedData} />
                          <div className="mt-6">
                            <ProjetosSelecionados
                              projetos={projetosSelecionados}
                              historico={historicoEdital}
                              isLoading={buscandoProjetos}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
