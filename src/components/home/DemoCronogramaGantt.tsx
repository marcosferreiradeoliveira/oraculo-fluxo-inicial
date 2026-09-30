import { Clock } from 'lucide-react';
import { formatDemoDate } from '@/lib/avaliarProjetoDemoSession';

export type CronogramaEtapaGantt = {
  id: string;
  etapa: string;
  inicio: string;
  fim: string;
};

function parseDay(iso: string): number {
  return new Date(`${iso}T12:00:00`).getTime();
}

const formatarMesAno = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

export function DemoCronogramaGantt({ etapas }: { etapas: CronogramaEtapaGantt[] }) {
  const etapasComDatas = etapas.filter((e) => e.inicio && e.fim && e.etapa.trim());
  if (etapasComDatas.length === 0) return null;

  const todasDatas = etapasComDatas.flatMap((e) => [parseDay(e.inicio), parseDay(e.fim)]);
  const minTime = Math.min(...todasDatas);
  const maxTime = Math.max(...todasDatas);
  const rangeMs = maxTime - minTime || 1;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b border-zinc-100 flex items-center gap-2">
        <Clock className="h-5 w-5 text-purple-600 shrink-0" aria-hidden />
        <h3 className="text-base md:text-lg font-bold text-zinc-900">Visão Gantt</h3>
        <span className="text-xs text-zinc-500 ml-auto hidden sm:inline">
          {etapasComDatas.length} marcos
        </span>
      </div>
      <div className="p-4 md:p-6 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="flex text-[10px] md:text-xs text-zinc-500 mb-2 border-b border-zinc-200 pb-2">
            <div className="w-36 md:w-52 flex-shrink-0" />
            <div className="flex-1 relative h-8">
              {Array.from({ length: 13 }, (_, i) => {
                const t = minTime + (rangeMs * i) / 12;
                const d = new Date(t);
                return (
                  <div
                    key={i}
                    className="absolute top-0 text-center -translate-x-1/2 whitespace-nowrap capitalize"
                    style={{ left: `${(i / 12) * 100}%` }}
                  >
                    {formatarMesAno(d)}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5 max-h-[min(520px,55vh)] overflow-y-auto pr-1">
            {etapasComDatas.map((e) => {
              const startMs = parseDay(e.inicio);
              const endMs = parseDay(e.fim);
              const left = ((startMs - minTime) / rangeMs) * 100;
              const width = ((endMs - startMs) / rangeMs) * 100;
              const label = `${formatDemoDate(e.inicio)} – ${formatDemoDate(e.fim)}`;
              return (
                <div key={e.id} className="flex items-center gap-2 min-h-[32px]">
                  <div
                    className="w-36 md:w-52 flex-shrink-0 text-xs md:text-sm text-zinc-800 truncate"
                    title={e.etapa}
                  >
                    {e.etapa}
                  </div>
                  <div className="flex-1 relative h-7 bg-zinc-100 rounded-md overflow-hidden">
                    <div
                      className="absolute top-0.5 bottom-0.5 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] md:text-xs flex items-center justify-center font-medium truncate px-1.5 shadow-sm"
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 1.5)}%`,
                        minWidth: width < 2 ? '4px' : undefined,
                      }}
                      title={label}
                    >
                      {width >= 12 ? label : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
