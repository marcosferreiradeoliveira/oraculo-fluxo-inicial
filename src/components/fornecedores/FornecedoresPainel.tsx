import React, { useCallback, useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
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
import { Building2, Loader2, Mail, Pencil, Plus, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import {
  type Fornecedor,
  cpfValidoBasico,
  emailValidoBasico,
  formatarCpf,
} from '@/lib/fornecedores';

const emptyForm = {
  nome: '',
  cpf: '',
  identidade: '',
  minibio: '',
  email: '',
};

export function FornecedoresPainel() {
  const [user] = useAuthState(auth);
  const [lista, setLista] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState(emptyForm);

  const carregar = useCallback(async () => {
    if (!user) {
      setLista([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const q = query(collection(db, 'fornecedores'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const items: Fornecedor[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as Fornecedor);
      });
      items.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
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
    setForm({
      nome: f.nome || '',
      cpf: f.cpf || '',
      identidade: f.identidade || '',
      minibio: f.minibio || '',
      email: f.email || '',
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
    if (!cpfValidoBasico(form.cpf)) {
      toast.error('Informe um CPF válido (11 dígitos).');
      return false;
    }
    if (!form.identidade.trim()) {
      toast.error('Informe o documento de identidade.');
      return false;
    }
    if (!emailValidoBasico(form.email)) {
      toast.error('Informe um e-mail de contato válido.');
      return false;
    }
    return true;
  };

  const salvar = async () => {
    if (!user || !validarForm()) return;
    setSalvando(true);
    try {
      const payload = {
        userId: user.uid,
        nome: form.nome.trim(),
        cpf: formatarCpf(form.cpf),
        identidade: form.identidade.trim(),
        minibio: form.minibio.trim(),
        email: form.email.trim().toLowerCase(),
        atualizadoEm: serverTimestamp(),
      };

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
            Cadastre fornecedores e parceiros da sua produção — dados da sua conta, independentes de
            qualquer projeto.
          </p>
        </div>
        <Button className="gradient-brand text-white shrink-0" onClick={abrirNovo}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar fornecedor
        </Button>
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
              Inclua nome, CPF, identidade, mini bio e e-mail — um cadastro por vez.
            </p>
            <Button variant="outline" onClick={abrirNovo}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar o primeiro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.map((f) => (
            <Card key={f.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg leading-snug">{f.nome}</CardTitle>
                <CardDescription className="text-xs space-y-0.5">
                  <span className="block">CPF: {f.cpf}</span>
                  <span className="block">Identidade: {f.identidade}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
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
                <div className="flex gap-2 pt-2 border-t border-gray-100">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && fecharDialog()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar fornecedor' : 'Novo fornecedor'}</DialogTitle>
            <DialogDescription>
              Preencha os dados de contato. Você pode cadastrar quantos precisar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="forn-nome">Nome *</Label>
              <Input
                id="forn-nome"
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Nome completo ou razão social"
              />
            </div>
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
