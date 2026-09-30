import { useState, type ElementType } from 'react';
import { Lock, BarChart3, AlertTriangle, FileEdit } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabId = 'pontuacao' | 'gaps' | 'sugestoes';

const TABS: { id: TabId; label: string; icon: ElementType }[] = [
  { id: 'pontuacao', label: 'Pontuação Preditiva por Critério', icon: BarChart3 },
  { id: 'gaps', label: 'Gaps de Acessibilidade e Riscos', icon: AlertTriangle },
  { id: 'sugestoes', label: 'Sugestões de Melhoria com 1 Clique', icon: FileEdit },
];

type Props = {
  instituicao: string;
  criterios: { nome: string; peso: string }[];
  onUnlockClick?: () => void;
};

export function EditalLandingPareceristaPreview({ instituicao, criterios, onUnlockClick }: Props) {
  const [tab, setTab] = useState<TabId>('pontuacao');

  return (
    <section className="space-y-6">
      <div className="text-center md:text-left max-w-2xl">
        <h2 className="text-xl md:text-2xl font-bold text-zinc-900">
          Como o Oráculo analisa seu projeto neste edital
        </h2>
        <p className="text-sm md:text-base text-zinc-600 mt-2">
          Cruzamos seu texto diretamente contra os critérios de pontuação da{' '}
          <span className="font-semibold text-zinc-800">{instituicao}</span>.
        </p>
      </div>

      <div className="relative rounded-2xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
        <div className="flex flex-wrap gap-1 p-2 bg-zinc-50 border-b border-zinc-200">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 text-xs sm:text-sm font-medium px-3 py-2 rounded-lg transition-colors',
                tab === id
                  ? 'bg-white text-primary shadow-sm border border-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{id === 'pontuacao' ? 'Pontuação' : id === 'gaps' ? 'Gaps' : 'Sugestões'}</span>
            </button>
          ))}
        </div>

        <div className="p-6 md:p-8 min-h-[220px] bg-gradient-to-b from-white to-zinc-50/80">
          {tab === 'pontuacao' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase text-zinc-500 tracking-wide">Painel previsto</p>
              <ul className="space-y-2">
                {criterios.slice(0, 5).map((c) => (
                  <li key={c.nome} className="flex items-center gap-3">
                    <div className="flex-1 text-sm text-zinc-700 truncate">{c.nome}</div>
                    <div className="w-24 h-2 rounded-full bg-zinc-200 overflow-hidden">
                      <div className="h-full w-1/3 rounded-full bg-zinc-300" />
                    </div>
                    <span className="text-xs font-mono text-zinc-400 w-10">— /10</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tab === 'gaps' && (
            <ul className="space-y-3 text-sm text-zinc-600">
              <li className="flex gap-2 items-start">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                Checklist de acessibilidade cruzado com anexo do edital
              </li>
              <li className="flex gap-2 items-start">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                Alertas de inconsistência orçamentária e prazo
              </li>
              <li className="flex gap-2 items-start">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                Riscos de reprovação por vício de forma
              </li>
            </ul>
          )}
          {tab === 'sugestoes' && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-lg border border-dashed border-zinc-300 bg-zinc-100/80 px-4 py-3 text-sm text-zinc-500"
                >
                  Bloco de texto do projeto · sugestão de reescrita alinhada ao critério {i}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/40 backdrop-blur-[2px] pointer-events-none">
          <button
            type="button"
            onClick={onUnlockClick}
            className="pointer-events-auto mx-4 max-w-md rounded-xl bg-white/95 border border-zinc-200 shadow-xl px-5 py-4 text-center hover:bg-white transition-colors"
          >
            <Lock className="h-5 w-5 text-primary mx-auto mb-2" aria-hidden />
            <p className="text-sm font-bold text-zinc-900">
              Preencha o formulário acima para destravar o diagnóstico do seu projeto
            </p>
          </button>
        </div>
      </div>
    </section>
  );
}
