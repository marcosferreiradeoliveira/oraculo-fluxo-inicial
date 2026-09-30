import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DemoWizardShell } from '@/components/home/DemoWizardShell';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileCheck, Lock } from 'lucide-react';
import {
  PROJETO_DEMONSTRACAO,
  formatarMoedaBRL,
} from '@/lib/projetoDemonstracao';
import {
  loadAvaliarProjetoDemoSession,
  formatDemoDate,
  type AvaliarProjetoDemoSession,
} from '@/lib/avaliarProjetoDemoSession';
import { DemoCronogramaGantt } from '@/components/home/DemoCronogramaGantt';

type PassoSlug = 'orcamento' | 'cronograma' | 'documentos' | 'finalizar';

const PASSOS: Record<
  PassoSlug,
  {
    etapaAtiva: number;
    titulo: string;
    subtitulo: string;
    voltar: string;
    proximo: string;
    proximoLabel: string;
  }
> = {
  orcamento: {
    etapaAtiva: 4,
    titulo: 'Orçamento do projeto (exemplo)',
    subtitulo: 'Planilha fictícia completa (~R$ 600 mil) — rubricas típicas de festival de médio porte, apenas para demonstração.',
    voltar: '/avaliar-projeto/gerar-textos',
    proximo: '/avaliar-projeto/cronograma',
    proximoLabel: 'Próximo: Criar Cronograma →',
  },
  cronograma: {
    etapaAtiva: 5,
    titulo: 'Cronograma de execução (exemplo)',
    subtitulo: '23 marcos de jan a out/2026 — planejamento, festival, circulação e prestação de contas (demonstração).',
    voltar: '/avaliar-projeto/orcamento',
    proximo: '/avaliar-projeto/documentos',
    proximoLabel: 'Próximo: Documentos e Inscrição →',
  },
  documentos: {
    etapaAtiva: 6,
    titulo: 'Documentos de inscrição (exemplo)',
    subtitulo: 'Checklist fictício de certidões e documentos societários.',
    voltar: '/avaliar-projeto/cronograma',
    proximo: '/avaliar-projeto/finalizar',
    proximoLabel: 'Próximo: Finalizar e Inscrição →',
  },
  finalizar: {
    etapaAtiva: 7,
    titulo: 'Finalizar e inscrição (exemplo)',
    subtitulo: 'Última etapa ilustrativa — anexos e envio ao edital no projeto real após cadastro.',
    voltar: '/avaliar-projeto/documentos',
    proximo: '/cadastro?redirect=/criar-projeto',
    proximoLabel: 'Criar conta e montar meu projeto →',
  },
};

const ANEXOS_DEMO = [
  { nome: 'Formulário de inscrição assinado', status: 'Pronto (exemplo)' },
  { nome: 'Orçamento detalhado (PDF)', status: 'Pronto (exemplo)' },
  { nome: 'Cronograma físico assinado', status: 'Pronto (exemplo)' },
  { nome: 'Currículos da equipe técnica', status: 'Pronto (exemplo)' },
];

export default function AvaliarProjetoDemoPasso() {
  const location = useLocation();
  const navigate = useNavigate();
  const [dados, setDados] = useState<AvaliarProjetoDemoSession | null>(null);
  const [loading, setLoading] = useState(true);

  const slug = location.pathname.replace(/^\/avaliar-projeto\//, '') as PassoSlug;
  const config = PASSOS[slug];

  useEffect(() => {
    if (!config) {
      navigate('/avaliar-projeto', { replace: true });
      return;
    }
    const session = loadAvaliarProjetoDemoSession();
    if (!session?.nome) {
      navigate('/avaliar-projeto', { replace: true });
      return;
    }
    setDados(session);
    setLoading(false);
  }, [config, navigate]);

  if (loading || !dados || !config) {
    return (
      <div className="flex min-h-screen bg-[#F8FAFC]">
        <DashboardSidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </main>
      </div>
    );
  }

  const demo = PROJETO_DEMONSTRACAO;
  const totalOrcamento = demo.orcamento.rubricas.reduce((s, r) => s + r.total, 0);

  const conteudo = (() => {
    switch (slug) {
      case 'orcamento':
        return (
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-800">Total do projeto</p>
              <p className="text-lg font-bold text-purple-700">{formatarMoedaBRL(totalOrcamento)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-600">
                    <th className="p-3 font-medium">Rubrica</th>
                    <th className="p-3 font-medium">Quantidade</th>
                    <th className="p-3 font-medium text-right">Valor unit.</th>
                    <th className="p-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {demo.orcamento.rubricas.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-100">
                      <td className="p-3 text-zinc-900">{r.nome}</td>
                      <td className="p-3 text-zinc-700">
                        {r.quantidade} {r.unidade}
                      </td>
                      <td className="p-3 text-right text-zinc-700">{formatarMoedaBRL(r.valorUnitario)}</td>
                      <td className="p-3 text-right font-semibold text-zinc-900">{formatarMoedaBRL(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-purple-50/80">
                    <td colSpan={3} className="p-3 text-right font-semibold text-zinc-800">
                      Total geral
                    </td>
                    <td className="p-3 text-right font-bold text-purple-800">{formatarMoedaBRL(totalOrcamento)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      case 'cronograma':
        return (
          <div className="space-y-4">
            <DemoCronogramaGantt etapas={demo.cronograma.etapas} />
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-600">
                    <th className="p-3 font-medium">Etapa</th>
                    <th className="p-3 font-medium">Início</th>
                    <th className="p-3 font-medium">Fim</th>
                    <th className="p-3 font-medium">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {demo.cronograma.etapas.map((e) => (
                    <tr key={e.id} className="border-b border-zinc-100">
                      <td className="p-3 font-medium text-zinc-900">{e.etapa}</td>
                      <td className="p-3 text-zinc-700 whitespace-nowrap">{formatDemoDate(e.inicio)}</td>
                      <td className="p-3 text-zinc-700 whitespace-nowrap">{formatDemoDate(e.fim)}</td>
                      <td className="p-3 text-zinc-600 text-xs leading-snug max-w-md">
                        {e.observacao ?? 'Marco fictício demo'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        );
      case 'documentos':
        return (
          <ul className="space-y-3">
            {demo.documentos_inscricao.map((doc) => (
              <li
                key={doc.nome}
                className="rounded-xl border border-zinc-200 bg-white shadow-sm p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <span className="text-sm font-medium text-zinc-900 flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-emerald-600" />
                  {doc.nome}
                </span>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                  {doc.status}
                </Badge>
              </li>
            ))}
          </ul>
        );
      case 'finalizar':
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-4 flex gap-3">
              <Lock className="h-5 w-5 text-zinc-500 shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-700 leading-relaxed">
                No projeto real, você envia anexos PDF e confirma a inscrição no edital. Abaixo, anexos fictícios
                que completam o fluxo de demonstração.
              </p>
            </div>
            <ul className="space-y-3">
              {ANEXOS_DEMO.map((a) => (
                <li
                  key={a.nome}
                  className="rounded-xl border border-zinc-200 bg-white shadow-sm p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <span className="text-sm font-medium text-zinc-900">{a.nome}</span>
                  <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-900">
                    {a.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          <DemoWizardShell
            etapaAtiva={config.etapaAtiva}
            nomeProjeto={dados.nome}
            editalNome={dados.editalAssociado}
            tituloPainel={config.titulo}
            subtituloPainel={config.subtitulo}
            voltarLabel="← Etapa anterior"
            onVoltar={() => navigate(config.voltar)}
            proximoLabel={config.proximoLabel}
            onProximo={() => navigate(config.proximo)}
          >
            {conteudo}
          </DemoWizardShell>
        </main>
      </div>
    </div>
  );
}
