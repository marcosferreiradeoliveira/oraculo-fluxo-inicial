import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Briefcase,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DadosEmpresaForm,
  type DadosEmpresaFormValues,
} from '@/components/empresa/DadosEmpresaForm';
import { emptyDadosCadastraisEmpresa, ufValida } from '@/lib/dadosCadastraisEmpresa';
import {
  atualizarEmpresa,
  criarEmpresa,
  definirEmpresaAtiva,
  legacyEmpresaFromUsuario,
  lerRefsEmpresaDoUsuario,
  listEmpresasDoUsuario,
  sincronizarPerfilUsuarioComEmpresa,
  type EmpresaComId,
} from '@/lib/empresasDb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PortfolioGaleriaEmpresa } from '@/components/empresa/PortfolioGaleriaEmpresa';

type View = 'lista' | 'criar' | 'detalhe';
type DetalheAba = 'cadastro' | 'galeria';

function emptyForm(): DadosEmpresaFormValues {
  return {
    nome: '',
    portfolio: '',
    equipeBio: '',
    dadosCadastraisEmpresa: emptyDadosCadastraisEmpresa(),
  };
}

function empresaToForm(e: EmpresaComId): DadosEmpresaFormValues {
  return {
    nome: e.nome,
    portfolio: e.portfolio,
    equipeBio: e.equipeBio,
    dadosCadastraisEmpresa: { ...e.dadosCadastraisEmpresa },
  };
}

function resumoLocal(e: EmpresaComId): string {
  const { cidade, uf } = e.dadosCadastraisEmpresa;
  if (cidade && uf) return `${cidade} / ${uf}`;
  if (cidade) return cidade;
  return e.portfolio.trim() ? 'Portfólio cadastrado' : 'Toque para completar o cadastro';
}

const Empresas = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, authLoading] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('lista');
  const [empresas, setEmpresas] = useState<EmpresaComId[]>([]);
  const [defaultEmpresaId, setDefaultEmpresaId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<DadosEmpresaFormValues>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [detalheAba, setDetalheAba] = useState<DetalheAba>('cadastro');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userSnap = await getDoc(doc(db, 'usuarios', user.uid));
      const data = userSnap.data();
      const refs = lerRefsEmpresaDoUsuario(data);
      setDefaultEmpresaId(refs.defaultEmpresaId);
      const list = await listEmpresasDoUsuario(refs.empresaIds);
      setEmpresas(list);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível carregar suas empresas.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/cadastro');
      return;
    }
    load();
  }, [user, authLoading, load, navigate]);

  const patchForm = (patch: Partial<DadosEmpresaFormValues>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const patchDados = (patch: Partial<DadosEmpresaFormValues['dadosCadastraisEmpresa']>) => {
    setForm((prev) => ({
      ...prev,
      dadosCadastraisEmpresa: { ...prev.dadosCadastraisEmpresa, ...patch },
    }));
  };

  const validarForm = (): boolean => {
    if (!form.nome.trim()) {
      toast.error('Informe o nome da empresa.');
      return false;
    }
    const cnpjDigits = form.dadosCadastraisEmpresa.cnpj.replace(/\D/g, '');
    if (cnpjDigits.length > 0 && cnpjDigits.length !== 14) {
      toast.error('CNPJ deve ter 14 dígitos.');
      return false;
    }
    if (form.dadosCadastraisEmpresa.uf && !ufValida(form.dadosCadastraisEmpresa.uf)) {
      toast.error('UF inválida (ex.: SP).');
      return false;
    }
    return true;
  };

  const voltarLista = () => {
    setSelectedId('');
    setForm(emptyForm());
    setView('lista');
  };

  const iniciarCriar = async () => {
    if (!user) return;
    const userSnap = await getDoc(doc(db, 'usuarios', user.uid));
    const legacy = legacyEmpresaFromUsuario(userSnap.data());
    setForm({
      nome: legacy.nome ?? '',
      portfolio: legacy.portfolio ?? '',
      equipeBio: legacy.equipeBio ?? '',
      dadosCadastraisEmpresa:
        legacy.dadosCadastraisEmpresa ?? emptyDadosCadastraisEmpresa(),
    });
    setSelectedId('');
    setView('criar');
  };

  useEffect(() => {
    const state = location.state as { view?: View } | null;
    if (state?.view === 'criar' && user && !authLoading) {
      void iniciarCriar();
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- abre criar só via state da rota
  }, [location.state, user, authLoading]);

  const abrirDetalhe = (empresaId: string, aba: DetalheAba = 'cadastro') => {
    const emp = empresas.find((e) => e.id === empresaId);
    if (!emp) return;
    setSelectedId(empresaId);
    setForm(empresaToForm(emp));
    setDetalheAba(aba);
    setView('detalhe');
  };

  useEffect(() => {
    const empresaParam = searchParams.get('empresa');
    if (!empresaParam || loading || empresas.length === 0) return;
    const emp = empresas.find((e) => e.id === empresaParam);
    if (!emp) return;
    const abaParam = searchParams.get('aba');
    setSelectedId(empresaParam);
    setForm(empresaToForm(emp));
    setDetalheAba(abaParam === 'galeria' ? 'galeria' : 'cadastro');
    setView('detalhe');
    if (searchParams.has('empresa') || searchParams.has('aba')) {
      setSearchParams({}, { replace: true });
    }
  }, [loading, empresas, searchParams, setSearchParams]);

  const handleCriar = async () => {
    if (!user?.email || !validarForm()) return;
    setSaving(true);
    try {
      await criarEmpresa(user.uid, user.email, {
        nome: form.nome,
        portfolio: form.portfolio,
        equipeBio: form.equipeBio,
        dadosCadastraisEmpresa: form.dadosCadastraisEmpresa,
      });
      toast.success('Empresa criada e definida como ativa.');
      await load();
      voltarLista();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Erro ao criar empresa.');
    } finally {
      setSaving(false);
    }
  };

  const handleSalvar = async () => {
    if (!user || !selectedId || !validarForm()) return;
    setSaving(true);
    try {
      const updated = await atualizarEmpresa(selectedId, {
        nome: form.nome,
        portfolio: form.portfolio,
        equipeBio: form.equipeBio,
        dadosCadastraisEmpresa: form.dadosCadastraisEmpresa,
      });
      if (defaultEmpresaId === selectedId) {
        await sincronizarPerfilUsuarioComEmpresa(user.uid, updated);
      }
      toast.success('Empresa atualizada.');
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar empresa.');
    } finally {
      setSaving(false);
    }
  };

  const handleUsarEmpresa = async (empresaId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) return;
    setSaving(true);
    try {
      await definirEmpresaAtiva(user.uid, empresaId);
      toast.success('Empresa ativa atualizada.');
      setDefaultEmpresaId(empresaId);
      await load();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível ativar esta empresa.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 flex items-center justify-center gap-2 text-gray-600">
            <Loader2 className="h-6 w-6 animate-spin text-oraculo-blue" />
            Carregando empresas…
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-8 animate-fade-in">
          <div className="max-w-6xl mx-auto">
            {view === 'lista' && (
              <>
                <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                      <Briefcase className="h-8 w-8 text-oraculo-blue" />
                      Empresas
                    </h1>
                    <p className="text-gray-600 text-sm md:text-base">
                      Escolha a organização ativa ou abra um card para editar dados e portfólio.
                    </p>
                  </div>
                  {empresas.length > 0 && (
                    <Button
                      className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple shrink-0"
                      onClick={() => void iniciarCriar()}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Nova empresa
                    </Button>
                  )}
                </div>

                {empresas.length === 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card
                      className="cursor-pointer hover:border-oraculo-blue/40 transition-colors"
                      onClick={() => void iniciarCriar()}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Plus className="h-5 w-5 text-oraculo-blue" />
                          Criar empresa
                        </CardTitle>
                        <CardDescription>
                          Cadastre uma nova organização. Você será administrador e ela ficará
                          ativa nos projetos.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple">
                          Começar cadastro
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="border-dashed">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-oraculo-purple" />
                          Usar empresa existente
                        </CardTitle>
                        <CardDescription>
                          Se você foi convidado, a empresa aparecerá aqui após o convite ser
                          aceito.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 text-sm text-gray-600">
                          <Building2 className="h-8 w-8 text-gray-400 mb-2" />
                          Nenhuma empresa vinculada ao seu e-mail ainda. Peça ao administrador
                          para enviar um convite ou crie uma nova empresa ao lado.
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {empresas.map((e) => (
                      <Card
                        key={e.id}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer hover:shadow-md hover:border-oraculo-blue/30 transition-all group"
                        onClick={() => abrirDetalhe(e.id)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault();
                            abrirDetalhe(e.id);
                          }
                        }}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <CardTitle className="text-lg truncate group-hover:text-oraculo-blue transition-colors">
                                {e.nome || 'Sem nome'}
                              </CardTitle>
                              {e.dadosCadastraisEmpresa.cnpj ? (
                                <p className="text-xs text-gray-500 mt-1 font-mono">
                                  {e.dadosCadastraisEmpresa.cnpj}
                                </p>
                              ) : null}
                            </div>
                            {defaultEmpresaId === e.id ? (
                              <Badge className="shrink-0 bg-oraculo-blue/10 text-oraculo-blue border-0">
                                Ativa
                              </Badge>
                            ) : null}
                          </div>
                          <CardDescription className="line-clamp-2 mt-2">
                            {resumoLocal(e)}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0 flex items-center justify-between gap-2">
                          {defaultEmpresaId !== e.id ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={saving}
                              onClick={(ev) => void handleUsarEmpresa(e.id, ev)}
                            >
                              <Check className="h-3.5 w-3.5 mr-1" />
                              Usar nos projetos
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-500">Usada em textos e anexos</span>
                          )}
                          <span className="text-sm text-oraculo-blue flex items-center font-medium">
                            Abrir
                            <ChevronRight className="h-4 w-4 ml-0.5" />
                          </span>
                        </CardContent>
                      </Card>
                    ))}

                    <Card
                      className="border-dashed cursor-pointer hover:border-oraculo-blue/40 hover:bg-oraculo-blue/[0.02] transition-colors flex flex-col justify-center min-h-[160px]"
                      onClick={() => void iniciarCriar()}
                    >
                      <CardContent className="flex flex-col items-center justify-center text-center py-8">
                        <div className="h-12 w-12 rounded-full bg-oraculo-blue/10 flex items-center justify-center mb-3">
                          <Plus className="h-6 w-6 text-oraculo-blue" />
                        </div>
                        <p className="font-medium text-gray-900">Adicionar empresa</p>
                        <p className="text-xs text-gray-500 mt-1">Criar ou importar da conta</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </>
            )}

            {view === 'criar' && (
              <Card>
                <CardHeader>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-fit -ml-2 mb-2"
                    onClick={voltarLista}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Voltar às empresas
                  </Button>
                  <CardTitle>Nova empresa</CardTitle>
                  <CardDescription>
                    {form.nome || form.portfolio
                      ? 'Importamos dados que estavam em Minha Conta — revise e salve.'
                      : 'Preencha os dados institucionais da proponente.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <DadosEmpresaForm values={form} onChange={patchForm} onPatchDados={patchDados} />
                  <Button
                    className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple"
                    onClick={() => void handleCriar()}
                    disabled={saving}
                  >
                    {saving ? 'Criando…' : 'Criar e usar esta empresa'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {view === 'detalhe' && selectedId && (
              <>
                <div className="mb-6">
                  <Button variant="ghost" size="sm" className="-ml-2 mb-4" onClick={voltarLista}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Voltar às empresas
                  </Button>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold text-gray-900">{form.nome || 'Empresa'}</h1>
                    {defaultEmpresaId === selectedId && (
                      <Badge className="bg-oraculo-blue/10 text-oraculo-blue border-0">
                        Ativa nos projetos
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm">
                    Dados usados em anexos e geração de textos quando esta empresa está ativa.
                  </p>
                </div>

                {defaultEmpresaId !== selectedId && (
                  <div className="mb-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={saving}
                      onClick={() => void handleUsarEmpresa(selectedId)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Definir como ativa
                    </Button>
                  </div>
                )}

                <Tabs
                  value={detalheAba}
                  onValueChange={(v) => setDetalheAba(v as DetalheAba)}
                  className="w-full"
                >
                  <TabsList className="mb-4">
                    <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
                    <TabsTrigger value="galeria">Portfólio (galeria)</TabsTrigger>
                  </TabsList>
                  <TabsContent value="cadastro">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Dados da empresa</CardTitle>
                        <CardDescription>
                          Nome, portfólio em texto, equipe e cadastro institucional (CNPJ).
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <DadosEmpresaForm
                          values={form}
                          onChange={patchForm}
                          onPatchDados={patchDados}
                          idPrefix="edit"
                        />
                        <Button
                          className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple"
                          onClick={() => void handleSalvar()}
                          disabled={saving}
                        >
                          {saving ? 'Salvando…' : 'Salvar alterações'}
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="galeria">
                    <PortfolioGaleriaEmpresa
                      empresaId={selectedId}
                      empresaNome={form.nome}
                    />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Empresas;
