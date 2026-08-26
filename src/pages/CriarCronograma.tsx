import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Clock, ArrowRight, Plus, Trash2, Calendar, Sparkles, FileDown, ChevronRight, ChevronDown } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { toast } from 'sonner';
import { trackTextGenerationStarted, trackTextGenerationCompleted, trackProjectStepViewed } from '@/lib/analytics';
import * as XLSX from 'xlsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Dev: proxy Vite. Produção: rewrite do Firebase Hosting para a função (mesma origem, sem CORS)
const GERAR_CRONOGRAMA_URL = '/api/gerarCronogramaIA';

export type MacroEtapa = 'pre_producao' | 'producao' | 'divulgacao' | 'pos_producao';

export const MACRO_ETAPAS: { value: MacroEtapa; label: string }[] = [
  { value: 'pre_producao', label: 'Pré-produção' },
  { value: 'producao', label: 'Produção' },
  { value: 'divulgacao', label: 'Divulgação' },
  { value: 'pos_producao', label: 'Pós-produção' },
];

/** Ordem de exibição na lista: pré, produção, pós, divulgação (etapas concomitantes podem estar em qualquer ordem dentro da mesma fase) */
const ORDEM_MACRO_LISTA: MacroEtapa[] = ['pre_producao', 'producao', 'pos_producao', 'divulgacao'];
function ordenarEtapasPorFase(etapas: EtapaCronograma[]): EtapaCronograma[] {
  return [...etapas].sort((a, b) => {
    const fa = a.macroEtapa || 'producao';
    const fb = b.macroEtapa || 'producao';
    const ia = ORDEM_MACRO_LISTA.indexOf(fa);
    const ib = ORDEM_MACRO_LISTA.indexOf(fb);
    if (ia !== ib) return ia - ib;
    return (a.inicio || '').localeCompare(b.inicio || '');
  });
}

export function getMacroEtapaLabel(value: MacroEtapa | undefined): string {
  return MACRO_ETAPAS.find((m) => m.value === value)?.label ?? 'Produção';
}

export interface EtapaCronograma {
  id: string;
  etapa: string;
  inicio: string;
  fim: string;
  macroEtapa?: MacroEtapa;
  /** Nomes das rubricas do orçamento associadas a esta etapa */
  rubricasAssociadas?: string[];
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
  const [sugestoesCronograma, setSugestoesCronograma] = useState('');
  const [processandoAlteracoes, setProcessandoAlteracoes] = useState(false);
  const [etapasAnteriores, setEtapasAnteriores] = useState<EtapaCronograma[]>([]);
  const [duracaoProjetoMeses, setDuracaoProjetoMeses] = useState<number | ''>('');
  const [expandedEtapaId, setExpandedEtapaId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [creditos, setCreditos] = useState<number>(0);

  const steps = ['Criar Projeto', 'Avaliar com IA', 'Alterar com IA', 'Gerar Textos', 'Criar Orçamento', 'Criar Cronograma', 'Documentos de Inscrição', 'Preencher Anexos'];
  const currentStep = 5;

  // Analytics: etapa "Criar Cronograma" visualizada (Mixpanel/Firebase/GTM) — uma vez ao carregar
  const stepViewedRef = React.useRef(false);
  useEffect(() => {
    if (id && projeto && !stepViewedRef.current) {
      stepViewedRef.current = true;
      trackProjectStepViewed({
        projectId: id,
        step: 'criar_cronograma',
        planType: isPremium ? 'premium' : undefined,
      });
    }
  }, [id, projeto, isPremium]);

  // Carregar premium e créditos (sem plano: 3 créditos para gerar cronograma)
  useEffect(() => {
    const checkAccess = async () => {
      if (!user) return;
      try {
        const db = getFirestore();
        const userRef = doc(db, 'usuarios', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const d = userSnap.data();
          setIsPremium(d?.isPremium === true);
          setCreditos(typeof d?.creditos === 'number' ? d.creditos : 0);
        }
      } catch (e) {
        console.error('Erro ao verificar acesso:', e);
      }
    };
    checkAccess();
  }, [user]);

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
          setEtapas(Array.isArray(etapasSalvas) ? etapasSalvas.map((e: EtapaCronograma) => ({
            ...e,
            id: e.id || gerarId(),
            macroEtapa: (e.macroEtapa && MACRO_ETAPAS.some((m) => m.value === e.macroEtapa)) ? e.macroEtapa : 'producao',
          })) : []);
          const dur = data.cronograma?.duracaoMeses;
          setDuracaoProjetoMeses(typeof dur === 'number' && dur >= 1 ? dur : '');
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
    setEtapas((prev) => [{ id: gerarId(), etapa: '', inicio: hoje, fim: hoje, macroEtapa: 'producao' }, ...prev]);
  };

  const removerEtapa = (etapaId: string) => {
    setEtapas((prev) => prev.filter((e) => e.id !== etapaId));
  };

  const atualizarEtapa = (etapaId: string, campo: keyof EtapaCronograma, valor: string) => {
    setEtapas((prev) =>
      prev.map((e) => (e.id === etapaId ? { ...e, [campo]: valor } : e))
    );
  };

  const toggleRubricaEtapa = (etapaId: string, rubricaNome: string) => {
    setEtapas((prev) =>
      prev.map((e) => {
        if (e.id !== etapaId) return e;
        const atuais = e.rubricasAssociadas || [];
        const jaAssociada = atuais.includes(rubricaNome);
        return { ...e, rubricasAssociadas: jaAssociada ? atuais.filter((x) => x !== rubricaNome) : [...atuais, rubricaNome] };
      })
    );
  };

  const rubricasOrcamento = (projeto?.orcamento as { rubricas?: { nome?: string; id?: string }[] } | undefined)?.rubricas ?? [];
  const nomesRubricas = rubricasOrcamento.map((r) => r.nome || '').filter(Boolean);

  /** Lista de etapas ordenada só para exibição: pré → produção → pós → divulgação (concomitantes mantidas) */
  const etapasOrdenadas = useMemo(() => ordenarEtapasPorFase(etapas), [etapas]);

  const CREDITOS_CRONOGRAMA = 3;

  const gerarCronogramaComIA = async () => {
    if (!id || !user) return;
    if (!isPremium && (creditos ?? 0) < CREDITOS_CRONOGRAMA) {
      navigate('/cadastro-premium?motivo=creditos_insuficientes');
      return;
    }
    setGerandoCronograma(true);
    const startTime = Date.now();
    trackTextGenerationStarted({
      projectId: id,
      textType: 'cronograma',
      planType: isPremium ? 'premium' : undefined,
    });
    try {
      const duracaoMeses = typeof duracaoProjetoMeses === 'number' && duracaoProjetoMeses >= 1 ? duracaoProjetoMeses : undefined;
      const res = await fetch(GERAR_CRONOGRAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projetoId: id, userId: user.uid, duracaoMeses }),
      });
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
      if (!res.ok) {
        if (res.status === 503) {
          throw new Error('Serviço temporariamente indisponível (cold start). Aguarde alguns segundos e tente novamente. Em local: use o emulador (veja README ou .env.example).');
        }
        const serverMsg = data.error || data.message || (res.status === 500 ? text?.slice(0, 200) : null);
        throw new Error(serverMsg || `Erro ao gerar cronograma (${res.status})`);
      }
      const etapasGeradas = Array.isArray(data.etapas) ? data.etapas : [];
      if (etapasGeradas.length === 0) {
        toast.info('A IA não retornou etapas. Tente novamente ou adicione manualmente.');
        return;
      }
      setEtapas(etapasGeradas.map((e: Omit<EtapaCronograma, 'id'>) => ({
        ...e,
        id: gerarId(),
        macroEtapa: (e.macroEtapa && MACRO_ETAPAS.some((m) => m.value === e.macroEtapa)) ? e.macroEtapa : 'producao',
        rubricasAssociadas: e.rubricasAssociadas ?? [],
      })));
      trackTextGenerationCompleted({
        projectId: id,
        textType: 'cronograma',
        durationSeconds: (Date.now() - startTime) / 1000,
        textLength: etapasGeradas.length,
        planType: isPremium ? 'premium' : undefined,
      });
      if (!isPremium) {
        try {
          const db = getFirestore();
          const userRef = doc(db, 'usuarios', user.uid);
          await updateDoc(userRef, { creditos: increment(-CREDITOS_CRONOGRAMA) });
          setCreditos((c) => Math.max(0, c - CREDITOS_CRONOGRAMA));
        } catch (e) {
          console.error('Erro ao descontar créditos cronograma:', e);
        }
      }
      toast.success(`Cronograma com ${etapasGeradas.length} etapas gerado. Revise e salve.`);
    } catch (err) {
      console.error(err);
      const isNetworkError = err instanceof TypeError && (err.message === 'Failed to fetch' || err.message?.includes('fetch'));
      let msg: string;
      if (isNetworkError) {
        msg = import.meta.env.DEV
          ? 'Em local, inicie o emulador: em outro terminal execute "cd functions && npm run serve" e tente novamente.'
          : 'Não foi possível conectar ao servidor. Verifique sua internet ou se a função está publicada.';
      } else {
        msg = err instanceof Error ? err.message : 'Erro ao gerar cronograma com IA.';
      }
      toast.error(msg, { duration: 8000 });
    } finally {
      setGerandoCronograma(false);
    }
  };

  const processarAlteracoesCronograma = async () => {
    if (!id || !user || !sugestoesCronograma.trim() || etapas.length === 0) {
      toast.error('Preencha as sugestões e tenha ao menos uma etapa no cronograma.');
      return;
    }
    setProcessandoAlteracoes(true);
    try {
      const etapasAtuais = etapas.map((e) => ({
        etapa: e.etapa,
        inicio: e.inicio,
        fim: e.fim,
        rubricasAssociadas: e.rubricasAssociadas ?? [],
      }));
      const duracaoMeses = typeof duracaoProjetoMeses === 'number' && duracaoProjetoMeses >= 1 ? duracaoProjetoMeses : undefined;
      const res = await fetch(GERAR_CRONOGRAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projetoId: id,
          userId: user.uid,
          etapasAtuais,
          sugestoes: sugestoesCronograma.trim(),
          duracaoMeses,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao aplicar alterações');
      }
      const etapasGeradas = Array.isArray(data.etapas) ? data.etapas : [];
      if (etapasGeradas.length === 0) {
        toast.info('A IA não retornou etapas. Tente novamente ou edite manualmente.');
        return;
      }
      setEtapasAnteriores([...etapas]);
      setEtapas(etapasGeradas.map((e: Omit<EtapaCronograma, 'id'>) => ({
        ...e,
        id: gerarId(),
        macroEtapa: (e.macroEtapa && MACRO_ETAPAS.some((m) => m.value === e.macroEtapa)) ? e.macroEtapa : 'producao',
        rubricasAssociadas: e.rubricasAssociadas ?? [],
      })));
      setSugestoesCronograma('');
      toast.success('Alterações aplicadas. Aprove ou volte ao estado anterior.');
    } catch (err) {
      console.error(err);
      const isNetworkError = err instanceof TypeError && (err.message === 'Failed to fetch' || (err as Error).message?.includes?.('fetch'));
      const msg = isNetworkError
        ? (import.meta.env.DEV
            ? 'Em local, inicie o emulador: em outro terminal execute "cd functions && npm run serve".'
            : 'Não foi possível conectar ao servidor. Verifique sua internet ou se a função está publicada.')
        : (err instanceof Error ? err.message : 'Erro ao aplicar alterações no cronograma.');
      toast.error(msg, { duration: 8000 });
    } finally {
      setProcessandoAlteracoes(false);
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
      const duracaoMesesToSave = typeof duracaoProjetoMeses === 'number' && duracaoProjetoMeses >= 1 ? duracaoProjetoMeses : null;
      await updateDoc(projetoRef, {
        cronograma: {
          etapas,
          ...(duracaoMesesToSave != null && { duracaoMeses: duracaoMesesToSave }),
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
    const etapasParaExport = ordenarEtapasPorFase(etapasValidas);
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
                <th>Fase</th>
                <th>Etapa</th>
                <th>Início</th>
                <th>Fim</th>
              </tr>
            </thead>
            <tbody>
              ${etapasParaExport
                .map(
                  (e) =>
                    `<tr><td>${getMacroEtapaLabel(e.macroEtapa).replace(/</g, '&lt;')}</td><td>${(e.etapa || '').replace(/</g, '&lt;')}</td><td>${formatarDataPtBr(e.inicio)}</td><td>${formatarDataPtBr(e.fim)}</td></tr>`
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
    const etapasParaExport = ordenarEtapasPorFase(etapasValidas);
    const rows = [['Fase', 'Etapa', 'Início', 'Fim'], ...etapasParaExport.map((e) => [getMacroEtapaLabel(e.macroEtapa), e.etapa || '', e.inicio || '', e.fim || ''])];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cronograma');
    const nomeArquivo = `cronograma_${(projeto?.nome || 'projeto').replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);
    toast.success('Planilha exportada.');
  };

  // Gantt: etapas com datas, ordenadas por macro (pré → produção → pós → divulgação) para exibir agrupadas
  const etapasComDatas = etapas.filter((e) => e.inicio && e.fim && e.etapa.trim());
  const etapasComDatasOrdenadas = useMemo(
    () => ordenarEtapasPorFase(etapas.filter((e) => e.inicio && e.fim && e.etapa.trim())),
    [etapas]
  );
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
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <DashboardHeader />

        <main className="flex-1 p-3 md:p-8 overflow-x-hidden pb-20 md:pb-8 min-h-0">
          <div className="max-w-7xl mx-auto min-w-0">
            <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl md:text-3xl font-bold text-gray-900 mb-2">
                  Criar Cronograma
                </h1>
                <p className="text-gray-600 text-sm md:text-base break-words">
                  Cronograma do projeto &quot;{projeto.nome || 'sem nome'}&quot;
                </p>
              </div>
              <div className="flex flex-col items-stretch sm:items-end gap-1.5 flex-shrink-0 w-full sm:w-auto">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Próximo passo</span>
                <Button
                  size="lg"
                  onClick={() => navigate(`/projeto/${id}/documentos-inscricao`)}
                  className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white w-full sm:w-auto px-4 sm:px-6 md:px-8 py-3 sm:py-2.5 text-sm sm:text-base font-semibold"
                >
                  Próxima etapa: Documentos de Inscrição <span className="ml-2 opacity-90">→</span>
                </Button>
              </div>
            </div>

            {/* Barra de progresso - scroll horizontal no mobile */}
            <div className="mb-6 md:mb-8 overflow-hidden">
              <div className="flex items-center gap-2 md:justify-between mb-2 overflow-x-auto pb-2 md:pb-0 min-w-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                {steps.map((step, index) => {
                  const isClickable = index <= currentStep;
                  return (
                    <div
                      key={index}
                      className={`flex flex-col items-center flex-shrink-0 min-w-[3.5rem] md:min-w-0 ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
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
                        className={`text-xs mt-1 text-center whitespace-nowrap transition-colors ${
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
              <div className="w-full bg-gray-200 rounded-full h-2 min-w-0">
                <div
                  className="bg-oraculo-blue h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Formulário de etapas */}
            <Card className="bg-white shadow-lg border-2 border-gray-200 mb-6 md:mb-8">
              <CardHeader className="pb-4 px-4 md:px-6 pt-4 md:pt-6">
                <div className="flex flex-col gap-4">
                  <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <Calendar className="h-5 w-5 md:h-6 md:w-6 text-oraculo-blue flex-shrink-0" />
                    Etapas do cronograma
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Cada etapa deve estar associada a uma macro etapa (Pré-produção, Produção, Divulgação ou Pós-produção). Atribua a fase na coluna &quot;Fase&quot; da tabela.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={gerarCronogramaComIA}
                      disabled={gerandoCronograma}
                      className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white w-full sm:w-auto"
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
                          <span className="ml-1.5 text-white/80 font-normal text-sm">(3 créditos)</span>
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      onClick={adicionarEtapa}
                      variant="outline"
                      className="border-oraculo-blue text-oraculo-blue hover:bg-oraculo-blue/10 w-full sm:w-auto"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Nova etapa
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-4 md:px-6 pb-4 md:pb-6">
                <div className="overflow-x-auto -mx-2 md:mx-0">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b text-left text-xs md:text-sm text-gray-600">
                        <th className="pb-2 pr-1 w-9" aria-label="Expandir" />
                        <th className="pb-2 pr-2">Fase</th>
                        <th className="pb-2 pr-2">Etapa</th>
                        <th className="pb-2 pr-2">Início</th>
                        <th className="pb-2 pr-2">Fim</th>
                        <th className="pb-2 w-10 md:w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {etapas.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-gray-500 text-sm">
                            Nenhuma etapa. Selecione a macro etapa e clique em &quot;Nova etapa&quot; para adicionar.
                          </td>
                        </tr>
                      ) : (
                        etapasOrdenadas.map((e) => (
                          <React.Fragment key={e.id}>
                            <tr className="border-b border-gray-100">
                              <td className="py-2 pr-1 w-9 align-top">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-gray-500 hover:text-oraculo-blue"
                                  onClick={() => setExpandedEtapaId((id) => (id === e.id ? null : e.id))}
                                  aria-expanded={expandedEtapaId === e.id}
                                >
                                  {expandedEtapaId === e.id ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </td>
                              <td className="py-2 pr-2 align-top">
                                <Select
                                  value={e.macroEtapa || 'producao'}
                                  onValueChange={(v) => atualizarEtapa(e.id, 'macroEtapa', v)}
                                >
                                  <SelectTrigger className="h-9 w-full min-w-[130px] max-w-[150px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {MACRO_ETAPAS.map((m) => (
                                      <SelectItem key={m.value} value={m.value}>
                                        {m.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="py-2 pr-2 min-w-0 md:min-w-[280px]">
                                <Input
                                  placeholder="Ex: Contratação de equipe..."
                                  value={e.etapa}
                                  onChange={(ev) => atualizarEtapa(e.id, 'etapa', ev.target.value)}
                                  className="min-w-0 w-full max-w-[200px] md:max-w-[380px]"
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <Input
                                  type="date"
                                  value={e.inicio}
                                  onChange={(ev) => atualizarEtapa(e.id, 'inicio', ev.target.value)}
                                  className="min-w-0 w-full max-w-[140px] md:max-w-[105px]"
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <Input
                                  type="date"
                                  value={e.fim}
                                  onChange={(ev) => atualizarEtapa(e.id, 'fim', ev.target.value)}
                                  className="min-w-0 w-full max-w-[140px] md:max-w-[105px]"
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
                            {expandedEtapaId === e.id && (
                              <tr className="border-b border-gray-100 bg-gray-50/70">
                                <td colSpan={6} className="px-4 py-3">
                                  <div className="text-sm font-medium text-gray-700 mb-2">Rubricas associadas à etapa</div>
                                  {nomesRubricas.length === 0 ? (
                                    <p className="text-gray-500 text-sm">Nenhuma rubrica no orçamento do projeto. Crie o orçamento em &quot;Criar Orçamento&quot; para associar rubricas às etapas.</p>
                                  ) : (
                                    <div className="flex flex-wrap gap-3">
                                      {nomesRubricas.map((nome) => {
                                        const associada = (e.rubricasAssociadas || []).includes(nome);
                                        return (
                                          <label key={nome} className="flex items-center gap-2 cursor-pointer text-sm">
                                            <input
                                              type="checkbox"
                                              checked={associada}
                                              onChange={() => toggleRubricaEtapa(e.id, nome)}
                                              className="rounded border-gray-300 text-oraculo-blue focus:ring-oraculo-blue"
                                            />
                                            <span className={associada ? 'text-gray-900 font-medium' : 'text-gray-600'}>{nome}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2 md:gap-3 pt-2 items-stretch sm:items-center">
                  <Button
                    onClick={salvarCronograma}
                    disabled={salvando || etapas.length === 0}
                    className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white w-full sm:w-auto"
                  >
                    {salvando ? 'Salvando...' : 'Salvar cronograma'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={exportarCronogramaPDF}
                    disabled={etapas.filter((e) => e.etapa.trim() || e.inicio || e.fim).length === 0}
                    className="flex-1 sm:flex-initial min-w-0"
                  >
                    <FileDown className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="truncate">Exportar PDF</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={exportarCronogramaXLSX}
                    disabled={etapas.filter((e) => e.etapa.trim() || e.inicio || e.fim).length === 0}
                    className="flex-1 sm:flex-initial min-w-0"
                  >
                    <FileDown className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="truncate">Exportar XLSX</span>
                  </Button>
                  </div>
                {/* Aprovar ou reverter após alterações */}
                {etapasAnteriores.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-oraculo-purple/20 flex flex-wrap items-center gap-3">
                    <span className="text-sm text-gray-600">Alterações aplicadas ao cronograma.</span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          setEtapasAnteriores([]);
                          toast.success('Alteração aprovada.');
                        }}
                        className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white"
                      >
                        Aprovar alteração
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEtapas([...etapasAnteriores]);
                          setEtapasAnteriores([]);
                          toast.success('Voltou ao estado anterior.');
                        }}
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        Voltar ao estado anterior
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sugestões de alteração do cronograma — em cima do estado atual */}
            {etapas.length > 0 && (
              <Card className="bg-white shadow border-2 border-oraculo-purple/30 mb-6 md:mb-8">
                <CardHeader className="pb-2 px-4 md:px-6 pt-4 md:pt-6">
                  <CardTitle className="text-base md:text-lg">Sugestões de alteração do cronograma</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Descreva o que deseja alterar no cronograma atual e clique em Aplicar. As alterações serão aplicadas em cima das etapas atuais.
                  </p>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                  <textarea
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-oraculo-purple focus:border-oraculo-purple min-h-[100px] text-gray-800 text-sm resize-y mb-3"
                    value={sugestoesCronograma}
                    onChange={(e) => setSugestoesCronograma(e.target.value)}
                    placeholder="Ex: Adicione uma etapa de pré-produção entre planejamento e produção / Estenda a etapa de divulgação em 2 semanas / Renomeie a etapa X para Y..."
                    disabled={processandoAlteracoes}
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={processarAlteracoesCronograma}
                      disabled={processandoAlteracoes || !sugestoesCronograma.trim()}
                      className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white"
                    >
                      {processandoAlteracoes ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Aplicando...
                        </>
                      ) : (
                        'Aplicar alterações'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gantt */}
            {etapasComDatas.length > 0 && (
              <Card className="bg-white shadow-lg border-2 border-gray-200">
                <CardHeader className="px-4 md:px-6">
                  <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <Clock className="h-5 w-5 md:h-6 md:w-6 text-oraculo-blue flex-shrink-0" />
                    Visão Gantt
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                  <div className="overflow-x-auto -mx-2 md:mx-0">
                    <div className="min-w-[520px]">
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
                      {/* Barras por etapa (ordenadas por macro: pré, produção, pós, divulgação) */}
                      <div className="space-y-2">
                        {etapasComDatasOrdenadas.map((e) => {
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

            {/* Próximo passo: Documentos de Inscrição — no pé da página */}
            <div className="flex flex-col items-stretch sm:items-end gap-2 pt-6 sm:pt-8 pb-6 px-4 md:px-8 mt-8 sm:mt-10 border-t-2 border-oraculo-blue/20 bg-gradient-to-r from-transparent to-oraculo-purple/5 rounded-b-xl">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Próximo passo</span>
              <Button
                size="lg"
                onClick={() => navigate(`/projeto/${id}/documentos-inscricao`)}
                className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white w-full sm:w-auto px-4 sm:px-8 md:px-10 py-3 sm:py-4 text-sm sm:text-base md:text-lg font-semibold"
              >
                Próxima etapa: Documentos de Inscrição <span className="ml-2 text-lg sm:text-xl" aria-hidden>→</span>
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CriarCronograma;
