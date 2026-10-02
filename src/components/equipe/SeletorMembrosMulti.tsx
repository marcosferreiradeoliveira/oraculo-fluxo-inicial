import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MembroOpcao = { id: string; nome: string; email?: string };

type Props = {
  opcoes: MembroOpcao[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
};

function normalizar(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function SeletorMembrosMulti({
  opcoes,
  selecionados,
  onChange,
  placeholder = 'Selecionar membros…',
  className,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [filtro, setFiltro] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const q = normalizar(filtro);
  const opcoesFiltradas = useMemo(() => {
    if (!q) return opcoes;
    return opcoes.filter(
      (o) => normalizar(o.nome).includes(q) || normalizar(o.email || '').includes(q)
    );
  }, [opcoes, q]);

  const rotulo = useMemo(() => {
    if (selecionados.length === 0) return placeholder;
    if (selecionados.length === 1) {
      return opcoes.find((o) => o.id === selecionados[0])?.nome ?? '1 membro';
    }
    return `${selecionados.length} membros selecionados`;
  }, [selecionados, opcoes, placeholder]);

  useEffect(() => {
    if (!aberto) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setAberto(false);
        setFiltro('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [aberto]);

  const toggle = (id: string, checked: boolean) => {
    if (checked) onChange([...new Set([...selecionados, id])]);
    else onChange(selecionados.filter((x) => x !== id));
  };

  const marcarFiltrados = (on: boolean) => {
    const ids = opcoesFiltradas.map((o) => o.id);
    if (on) onChange([...new Set([...selecionados, ...ids])]);
    else onChange(selecionados.filter((id) => !ids.includes(id)));
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between font-normal h-10 px-3"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="listbox"
      >
        <span className="flex items-center gap-2 truncate text-left">
          <Users className="h-4 w-4 shrink-0 text-gray-500" />
          <span className={cn('truncate', selecionados.length === 0 && 'text-muted-foreground')}>
            {rotulo}
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 opacity-50 transition-transform', aberto && 'rotate-180')} />
      </Button>

      {aberto && (
        <div
          className="absolute z-50 mt-1 w-full min-w-[16rem] rounded-md border border-gray-200 bg-white shadow-lg"
          role="listbox"
        >
          <div className="p-2 border-b border-gray-100">
            <Input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Filtrar membros…"
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-1 px-2 py-1.5 border-b border-gray-50 text-xs">
            <button
              type="button"
              className="text-oraculo-blue hover:underline px-1"
              onClick={() => marcarFiltrados(true)}
            >
              Marcar listados
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              className="text-gray-600 hover:underline px-1"
              onClick={() => marcarFiltrados(false)}
            >
              Desmarcar listados
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {opcoesFiltradas.length === 0 ? (
              <p className="text-xs text-gray-500 px-2 py-3 text-center">Nenhum membro encontrado.</p>
            ) : (
              opcoesFiltradas.map((o) => {
                const checked = selecionados.includes(o.id);
                return (
                  <label
                    key={o.id}
                    className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggle(o.id, v === true)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-gray-900 leading-tight">{o.nome}</span>
                      {o.email ? (
                        <span className="block text-xs text-gray-500 truncate">{o.email}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}

      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selecionados.map((id) => {
            const o = opcoes.find((x) => x.id === id);
            if (!o) return null;
            return (
              <span
                key={id}
                className="inline-flex items-center rounded-full bg-oraculo-blue/10 text-oraculo-blue px-2.5 py-0.5 text-xs font-medium"
              >
                {o.nome}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
