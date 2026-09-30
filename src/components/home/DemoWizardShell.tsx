import { Check, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DEMO_WIZARD_STEPS } from '@/lib/projetoDemonstracao';
import { ReactNode } from 'react';

function DemoWizardNavBar({
  voltarLabel,
  onVoltar,
  proximoLabel,
  onProximo,
  className = '',
}: {
  voltarLabel?: string;
  onVoltar?: () => void;
  proximoLabel: string;
  onProximo: () => void;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-zinc-200 bg-white shadow-sm px-4 py-3 md:px-5 ${className}`}
    >
      {onVoltar ? (
        <Button type="button" variant="outline" onClick={onVoltar} className="border-zinc-300 w-full sm:w-auto">
          {voltarLabel}
        </Button>
      ) : (
        <span className="hidden sm:block" />
      )}
      <Button
        type="button"
        onClick={onProximo}
        className="gradient-primary text-white font-bold py-3 px-6 rounded-xl w-full sm:w-auto sm:ml-auto border-0 shadow-md hover:opacity-95"
      >
        {proximoLabel}
      </Button>
    </div>
  );
}

type DemoWizardShellProps = {
  etapaAtiva: number;
  nomeProjeto: string;
  editalNome?: string;
  tituloPainel: string;
  subtituloPainel?: string;
  children: ReactNode;
  voltarLabel?: string;
  onVoltar?: () => void;
  proximoLabel: string;
  onProximo: () => void;
};

export function DemoWizardShell({
  etapaAtiva,
  nomeProjeto,
  editalNome,
  tituloPainel,
  subtituloPainel,
  children,
  voltarLabel = '← Voltar',
  onVoltar,
  proximoLabel,
  onProximo,
}: DemoWizardShellProps) {
  const editalLinha = editalNome
    ? `EDITAL DE FOMENTO — ${editalNome}`
    : 'EDITAL DE FOMENTO — Exemplo';

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0 space-y-6 font-sans antialiased">
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900">{nomeProjeto}</h1>
            <p className="text-xs md:text-sm font-semibold uppercase tracking-wide text-zinc-500 mt-2">{editalLinha}</p>
          </div>
          <Badge className="self-start bg-zinc-900 text-white">Demonstração</Badge>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-0 mb-3 overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          {DEMO_WIZARD_STEPS.map((label, index) => {
            const concluido = index < etapaAtiva;
            const ativo = index === etapaAtiva;
            return (
              <div key={label} className="flex items-center flex-shrink-0 md:flex-1">
                <div className="flex flex-col items-center min-w-[4rem] md:flex-1">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center ${
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
                  <ChevronRight className="hidden lg:block h-4 w-4 text-zinc-300 shrink-0" aria-hidden />
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

      <DemoWizardNavBar
        voltarLabel={voltarLabel}
        onVoltar={onVoltar}
        proximoLabel={proximoLabel}
        onProximo={onProximo}
      />

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 md:px-6 py-4">
          <h2 className="text-lg md:text-xl font-bold">{tituloPainel}</h2>
          {subtituloPainel ? <p className="text-sm text-white/85 mt-1">{subtituloPainel}</p> : null}
        </div>
        <div className="p-4 md:p-6 bg-[#F8FAFC]">{children}</div>
        <DemoWizardNavBar
          voltarLabel={voltarLabel}
          onVoltar={onVoltar}
          proximoLabel={proximoLabel}
          onProximo={onProximo}
          className="border-0 border-t border-zinc-200 rounded-none shadow-none"
        />
      </div>
    </div>
  );
}
