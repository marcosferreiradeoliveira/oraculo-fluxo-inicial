import type { ReactNode } from 'react';
import {
  explicarCalculoNota,
  formatNotaBr,
  resumoNotaParaExibicao,
  type NotaPersistidaFirestore,
  type ResumoNotaEstimada,
} from '@/lib/extrairNotasCriterios';

type NotasCriteriosPainelProps = {
  analiseTexto: string;
  /** Nota e critérios salvos no Firestore (não dependem do parse após reload). */
  notaPersistida?: NotaPersistidaFirestore;
  rodapeCard?: ReactNode;
  variant?: 'default' | 'demo';
};

function GridCriterios({ criterios }: { criterios: ResumoNotaEstimada['criterios'] }) {
  if (criterios.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Notas por critério</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {criterios.map((criterio, idx) => {
          const percentual = criterio.maxima > 0 ? (criterio.obtida / criterio.maxima) * 100 : 0;
          const cor =
            percentual >= 75 ? 'bg-green-500' : percentual >= 50 ? 'bg-yellow-500' : 'bg-red-500';

          return (
            <div
              key={`${criterio.titulo}-${idx}`}
              className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm min-w-0"
            >
              <div className="flex items-start justify-between gap-3 mb-3 min-w-0">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-800 text-sm leading-tight break-words">
                    {criterio.titulo}
                  </h4>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-xl md:text-2xl font-bold text-oraculo-blue whitespace-nowrap">
                    {formatNotaBr(criterio.obtida)}
                    <span className="text-sm font-normal text-gray-500"> / {formatNotaBr(criterio.maxima)}</span>
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`${cor} h-2 rounded-full transition-all duration-500`}
                  style={{ width: `${Math.min(100, percentual)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-600 text-right">{percentual.toFixed(0)}% do máximo</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function NotasCriteriosPainel({
  analiseTexto,
  notaPersistida,
  rodapeCard,
  variant = 'default',
}: NotasCriteriosPainelProps) {
  const resumo = resumoNotaParaExibicao(analiseTexto, notaPersistida);
  if (!resumo) return null;

  const cardClass =
    variant === 'demo'
      ? 'bg-gradient-to-r from-oraculo-blue/85 to-oraculo-purple/85'
      : 'bg-gradient-to-r from-oraculo-blue to-oraculo-purple';

  return (
    <>
      <div className={`${cardClass} rounded-2xl p-8 text-white text-center mb-8`}>
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-3xl font-bold">📊</span>
          </div>
        </div>
        <h3 className="text-2xl font-bold mb-2">Nota Estimada</h3>
        <div className="text-6xl font-black mb-4">{formatNotaBr(resumo.notaExibida)}</div>
        <div className="text-lg opacity-90">
          de {formatNotaBr(resumo.maximaExibida)} pontos
          {resumo.somaObtida != null && resumo.somaMaxima != null && resumo.criterios.length > 0 && (
            <span className="block text-sm mt-1 opacity-75">
              (soma dos critérios: {formatNotaBr(resumo.somaObtida)}/{formatNotaBr(resumo.somaMaxima)})
            </span>
          )}
        </div>
        <div className="mt-4 w-full bg-white/20 rounded-full h-3">
          <div
            className="bg-white rounded-full h-3 transition-all duration-1000 ease-out"
            style={{ width: `${resumo.percentualBarra}%` }}
          />
        </div>
        {rodapeCard}
      </div>
      <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-5 md:p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-3">Como chegamos nesta nota</h3>
        <ol className="list-decimal pl-5 space-y-2 text-sm md:text-base text-gray-700 leading-relaxed">
          {explicarCalculoNota(resumo).map((linha, i) => (
            <li key={i}>{linha}</li>
          ))}
        </ol>
      </div>
      <GridCriterios criterios={resumo.criterios} />
    </>
  );
}
