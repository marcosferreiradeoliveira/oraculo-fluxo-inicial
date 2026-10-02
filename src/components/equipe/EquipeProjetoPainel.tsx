import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, AlertCircle } from 'lucide-react';
import type { Fornecedor } from '@/lib/fornecedores';
import type { AlocacaoEquipe } from '@/lib/equipeProjeto';
import {
  alocacaoDeFornecedor,
  setEtapaFornecedor,
  setFornecedorNaEtapa,
  setFornecedorNaRubrica,
  setRubricaFornecedor,
} from '@/lib/equipeProjeto';

type RubricaRef = { id: string; nome: string };
type EtapaRef = { id: string; nome: string; inicio?: string; fim?: string };

type Props = {
  fornecedores: Fornecedor[];
  rubricas: RubricaRef[];
  etapas: EtapaRef[];
  alocacoes: AlocacaoEquipe[];
  onAlocacoesChange: (next: AlocacaoEquipe[]) => void;
};

export function EquipeProjetoPainel({
  fornecedores,
  rubricas,
  etapas,
  alocacoes,
  onAlocacoesChange,
}: Props) {
  if (!fornecedores.length) {
    return (
      <p className="text-sm text-gray-600 py-4">
        Nenhum membro cadastrado. Adicione fornecedores/equipe na página inicial (menu Fornecedores)
        e volte aqui para alocar no projeto.
      </p>
    );
  }

  const rubricasOk = rubricas.filter((r) => r.nome.trim());
  const etapasOk = etapas.filter((e) => (e.nome || '').trim() || e.inicio || e.fim);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 flex items-start gap-2">
        <Users className="h-4 w-4 mt-0.5 shrink-0 text-oraculo-blue" />
        Vincule cada pessoa da sua base cadastrada às rubricas (pagamento) e às etapas do cronograma
        (execução).
      </p>
      {(rubricasOk.length === 0 || etapasOk.length === 0) && (
        <p className="text-xs text-amber-800 flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {rubricasOk.length === 0 && 'Salve o orçamento com rubricas. '}
          {etapasOk.length === 0 && 'Salve o cronograma com etapas. '}
          Você ainda pode alocar o que já existir.
        </p>
      )}

      <Tabs defaultValue="membro" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="membro">Por membro</TabsTrigger>
          <TabsTrigger value="rubrica">Por rubrica</TabsTrigger>
          <TabsTrigger value="etapa">Por etapa</TabsTrigger>
        </TabsList>

        <TabsContent value="membro" className="mt-4 space-y-4">
          {fornecedores.map((f) => {
            const al = alocacaoDeFornecedor(alocacoes, f.id);
            return (
              <div key={f.id} className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 space-y-3">
                <div>
                  <div className="font-medium text-gray-900">{f.nome}</div>
                  <div className="text-xs text-gray-500">{f.email}</div>
                  {f.minibio ? (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{f.minibio}</p>
                  ) : null}
                </div>
                {rubricasOk.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-2">Rubricas</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-2">
                      {rubricasOk.map((r) => {
                        const checked = al.rubricaIds.includes(r.id);
                        return (
                          <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                onAlocacoesChange(
                                  setRubricaFornecedor(alocacoes, f.id, r.id, !checked)
                                )
                              }
                              className="rounded border-gray-300 text-oraculo-blue"
                            />
                            <span>{r.nome}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                {etapasOk.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-2">Etapas do cronograma</div>
                    <div className="flex flex-col gap-1.5">
                      {etapasOk.map((e) => {
                        const checked = al.etapaIds.includes(e.id);
                        return (
                          <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                onAlocacoesChange(
                                  setEtapaFornecedor(alocacoes, f.id, e.id, !checked)
                                )
                              }
                              className="rounded border-gray-300 text-oraculo-blue"
                            />
                            <span>
                              {e.nome || 'Etapa'}
                              {(e.inicio || e.fim) && (
                                <span className="text-gray-400 ml-1 text-xs">
                                  ({e.inicio?.slice(0, 10)} – {e.fim?.slice(0, 10)})
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="rubrica" className="mt-4 space-y-4">
          {rubricasOk.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma rubrica no orçamento.</p>
          ) : (
            rubricasOk.map((r) => (
              <div key={r.id} className="rounded-lg border border-gray-200 p-4">
                <div className="font-medium text-sm mb-3">{r.nome}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-2">
                  {fornecedores.map((f) => {
                    const checked = alocacaoDeFornecedor(alocacoes, f.id).rubricaIds.includes(r.id);
                    return (
                      <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            onAlocacoesChange(
                              setFornecedorNaRubrica(alocacoes, r.id, f.id, !checked)
                            )
                          }
                          className="rounded border-gray-300 text-oraculo-blue"
                        />
                        <span>{f.nome}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="etapa" className="mt-4 space-y-4">
          {etapasOk.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma etapa no cronograma.</p>
          ) : (
            etapasOk.map((e) => (
              <div key={e.id} className="rounded-lg border border-gray-200 p-4">
                <div className="font-medium text-sm mb-1">{e.nome || 'Etapa'}</div>
                {(e.inicio || e.fim) && (
                  <div className="text-xs text-gray-500 mb-3">
                    {e.inicio?.slice(0, 10)} → {e.fim?.slice(0, 10)}
                  </div>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-2">
                  {fornecedores.map((f) => {
                    const checked = alocacaoDeFornecedor(alocacoes, f.id).etapaIds.includes(e.id);
                    return (
                      <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            onAlocacoesChange(
                              setFornecedorNaEtapa(alocacoes, e.id, f.id, !checked)
                            )
                          }
                          className="rounded border-gray-300 text-oraculo-blue"
                        />
                        <span>{f.nome}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
