import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { db, storage, auth } from '@/lib/firebase';
import { parseEditalEncerramento } from '@/lib/editalDates';
import { toast } from 'sonner';
import { ImagePlus, Loader2 } from 'lucide-react';

type EditalForm = {
  nome: string;
  proponente: string;
  descricao: string;
  escopo: string;
  criterios: string;
  categoriasText: string;
  textosExigidosText: string;
  valor_maximo_premiacao: string;
  link_edital: string;
  dataEncerramentoInput: string;
  thumbnail: string;
  pdf_url: string;
};

function dateToInputValue(raw: unknown): string {
  const parsed = parseEditalEncerramento({ data_encerramento: raw, dataEncerramento: raw, deadline: raw });
  if (parsed) return parsed.toISOString().split('T')[0];
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (typeof raw === 'string' && raw.includes('/')) {
    const [d, m, y] = raw.split('/').map((p) => p.trim());
    if (d && m && y) {
      const iso = `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      if (!Number.isNaN(new Date(iso).getTime())) return iso;
    }
  }
  return '';
}

function firestoreToForm(data: Record<string, unknown>): EditalForm {
  const categorias = Array.isArray(data.categorias) ? (data.categorias as string[]) : [];
  const textos = Array.isArray(data.textos_exigidos) ? (data.textos_exigidos as string[]) : [];
  const encRaw = data.data_encerramento ?? data.dataEncerramento ?? data.deadline;

  return {
    nome: typeof data.nome === 'string' ? data.nome : '',
    proponente: typeof data.proponente === 'string' ? data.proponente : '',
    descricao:
      (typeof data.descricao === 'string' && data.descricao) ||
      (typeof data.escopo === 'string' ? data.escopo : ''),
    escopo: typeof data.escopo === 'string' ? data.escopo : '',
    criterios: typeof data.criterios === 'string' ? data.criterios : '',
    categoriasText: categorias.join(', '),
    textosExigidosText: textos.join('\n'),
    valor_maximo_premiacao:
      typeof data.valor_maximo_premiacao === 'string' ? data.valor_maximo_premiacao : '',
    link_edital:
      (typeof data.link_edital === 'string' && data.link_edital) ||
      (typeof data.pdf_url === 'string' ? data.pdf_url : ''),
    dataEncerramentoInput: dateToInputValue(encRaw),
    thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail : '',
    pdf_url: typeof data.pdf_url === 'string' ? data.pdf_url : '',
  };
}

function splitList(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const EditarEdital = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<EditalForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [thumbFile, setThumbFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchEdital = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'editais', id));
        if (snap.exists()) {
          setForm(firestoreToForm(snap.data() as Record<string, unknown>));
        } else {
          setForm(null);
          toast.error('Edital não encontrado');
        }
      } catch (e) {
        console.error(e);
        toast.error('Erro ao carregar edital');
        setForm(null);
      } finally {
        setLoading(false);
      }
    };
    void fetchEdital();
  }, [id]);

  const patch = (partial: Partial<EditalForm>) => {
    setForm((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  const handleUploadThumbnail = async () => {
    if (!id || !thumbFile) return;
    if (!auth.currentUser) {
      toast.error('Faça login para enviar a foto');
      return;
    }
    setUploadingThumb(true);
    try {
      const safeName = thumbFile.name.replace(/[^\w.-]+/g, '_');
      const fileRef = storageRef(storage, `editais/${id}/thumbnail_${Date.now()}_${safeName}`);
      await uploadBytes(fileRef, thumbFile, {
        contentType: thumbFile.type || 'image/jpeg',
      });
      const url = await getDownloadURL(fileRef);
      patch({ thumbnail: url });
      setThumbFile(null);
      toast.success('Foto do edital enviada');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao enviar foto');
    } finally {
      setUploadingThumb(false);
    }
  };

  const handleSalvar = async () => {
    if (!id || !form) return;
    setSalvando(true);
    try {
      let data_encerramento: Timestamp | undefined;
      let dataEncerramento: Timestamp | undefined;
      if (form.dataEncerramentoInput) {
        const d = new Date(`${form.dataEncerramentoInput}T12:00:00`);
        if (!Number.isNaN(d.getTime())) {
          data_encerramento = Timestamp.fromDate(d);
          dataEncerramento = data_encerramento;
        }
      }

      const categorias = splitList(form.categoriasText);
      const textos_exigidos = splitList(form.textosExigidosText);
      const escopo = form.escopo.trim() || form.descricao.trim();

      await updateDoc(doc(db, 'editais', id), {
        nome: form.nome.trim(),
        proponente: form.proponente.trim(),
        descricao: form.descricao.trim(),
        escopo,
        criterios: form.criterios.trim(),
        categorias,
        textos_exigidos,
        valor_maximo_premiacao: form.valor_maximo_premiacao.trim(),
        link_edital: form.link_edital.trim(),
        thumbnail: form.thumbnail.trim(),
        ...(data_encerramento ? { data_encerramento, dataEncerramento } : {}),
      });

      toast.success('Edital atualizado');
      navigate(`/edital/${id}`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar edital');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-oraculo-blue" />
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 p-8 text-center">
          <p className="text-gray-600 mb-4">Edital não encontrado.</p>
          <Button onClick={() => navigate('/editais-abertos')}>Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-3xl mx-auto">
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="mb-4 text-oraculo-blue hover:bg-oraculo-blue/10"
            >
              ← Voltar
            </Button>

            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Editar edital</h1>
            <p className="text-gray-600 text-sm mb-6">Atualize os dados exibidos na listagem e na página do edital.</p>

            <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Foto / capa do edital</label>
                {form.thumbnail ? (
                  <div className="relative rounded-lg overflow-hidden border aspect-video max-w-md bg-gray-100">
                    <img src={form.thumbnail} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center rounded-lg border border-dashed aspect-video max-w-md bg-gray-50 text-gray-400">
                    <ImagePlus className="h-10 w-10" />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 max-w-md">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)}
                    className="flex-1 min-w-[200px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!thumbFile || uploadingThumb}
                    onClick={() => void handleUploadThumbnail()}
                  >
                    {uploadingThumb ? 'Enviando…' : 'Enviar foto'}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">Aparece nos cards de Editais Abertos (JPEG, PNG ou WebP).</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nome do edital">
                  <Input value={form.nome} onChange={(e) => patch({ nome: e.target.value })} />
                </Field>
                <Field label="Proponente / órgão">
                  <Input value={form.proponente} onChange={(e) => patch({ proponente: e.target.value })} />
                </Field>
                <Field label="Data de encerramento">
                  <Input
                    type="date"
                    value={form.dataEncerramentoInput}
                    onChange={(e) => patch({ dataEncerramentoInput: e.target.value })}
                  />
                </Field>
                <Field label="Valor máximo de premiação">
                  <Input
                    value={form.valor_maximo_premiacao}
                    onChange={(e) => patch({ valor_maximo_premiacao: e.target.value })}
                    placeholder="Ex.: R$ 100.000,00"
                  />
                </Field>
              </div>

              <Field label="Descrição (listagem)">
                <TextArea
                  value={form.descricao}
                  onChange={(v) => patch({ descricao: v })}
                  placeholder="Resumo curto para cards e busca"
                />
              </Field>

              <Field label="Escopo do edital">
                <TextArea
                  value={form.escopo}
                  onChange={(v) => patch({ escopo: v })}
                  placeholder="Texto completo do escopo (página de detalhes)"
                  rows={5}
                />
              </Field>

              <Field label="Critérios de avaliação">
                <TextArea value={form.criterios} onChange={(v) => patch({ criterios: v })} rows={4} />
              </Field>

              <Field label="Categorias (separadas por vírgula)">
                <Input
                  value={form.categoriasText}
                  onChange={(e) => patch({ categoriasText: e.target.value })}
                  placeholder="Artes visuais, Música, Teatro"
                />
              </Field>

              <Field label="Textos exigidos (um por linha)">
                <TextArea
                  value={form.textosExigidosText}
                  onChange={(v) => patch({ textosExigidosText: v })}
                  rows={4}
                />
              </Field>

              <Field label="Link do edital (PDF ou página oficial)">
                <Input
                  type="url"
                  value={form.link_edital}
                  onChange={(e) => patch({ link_edital: e.target.value })}
                />
              </Field>

              {form.pdf_url ? (
                <p className="text-sm text-gray-500">
                  PDF importado:{' '}
                  <a href={form.pdf_url} target="_blank" rel="noopener noreferrer" className="text-oraculo-blue hover:underline">
                    abrir arquivo
                  </a>
                </p>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate(`/edital/${id}`)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSalvar()}
                  disabled={salvando}
                  className="bg-oraculo-blue text-white hover:bg-oraculo-blue/90"
                >
                  {salvando ? 'Salvando…' : 'Salvar alterações'}
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-oraculo-blue/50 focus:border-oraculo-blue outline-none"
    />
  );
}

export default EditarEdital;
