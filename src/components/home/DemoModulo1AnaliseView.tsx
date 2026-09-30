import { Brain, Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DEMO_MODULO1, DEMO_WIZARD_STEPS } from '@/lib/projetoDemonstracao';
import { toast } from 'sonner';

export type DemoModulo1AnaliseViewProps = {
  nomeProjeto: string;
  editalNome?: string;
  sugestoes: string[];
  onProximoGerarTextos: () => void;
};

export function DemoModulo1AnaliseView({
  nomeProjeto,
  editalNome,
  sugestoes,
  onProximoGerarTextos,
}: DemoModulo1AnaliseViewProps) {
  const m = DEMO_MODULO1;
  const etapaAtiva = m.etapaAtiva;
  const pctTotal = Math.round((m.notaTotal.obtida / m.notaTotal.maxima) * 100);

  const textoCompleto = m.secoesTextoProjeto.map((s) => `${s.titulo}\n${s.corpo}`).join('\n\n');

  const copiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(textoCompleto);
      toast.success('Texto copiado.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const editalLinha = editalNome
    ? `EDITAL DE FOMENTO — ${editalNome}`
    : 'EDITAL DE FOMENTO — Exemplo';

  return (
    <div className="space-y-6 md:space-y-8 font-sans antialiased text-zinc-900">
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight">{nomeProjeto}</h1>
            <p className="text-xs md:text-sm font-semibold uppercase tracking-wide text-zinc-500 mt-2">{editalLinha}</p>
          </div>
          <Badge variant="secondary" className="self-start bg-zinc-900 text-white hover:bg-zinc-900">
            {m.planBadge}
          </Badge>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-4 md:p-6 overflow-hidden">
        <div className="flex items-center gap-0 mb-3 overflow-x-auto pb-2 min-w-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          {DEMO_WIZARD_STEPS.map((label, index) => {
            const concluido = index < etapaAtiva;
            const ativo = index === etapaAtiva;
            return (
              <div key={label} className="flex items-center flex-shrink-0 md:flex-1 md:min-w-0">
                <div className="flex flex-col items-center min-w-[4.25rem] md:min-w-0 md:flex-1">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      concluido
                        ? 'bg-emerald-600 text-white'
                        : ativo
                          ? 'bg-purple-600 text-white ring-2 ring-purple-300 ring-offset-2'
                          : 'bg-zinc-200 text-zinc-600'
                    }`}
                  >
                    {concluido ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
                  </div>
                  <span
                    className={`text-[10px] md:text-xs mt-1.5 text-center leading-tight px-0.5 ${
                      ativo ? 'font-bold text-purple-700' : concluido ? 'text-emerald-800 font-medium' : 'text-zinc-500'
                    }`}
                  >
                    {index + 1}. {label}
                  </span>
                </div>
                {index < DEMO_WIZARD_STEPS.length - 1 && (
                  <ChevronRight className="hidden lg:block h-4 w-4 text-zinc-300 shrink-0 mx-0.5" aria-hidden />
                )}
              </div>
            );
          })}
        </div>
        <div className="w-full bg-zinc-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${((etapaAtiva + 1) / DEMO_WIZARD_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={onProximoGerarTextos}
          className="gradient-primary text-white font-bold py-3 px-6 rounded-xl hover:opacity-95 border-0 shadow-md w-full sm:w-auto"
        >
          Próximo: Gerar Textos →
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 md:px-8 py-4 md:py-6 flex items-center gap-3">
          <Brain className="h-7 w-7 md:h-8 md:w-8 shrink-0" />
          <h2 className="text-lg md:text-2xl font-bold">Análise do Oráculo</h2>
        </div>

        <div className="p-4 md:p-8 space-y-8 bg-[#F8FAFC]">
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
              O que é este projeto (exemplo)
            </p>
            <p className="text-sm md:text-base text-zinc-800 leading-relaxed">{m.resumoProjeto}</p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-sm p-6 md:p-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-800 mb-2">Nota total da avaliação</p>
            <p className="text-5xl md:text-6xl font-black text-zinc-900 tabular-nums">{m.notaTotal.rotulo}</p>
            <p className="text-sm text-zinc-600 mt-2">
              {m.notaTotal.obtida} pontos de {m.notaTotal.maxima} na matriz do edital
            </p>
            <div className="mt-4 w-full max-w-md mx-auto bg-zinc-200 rounded-full h-2.5">
              <div
                className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2.5 rounded-full"
                style={{ width: `${pctTotal}%` }}
              />
            </div>
          </div>

          <section className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5 md:p-6 space-y-8">
            <h3 className="text-base md:text-lg font-bold text-zinc-900">Adequação aos Critérios do Edital</h3>
            {m.criteriosMatriz.map((c) => (
              <div key={c.titulo} className="space-y-3 pb-6 border-b border-zinc-100 last:border-0 last:pb-0">
                <h4 className="text-sm font-semibold text-zinc-800">{c.titulo}</h4>
                <p className="text-sm md:text-base text-zinc-700 leading-relaxed">{c.analise}</p>
                <p className="text-sm font-bold text-purple-700">Pontuação: {c.pontuacao}</p>
              </div>
            ))}

            <div className="grid md:grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-4 md:p-5">
                <h4 className="font-bold text-emerald-900 mb-3 text-sm">Pontos Fortes do Projeto</h4>
                <ul className="space-y-2">
                  {m.pontosFortes.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-emerald-950">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-4 md:p-5">
                <h4 className="font-bold text-amber-900 mb-3 text-sm">Pontos Fracos e Gaps</h4>
                <ul className="space-y-2">
                  {m.gaps.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-amber-950">
                      <span className="shrink-0" aria-hidden>
                        ⚠️
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-base md:text-lg font-bold text-zinc-900 px-1">Sugestões de melhoria</h3>
            {sugestoes.map((sugestao, idx) => (
              <div
                key={`${idx}-${sugestao.slice(0, 24)}`}
                className="rounded-xl border border-zinc-200 bg-white shadow-sm p-4 md:p-5"
              >
                <p className="text-sm md:text-base text-zinc-800 leading-relaxed">
                  <span className="font-semibold text-zinc-900">Sugestão {idx + 1}: </span>
                  {sugestao}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5 md:p-6">
            <div id="texto-do-projeto">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-base font-bold text-zinc-900">Texto do projeto</h3>
                <Button type="button" variant="outline" size="sm" onClick={copiarTexto} className="border-zinc-300">
                  📋 Copiar
                </Button>
              </div>
              <div className="space-y-5 text-sm md:text-base text-zinc-700 leading-relaxed">
                {m.secoesTextoProjeto.map((sec) => (
                  <div key={sec.titulo}>
                    <h4 className="font-semibold text-zinc-900 mb-1">{sec.titulo}</h4>
                    <p>{sec.corpo}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="border-t border-zinc-200 bg-white px-4 md:px-8 py-4 md:py-5 flex justify-end">
          <Button
            type="button"
            onClick={onProximoGerarTextos}
            className="gradient-primary text-white font-bold py-3 px-6 rounded-xl hover:opacity-95 border-0 shadow-md"
          >
            Próximo: Gerar Textos →
          </Button>
        </div>
      </div>
    </div>
  );
}
