import React, { useCallback, useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import {
  cancelarConviteEmpresa,
  listConvitesPendentesEmpresa,
  listMembrosEmpresa,
  linkConviteEmpresa,
  podeGerenciarEquipeEmpresa,
  type ConviteEmpresaComId,
  type EmpresaMembroComId,
  type EmpresaMembroRole,
} from '@/lib/empresasDb';
import {
  mensagemErroCallable,
  provisionarConviteEmpresaCallable,
  revogarAcessoMembroEmpresaCallable,
} from '@/lib/conviteEmpresaCallable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Copy, Loader2, Mail, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  listProjetosParaAtribuirConvite,
  type ProjetoResumoEmpresa,
} from '@/lib/projetosEmpresa';

const ROLE_LABEL: Record<EmpresaMembroRole, string> = {
  super_admin: 'Administrador',
  gestor_financeiro: 'Gestor',
  membro: 'Membro',
};

type Props = {
  empresaId: string;
  empresaNome?: string;
  ownerUid?: string;
};

function podeRevogarMembro(
  m: EmpresaMembroComId,
  ctx: { canManage: boolean; ownerUid?: string; currentUid?: string }
): boolean {
  if (!ctx.canManage || m.status !== 'active') return false;
  if (ctx.currentUid && m.uid === ctx.currentUid) return false;
  if (ctx.ownerUid && m.uid === ctx.ownerUid) return false;
  if (m.role === 'super_admin') return false;
  if (m.role === 'gestor_financeiro' && ctx.ownerUid !== ctx.currentUid) return false;
  return true;
}

export function EmpresaEquipePanel({ empresaId, empresaNome, ownerUid }: Props) {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [membros, setMembros] = useState<EmpresaMembroComId[]>([]);
  const [convites, setConvites] = useState<ConviteEmpresaComId[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'membro' | 'gestor_financeiro'>('membro');
  const [sending, setSending] = useState(false);
  const [lastLink, setLastLink] = useState('');
  const [revokeTarget, setRevokeTarget] = useState<EmpresaMembroComId | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [projetosEmpresa, setProjetosEmpresa] = useState<ProjetoResumoEmpresa[]>([]);
  const [loadingProjetos, setLoadingProjetos] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [manage, listM, listC] = await Promise.all([
        podeGerenciarEquipeEmpresa(empresaId, user.uid),
        listMembrosEmpresa(empresaId),
        listConvitesPendentesEmpresa(empresaId),
      ]);
      setCanManage(manage);
      listM.sort((a, b) => {
        const order: Record<EmpresaMembroRole, number> = {
          super_admin: 0,
          gestor_financeiro: 1,
          membro: 2,
        };
        return order[a.role] - order[b.role];
      });
      setMembros(listM.filter((m) => m.status === 'active'));
      setConvites(listC);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível carregar a equipe.');
    } finally {
      setLoading(false);
    }
  }, [empresaId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canManage) return;
    setLoadingProjetos(true);
    listProjetosParaAtribuirConvite(empresaId)
      .then(setProjetosEmpresa)
      .catch(() => toast.error('Não foi possível carregar os projetos da empresa.'))
      .finally(() => setLoadingProjetos(false));
  }, [canManage, empresaId]);

  const toggleProjeto = (projectId: string, checked: boolean) => {
    setSelectedProjectIds((prev) =>
      checked ? [...new Set([...prev, projectId])] : prev.filter((id) => id !== projectId)
    );
  };

  const handleConvidar = async () => {
    if (!user?.email) return;
    if (role === 'membro' && selectedProjectIds.length === 0) {
      toast.error('Selecione ao menos um projeto para o membro convidado.');
      return;
    }
    setSending(true);
    try {
      const result = await provisionarConviteEmpresaCallable(
        empresaId,
        email,
        role,
        role === 'membro' ? selectedProjectIds : undefined
      );
      setLastLink(result.link);
      setEmail('');
      setSelectedProjectIds([]);
      if (result.emailSent) {
        toast.success(
          result.resent
            ? `Convite reenviado para ${result.email}.`
            : `Convite enviado para ${result.email}.`
        );
      } else {
        toast.error(
          result.emailError ||
            'Convite salvo, mas o e-mail NÃO foi enviado. Configure BREVO_API_KEY na function ou copie o link abaixo.',
          { duration: 12000 }
        );
      }
      await load();
    } catch (e) {
      toast.error(mensagemErroCallable(e));
    } finally {
      setSending(false);
    }
  };

  const handleRevogar = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revogarAcessoMembroEmpresaCallable(empresaId, revokeTarget.uid);
      toast.success(`Acesso de ${revokeTarget.email || 'convidado'} revogado.`);
      setRevokeTarget(null);
      await load();
    } catch (e) {
      toast.error(mensagemErroCallable(e));
    } finally {
      setRevoking(false);
    }
  };

  const handleCancelar = async (conviteId: string) => {
    if (!user) return;
    try {
      await cancelarConviteEmpresa(empresaId, conviteId, user.uid);
      toast.success('Convite cancelado.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao cancelar convite.');
    }
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copiado.');
    } catch {
      toast.error('Não foi possível copiar. Selecione o link manualmente.');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-oraculo-blue" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-oraculo-blue" />
            Pessoas com acesso
          </CardTitle>
          <CardDescription>
            Quem pode ver e editar projetos da empresa
            {empresaNome ? ` «${empresaNome}»` : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {membros.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum membro cadastrado.</p>
          ) : (
            membros.map((m) => {
              const showRevoke = podeRevogarMembro(m, {
                canManage,
                ownerUid,
                currentUid: user?.uid,
              });
              return (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.email || m.uid}</p>
                    {m.uid === user?.uid ? (
                      <p className="text-xs text-gray-500">Você</p>
                    ) : null}
                    {m.role === 'membro' && m.assignedProjects?.length ? (
                      <p className="text-xs text-gray-500">
                        {m.assignedProjects.length} projeto(s) atribuído(s)
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary">{ROLE_LABEL[m.role]}</Badge>
                    {showRevoke ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setRevokeTarget(m)}
                      >
                        <UserMinus className="h-3.5 w-3.5 mr-1" />
                        Revogar acesso
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="h-5 w-5 text-oraculo-purple" />
                Convidar por e-mail
              </CardTitle>
              <CardDescription>
                Enviamos um e-mail para o endereço informado com o link de{' '}
                <strong>primeiro acesso</strong> (criar senha). Não é a tela genérica de login.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="convite-email">E-mail</Label>
                  <Input
                    id="convite-email"
                    type="email"
                    placeholder="colega@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Papel na empresa</Label>
                  <Select
                    value={role}
                    onValueChange={(v) => {
                      setRole(v as typeof role);
                      if (v !== 'membro') setSelectedProjectIds([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="membro">Membro — projetos atribuídos</SelectItem>
                      <SelectItem value="gestor_financeiro">Gestor — todos os projetos da empresa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {role === 'membro' ? (
                <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
                  <Label>Projetos com acesso</Label>
                  <p className="text-xs text-gray-500">
                    O convidado só verá os projetos marcados abaixo (home, criar projeto e fluxo
                    do Oráculo).
                  </p>
                  {loadingProjetos ? (
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando projetos…
                    </p>
                  ) : projetosEmpresa.length === 0 ? (
                    <p className="text-sm text-amber-800">
                      Nenhum projeto encontrado. Crie projetos com a empresa ativa ou vincule{' '}
                      <code className="text-xs">empresaId</code> nos projetos existentes.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {projetosEmpresa.map((p) => (
                        <label
                          key={p.id}
                          className="flex items-start gap-2 text-sm cursor-pointer rounded-md px-1 py-0.5 hover:bg-white"
                        >
                          <Checkbox
                            checked={selectedProjectIds.includes(p.id)}
                            onCheckedChange={(v) => toggleProjeto(p.id, v === true)}
                          />
                          <span className="leading-snug">{p.nome}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
              <Button
                className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple"
                disabled={
                  sending ||
                  !email.trim() ||
                  (role === 'membro' && (loadingProjetos || selectedProjectIds.length === 0))
                }
                onClick={() => void handleConvidar()}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Enviar convite por e-mail
                  </>
                )}
              </Button>
              {lastLink ? (
                <div className="rounded-lg border border-oraculo-blue/20 bg-oraculo-blue/5 p-3 space-y-2">
                  <p className="text-xs font-medium text-gray-700">Link do convite</p>
                  <p className="text-xs break-all font-mono text-gray-600">{lastLink}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyLink(lastLink)}>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copiar link
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {convites.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Convites pendentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {convites.map((c) => {
                  const link = linkConviteEmpresa(empresaId, c.id);
                  return (
                    <div
                      key={c.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{c.email}</p>
                        <p className="text-xs text-gray-500">
                          {ROLE_LABEL[c.role]}
                          {c.role === 'membro' && c.assignedProjectIds?.length
                            ? ` · ${c.assignedProjectIds.length} projeto(s)`
                            : ''}
                        </p>
                        {c.emailSendError ? (
                          <p className="text-xs text-amber-700 mt-1">E-mail não enviado: {c.emailSendError}</p>
                        ) : c.emailSentAt ? (
                          <p className="text-xs text-green-700 mt-1">E-mail enviado</p>
                        ) : null}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button type="button" variant="outline" size="sm" onClick={() => void copyLink(link)}>
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Link
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => void handleCancelar(c.id)}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-6 text-sm text-gray-600">
            Apenas administradores ou gestores da empresa podem enviar convites. Peça acesso a quem
            criou a organização.
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !revoking) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget ? (
                <>
                  <strong>{revokeTarget.email}</strong> deixará de ver e editar projetos desta
                  empresa. Convites pendentes para o mesmo e-mail serão cancelados.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={revoking}
              onClick={(e) => {
                e.preventDefault();
                void handleRevogar();
              }}
            >
              {revoking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Revogando…
                </>
              ) : (
                'Revogar acesso'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
