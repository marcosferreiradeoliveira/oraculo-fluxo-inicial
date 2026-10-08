import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  definirEmpresaAtiva,
  lerRefsEmpresaDoUsuario,
  listEmpresasDoUsuario,
  type EmpresaComId,
} from '@/lib/empresasDb';

type Props = {
  uid: string;
};

export function AssociarEmpresaConta({ uid }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [empresas, setEmpresas] = useState<EmpresaComId[]>([]);
  const [defaultEmpresaId, setDefaultEmpresaId] = useState('');
  const [selecionada, setSelecionada] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const userSnap = await getDoc(doc(db, 'usuarios', uid));
      const refs = lerRefsEmpresaDoUsuario(userSnap.data());
      setDefaultEmpresaId(refs.defaultEmpresaId);
      const list = await listEmpresasDoUsuario(refs.empresaIds);
      setEmpresas(list);
      const initial =
        refs.defaultEmpresaId && list.some((e) => e.id === refs.defaultEmpresaId)
          ? refs.defaultEmpresaId
          : list[0]?.id ?? '';
      setSelecionada(initial);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível carregar suas empresas.');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const empresaAtiva = empresas.find((e) => e.id === defaultEmpresaId);

  const associar = async () => {
    if (!selecionada) {
      toast.error('Selecione uma empresa.');
      return;
    }
    if (selecionada === defaultEmpresaId) {
      toast.message('Esta empresa já está associada à sua conta.');
      return;
    }
    setSaving(true);
    try {
      await definirEmpresaAtiva(uid, selecionada);
      toast.success('Conta associada à empresa selecionada.');
      setDefaultEmpresaId(selecionada);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível associar a empresa.');
    } finally {
      setSaving(false);
    }
  };

  const irCriar = () => {
    navigate('/empresas', { state: { view: 'criar' } });
  };

  const irLista = () => {
    navigate('/empresas');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-oraculo-blue" />
          Empresa
        </CardTitle>
        <CardDescription>
          Associe sua conta a uma empresa existente ou cadastre uma nova organização.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-600 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : empresas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-4 text-sm text-gray-600">
            <p className="font-medium text-gray-800">Nenhuma empresa vinculada</p>
            <p className="mt-1">
              Crie uma nova empresa ou aguarde um convite no seu e-mail para entrar em uma
              existente.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                type="button"
                className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple"
                onClick={irCriar}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar nova empresa
              </Button>
            </div>
          </div>
        ) : (
          <>
            {empresaAtiva ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-600">Associada agora:</span>
                <span className="font-semibold text-gray-900">{empresaAtiva.nome}</span>
                <Badge variant="secondary" className="text-xs">
                  Ativa
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                Escolha abaixo qual empresa usar nos projetos.
              </p>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Empresa existente</label>
              <Select value={selecionada} onValueChange={setSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome || 'Sem nome'}
                      {defaultEmpresaId === e.id ? ' (ativa)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple"
                disabled={saving || !selecionada}
                onClick={() => void associar()}
              >
                {saving ? 'Associando…' : 'Associar a esta empresa'}
              </Button>
              <Button type="button" variant="outline" onClick={irLista}>
                Gerenciar empresas
              </Button>
              <Button type="button" variant="outline" onClick={irCriar}>
                <Plus className="h-4 w-4 mr-2" />
                Criar nova
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
