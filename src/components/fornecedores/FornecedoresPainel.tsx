import React, { useCallback, useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { Building2, FolderKanban, Loader2, Mail, Pencil, Plus, Trash2, User, Eye } from 'lucide-react';
import {
  carregarMapaProjetosPorFornecedor,
  type ProjetoVinculoFornecedor,
} from '@/lib/fornecedorProjetos';
import {
  fetchFornecedoresAcessiveis,
  usuarioPodeGerenciarFornecedores,
} from '@/lib/fornecedoresEmpresa';
import { lerRefsEmpresaDoUsuario } from '@/lib/empresasDb';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  type Fornecedor,
  type TipoPessoaFornecedor,
  cpfValidoBasico,
  cnpjValidoBasico,
  emailValidoBasico,
  formatarCpf,
  formatarCnpj,
  tipoPessoaFornecedor,
} from '@/lib/fornecedores';
import { atividadeReferenciaPorId, rotuloAtividadeFornecedor } from '@/lib/atividadesReferenciaFgv';
import {
  SeletorAtividadeFornecedor,
  atividadeFormFromFornecedor,
  atividadeFromForm,
  emptyAtividadeForm,
  type AtividadeFornecedorFormState,
} from '@/components/fornecedores/SeletorAtividadeFornecedor';

type FormState = {
  tipoPessoa: TipoPessoaFornecedor;
  nome: string;
  cpf: string;
  cnpj: string;
  identidade: string;
  minibio: string;
  email: string;
  atividade: AtividadeFornecedorFormState;
};

const emptyForm: FormState = {
  tipoPessoa: 'PF',
  nome: '',
  cpf: '',
  cnpj: '',
  identidade: '',
  minibio: '',
  email: '',
  atividade: { ...emptyAtividadeForm },
};

export function FornecedoresPainel() {
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [lista, setLista] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [projetosDialogOpen, setProjetosDialogOpen] = useState(false);
  const [projetosPorFornecedor, setProjetosPorFornecedor] = useState<
    Map<string, ProjetoVinculoFornecedor[]>
  >(new Map());
  const [carregandoProjetos, setCarregandoProjetos] = useState(false);
  const [fornecedorProjetosFoco, setFornecedorProjetosFoco] = useState<Fornecedor | null>(null);
  const [podeGerenciar, setPodeGerenciar] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) {
      setLista([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [items, manage] = await Promise.all([
        fetchFornecedoresAcessiveis(user.uid),
        usuarioPodeGerenciarFornecedores(user.uid),
      ]);
      setPodeGerenciar(manage);
      setLista(items);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível carregar fornecedores.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirNovo = () => {
    setEditando(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const abrirEditar = (f: Fornecedor) => {
    setEditando(f);
    const tipo = tipoPessoaFornecedor(f);
    setForm({
      tipoPessoa: tipo,
      nome: f.nome || '',
      cpf: tipo === 'PF' ? f.cpf || '' : '',
      cnpj: tipo === 'PJ' ? f.cnpj || '' : '',
      identidade: f.identidade || '',
      minibio: f.minibio || '',
      email: f.email || '',
      atividade: atividadeFormFromFornecedor(f.atividade),
    });
    setDialogOpen(true);
  };

  const fecharDialog = () => {
    setDialogOpen(false);
    setEditando(null);
    setForm(emptyForm);
  };

  const validarForm = (): boolean => {
    if (!form.nome.trim()) {
      toast.error('Informe o nome do fornecedor.');
      return false;
    }
    if (form.tipoPessoa === 'PJ') {
      if (!cnpjValidoBasico(form.cnpj)) {
        toast.error('Informe um CNPJ válido (14 dígitos).');
        return false;
      }
    } else {
      if (!cpfValidoBasico(form.cpf)) {
        toast.error('Informe um CPF válido (11 dígitos).');
        return false;
      }
      if (!form.identidade.trim()) {
        toast.error('Informe o documento de identidade.');
        return false;
      }
    }
    if (!emailValidoBasico(form.email)) {
      toast.error('Informe um e-mail de contato válido.');
      return false;
    }
    if (form.atividade.modo === 'personalizada') {
      if (!form.atividade.personalizada.trim()) {
        toast.error('Informe o nome da atividade ou escolha uma da lista FGV.');
        return false;
      }
    } else if (!form.atividade.referenciaId) {
      toast.error('Selecione uma atividade da lista de referência ou use atividade personalizada.');
      return false;
    }
    return true;
  };

  const salvar = async () => {
    if (!user || !validarForm()) return;
    setSalvando(true);
    try {
      const isPj = form.tipoPessoa === 'PJ';
      const ref =
        form.atividade.modo === 'fgv_referencia'
          ? atividadeReferenciaPorId(form.atividade.referenciaId)
          : undefined;
      const atividade = atividadeFromForm(form.atividade, ref);
      const userSnap = await getDoc(doc(db, 'usuarios', user.uid));
      const empresaAtiva = lerRefsEmpresaDoUsuario(userSnap.data()).defaultEmpresaId;
      const payload: Record<string, unknown> = {
        userId: user.uid,
        tipoPessoa: form.tipoPessoa,
        nome: form.nome.trim(),
        cpf: isPj ? '' : formatarCpf(form.cpf),
        cnpj: isPj ? formatarCnpj(form.cnpj) : '',
        identidade: isPj ? (form.identidade.trim() || '') : form.identidade.trim(),
        minibio: form.minibio.trim(),
        email: form.email.trim().toLowerCase(),
        atividade: atividade ?? null,
        atualizadoEm: serverTimestamp(),
      };
      if (empresaAtiva) {
        payload.empresaId = empresaAtiva;
      }

      if (editando) {
        await updateDoc(doc(db, 'fornecedores', editando.id), payload);
        toast.success('Fornecedor atualizado.');
      } else {
        await addDoc(collection(db, 'fornecedores'), {
          ...payload,
          criadoEm: serverTimestamp(),
        });
        toast.success('Fornecedor cadastrado.');
      }
      fecharDialog();
      await carregar();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar fornecedor.');
    } finally {
      setSalvando(false);
    }
  };

  const abrirProjetosVinculados = async (foco: Fornecedor | null = null) => {
    if (!user) return;
    setFornecedorProjetosFoco(foco);
    setProjetosDialogOpen(true);
    setCarregandoProjetos(true);
    try {
      const mapa = await carregarMapaProjetosPorFornecedor(user.uid);
      setProjetosPorFornecedor(mapa);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível carregar projetos vinculados.');
      setProjetosDialogOpen(false);
    } finally {
      setCarregandoProjetos(false);
    }
  };

  const excluir = async (f: Fornecedor) => {
    if (!window.confirm(`Remover "${f.nome}" da lista?`)) return;
    try {
      await deleteDoc(doc(db, 'fornecedores', f.id));
      toast.success('Fornecedor removido.');
      await carregar();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao remover fornecedor.');
    }
  };

  if (!user) {
    return (
      <section id="fornecedores" className="mb-12 scroll-mt-24">
        <Card className="border-oraculo-blue/20">
          <CardContent className="py-8 text-center text-gray-600">
            Entre na sua conta para cadastrar fornecedores.
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section id="fornecedores" className="mb-12 scroll-mt-24">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="h-7 w-7 text-oraculo-blue" />
            Fornecedores
          </h2>
          <p className="text-gray-600 mt-1 text-sm md:text-base max-w-2xl">
            {podeGerenciar
              ? 'Cadastre fornecedores e parceiros da produção — compartilhados com a equipe da empresa.'
              : 'Fornecedores cadastrados pela equipe da empresa (somente consulta).'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {lista.length > 0 && (
            <Button variant="outline" onClick={() => abrirProjetosVinculados(null)}>
              <FolderKanban className="h-4 w-4 mr-2" />
              Projetos por fornecedor
            </Button>
          )}
          {podeGerenciar ? (
            <Button className="gradient-brand text-white" onClick={abrirNovo}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar fornecedor
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Carregando…
        </div>
      ) : lista.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200 bg-white">
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-700 font-medium mb-2">Nenhum fornecedor cadastrado</p>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Pessoa física (CPF) ou jurídica (CNPJ), mini bio e e-mail — um cadastro por vez.
            </p>
            {podeGerenciar ? (
              <Button variant="outline" onClick={abrirNovo}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar o primeiro
              </Button>
            ) : (
              <p className="text-sm text-gray-500">Peça a um gestor da empresa para cadastrar.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.map((f) => (
            <Card key={f.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg leading-snug">{f.nome}</CardTitle>
                <CardDescription className="text-xs space-y-0.5">
                  <span className="block font-medium text-gray-700">
                    {tipoPessoaFornecedor(f) === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'}
                  </span>
                  {tipoPessoaFornecedor(f) === 'PJ' ? (
                    <span className="block">CNPJ: {f.cnpj || '—'}</span>
                  ) : (
                    <>
                      <span className="block">CPF: {f.cpf}</span>
                      {f.identidade ? (
                        <span className="block">Identidade: {f.identidade}</span>
                      ) : null}
                    </>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {f.atividade ? (
                  <p className="text-xs text-gray-600 bg-gray-50 rounded-md px-2 py-1.5 border border-gray-100">
                    <span className="font-medium text-gray-800">Função: </span>
                    {rotuloAtividadeFornecedor(f.atividade)}
                  </p>
                ) : null}
                {f.minibio ? (
                  <p className="text-sm text-gray-600 line-clamp-3">{f.minibio}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">Sem mini bio</p>
                )}
                <a
                  href={`mailto:${f.email}`}
                  className="inline-flex items-center gap-1.5 text-sm text-oraculo-blue hover:underline"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {f.email}
                </a>
                <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => abrirProjetosVinculados(f)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Ver projetos
                  </Button>
                  {podeGerenciar ? (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => abrirEditar(f)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => excluir(f)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={projetosDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setProjetosDialogOpen(false);
            setFornecedorProjetosFoco(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {fornecedorProjetosFoco
                ? `Projetos — ${fornecedorProjetosFoco.nome}`
                : 'Projetos por fornecedor'}
            </DialogTitle>
            <DialogDescription>
              Projetos em que o membro foi alocado na etapa Equipe (rubricas e/ou cronograma).
            </DialogDescription>
          </DialogHeader>
          {carregandoProjetos ? (
            <div className="flex items-center justify-center py-10 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando projetos…
            </div>
          ) : (
            <div className="space-y-4 py-1">
              {(fornecedorProjetosFoco ? [fornecedorProjetosFoco] : lista).map((f) => {
                const projetos = projetosPorFornecedor.get(f.id) ?? [];
                return (
                  <div key={f.id} className="rounded-lg border border-gray-200 p-3">
                    {!fornecedorProjetosFoco && (
                      <div className="font-medium text-sm text-gray-900 mb-2">{f.nome}</div>
                    )}
                    {projetos.length === 0 ? (
                      <p className="text-xs text-gray-500">
                        Nenhum projeto com alocação na etapa Equipe.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {projetos.map((p) => (
                          <li
                            key={p.id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm border-b border-gray-50 last:border-0 pb-2 last:pb-0"
                          >
                            <div>
                              <span className="font-medium text-gray-800">{p.nome}</span>
                              <span className="block text-xs text-gray-500 mt-0.5">
                                {p.rubricasVinculadas > 0 && `${p.rubricasVinculadas} rubrica(s)`}
                                {p.rubricasVinculadas > 0 && p.etapasVinculadas > 0 && ' · '}
                                {p.etapasVinculadas > 0 && `${p.etapasVinculadas} etapa(s)`}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-oraculo-blue shrink-0"
                              onClick={() => {
                                setProjetosDialogOpen(false);
                                navigate(`/projeto/${p.id}/equipe`);
                              }}
                            >
                              Abrir equipe
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && fecharDialog()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar fornecedor' : 'Novo fornecedor'}</DialogTitle>
            <DialogDescription>
              Preencha os dados de contato. Você pode cadastrar quantos precisar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <RadioGroup
                value={form.tipoPessoa}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    tipoPessoa: v as TipoPessoaFornecedor,
                    cpf: v === 'PJ' ? '' : p.cpf,
                    cnpj: v === 'PF' ? '' : p.cnpj,
                  }))
                }
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PF" id="forn-tipo-pf" />
                  <Label htmlFor="forn-tipo-pf" className="font-normal cursor-pointer">
                    Pessoa física (PF)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PJ" id="forn-tipo-pj" />
                  <Label htmlFor="forn-tipo-pj" className="font-normal cursor-pointer">
                    Pessoa jurídica (PJ)
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="forn-nome">
                {form.tipoPessoa === 'PJ' ? 'Razão social / nome fantasia *' : 'Nome completo *'}
              </Label>
              <Input
                id="forn-nome"
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                placeholder={form.tipoPessoa === 'PJ' ? 'Ex.: Produções Culturais Ltda.' : 'Nome completo'}
              />
            </div>
            {form.tipoPessoa === 'PJ' ? (
              <div>
                <Label htmlFor="forn-cnpj">CNPJ *</Label>
                <Input
                  id="forn-cnpj"
                  value={form.cnpj}
                  onChange={(e) => setForm((p) => ({ ...p, cnpj: formatarCnpj(e.target.value) }))}
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="forn-cpf">CPF *</Label>
                  <Input
                    id="forn-cpf"
                    value={form.cpf}
                    onChange={(e) => setForm((p) => ({ ...p, cpf: formatarCpf(e.target.value) }))}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <Label htmlFor="forn-id">Identidade *</Label>
                  <Input
                    id="forn-id"
                    value={form.identidade}
                    onChange={(e) => setForm((p) => ({ ...p, identidade: e.target.value }))}
                    placeholder="RG ou documento"
                  />
                </div>
              </div>
            )}
            <SeletorAtividadeFornecedor
              value={form.atividade}
              onChange={(atividade) => setForm((p) => ({ ...p, atividade }))}
              referenciaSelecionada={
                form.atividade.referenciaId
                  ? atividadeReferenciaPorId(form.atividade.referenciaId)
                  : undefined
              }
            />
            <div>
              <Label htmlFor="forn-email">E-mail de contato *</Label>
              <Input
                id="forn-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="contato@exemplo.com"
              />
            </div>
            <div>
              <Label htmlFor="forn-bio">Mini bio</Label>
              <Textarea
                id="forn-bio"
                value={form.minibio}
                onChange={(e) => setForm((p) => ({ ...p, minibio: e.target.value }))}
                placeholder="Serviços, experiência, observações…"
                rows={4}
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={fecharDialog} disabled={salvando}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="gradient-brand text-white"
                onClick={salvar}
                disabled={salvando}
              >
                {salvando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando…
                  </>
                ) : editando ? (
                  'Salvar alterações'
                ) : (
                  'Cadastrar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
