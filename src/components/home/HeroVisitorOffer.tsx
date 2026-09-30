import { Sparkles, Zap, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackCtaVerComoFunciona } from '@/lib/analytics';
import analisarImage from '@/assets/Analisar.jpeg';

type HeroVisitorOfferProps = {
  onStartDemo: () => void;
  onCriarProjeto: () => void;
  onVerProjetoCompleto?: () => void;
};

export function HeroVisitorOffer({ onStartDemo, onCriarProjeto, onVerProjetoCompleto }: HeroVisitorOfferProps) {
  return (
    <section className="mb-10 rounded-lg overflow-hidden gradient-primary shadow-xl border border-primary/20">
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        <div className="flex-1 p-6 md:p-10 flex flex-col justify-center">
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-white/15 px-3 py-1 text-xs md:text-sm font-medium text-white mb-4 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Inteligência Artificial Especializada em Editais
          </span>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
            Veja como seu projeto é avaliado antes de enviar o rascunho final
          </h1>
          <p className="text-white/90 text-sm md:text-base leading-relaxed mb-8 max-w-2xl">
            Em menos de 2 minutos, rode uma avaliação preditiva simulando a banca examinadora do seu edital.
          </p>
          <div className="flex flex-col items-start gap-3">
            <Button
              size="lg"
              onClick={() => {
                trackCtaVerComoFunciona();
                onStartDemo();
              }}
              className="w-full sm:w-auto btn-cta-yellow font-bold text-base md:text-lg px-8 py-6 shadow-lg border-0 rounded-lg"
            >
              <Zap className="h-5 w-5 mr-2" />
              Ver Como Funciona na Prática
            </Button>
            <button
              type="button"
              onClick={onCriarProjeto}
              className="text-sm text-white/90 hover:text-white underline-offset-4 hover:underline inline-flex items-center gap-1"
            >
              Já tem um edital em mente?
              <span className="inline-flex items-center gap-1 font-semibold text-white">
                <Plus className="h-4 w-4" />
                Criar Projeto do Zero
              </span>
            </button>
            {onVerProjetoCompleto && (
              <button
                type="button"
                onClick={onVerProjetoCompleto}
                className="text-sm text-white/85 hover:text-white underline underline-offset-4"
              >
                Ver um projeto completo preenchido (exemplo)
              </button>
            )}
          </div>
        </div>
        <div className="lg:w-[42%] min-h-[220px] lg:min-h-0 relative hidden sm:block">
          <img
            src={analisarImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-95"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-transparent lg:from-primary/90" />
        </div>
      </div>
    </section>
  );
}
