import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, ClipboardList } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<boolean[]>(Array(STEPS.length).fill(false));
  const [saving, setSaving] = useState(false);

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
        const saved = data.resumo_etapas && Array.isArray(data.resumo_etapas) ? data.resumo_etapas : null;
        const merged = computed.map((c, i) => (saved && saved[i] !== undefined ? saved[i] : c));
        setCompleted(merged);
      } catch (error) {
        console.error('Erro ao carregar projeto:', error);
        toast.error('Erro ao carregar projeto');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, user]);

  const toggleStep = async (index: number) => {
    if (!id || !projeto) return;
    const next = [...completed];
    next[index] = !next[index];
    setCompleted(next);
    setSaving(true);
    try {
      const db = getFirestore();
      await updateDoc(doc(db, 'projetos', id), { resumo_etapas: next });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar');
      setCompleted(completed);
    } finally {
      setSaving(false);
    }
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

                {/* Lista de checkboxes */}
                <div className="flex-1 w-full space-y-3">
                  {STEPS.map((step, index) => (
                    <label
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        completed[index] ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <Checkbox
                        checked={completed[index]}
                        onCheckedChange={() => toggleStep(index)}
                        disabled={saving}
                        className="data-[state=checked]:bg-oraculo-blue data-[state=checked]:border-oraculo-blue"
                      />
                      <span className={completed[index] ? 'font-medium text-gray-900' : 'text-gray-700'}>
                        {index + 1}. {step}
                      </span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate(`/projeto/${id}/preencher-anexos`)}>
                Voltar para Preencher Anexos
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ResumoProjeto;
