import React, { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Check, Search } from 'lucide-react';
import {
  type AtividadeFornecedor,
  type AtividadeReferenciaFgv,
  type TipoAtividadeFornecedor,
  buscarAtividadesReferenciaFgv,
} from '@/lib/atividadesReferenciaFgv';

export type AtividadeFornecedorFormState = {
  modo: TipoAtividadeFornecedor;
  referenciaId: string;
  personalizada: string;
};

export const emptyAtividadeForm: AtividadeFornecedorFormState = {
  modo: 'fgv_referencia',
  referenciaId: '',
  personalizada: '',
};

export function atividadeFormFromFornecedor(atividade?: AtividadeFornecedor | null): AtividadeFornecedorFormState {
  if (!atividade) return { ...emptyAtividadeForm };
  if (atividade.tipo === 'personalizada') {
    return { modo: 'personalizada', referenciaId: '', personalizada: atividade.nome };
  }
  return {
    modo: 'fgv_referencia',
    referenciaId: atividade.referenciaId,
    personalizada: '',
  };
}

export function atividadeFromForm(
  form: AtividadeFornecedorFormState,
  referencia?: AtividadeReferenciaFgv
): AtividadeFornecedor | null {
  if (form.modo === 'personalizada') {
    const nome = form.personalizada.trim();
    return nome ? { tipo: 'personalizada', nome } : null;
  }
  if (!referencia) return null;
  return {
    tipo: 'fgv_referencia',
    referenciaId: referencia.id,
    descricao: referencia.descricao,
  };
}

type Props = {
  value: AtividadeFornecedorFormState;
  onChange: (next: AtividadeFornecedorFormState) => void;
  referenciaSelecionada?: AtividadeReferenciaFgv;
};

export function SeletorAtividadeFornecedor({ value, onChange, referenciaSelecionada }: Props) {
  const [busca, setBusca] = useState('');

  const resultados = useMemo(() => buscarAtividadesReferenciaFgv(busca, 50), [busca]);

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
      <div>
        <Label className="text-sm font-medium">Função (referência FGV)</Label>
        <p className="text-xs text-gray-500 mt-0.5">
          Nomenclatura da tabela RJ 2012 — só a função, sem valores da planilha. Ou cadastre uma função
          própria.
        </p>
      </div>

      <RadioGroup
        value={value.modo}
        onValueChange={(v) =>
          onChange({
            ...value,
            modo: v as TipoAtividadeFornecedor,
          })
        }
        className="flex flex-col sm:flex-row gap-3 sm:gap-6"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="fgv_referencia" id="ativ-fgv" />
          <Label htmlFor="ativ-fgv" className="font-normal cursor-pointer">
            Da lista de referência
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="personalizada" id="ativ-custom" />
          <Label htmlFor="ativ-custom" className="font-normal cursor-pointer">
            Outra função (texto livre)
          </Label>
        </div>
      </RadioGroup>

      {value.modo === 'personalizada' ? (
        <div>
          <Label htmlFor="ativ-livre">Nome da função *</Label>
          <Input
            id="ativ-livre"
            value={value.personalizada}
            onChange={(e) => onChange({ ...value, personalizada: e.target.value })}
            placeholder="Ex.: Consultoria em gestão cultural"
            className="mt-1 bg-white"
          />
        </div>
      ) : (
        <div className="space-y-2">
          {referenciaSelecionada ? (
            <div className="rounded-md border border-oraculo-blue/30 bg-white p-2.5 text-sm">
              <div className="font-medium text-gray-900 leading-snug">{referenciaSelecionada.descricao}</div>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 mt-1 text-oraculo-blue"
                onClick={() => onChange({ ...value, referenciaId: '' })}
              >
                Trocar função
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome (ex.: roteirista, sonoplasta)…"
                  className="pl-9 bg-white"
                />
              </div>
              <ul className="max-h-44 overflow-y-auto rounded-md border border-gray-200 bg-white divide-y divide-gray-100">
                {resultados.length === 0 ? (
                  <li className="px-3 py-4 text-sm text-gray-500 text-center">Nenhuma atividade encontrada.</li>
                ) : (
                  resultados.map((a) => {
                    const selected = value.referenciaId === a.id;
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-oraculo-blue/5 transition-colors ${
                            selected ? 'bg-oraculo-blue/10' : ''
                          }`}
                          onClick={() => onChange({ ...value, referenciaId: a.id })}
                        >
                          <span className="flex items-start gap-2">
                            {selected ? (
                              <Check className="h-4 w-4 text-oraculo-blue shrink-0 mt-0.5" />
                            ) : (
                              <span className="w-4 shrink-0" />
                            )}
                            <span className="min-w-0">
                              <span className="block font-medium text-gray-900 leading-snug">{a.descricao}</span>
                              {a.unidade && a.unidade !== '—' ? (
                                <span className="block text-xs text-gray-500 mt-0.5">{a.unidade}</span>
                              ) : null}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
