import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  type DadosCadastraisEmpresa,
  formatarCep,
} from '@/lib/dadosCadastraisEmpresa';
import { formatarCnpj, formatarCpf } from '@/lib/fornecedores';
import { UfSelect } from '@/components/UfSelect';

export type DadosEmpresaFormValues = {
  nome: string;
  portfolio: string;
  equipeBio: string;
  dadosCadastraisEmpresa: DadosCadastraisEmpresa;
};

type Props = {
  values: DadosEmpresaFormValues;
  onChange: (patch: Partial<DadosEmpresaFormValues>) => void;
  onPatchDados: (patch: Partial<DadosCadastraisEmpresa>) => void;
  idPrefix?: string;
};

export function DadosEmpresaForm({ values, onChange, onPatchDados, idPrefix = 'emp' }: Props) {
  const p = (field: string) => `${idPrefix}-${field}`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor={p('nome')}>Nome da empresa *</Label>
        <Input
          id={p('nome')}
          value={values.nome}
          onChange={(e) => onChange({ nome: e.target.value })}
          placeholder="Como a empresa aparece em propostas e projetos"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={p('portfolio')}>Portfólio (texto)</Label>
        <Textarea
          id={p('portfolio')}
          value={values.portfolio}
          onChange={(e) => onChange({ portfolio: e.target.value })}
          placeholder="Resumo de projetos, experiências e referências para a IA usar nos textos"
          rows={4}
        />
        <p className="text-xs text-gray-500">
          Para fotos e clippings por ano, use a aba{' '}
          <span className="font-medium">Portfólio (galeria)</span> desta empresa.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={p('equipe')}>Equipe / bio institucional</Label>
        <Textarea
          id={p('equipe')}
          value={values.equipeBio}
          onChange={(e) => onChange({ equipeBio: e.target.value })}
          placeholder="Currículo da equipe, corpo técnico, histórico da organização…"
          rows={3}
        />
      </div>

      <div className="space-y-4 pt-2 border-t border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Dados cadastrais</h3>
          <p className="text-xs text-gray-500 mt-1">
            Usados em anexos e textos do projeto (CNPJ, endereço, representante legal).
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={p('cnpj')}>CNPJ</Label>
            <Input
              id={p('cnpj')}
              value={values.dadosCadastraisEmpresa.cnpj}
              onChange={(e) => onPatchDados({ cnpj: formatarCnpj(e.target.value) })}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={p('razao')}>Razão social</Label>
            <Input
              id={p('razao')}
              value={values.dadosCadastraisEmpresa.razaoSocial}
              onChange={(e) => onPatchDados({ razaoSocial: e.target.value })}
              placeholder="Nome jurídico conforme contrato social"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={p('fantasia')}>Nome fantasia</Label>
            <Input
              id={p('fantasia')}
              value={values.dadosCadastraisEmpresa.nomeFantasia}
              onChange={(e) => onPatchDados({ nomeFantasia: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={p('ie')}>Inscrição estadual</Label>
            <Input
              id={p('ie')}
              value={values.dadosCadastraisEmpresa.inscricaoEstadual}
              onChange={(e) => onPatchDados({ inscricaoEstadual: e.target.value })}
              placeholder="IE ou isento"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={p('im')}>Inscrição municipal</Label>
            <Input
              id={p('im')}
              value={values.dadosCadastraisEmpresa.inscricaoMunicipal}
              onChange={(e) => onPatchDados({ inscricaoMunicipal: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={p('cep')}>CEP</Label>
            <Input
              id={p('cep')}
              value={values.dadosCadastraisEmpresa.cep}
              onChange={(e) => onPatchDados({ cep: formatarCep(e.target.value) })}
              placeholder="00000-000"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={p('log')}>Logradouro</Label>
            <Input
              id={p('log')}
              value={values.dadosCadastraisEmpresa.logradouro}
              onChange={(e) => onPatchDados({ logradouro: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={p('num')}>Número</Label>
            <Input
              id={p('num')}
              value={values.dadosCadastraisEmpresa.numero}
              onChange={(e) => onPatchDados({ numero: e.target.value })}
              placeholder="Nº ou S/N"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={p('comp')}>Complemento</Label>
            <Input
              id={p('comp')}
              value={values.dadosCadastraisEmpresa.complemento}
              onChange={(e) => onPatchDados({ complemento: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={p('bairro')}>Bairro</Label>
            <Input
              id={p('bairro')}
              value={values.dadosCadastraisEmpresa.bairro}
              onChange={(e) => onPatchDados({ bairro: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={p('cidade')}>Cidade</Label>
            <Input
              id={p('cidade')}
              value={values.dadosCadastraisEmpresa.cidade}
              onChange={(e) => onPatchDados({ cidade: e.target.value })}
            />
          </div>
          <UfSelect
            id={p('uf')}
            value={values.dadosCadastraisEmpresa.uf}
            onChange={(uf) => onPatchDados({ uf })}
          />
          <div className="space-y-2">
            <Label htmlFor={p('tel')}>Telefone / WhatsApp</Label>
            <Input
              id={p('tel')}
              value={values.dadosCadastraisEmpresa.telefone}
              onChange={(e) => onPatchDados({ telefone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={p('email-inst')}>E-mail institucional</Label>
            <Input
              id={p('email-inst')}
              type="email"
              value={values.dadosCadastraisEmpresa.emailInstitucional}
              onChange={(e) => onPatchDados({ emailInstitucional: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={p('rep')}>Representante legal</Label>
            <Input
              id={p('rep')}
              value={values.dadosCadastraisEmpresa.representanteLegal}
              onChange={(e) => onPatchDados({ representanteLegal: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={p('cpf-rep')}>CPF do representante</Label>
            <Input
              id={p('cpf-rep')}
              value={values.dadosCadastraisEmpresa.cpfRepresentante}
              onChange={(e) =>
                onPatchDados({ cpfRepresentante: formatarCpf(e.target.value) })
              }
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={p('obs')}>Observações</Label>
            <Textarea
              id={p('obs')}
              value={values.dadosCadastraisEmpresa.observacoes}
              onChange={(e) => onPatchDados({ observacoes: e.target.value })}
              rows={3}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
