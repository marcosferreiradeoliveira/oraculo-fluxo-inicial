import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UF_LIST } from '@/lib/dadosCadastraisEmpresa';

type Props = {
  id?: string;
  label?: string;
  value: string;
  onChange: (uf: string) => void;
  placeholder?: string;
};

export function UfSelect({
  id = 'uf',
  label = 'UF',
  value,
  onChange,
  placeholder = 'Selecione o estado',
}: Props) {
  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Select
        value={value || undefined}
        onValueChange={(v) => onChange(v)}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {UF_LIST.map((uf) => (
            <SelectItem key={uf} value={uf}>
              {uf}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
