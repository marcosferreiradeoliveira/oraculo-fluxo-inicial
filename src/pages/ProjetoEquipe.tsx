import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { WIZARD_STEP_LABELS, WIZARD_STEP, wizardRoutes } from '@/lib/projetoWizard';
import { EquipeProjetoPainel } from '@/components/equipe/EquipeProjetoPainel';
import type { AlocacaoEquipe } from '@/lib/equipeProjeto';
import { limparIdsOrfaos } from '@/lib/equipeProjeto';
import type { Fornecedor } from '@/lib/fornecedores';
import { trackProjectStepViewed } from '@/lib/analytics';

const gerarIdEtapa = () => Math.random().toString(36).slice(2, 11);

const ProjetoEquipe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [nomeProjeto, setNomeProjeto] = useState('');
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [alocacoes, setAlocacoes] = useState<AlocacaoEquipe[]>([]);
  const [rubricas, setRubricas] = useState<{ id: string; nome: string }[]>([]);
  const [etapas, setEtapas] = useState<{ id: string; nome: string; inicio?: string; fim?: string }[]>([]);

  const steps = [...WIZARD_STEP_LABELS];
  const currentStep = WIZARD_STEP.equipe;
  const stepViewedRef = React.useRef(false);

  useEffect(() => {
    if (id && !stepViewedRef.current) {
      stepViewedRef.current = true;
      trackProjectStepViewed({ projectId: id, step: 'equipe' });
    }
  }, [id]);

  useEffect(() => {
    const load = async () => {
      if (!id || !user) {
        setLoading(false);
        return;
      }
      try {
        const projetoSnap = await getDoc(doc(db, 'projetos', id));
        if (!projetoSnap.exists()) {
          navigate('/');
          return;
        }
        const data = projetoSnap.data();
        setNomeProjeto(data.nome || 'Projeto');

        const rub = (data.orcamento?.rubricas || []) as { id?: string; nome?: string }[];
        setRubricas(
          rub.map((r, i) => ({
            id: r.id || `r-${i}`,
            nome: (r.nome || '').trim(),
          }))
        );

        const et = (data.cronograma?.etapas || []) as {
          id?: string;
          etapa?: string;
          inicio?: string;
          fim?: string;
        }[];
        setEtapas(
          et.map((e) => ({
            id: e.id || gerarIdEtapa(),
            nome: e.etapa || '',
            inicio: e.inicio,
            fim: e.fim,
          }))
        );

        const al = (data.equipe?.alocacoes || []) as AlocacaoEquipe[];
        setAlocacoes(Array.isArray(al) ? al : []);

        const fq = query(collection(db, 'fornecedores'), where('userId', '==', user.uid));
        const fs = await getDocs(fq);
        const lista: Fornecedor[] = [];
        fs.forEach((d) => lista.push({ id: d.id, ...d.data() } as Fornecedor));
        lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        setFornecedores(lista);
      } catch (e) {
        console.error(e);
        toast.error('Erro ao carregar dados da equipe.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user, navigate]);

  const routes = useMemo(() => (id ? wizardRoutes(id) : []), [id]);

  const salvarEquipe = async () => {
    if (!id) return;
    setSalvando(true);
    try {
      const rubricaIds = new Set(rubricas.map((r) => r.id));
      const etapaIds = new Set(etapas.map((e) => e.id));
      const fornecedorIds = new Set(fornecedores.map((f) => f.id));
      const limpas = limparIdsOrfaos(alocacoes, rubricaIds, etapaIds, fornecedorIds);

      await updateDoc(doc(db, 'projetos', id), {
        equipe: {
          alocacoes: limpas,
          atualizado_em: serverTimestamp(),
        },
      });
      setAlocacoes(limpas);
      toast.success('Equipe do projeto salva.');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar a equipe.');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-oraculo-blue" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <DashboardHeader />
        <main className="flex-1 p-3 md:p-8 overflow-x-hidden pb-20 md:pb-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-3xl font-bold text-gray-900 mb-2">Equipe do projeto</h1>
                <p className="text-gray-600 text-sm md:text-base">{nomeProjeto}</p>
              </div>
              <div className="flex flex-col items-stretch sm:items-end gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Próximo passo
                </span>
                <Button
                  size="lg"
                  className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white"
                  onClick={() => id && navigate(`/projeto/${id}/documentos-inscricao`)}
                >
                  Documentos de Inscrição →
                </Button>
              </div>
            </div>

            <div className="mb-6 md:mb-8 overflow-hidden">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 min-w-0">
                {steps.map((step, index) => {
                  const isClickable = index <= currentStep;
                  return (
                    <div
                      key={step}
                      className={`flex flex-col items-center flex-shrink-0 min-w-[3rem] ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                      onClick={() => isClickable && routes[index] && navigate(routes[index])}
                    >
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-sm ${
                          index <= currentStep ? 'bg-oraculo-blue text-white' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <span
                        className={`text-[10px] md:text-xs mt-1 text-center max-w-[4.5rem] leading-tight ${
                          index === currentStep ? 'font-medium text-oraculo-blue' : 'text-gray-500'
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
                  className="bg-oraculo-blue h-2 rounded-full transition-all"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>

            <Card className="bg-white shadow-lg border-2 border-gray-200 mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-oraculo-blue" />
                  Alocar equipe (cadastro global)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => navigate({ pathname: '/', hash: 'fornecedores' })}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Gerenciar cadastro na página inicial
                </Button>
                <EquipeProjetoPainel
                  fornecedores={fornecedores}
                  rubricas={rubricas}
                  etapas={etapas}
                  alocacoes={alocacoes}
                  onAlocacoesChange={setAlocacoes}
                />
                <div className="pt-4 border-t flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => id && navigate(`/projeto/${id}/criar-orcamento`)}
                  >
                    Voltar ao orçamento
                  </Button>
                  <Button
                    className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white"
                    onClick={salvarEquipe}
                    disabled={salvando}
                  >
                    {salvando ? 'Salvando…' : 'Salvar equipe do projeto'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ProjetoEquipe;
