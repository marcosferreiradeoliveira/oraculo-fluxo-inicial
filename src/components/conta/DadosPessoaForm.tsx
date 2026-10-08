import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type DadosCadastraisPessoa } from '@/lib/dadosCadastraisPessoa';
import { formatarCep } from '@/lib/dadosCadastraisEmpresa';
import { formatarCpf } from '@/lib/fornecedores';
import { UfSelect } from '@/components/UfSelect';

type Props = {
  values: DadosCadastraisPessoa;
  onChange: (patch: Partial<DadosCadastraisPessoa>) => void;
};

export function DadosPessoaForm({ values, onChange }: Props) {
  return (
    <div className="space-y-4 pt-2 border-t border-gray-100">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Dados de pessoa física</h3>
        <p className="text-xs text-gray-500 mt-1">
          CPF, documentos e endereço residencial para propostas e anexos em nome próprio.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pf-cpf">CPF</Label>
          <Input
            id="pf-cpf"
            value={values.cpf}
            onChange={(e) => onChange({ cpf: formatarCpf(e.target.value) })}
            placeholder="000.000.000-00"
            inputMode="numeric"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-nasc">Data de nascimento</Label>
          <Input
            id="pf-nasc"
            type="date"
            value={values.dataNascimento}
            onChange={(e) => onChange({ dataNascimento: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-rg">RG</Label>
          <Input
            id="pf-rg"
            value={values.rg}
            onChange={(e) => onChange({ rg: e.target.value })}
            placeholder="Número do documento"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-orgao">Órgão emissor (RG)</Label>
          <Input
            id="pf-orgao"
            value={values.orgaoEmissorRg}
            onChange={(e) => onChange({ orgaoEmissorRg: e.target.value })}
            placeholder="Ex.: SSP/SP"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-nacionalidade">Nacionalidade</Label>
          <Input
            id="pf-nacionalidade"
            value={values.nacionalidade}
            onChange={(e) => onChange({ nacionalidade: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-prof">Profissão / ocupação</Label>
          <Input
            id="pf-prof"
            value={values.profissao}
            onChange={(e) => onChange({ profissao: e.target.value })}
            placeholder="Ex.: Produtor cultural"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-tel">Telefone fixo</Label>
          <Input
            id="pf-tel"
            value={values.telefone}
            onChange={(e) => onChange({ telefone: e.target.value })}
            placeholder="(00) 0000-0000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-cel">Celular / WhatsApp</Label>
          <Input
            id="pf-cel"
            value={values.celular}
            onChange={(e) => onChange({ celular: e.target.value })}
            placeholder="(00) 00000-0000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-cep">CEP</Label>
          <Input
            id="pf-cep"
            value={values.cep}
            onChange={(e) => onChange({ cep: formatarCep(e.target.value) })}
            placeholder="00000-000"
            inputMode="numeric"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="pf-log">Logradouro</Label>
          <Input
            id="pf-log"
            value={values.logradouro}
            onChange={(e) => onChange({ logradouro: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-num">Número</Label>
          <Input
            id="pf-num"
            value={values.numero}
            onChange={(e) => onChange({ numero: e.target.value })}
            placeholder="Nº ou S/N"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-comp">Complemento</Label>
          <Input
            id="pf-comp"
            value={values.complemento}
            onChange={(e) => onChange({ complemento: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-bairro">Bairro</Label>
          <Input
            id="pf-bairro"
            value={values.bairro}
            onChange={(e) => onChange({ bairro: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-cidade">Cidade</Label>
          <Input
            id="pf-cidade"
            value={values.cidade}
            onChange={(e) => onChange({ cidade: e.target.value })}
          />
        </div>
        <UfSelect
          id="pf-uf"
          value={values.uf}
          onChange={(uf) => onChange({ uf })}
        />
      </div>
    </div>
  );
}
