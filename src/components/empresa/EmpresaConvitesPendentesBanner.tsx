import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import {
  aceitarConviteEmpresa,
  listConvitesPendentesPorEmail,
  type ConvitePendenteUsuario,
} from '@/lib/empresasDb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  onAccepted?: () => void;
  /** `empresaId:conviteId` da URL */
  conviteParam?: string | null;
};

export function EmpresaConvitesPendentesBanner({ onAccepted, conviteParam }: Props) {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [convites, setConvites] = useState<ConvitePendenteUsuario[]>([]);
  const [acceptingKey, setAcceptingKey] = useState('');
  const autoAcceptRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.email) {
      setConvites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await listConvitesPendentesPorEmail(user.email);
      setConvites(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    void load();
  }, [load]);

  const aceitar = async (c: ConvitePendenteUsuario) => {
    if (!user?.email) return;
    const key = `${c.empresaId}:${c.conviteId}`;
    setAcceptingKey(key);
    try {
      await aceitarConviteEmpresa(user.uid, user.email, c.empresaId, c.conviteId);
      toast.success('Convite aceito. A empresa já está na sua conta.');
      await load();
      onAccepted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível aceitar o convite.');
    } finally {
      setAcceptingKey('');
    }
  };

  useEffect(() => {
    if (!conviteParam || !user?.email || loading || convites.length === 0) return;
    if (autoAcceptRef.current === conviteParam) return;
    const [empresaId, conviteId] = conviteParam.split(':');
    if (!empresaId || !conviteId) return;
    const match = convites.find((c) => c.empresaId === empresaId && c.conviteId === conviteId);
    if (match && acceptingKey === '') {
      autoAcceptRef.current = conviteParam;
      void aceitar(match);
    }
  }, [conviteParam, user?.email, loading, convites, acceptingKey]);

  if (loading || convites.length === 0) return null;

  return (
    <Card className="mb-6 border-oraculo-purple/30 bg-gradient-to-r from-oraculo-purple/5 to-oraculo-blue/5">
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center gap-2 text-oraculo-purple font-medium">
          <Mail className="h-5 w-5" />
          Convite{convites.length > 1 ? 's' : ''} de empresa
        </div>
        {convites.map((c) => {
          const key = `${c.empresaId}:${c.conviteId}`;
          const busy = acceptingKey === key;
          return (
            <div
              key={key}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-white/80 border border-white px-4 py-3"
            >
              <p className="text-sm text-gray-800">
                Você foi convidado para{' '}
                <strong>{c.empresaNome?.trim() || 'uma empresa'}</strong>
                {c.role === 'gestor_financeiro' ? ' como gestor' : ' como membro'}.
              </p>
              <Button
                size="sm"
                className="bg-oraculo-purple hover:bg-oraculo-purple/90 shrink-0"
                disabled={busy}
                onClick={() => void aceitar(c)}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aceitando…
                  </>
                ) : (
                  'Aceitar convite'
                )}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
