import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getEditalPrazoDisplay, formatEditalValorPremiacao } from '@/lib/editalDates';
import { editalIniciais, formatEditalOrgao, formatEditalTitulo } from '@/lib/editalDisplayText';

export type EditalCardModel = {
  id: string;
  nome?: string;
  proponente?: string;
  orgao?: string;
  thumbnail?: string;
  valor_maximo_premiacao?: string;
  [key: string]: unknown;
};

type EditalCardProps = {
  edital: EditalCardModel;
  onOpenDetails: (editalId: string) => void;
  onCreateProject: (editalId: string) => void;
  className?: string;
  priorityBadge?: React.ReactNode;
  topOverlay?: React.ReactNode;
  primaryActionLabel?: string;
};

export function EditalCard({
  edital,
  onOpenDetails,
  onCreateProject,
  className = '',
  priorityBadge,
  topOverlay,
  primaryActionLabel = 'Avaliar neste edital',
}: EditalCardProps) {
  const prazo = getEditalPrazoDisplay(edital);
  const prazoLabel = prazo.show ? prazo.label : 'Sem prazo definido';
  const valorRaw = formatEditalValorPremiacao(edital.valor_maximo_premiacao);
  const valorLabel = valorRaw ?? 'Consulte o edital';
  const orgao =
    typeof edital.proponente === 'string' && edital.proponente.trim()
      ? edital.proponente
      : typeof edital.orgao === 'string'
        ? edital.orgao
        : undefined;
  const titulo = formatEditalTitulo(edital.nome);
  const thumbnail =
    typeof edital.thumbnail === 'string' && edital.thumbnail.trim() ? edital.thumbnail : null;

  return (
    <Card
      className={`relative flex h-full min-h-[380px] flex-col overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer ${className}`}
      onClick={() => onOpenDetails(edital.id)}
    >
      {topOverlay}

      <div className="relative h-28 shrink-0 border-b border-gray-100 bg-gradient-to-br from-oraculo-blue/8 to-oraculo-purple/10 flex items-center justify-center p-4">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <div
            className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-oraculo-blue to-oraculo-purple text-lg font-bold text-white shadow-md"
            aria-hidden
          >
            {editalIniciais(edital.nome)}
          </div>
        )}
        {priorityBadge ? <div className="absolute top-2 right-2 z-[1]">{priorityBadge}</div> : null}
      </div>

      <CardHeader className="pb-2 space-y-1">
        <CardTitle className="text-lg leading-snug line-clamp-2 min-h-[2.75rem]">{titulo}</CardTitle>
        <p className="text-sm text-gray-600 line-clamp-1 min-h-[1.25rem]">{formatEditalOrgao(orgao)}</p>
      </CardHeader>

      <CardContent className="mt-auto flex flex-col gap-3 pt-0 pb-5">
        <dl className="space-y-2 rounded-lg bg-gray-50 px-3 py-2.5 text-sm border border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-gray-500 shrink-0">Prazo</dt>
            <dd className="text-gray-900 font-medium text-right leading-snug">{prazoLabel}</dd>
          </div>
          <div className="flex items-start justify-between gap-3 border-t border-gray-200/80 pt-2">
            <dt className="text-gray-500 shrink-0">Valor</dt>
            <dd className="text-gray-900 font-medium text-right leading-snug line-clamp-2">{valorLabel}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white hover:opacity-90"
            onClick={(e) => {
              e.stopPropagation();
              onCreateProject(edital.id);
            }}
          >
            {primaryActionLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(edital.id);
            }}
          >
            Ver detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
