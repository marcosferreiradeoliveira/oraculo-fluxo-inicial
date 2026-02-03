import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Clock, ArrowRight, Plus, Trash2, Calendar, Sparkles, FileDown, ClipboardList } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export interface EtapaCronograma {
  id: string;
  etapa: string;
  inicio: string;
  fim: string;
}

interface ProjetoDocument {
  id: string;
  nome?: string;
  cronograma?: { etapas?: EtapaCronograma[]; atualizado_em?: unknown };
  [key: string]: unknown;
}

const gerarId = () => Math.random().toString(36).slice(2, 11);

const CriarCronograma = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [projeto, setProjeto] = useState<ProjetoDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [etapas, setEtapas] = useState<EtapaCronograma[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [gerandoCronograma, setGerandoCronograma] = useState(false);

  const steps = ['Criar Projeto', 'Avaliar com IA', 'Alterar com IA', 'Gerar Textos', 'Criar Orçamento', 'Criar Cronograma', 'Documentos de Inscrição', 'Preencher Anexos'];
  const currentStep = 5;

  useEffect(() => {
    const fetchProjeto = async () => {
      if (!id || !user) {
        setLoading(false);
        return;
      }

      try {
        const db = getFirestore();
        const projetoRef = doc(db, 'projetos', id);
        const projetoSnap = await getDoc(projetoRef);

        if (projetoSnap.exists()) {
          const data = { id: projetoSnap.id, ...projetoSnap.data() } as ProjetoDocument;
          setProjeto(data);
          const etapasSalvas = data.cronograma?.etapas ?? [];
          setEtapas(Array.isArray(etapasSalvas) ? etapasSalvas.map((e: EtapaCronograma) => ({ ...e, id: e.id || gerarId() })) : []);
        }
      } catch (error) {
        console.error('Erro ao carregar projeto:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjeto();
  }, [id, user]);

  const adicionarEtapa = () => {
    const hoje = new Date().toISOString().slice(0, 10);
    setEtapas((prev) => [...prev, { id: gerarId(), etapa: '', inicio: hoje, fim: hoje }]);
  };

  const removerEtapa = (etapaId: string) => {
    setEtapas((prev) => prev.filter((e) => e.id !== etapaId));
  };

  const atualizarEtapa = (etapaId: string, campo: keyof EtapaCronograma, valor: string) => {
    setEtapas((prev) =>
      prev.map((e) => (e.id === etapaId ? { ...e, [campo]: valor } : e))
    );
  };

  const gerarCronogramaComIA = async () => {
    if (!id || !user) return;
    setGerandoCronograma(true);
    try {
      const res = await fetch('https://us-central1-culturalapp-fb9b0.cloudfunctions.net/gerarCronogramaIA', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projetoId: id, userId: user.uid }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar cronograma');
      }
      const etapasGeradas = Array.isArray(data.etapas) ? data.etapas : [];
      if (etapasGeradas.length === 0) {
        toast.info('A IA não retornou etapas. Tente novamente ou adicione manualmente.');
        return;
      }
      setEtapas(etapasGeradas.map((e: Omit<EtapaCronograma, 'id'>) => ({
        ...e,
        id: gerarId(),
      })));
      toast.success(`Cronograma com ${etapasGeradas.length} etapas gerado. Revise e salve.`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar cronograma com IA.');
    } finally {
      setGerandoCronograma(false);
    }
  };

  const salvarCronograma = async () => {
    if (!id) return;
    const incompletas = etapas.filter((e) => !e.etapa.trim() || !e.inicio || !e.fim);
    if (incompletas.length > 0) {
      toast.error('Preencha etapa, início e fim em todas as linhas.');
      return;
    }
    const comFimAntesDoInicio = etapas.some((e) => e.fim < e.inicio);
    if (comFimAntesDoInicio) {
      toast.error('A data de fim não pode ser anterior à data de início em nenhuma etapa.');
      return;
    }

    setSalvando(true);
    try {
      const db = getFirestore();
      const projetoRef = doc(db, 'projetos', id);
      await updateDoc(projetoRef, {
        cronograma: {
          etapas,
          atualizado_em: serverTimestamp(),
        },
      });
      toast.success('Cronograma salvo com sucesso.');
    } catch (error) {
      console.error('Erro ao salvar cronograma:', error);
      toast.error('Erro ao salvar cronograma. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const formatarDataPtBr = (s: string) => {
    if (!s) return '';
    const d = new Date(s + 'T12:00:00');
    return isNaN(d.getTime()) ? s : d.toLocaleDateString('pt-BR');
  };

  const exportarCronogramaPDF = () => {
    const etapasValidas = etapas.filter((e) => e.etapa.trim() || e.inicio || e.fim);
    if (etapasValidas.length === 0) {
      toast.error('Adicione ao menos uma etapa para exportar.');
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #1a1a1a; margin-bottom: 10px; }
            .info { margin-bottom: 20px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Cronograma - ${(projeto?.nome || 'Projeto').replace(/</g, '&lt;')}</h1>
          <div class="info">Exportado em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
          <table>
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Início</th>
                <th>Fim</th>
              </tr>
            </thead>
            <tbody>
              ${etapasValidas
                .map(
                  (e) =>
                    `<tr><td>${(e.etapa || '').replace(/</g, '&lt;')}</td><td>${formatarDataPtBr(e.inicio)}</td><td>${formatarDataPtBr(e.fim)}</td></tr>`
                )
                .join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
    } else {
      toast.error('Permita pop-ups para exportar em PDF.');
    }
  };

  const exportarCronogramaXLSX = () => {
    const etapasValidas = etapas.filter((e) => e.etapa.trim() || e.inicio || e.fim);
    if (etapasValidas.length === 0) {
      toast.error('Adicione ao menos uma etapa para exportar.');
      return;
    }
    const rows = [['Etapa', 'Início', 'Fim'], ...etapasValidas.map((e) => [e.etapa || '', e.inicio || '', e.fim || ''])];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cronograma');
    const nomeArquivo = `cronograma_${(projeto?.nome || 'projeto').replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);
    toast.success('Planilha exportada.');
  };

  // Gantt: calcular intervalo total e posição de cada barra
  const etapasComDatas = etapas.filter((e) => e.inicio && e.fim && e.etapa.trim());
  const todasDatas = etapasComDatas.flatMap((e) => [new Date(e.inicio).getTime(), new Date(e.fim).getTime()]);
  const minTime = todasDatas.length ? Math.min(...todasDatas) : Date.now();
  const maxTime = todasDatas.length ? Math.max(...todasDatas) : Date.now() + 30 * 24 * 60 * 60 * 1000;
  const rangeMs = maxTime - minTime || 1;

  const formatarMesAno = (d: Date) =>
    d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

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
            <p className="text-gray-600">Projeto não encontrado</p>
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
          <div className="max-w-7xl mx-auto">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  Criar Cronograma
                </h1>
                <p className="text-gray-600 text-sm md:text-base">
                  Cronograma do projeto &quot;{projeto.nome || 'sem nome'}&quot;
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate(`/projeto/${id}/documentos-inscricao`)}
                className="border-oraculo-blue text-oraculo-blue hover:bg-oraculo-blue/10 shrink-0"
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Documentos de Inscrição
              </Button>
            </div>

            {/* Barra de progresso */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                {steps.map((step, index) => {
                  const isClickable = index <= currentStep;
                  return (
                    <div
                      key={index}
                      className={`flex flex-col items-center ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                      onClick={() => {
                        if (isClickable) {
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
                          if (routes[index]) navigate(routes[index]);
                        }
                      }}
                    >
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                          index <= currentStep
                            ? 'bg-oraculo-blue text-white hover:bg-oraculo-blue/90'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <span
                        className={`text-xs mt-1 text-center transition-colors ${
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

            {/* Formulário de etapas */}
            <Card className="bg-white shadow-lg border-2 border-gray-200 mb-8">
              <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-oraculo-blue" />
                    Etapas do cronograma
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    A opção &quot;Criar com IA&quot; gera etapas com base no orçamento, nos textos do projeto e no prazo do edital.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      type="button"
                      onClick={gerarCronogramaComIA}
                      disabled={gerandoCronograma}
                      className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white"
                    >
                      {gerandoCronograma ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Criar com IA
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      onClick={adicionarEtapa}
                      variant="outline"
                      className="border-oraculo-blue text-oraculo-blue hover:bg-oraculo-blue/10"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Nova etapa
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b text-left text-sm text-gray-600">
                        <th className="pb-2 pr-2">Etapa</th>
                        <th className="pb-2 pr-2">Início</th>
                        <th className="pb-2 pr-2">Fim</th>
                        <th className="pb-2 w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {etapas.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-gray-500">
                            Nenhuma etapa. Clique em &quot;Nova etapa&quot; para adicionar.
                          </td>
                        </tr>
                      ) : (
                        etapas.map((e) => (
                          <tr key={e.id} className="border-b border-gray-100">
                            <td className="py-2 pr-2">
                              <Input
                                placeholder="Ex: Produção, Divulgação..."
                                value={e.etapa}
                                onChange={(ev) => atualizarEtapa(e.id, 'etapa', ev.target.value)}
                                className="max-w-xs"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <Input
                                type="date"
                                value={e.inicio}
                                onChange={(ev) => atualizarEtapa(e.id, 'inicio', ev.target.value)}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <Input
                                type="date"
                                value={e.fim}
                                onChange={(ev) => atualizarEtapa(e.id, 'fim', ev.target.value)}
                              />
                            </td>
                            <td className="py-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removerEtapa(e.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-3 pt-2 items-center">
                  <Button
                    onClick={salvarCronograma}
                    disabled={salvando || etapas.length === 0}
                    className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white"
                  >
                    {salvando ? 'Salvando...' : 'Salvar cronograma'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={exportarCronogramaPDF}
                    disabled={etapas.filter((e) => e.etapa.trim() || e.inicio || e.fim).length === 0}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Exportar PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={exportarCronogramaXLSX}
                    disabled={etapas.filter((e) => e.etapa.trim() || e.inicio || e.fim).length === 0}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Exportar XLSX
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/projeto/${id}/documentos-inscricao`)}
                  >
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Documentos de Inscrição
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/projeto/${id}/preencher-anexos`)}
                  >
                    Continuar para Preencher Anexos
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Gantt */}
            {etapasComDatas.length > 0 && (
              <Card className="bg-white shadow-lg border-2 border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-6 w-6 text-oraculo-blue" />
                    Visão Gantt
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      {/* Eixo do tempo: meses */}
                      <div className="flex text-xs text-gray-500 mb-2 border-b pb-1">
                        <div className="w-40 flex-shrink-0" />
                        <div className="flex-1 relative h-8">
                          {Array.from({ length: 13 }, (_, i) => {
                            const t = minTime + (rangeMs * i) / 12;
                            const d = new Date(t);
                            return (
                              <div
                                key={i}
                                className="absolute top-0 text-center transform -translate-x-1/2 whitespace-nowrap"
                                style={{
                                  left: `${(i / 12) * 100}%`,
                                }}
                              >
                                {formatarMesAno(d)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {/* Barras por etapa */}
                      <div className="space-y-2">
                        {etapasComDatas.map((e) => {
                          const startMs = new Date(e.inicio).getTime();
                          const endMs = new Date(e.fim).getTime();
                          const left = ((startMs - minTime) / rangeMs) * 100;
                          const width = ((endMs - startMs) / rangeMs) * 100;
                          return (
                            <div key={e.id} className="flex items-center gap-2 min-h-[36px]">
                              <div className="w-40 flex-shrink-0 text-sm text-gray-700 truncate" title={e.etapa}>
                                {e.etapa}
                              </div>
                              <div className="flex-1 relative h-8 bg-gray-100 rounded overflow-hidden">
                                <div
                                  className="absolute top-1 bottom-1 rounded bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white text-xs flex items-center justify-center font-medium truncate px-1"
                                  style={{
                                    left: `${left}%`,
                                    width: `${Math.max(width, 4)}%`,
                                    minWidth: '2px',
                                  }}
                                  title={`${e.inicio} → ${e.fim}`}
                                >
                                  {width >= 15 ? `${e.inicio} - ${e.fim}` : ''}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default CriarCronograma;
