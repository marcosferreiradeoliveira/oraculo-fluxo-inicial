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
  Sparkles,
} from 'lucide-react';
import type { EditalUrgenteInfo } from '@/lib/editalDates';
import type { HomeDashboardMetrics, PremiumProjectSummary } from '@/hooks/useUserProfile';
import { etapaLabel } from '@/hooks/useUserProfile';

type DashboardPremiumHeroProps = {
  userName: string;
  planLabel: string;
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
  planLabel,
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
    <section className="mb-10 rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <div className="p-6 md:p-8 border-b border-border bg-muted/30">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Módulo editais & parecerista</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Olá, {firstName}</h1>
            <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-xl">
              {editaisAbertosCount > 0
                ? `${editaisAbertosCount} editais abertos agora — avalie seu projeto antes do prazo.`
                : 'Monte ou retome seu projeto enquanto novos editais entram no ar.'}
            </p>
          </div>
          <Badge className="self-start sm:self-center gradient-primary text-primary-foreground border-0 px-4 py-1.5 text-sm">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Plano {planLabel}
          </Badge>
        </div>
      </div>

      {editalUrgente && (
        <div className="px-6 md:px-8 pt-6">
          <Card className="rounded-lg border-warning/40 bg-warning/5 overflow-hidden">
            <CardContent className="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-warning">
                    {urgentLabel}
                  </p>
                  <p className="font-semibold text-foreground truncate">{editalUrgente.titulo}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
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
                className="shrink-0 rounded-lg btn-cta-yellow text-[#18181b] font-semibold hover:opacity-90 border-0"
                onClick={() => onAvaliarEditalUrgente(editalUrgente.id)}
              >
                Avaliar projeto neste edital
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="rounded-lg border-border">
          <CardContent className="p-4 flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Editais abertos</p>
              <p className="text-2xl font-bold text-foreground">{editaisAbertosCount}</p>
              <button
                type="button"
                onClick={onVerEditais}
                className="text-xs text-primary hover:underline mt-1"
              >
                Ver todos
              </button>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-border">
          <CardContent className="p-4 flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderKanban className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Projetos criados</p>
              <p className="text-2xl font-bold text-foreground">{metrics.projetosAtivos}</p>
              {metrics.projetosAtivos === 0 && (
                <p className="text-xs text-warning mt-1">Nenhum projeto — comece hoje</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {metrics.recentProjects.length > 0 && (
        <div className="px-6 md:px-8 pb-2">
          <h2 className="text-sm font-semibold text-foreground mb-3">Continue de onde parou</h2>
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
          className="flex-1 rounded-lg gradient-primary text-primary-foreground hover:opacity-90"
          onClick={onCriarProjeto}
        >
          <Plus className="h-5 w-5 mr-2" />
          Criar novo projeto
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="flex-1 rounded-lg border-primary/30"
          onClick={onVerEditais}
        >
          <FileSearch className="h-5 w-5 mr-2 text-primary" />
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
        className="w-full flex items-center gap-3 rounded-lg border border-border bg-background hover:bg-muted/50 px-4 py-3 text-left transition-colors"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
          {project.nome.charAt(0).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{project.nome}</p>
          <p className="text-xs text-muted-foreground truncate">
            {project.editalLabel ? `${project.editalLabel} · ` : ''}
            Etapa: {step}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </button>
    </li>
  );
}
