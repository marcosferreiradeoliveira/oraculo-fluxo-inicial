import React, { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Users, AlertCircle, Search, CheckSquare, Square } from 'lucide-react';
import type { Fornecedor } from '@/lib/fornecedores';
import type { AlocacaoEquipe } from '@/lib/equipeProjeto';
import {
  alocacaoDeFornecedor,
  fornecedoresDaEtapa,
  fornecedoresDaRubrica,
  setEtapaFornecedor,
  setFornecedoresNaEtapa,
  setFornecedoresNaRubrica,
  setRubricaFornecedor,
} from '@/lib/equipeProjeto';
import { SeletorMembrosMulti } from '@/components/equipe/SeletorMembrosMulti';

type RubricaRef = { id: string; nome: string };
type EtapaRef = { id: string; nome: string; inicio?: string; fim?: string };

type Props = {
  fornecedores: Fornecedor[];
  rubricas: RubricaRef[];
  etapas: EtapaRef[];
  alocacoes: AlocacaoEquipe[];
  onAlocacoesChange: (next: AlocacaoEquipe[]) => void;
};

type TabEquipe = 'rubrica' | 'etapa' | 'membro';

function normalizarBusca(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function contemBusca(texto: string | undefined, q: string): boolean {
  if (!q) return true;
  const t = normalizarBusca(texto || '');
  return t.includes(q);
}

export function EquipeProjetoPainel({
  fornecedores,
  rubricas,
  etapas,
  alocacoes,
  onAlocacoesChange,
}: Props) {
  const rubricasOk = rubricas.filter((r) => r.nome.trim());
  const etapasOk = etapas.filter((e) => (e.nome || '').trim() || e.inicio || e.fim);

  const [aba, setAba] = useState<TabEquipe>('rubrica');
  const [busca, setBusca] = useState('');

  const q = normalizarBusca(busca);

  const fornecedoresFiltrados = useMemo(() => {
    if (!q) return fornecedores;
    return fornecedores.filter(
      (f) =>
        contemBusca(f.nome, q) ||
        contemBusca(f.email, q) ||
        contemBusca(f.minibio, q)
    );
  }, [fornecedores, q]);

  const rubricasFiltradas = useMemo(() => {
    if (!q) return rubricasOk;
    return rubricasOk.filter((r) => {
      if (contemBusca(r.nome, q)) return true;
      return fornecedores.some(
        (f) =>
          (contemBusca(f.nome, q) || contemBusca(f.email, q)) &&
          alocacaoDeFornecedor(alocacoes, f.id).rubricaIds.includes(r.id)
      );
    });
  }, [rubricasOk, q, fornecedores, alocacoes]);

  const etapasFiltradas = useMemo(() => {
    if (!q) return etapasOk;
    return etapasOk.filter((e) => {
      const rotulo = `${e.nome || ''} ${e.inicio || ''} ${e.fim || ''}`;
      if (contemBusca(rotulo, q)) return true;
      return fornecedores.some(
        (f) =>
          (contemBusca(f.nome, q) || contemBusca(f.email, q)) &&
          alocacaoDeFornecedor(alocacoes, f.id).etapaIds.includes(e.id)
      );
    });
  }, [etapasOk, q, fornecedores, alocacoes]);

  const fornecedoresVisiveisNaRubrica = (rubricaId: string) => {
    if (!q) return fornecedores;
    const r = rubricasOk.find((x) => x.id === rubricaId);
    if (r && contemBusca(r.nome, q)) return fornecedores;
    return fornecedoresFiltrados;
  };

  const todosFornecedorIds = useMemo(() => fornecedores.map((f) => f.id), [fornecedores]);

  const marcarVisiveisAba = (associar: boolean) => {
    let next = alocacoes;
    if (aba === 'rubrica') {
      for (const r of rubricasFiltradas) {
        const ids = associar
          ? fornecedoresVisiveisNaRubrica(r.id).map((f) => f.id)
          : [];
        next = setFornecedoresNaRubrica(next, r.id, ids, todosFornecedorIds);
      }
    } else if (aba === 'etapa') {
      for (const e of etapasFiltradas) {
        const ids = associar ? fornecedoresFiltrados.map((f) => f.id) : [];
        next = setFornecedoresNaEtapa(next, e.id, ids, todosFornecedorIds);
      }
    } else {
      for (const f of fornecedoresFiltrados) {
        for (const r of rubricasOk) {
          if (!q || contemBusca(r.nome, q)) {
            next = setRubricaFornecedor(next, f.id, r.id, associar);
          }
        }
        for (const e of etapasOk) {
          const rotulo = `${e.nome || ''} ${e.inicio || ''} ${e.fim || ''}`;
          if (!q || contemBusca(rotulo, q)) {
            next = setEtapaFornecedor(next, f.id, e.id, associar);
          }
        }
      }
    }
    onAlocacoesChange(next);
  };

  if (!fornecedores.length) {
    return (
      <p className="text-sm text-gray-600 py-4">
        Nenhum membro cadastrado. Cadastre em Fornecedores no menu lateral.
        e volte aqui para alocar no projeto.
      </p>
    );
  }

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

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar membro, rubrica ou etapa…"
            className="pl-9"
            aria-label="Buscar"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs sm:text-sm"
            onClick={() => marcarVisiveisAba(true)}
            title="Marca todos os vínculos visíveis nesta aba"
          >
            <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
            Marcar visíveis
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs sm:text-sm"
            onClick={() => marcarVisiveisAba(false)}
            title="Desmarca todos os vínculos visíveis nesta aba"
          >
            <Square className="h-3.5 w-3.5 mr-1.5" />
            Limpar visíveis
          </Button>
        </div>
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as TabEquipe)} className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="rubrica">Por rubrica</TabsTrigger>
          <TabsTrigger value="etapa">Por etapa</TabsTrigger>
          <TabsTrigger value="membro">Por membro</TabsTrigger>
        </TabsList>

        <TabsContent value="rubrica" className="mt-4 space-y-4">
          {rubricasOk.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma rubrica no orçamento.</p>
          ) : rubricasFiltradas.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma rubrica corresponde à busca.</p>
          ) : (
            rubricasFiltradas.map((r) => {
              const listaF = fornecedoresVisiveisNaRubrica(r.id);
              const selecionados = fornecedoresDaRubrica(alocacoes, r.id);
              return (
              <div key={r.id} className="rounded-lg border border-gray-200 p-4">
                <div className="font-medium text-sm mb-3">{r.nome}</div>
                {listaF.length === 0 ? (
                  <p className="text-xs text-gray-500">Nenhum membro corresponde à busca.</p>
                ) : (
                  <SeletorMembrosMulti
                    opcoes={listaF.map((f) => ({ id: f.id, nome: f.nome, email: f.email }))}
                    selecionados={selecionados}
                    onChange={(ids) =>
                      onAlocacoesChange(
                        setFornecedoresNaRubrica(alocacoes, r.id, ids, todosFornecedorIds)
                      )
                    }
                    placeholder="Escolher membros desta rubrica…"
                  />
                )}
              </div>
            );
            })
          )}
        </TabsContent>

        <TabsContent value="etapa" className="mt-4 space-y-4">
          {etapasOk.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma etapa no cronograma.</p>
          ) : etapasFiltradas.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma etapa corresponde à busca.</p>
          ) : (
            etapasFiltradas.map((e) => {
              const selecionados = fornecedoresDaEtapa(alocacoes, e.id);
              return (
              <div key={e.id} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3">
                  <div className="font-medium text-sm">{e.nome || 'Etapa'}</div>
                  {(e.inicio || e.fim) && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {e.inicio?.slice(0, 10)} → {e.fim?.slice(0, 10)}
                    </div>
                  )}
                </div>
                {fornecedoresFiltrados.length === 0 ? (
                  <p className="text-xs text-gray-500">Nenhum membro corresponde à busca.</p>
                ) : (
                  <SeletorMembrosMulti
                    opcoes={fornecedoresFiltrados.map((f) => ({
                      id: f.id,
                      nome: f.nome,
                      email: f.email,
                    }))}
                    selecionados={selecionados}
                    onChange={(ids) =>
                      onAlocacoesChange(
                        setFornecedoresNaEtapa(alocacoes, e.id, ids, todosFornecedorIds)
                      )
                    }
                    placeholder="Escolher membros desta etapa…"
                  />
                )}
              </div>
            );
            })
          )}
        </TabsContent>

        <TabsContent value="membro" className="mt-4 space-y-4">
          {fornecedoresFiltrados.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum membro corresponde à busca.</p>
          ) : null}
          {fornecedoresFiltrados.map((f) => {
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
                      {rubricasOk
                        .filter((r) => !q || contemBusca(r.nome, q))
                        .map((r) => {
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
                      {etapasOk
                        .filter((e) => {
                          if (!q) return true;
                          const rotulo = `${e.nome || ''} ${e.inicio || ''} ${e.fim || ''}`;
                          return contemBusca(rotulo, q);
                        })
                        .map((e) => {
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
      </Tabs>
    </div>
  );
}
