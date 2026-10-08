import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { getEditaisWriteDb } from '@/lib/editaisDb';
import { auth, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Plus, Trash2 } from 'lucide-react';

type DocumentoExigido = { nome: string; fase: 'inscrição' | 'contratação' };

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function storageObjectName(original: string, prefix: string): string {
  const rawExt = original.includes('.') ? original.split('.').pop()! : 'jpg';
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'jpg';
  return `${prefix}_${Date.now()}.${ext}`;
}

/** Importador/extrator grava `escopo`; catálogo antigo usa `descricao`. */
function descricaoDoEdital(data: Record<string, unknown>): string {
  const descricao = data.descricao;
  if (typeof descricao === 'string' && descricao.trim()) return descricao.trim();
  const escopo = data.escopo;
  if (typeof escopo === 'string' && escopo.trim()) return escopo.trim();
  return '';
}

function formatStorageError(err: unknown): string {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : '';
  const message =
    typeof err === 'object' && err && 'message' in err ? String((err as { message: string }).message) : String(err);
  if (code === 'storage/unauthorized') {
    return 'Sem permissão no Storage (storage/unauthorized). Confira se está logado no projeto oraculo-is.';
  }
  if (code === 'storage/unauthenticated') {
    return 'Sessão expirada. Saia e entre de novo.';
  }
  if (code === 'storage/quota-exceeded' || message.includes('size')) {
    return 'Arquivo maior que 15 MB. Reduza a imagem e tente outra vez.';
  }
  return code ? `${code}: ${message}` : message;
}

function dateInputValue(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString().split('T')[0];
  }
  if (typeof value === 'string' && value.trim()) {
    const iso = value.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return '';
}

function toEncerramentoTimestamp(value: unknown): Timestamp | unknown {
  if (value && typeof value === 'object' && 'toDate' in value) return value;
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(`${value.trim()}T12:00:00`);
    if (!Number.isNaN(d.getTime())) return Timestamp.fromDate(d);
  }
  return value;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? ''));
}

function cleanStringArray(value: unknown): string[] {
  return asStringArray(value)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeFase(value: unknown): DocumentoExigido['fase'] {
  const f = String(value ?? 'inscrição')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (f === 'contratacao' || f.startsWith('contrat')) return 'contratação';
  return 'inscrição';
}

function asDocumentacaoArray(value: unknown): DocumentoExigido[] {
  if (!Array.isArray(value)) return [];
  return value.map((d) => {
    if (!d || typeof d !== 'object') return { nome: '', fase: 'inscrição' as const };
    return {
      nome: String((d as { nome?: string }).nome ?? ''),
      fase: normalizeFase((d as { fase?: string }).fase),
    };
  });
}

function cleanDocumentacao(value: unknown): DocumentoExigido[] {
  return asDocumentacaoArray(value)
    .map((d) => ({ nome: d.nome.trim(), fase: d.fase }))
    .filter((d) => d.nome.length > 0);
}

const textareaClass =
  'w-full border rounded-md p-2 min-h-[100px] focus:ring-2 focus:ring-oraculo-blue/50 focus:border-oraculo-blue outline-none text-sm';

const EditarEdital = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [edital, setEdital] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [orcamentoFile, setOrcamentoFile] = useState<File | null>(null);
  const [cronogramaFile, setCronogramaFile] = useState<File | null>(null);
  const [cartaFile, setCartaFile] = useState<File | null>(null);
  const [imagemFile, setImagemFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchEdital = async () => {
      if (!id) return;
      setLoading(true);
      const ref = doc(getEditaisWriteDb(), 'editais', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const raw = snap.data() as Record<string, unknown>;
        setEdital({
          id: snap.id,
          ...raw,
          descricao: descricaoDoEdital(raw),
          categorias: asStringArray(raw.categorias),
          textos_exigidos: asStringArray(raw.textos_exigidos),
          documentacao_exigida: asDocumentacaoArray(raw.documentacao_exigida),
        });
      }
      setLoading(false);
    };
    fetchEdital();
  }, [id]);

  const handleChange = (field: string, value: any) => {
    setEdital((prev: any) => ({ ...prev, [field]: value }));
  };

  const uploadFileToStorage = async (field: string, file: File): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Faça login novamente para enviar arquivos.');
    if (!id) throw new Error('ID do edital inválido.');
    if (field === 'thumbnail' && !file.type.startsWith('image/')) {
      throw new Error('Selecione um arquivo de imagem (JPG, PNG, WebP…).');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error('Arquivo maior que 15 MB (limite do Storage).');
    }

    await user.getIdToken(true);

    const objectName = storageObjectName(file.name, field === 'thumbnail' ? 'thumbnail' : field);
    const objectPath = `editais/${user.uid}/${id}/${objectName}`;
    const fileRef = storageRef(storage, objectPath);
    await uploadBytes(fileRef, file, {
      contentType: file.type || (field === 'thumbnail' ? 'image/jpeg' : 'application/octet-stream'),
    });
    return getDownloadURL(fileRef);
  };

  const handleUpload = async (field: string, file: File, extraFields?: Record<string, string>) => {
    const url = await uploadFileToStorage(field, file);
    setEdital((prev: any) => {
      const next = { ...prev, [field]: url, ...extraFields };
      if (field === 'thumbnail') {
        next.imagem = url;
        next.imagem_url = url;
      }
      return next;
    });
    return url;
  };

  const thumbnailAtual =
    edital?.thumbnail || edital?.imagem || edital?.imagem_url || '';

  const handleSalvar = async () => {
    if (!id) return;
    setSalvando(true);
    try {
      let payload = { ...edital };
      if (imagemFile) {
        const url = await uploadFileToStorage('thumbnail', imagemFile);
        payload = { ...payload, thumbnail: url, imagem: url, imagem_url: url };
        setImagemFile(null);
        setEdital(payload);
      }
      const ref = doc(getEditaisWriteDb(), 'editais', id);
      const { id: _id, ...dados } = payload;
      const descricaoTexto = typeof dados.descricao === 'string' ? dados.descricao.trim() : '';
      const encerramento = toEncerramentoTimestamp(dados.data_encerramento);
      await updateDoc(ref, {
        ...dados,
        descricao: descricaoTexto,
        escopo: descricaoTexto,
        categorias: cleanStringArray(dados.categorias),
        textos_exigidos: cleanStringArray(dados.textos_exigidos),
        documentacao_exigida: cleanDocumentacao(dados.documentacao_exigida),
        data_encerramento: encerramento,
        dataEncerramento: encerramento,
      });
      alert('Edital atualizado com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar edital:', err);
      alert(formatStorageError(err));
    } finally {
      setSalvando(false);
    }
  };

  if (loading || !edital) return <div className="p-8">Carregando...</div>;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            <Button 
              variant="ghost"
              onClick={() => navigate(-1)}
              className="mb-4 flex items-center gap-2 text-oraculo-blue hover:bg-oraculo-blue/10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="m12 19-7-7 7-7"/>
                <path d="M19 12H5"/>
              </svg>
              Voltar
            </Button>
            
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                {loading ? 'Carregando...' : `Editar Edital: ${edital?.nome || ''}`}
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Atualize as informações do edital conforme necessário
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-oraculo-blue"></div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md overflow-hidden p-6 space-y-8">
                <section className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Dados gerais</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Nome do Edital</label>
                      <Input
                        value={edital?.nome || ''}
                        onChange={(e) => handleChange('nome', e.target.value)}
                        placeholder="Nome do edital"
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Proponente / órgão</label>
                      <Input
                        value={edital?.proponente || ''}
                        onChange={(e) => handleChange('proponente', e.target.value)}
                        placeholder="Ex.: RioFilme"
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Data de encerramento</label>
                      <Input
                        type="date"
                        value={dateInputValue(edital?.data_encerramento ?? edital?.dataEncerramento)}
                        onChange={(e) => handleChange('data_encerramento', e.target.value)}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Valor máximo da premiação</label>
                      <Input
                        value={edital?.valor_maximo_premiacao || ''}
                        onChange={(e) => handleChange('valor_maximo_premiacao', e.target.value)}
                        placeholder="Ex.: R$ 500.000,00"
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Link do edital (PDF/site)</label>
                      <Input
                        type="url"
                        value={edital?.link_edital || edital?.pdf_url || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEdital((prev: any) => ({ ...prev, link_edital: v, pdf_url: v }));
                        }}
                        placeholder="https://..."
                        className="w-full"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <StringListEditor
                        label="Categorias"
                        items={edital?.categorias}
                        onChange={(items) => handleChange('categorias', items)}
                        placeholder="Ex.: Cinema"
                        addLabel="Adicionar categoria"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Conteúdo e avaliação</h2>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Descrição / escopo</label>
                    <textarea
                      value={edital?.descricao || ''}
                      onChange={(e) => handleChange('descricao', e.target.value)}
                      placeholder="Objetivo e escopo do edital"
                      className={`${textareaClass} min-h-[120px]`}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Critérios de avaliação</label>
                    <textarea
                      value={edital?.criterios || ''}
                      onChange={(e) => handleChange('criterios', e.target.value)}
                      placeholder="Critérios, pesos e formas de julgamento"
                      className={`${textareaClass} min-h-[160px]`}
                    />
                  </div>

                  <StringListEditor
                    label="Textos exigidos na inscrição"
                    items={edital?.textos_exigidos}
                    onChange={(items) => handleChange('textos_exigidos', items)}
                    placeholder="Ex.: Resumo do projeto"
                    addLabel="Adicionar texto"
                  />

                  <DocumentacaoListEditor
                    items={edital?.documentacao_exigida}
                    onChange={(items) => handleChange('documentacao_exigida', items)}
                  />
                </section>

                <section className="space-y-4 border border-gray-100 rounded-lg p-4 bg-gray-50/50">
                  <h2 className="text-lg font-semibold text-gray-900">Imagem de capa</h2>
                  <label className="block text-sm font-medium text-gray-700 sr-only">Imagem de capa</label>
                  <p className="text-xs text-gray-500">
                    Aparece nos cards de Editais abertos e na home. Máx. 15 MB. Você pode só escolher a foto e
                    clicar em Salvar alterações.
                  </p>
                  {thumbnailAtual && (
                    <div className="mb-2">
                      <img
                        src={thumbnailAtual}
                        alt="Capa atual do edital"
                        className="w-full max-w-xs h-40 object-cover rounded-lg border border-gray-200"
                      />
                      <p className="text-xs text-gray-500 mt-1">Imagem atual</p>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImagemFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-oraculo-blue/10 file:text-oraculo-blue hover:file:bg-oraculo-blue/20"
                    />
                    {imagemFile && (
                      <Button
                        type="button"
                        onClick={async () => {
                          try {
                            await handleUpload('thumbnail', imagemFile);
                            setImagemFile(null);
                            alert('Imagem enviada. Clique em Salvar alterações para gravar no edital.');
                          } catch (err) {
                            console.error('Erro ao enviar imagem:', err);
                            alert(formatStorageError(err));
                          }
                        }}
                        className="bg-oraculo-blue hover:bg-oraculo-blue/90 text-white text-sm shrink-0"
                      >
                        Enviar imagem
                      </Button>
                    )}
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Anexos (opcional)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FileUpload
                    label="Arquivo de Orçamento"
                    file={orcamentoFile}
                    setFile={setOrcamentoFile}
                    currentFileUrl={edital?.orcamentoUrl}
                    onUpload={() => orcamentoFile && handleUpload('orcamentoUrl', orcamentoFile)}
                  />

                  <FileUpload
                    label="Cronograma"
                    file={cronogramaFile}
                    setFile={setCronogramaFile}
                    currentFileUrl={edital?.cronogramaUrl}
                    onUpload={() => cronogramaFile && handleUpload('cronogramaUrl', cronogramaFile)}
                  />

                  <FileUpload
                    label="Carta de Anuência"
                    file={cartaFile}
                    setFile={setCartaFile}
                    currentFileUrl={edital?.cartaAprovacaoUrl}
                    onUpload={() => cartaFile && handleUpload('cartaAprovacaoUrl', cartaFile)}
                  />
                </div>
                </section>

                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleSalvar}
                    disabled={salvando}
                    className="bg-oraculo-blue text-white hover:bg-oraculo-blue/90"
                  >
                    {salvando ? 'Salvando...' : 'Salvar alterações'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

function StringListEditor({
  label,
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  label: string;
  items: string[] | undefined;
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel: string;
}) {
  const list = Array.isArray(items) ? items : [];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {list.length === 0 ? (
        <p className="text-xs text-gray-500">Nenhum item. Use o botão abaixo para adicionar.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((item, index) => (
            <li key={index} className="flex gap-2 items-center">
              <Input
                value={item}
                onChange={(e) => {
                  const next = [...list];
                  next[index] = e.target.value;
                  onChange(next);
                }}
                placeholder={placeholder}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => onChange(list.filter((_, i) => i !== index))}
                aria-label="Remover item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => onChange([...list, ''])}>
        <Plus className="h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}

function DocumentacaoListEditor({
  items,
  onChange,
}: {
  items: DocumentoExigido[] | undefined;
  onChange: (items: DocumentoExigido[]) => void;
}) {
  const list = Array.isArray(items) ? items : [];

  const updateRow = (index: number, patch: Partial<DocumentoExigido>) => {
    const next = list.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Documentação exigida</label>
      <p className="text-xs text-gray-500">Cada linha é um documento e a fase em que ele é exigido.</p>
      {list.length === 0 ? (
        <p className="text-xs text-gray-500">Nenhum documento listado.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((doc, index) => (
            <li key={index} className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Input
                value={doc.nome}
                onChange={(e) => updateRow(index, { nome: e.target.value })}
                placeholder="Nome do documento"
                className="flex-1"
              />
              <div className="flex gap-2 items-center sm:w-48">
                <select
                  value={doc.fase}
                  onChange={(e) => updateRow(index, { fase: normalizeFase(e.target.value) })}
                  className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oraculo-blue/50"
                >
                  <option value="inscrição">Inscrição</option>
                  <option value="contratação">Contratação</option>
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onChange(list.filter((_, i) => i !== index))}
                  aria-label="Remover documento"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => onChange([...list, { nome: '', fase: 'inscrição' }])}
      >
        <Plus className="h-4 w-4" />
        Adicionar documento
      </Button>
    </div>
  );
}

// Componente auxiliar para upload de arquivos
const FileUpload = ({ label, file, setFile, currentFileUrl, onUpload }: any) => (
  <div className="space-y-2">
    <label className="block text-sm font-medium text-gray-700">{label}</label>
    <div className="flex items-center gap-2">
      <Input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-oraculo-blue/10 file:text-oraculo-blue hover:file:bg-oraculo-blue/20"
      />
      {file && (
        <Button
          type="button"
          onClick={onUpload}
          className="bg-oraculo-blue hover:bg-oraculo-blue/90 text-white text-sm"
        >
          Upload
        </Button>
      )}
    </div>
    {currentFileUrl && (
      <a
        href={currentFileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-oraculo-blue hover:underline inline-block mt-1"
      >
        Ver arquivo atual
      </a>
    )}
  </div>
);

export default EditarEdital;