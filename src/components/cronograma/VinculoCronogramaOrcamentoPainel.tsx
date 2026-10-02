import React from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link2, Sparkles, AlertCircle } from 'lucide-react';
import {
  type EtapaVinculo,
  type RubricaVinculo,
  resumoVinculos,
  setRubricaNaEtapa,
} from '@/lib/vinculoCronogramaOrcamento';

type Props = {
  etapas: EtapaVinculo[];
  rubricas: RubricaVinculo[];
  onEtapasChange: (etapas: EtapaVinculo[]) => void;
  onSugerirVinculos?: () => void;
  sugerindo?: boolean;
  emptyRubricasMessage?: string;
  emptyEtapasMessage?: string;
};

export function VinculoCronogramaOrcamentoPainel({
  etapas,
  rubricas,
  onEtapasChange,
  onSugerirVinculos,
  sugerindo,
  emptyRubricasMessage = 'Crie e salve o orçamento para listar rubricas aqui.',
  emptyEtapasMessage = 'Adicione etapas no cronograma na aba anterior.',
}: Props) {
  const rubricasValidas = rubricas.filter((r) => r.nome.trim().length > 0);
  const etapasValidas = etapas.filter((e) => (e.etapa || '').trim() || e.inicio || e.fim);
  const resumo = resumoVinculos(etapas, rubricasValidas);

  if (!etapasValidas.length) {
    return <p className="text-sm text-gray-500 py-4">{emptyEtapasMessage}</p>;
  }

  if (!rubricasValidas.length) {
    return <p className="text-sm text-gray-500 py-4">{emptyRubricasMessage}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-sm text-gray-600 flex items-start gap-2">
            <Link2 className="h-4 w-4 mt-0.5 shrink-0 text-oraculo-blue" />
            Relacione cada rubrica do orçamento às etapas em que o custo ocorre. O vínculo é salvo no
            cronograma do projeto.
          </p>
          {(resumo.semEtapa.length > 0 || resumo.etapasSemRubrica > 0) && (
            <p className="text-xs text-amber-800 mt-2 flex items-start gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {resumo.semEtapa.length > 0 && (
                <span>
                  {resumo.semEtapa.length} rubrica(s) sem etapa: {resumo.semEtapa.slice(0, 3).join(', ')}
                  {resumo.semEtapa.length > 3 ? '…' : ''}.{' '}
                </span>
              )}
              {resumo.etapasSemRubrica > 0 && (
                <span>{resumo.etapasSemRubrica} etapa(s) sem rubrica associada.</span>
              )}
            </p>
          )}
        </div>
        {onSugerirVinculos && (
          <Button
            type="button"
            variant="outline"
            className="border-oraculo-purple text-oraculo-purple shrink-0"
            onClick={onSugerirVinculos}
            disabled={sugerindo}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {sugerindo ? 'Sugerindo…' : 'Sugerir automaticamente'}
          </Button>
        )}
      </div>

      <Tabs defaultValue="por-etapa" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="por-etapa">Por etapa</TabsTrigger>
          <TabsTrigger value="por-rubrica">Por rubrica</TabsTrigger>
        </TabsList>

        <TabsContent value="por-etapa" className="mt-4 space-y-4">
          {etapasValidas.map((e) => (
            <div key={e.id} className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
              <div className="font-medium text-gray-900 text-sm mb-1">{e.etapa || 'Etapa sem nome'}</div>
              {(e.inicio || e.fim) && (
                <div className="text-xs text-gray-500 mb-3">
                  {e.inicio?.slice(0, 10)} → {e.fim?.slice(0, 10)}
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {rubricasValidas.map((r) => {
                  const checked = (e.rubricasAssociadas || []).includes(r.nome.trim());
                  return (
                    <label key={r.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          onEtapasChange(
                            setRubricaNaEtapa(etapas, e.id, r.nome.trim(), !checked)
                          )
                        }
                        className="rounded border-gray-300 text-oraculo-blue focus:ring-oraculo-blue"
                      />
                      <span className={checked ? 'font-medium text-gray-900' : 'text-gray-600'}>
                        {r.nome}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="por-rubrica" className="mt-4 space-y-4">
          {rubricasValidas.map((r) => {
            const nome = r.nome.trim();
            return (
              <div key={r.id} className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                <div className="font-medium text-gray-900 text-sm mb-3">{nome}</div>
                <div className="flex flex-col gap-2">
                  {etapasValidas.map((e) => {
                    const checked = (e.rubricasAssociadas || []).includes(nome);
                    return (
                      <label key={e.id} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            onEtapasChange(setRubricaNaEtapa(etapas, e.id, nome, !checked))
                          }
                          className="rounded border-gray-300 text-oraculo-blue focus:ring-oraculo-blue"
                        />
                        <span className={checked ? 'font-medium text-gray-900' : 'text-gray-600'}>
                          {e.etapa || 'Etapa'}
                          {(e.inicio || e.fim) && (
                            <span className="text-gray-400 font-normal ml-1">
                              ({e.inicio?.slice(0, 10)} – {e.fim?.slice(0, 10)})
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
