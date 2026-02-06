import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ClipboardList, ExternalLink, Send, CheckCircle2 } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { toast } from 'sonner';

interface ProjetoDocument {
  id: string;
  nome?: string;
  analise_ia?: string;
  textos_gerados?: Record<string, string>;
  orcamento?: { rubricas?: unknown[] };
  cronograma?: { etapas?: unknown[] };
  documentos_inscricao?: Array<{ url?: string }>;
  resumo_etapas?: boolean[];
  edital_id?: string;
  [key: string]: unknown;
}

interface EditalDoc {
  id?: string;
  nome?: string;
  link_inscricao?: string;
  link_edital?: string;
  pdf_url?: string;
  [key: string]: unknown;
}

const STEPS = [
  'Criar Projeto',
  'Avaliar com IA',
  'Alterar com IA',
  'Gerar Textos',
  'Criar Orçamento',
  'Criar Cronograma',
  'Documentos de Inscrição',
  'Preencher Anexos',
];

const ResumoProjeto = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [projeto, setProjeto] = useState<ProjetoDocument | null>(null);
  const [edital, setEdital] = useState<EditalDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<boolean[]>(Array(STEPS.length).fill(false));

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
        const data = { id: projetoSnap.id, ...projetoSnap.data() } as ProjetoDocument;
        setProjeto(data);

        if (data.edital_id) {
          const editalRef = doc(db, 'editais', data.edital_id as string);
          const editalSnap = await getDoc(editalRef);
          if (editalSnap.exists()) {
            setEdital({ id: editalSnap.id, ...editalSnap.data() } as EditalDoc);
          }
        }

        const computed: boolean[] = [
          true,
          !!(data.analise_ia && String(data.analise_ia).trim().length > 0),
          !!(data.analise_ia && String(data.analise_ia).trim().length > 0),
          !!(data.textos_gerados && Object.keys(data.textos_gerados).length > 0),
          !!(data.orcamento?.rubricas && data.orcamento.rubricas.length > 0),
          !!(data.cronograma?.etapas && data.cronograma.etapas.length > 0),
          !!(data.documentos_inscricao && data.documentos_inscricao.length > 0 && data.documentos_inscricao.some((d) => d?.url)),
          false,
        ];
        setCompleted(computed);
      } catch (error) {
        console.error('Erro ao carregar projeto:', error);
        toast.error('Erro ao carregar projeto');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, user]);

  const getStepRoute = (index: number): string => {
    if (!id) return '#';
    const routes: Record<number, string> = {
      0: '/criar-projeto',
      1: `/projeto/${id}`,
      2: `/projeto/${id}/alterar-com-ia`,
      3: `/projeto/${id}/gerar-textos`,
      4: `/projeto/${id}/criar-orcamento`,
      5: `/projeto/${id}/criar-cronograma`,
      6: `/projeto/${id}/documentos-inscricao`,
      7: `/projeto/${id}/preencher-anexos`,
    };
    return routes[index] ?? '#';
  };

  const percent = STEPS.length ? Math.round((completed.filter(Boolean).length / STEPS.length) * 100) : 0;
  const size = 160;
  const strokeWidth = 14;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (percent / 100) * circumference;

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
          <div className="max-w-2xl mx-auto">
            <div className="mb-6 flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(`/projeto/${id}/preencher-anexos`)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Resumo do Projeto</h1>
                <p className="text-gray-600 text-sm md:text-base mt-1">{projeto.nome || 'Projeto'}</p>
              </div>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-6 w-6 text-oraculo-blue" />
                  Etapas cumpridas
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                {/* Bolota de percentual */}
                <div className="flex flex-col items-center shrink-0">
                  <svg width={size} height={size} className="transform -rotate-90">
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={r}
                      fill="none"
                      stroke="var(--gray-200, #e5e7eb)"
                      strokeWidth={strokeWidth}
                    />
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={r}
                      fill="none"
                      stroke="url(#resumoGradient)"
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      strokeDasharray={`${dash} ${circumference}`}
                      className="transition-all duration-500"
                    />
                    <defs>
                      <linearGradient id="resumoGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#2563eb" />
                        <stop offset="100%" stopColor="#7c3aed" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="text-3xl font-bold text-gray-900 mt-3">{percent}%</span>
                  <span className="text-sm text-gray-500">concluído</span>
                </div>

                {/* Lista de etapas — só leitura; clique leva à seção correspondente */}
                <div className="flex-1 w-full space-y-3">
                  {STEPS.map((step, index) => {
                    const route = getStepRoute(index);
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => route !== '#' && navigate(route)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                          completed[index] ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:bg-gray-50'
                        } ${route !== '#' ? 'cursor-pointer hover:border-oraculo-blue/50' : 'cursor-default'}`}
                      >
                        {completed[index] ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" aria-hidden />
                        ) : (
                          <span className="w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0" aria-hidden />
                        )}
                        <span className={completed[index] ? 'font-medium text-gray-900' : 'text-gray-700'}>
                          {index + 1}. {step}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <Button variant="outline" onClick={() => navigate(`/projeto/${id}/preencher-anexos`)}>
                Voltar para Preencher Anexos
              </Button>
              <div className="flex gap-3 flex-wrap">
                {edital?.link_inscricao ? (
                  <Button
                    className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white"
                    onClick={() => window.open(edital.link_inscricao, '_blank', 'noopener,noreferrer')}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Inscrever no edital
                  </Button>
                ) : (
                  <Button
                    className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white"
                    disabled
                    title="Cadastre o link de inscrição (link_inscricao) no edital para habilitar."
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Inscrever no edital
                  </Button>
                )}
                {(edital?.link_edital || edital?.pdf_url) && (
                  <Button
                    variant="outline"
                    className="border-oraculo-blue text-oraculo-blue hover:bg-oraculo-blue/10"
                    asChild
                  >
                    <a
                      href={edital?.link_edital || edital?.pdf_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver edital
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ResumoProjeto;
