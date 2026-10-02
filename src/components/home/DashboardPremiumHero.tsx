import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  FileSearch,
  FolderKanban,
  Plus,
} from 'lucide-react';
import type { EditalUrgenteInfo } from '@/lib/editalDates';
import type { HomeDashboardMetrics, PremiumProjectSummary } from '@/hooks/useUserProfile';
import { etapaLabel } from '@/hooks/useUserProfile';

type DashboardPremiumHeroProps = {
  userName: string;
  editaisAbertosCount: number;
  metrics: HomeDashboardMetrics;
  editalUrgente: EditalUrgenteInfo | null;
  onCriarProjeto: () => void;
  onVerEditais: () => void;
  onContinuarProjeto: (projectId: string) => void;
  onAvaliarEditalUrgente: (editalId: string) => void;
};

export function DashboardPremiumHero({
  userName,
  editaisAbertosCount,
  metrics,
  editalUrgente,
  onCriarProjeto,
  onVerEditais,
  onContinuarProjeto,
  onAvaliarEditalUrgente,
}: DashboardPremiumHeroProps) {
  const firstName = userName.split(/\s+/)[0] || userName;
  const urgentLabel =
    editalUrgente &&
    (editalUrgente.diasRestantes <= 1
      ? 'Encerra hoje'
      : editalUrgente.diasRestantes <= 7
        ? `Faltam ${editalUrgente.diasRestantes} dias`
        : `Faltam ${editalUrgente.diasRestantes} dias`);

  return (
    <section className="mb-10 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="p-6 md:p-8 border-b border-gray-100 bg-gradient-to-r from-oraculo-blue/5 to-oraculo-purple/5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Instituto dos Sonhos</p>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 font-display">Olá, {firstName}</h1>
            <p className="text-gray-600 mt-2 text-sm md:text-base max-w-xl">
              {editaisAbertosCount > 0
                ? `${editaisAbertosCount} editais abertos — avalie seu projeto antes do prazo.`
                : 'Monte ou retome seu projeto enquanto novos editais entram no ar.'}
            </p>
          </div>
          <Badge className="self-start sm:self-center gradient-brand text-white border-0 px-4 py-1.5 text-sm">
            Área do produtor
          </Badge>
        </div>
      </div>

      {editalUrgente && (
        <div className="px-6 md:px-8 pt-6">
          <Card className="rounded-xl border-amber-300/60 bg-amber-50 overflow-hidden">
            <CardContent className="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                    Prazo apertado · {urgentLabel}
                  </p>
                  <p className="font-semibold text-gray-900 truncate">{editalUrgente.titulo}</p>
                  <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Até{' '}
                    {editalUrgente.dataEncerramento.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </p>
                </div>
              </div>
              <Button
                className="shrink-0 rounded-lg bg-oraculo-gold text-[#18181b] font-semibold hover:opacity-90 border-0"
                onClick={() => onAvaliarEditalUrgente(editalUrgente.id)}
              >
                Avaliar projeto neste edital
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="rounded-xl border-gray-200">
          <CardContent className="p-4 flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-oraculo-blue/10 text-oraculo-blue">
              <Calendar className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-gray-600">Editais abertos</p>
              <p className="text-2xl font-bold text-gray-900">{editaisAbertosCount}</p>
              <button type="button" onClick={onVerEditais} className="text-xs text-oraculo-blue hover:underline mt-1">
                Ver todos
              </button>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-gray-200">
          <CardContent className="p-4 flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-oraculo-blue/10 text-oraculo-blue">
              <FolderKanban className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-gray-600">Projetos criados</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.projetosAtivos}</p>
              {metrics.projetosAtivos === 0 && (
                <p className="text-xs text-amber-700 mt-1">Nenhum projeto — comece hoje</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {metrics.recentProjects.length > 0 && (
        <div className="px-6 md:px-8 pb-2">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Continue de onde parou</h2>
          <ul className="space-y-2">
            {metrics.recentProjects.map((proj) => (
              <ProjectRow key={proj.id} project={proj} onOpen={() => onContinuarProjeto(proj.id)} />
            ))}
          </ul>
        </div>
      )}

      <div className="px-6 md:px-8 pb-8 pt-4 flex flex-col sm:flex-row gap-3">
        <Button
          size="lg"
          className="flex-1 rounded-lg gradient-brand text-white hover:opacity-90"
          onClick={onCriarProjeto}
        >
          <Plus className="h-5 w-5 mr-2" />
          Criar novo projeto
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="flex-1 rounded-lg border-oraculo-blue/30"
          onClick={onVerEditais}
        >
          <FileSearch className="h-5 w-5 mr-2 text-oraculo-blue" />
          Explorar editais abertos
        </Button>
      </div>
    </section>
  );
}

function ProjectRow({
  project,
  onOpen,
}: {
  project: PremiumProjectSummary;
  onOpen: () => void;
}) {
  const step = etapaLabel(project.etapaAtual);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full flex items-center gap-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-3 text-left transition-colors"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-oraculo-blue/10 text-oraculo-blue text-sm font-bold">
          {project.nome.charAt(0).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{project.nome}</p>
          <p className="text-xs text-gray-500 truncate">
            {project.editalLabel ? `${project.editalLabel} · ` : ''}
            Etapa: {step}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
      </button>
    </li>
  );
}
