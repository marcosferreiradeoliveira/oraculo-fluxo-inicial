import React, { useCallback, useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import {
  createPortfolioItem,
  deletePortfolioItem,
  listPortfoliosDaEmpresa,
  normalizarUrlMedia,
  updatePortfolioItem,
  urlHttpValida,
  type PortfolioItemDoc,
} from '@/lib/portfolioEmpresa';
import { getStorage, ref as storageRef, deleteObject } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Trash2, Edit, FileText, Calendar as CalendarIcon, Brain, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { geminiChatCompletion } from '@/lib/gemini';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type PortfolioItem = PortfolioItemDoc;

type Props = {
  empresaId: string;
  empresaNome?: string;
};

export function PortfolioGaleriaEmpresa({ empresaId, empresaNome }: Props) {
  const [user] = useAuthState(auth);
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<PortfolioItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [modoPreenchimento, setModoPreenchimento] = useState<'ia' | 'manual'>('manual');

  const [ano, setAno] = useState('');
  const [descricao, setDescricao] = useState('');
  const [fotoUrlInput, setFotoUrlInput] = useState('');
  const [clippingUrlInput, setClippingUrlInput] = useState('');
  const [iaFonteClipping, setIaFonteClipping] = useState<'url' | 'pdf'>('url');
  const [pdfLeituraIa, setPdfLeituraIa] = useState<File | null>(null);

  const fetchPortfolios = useCallback(async () => {
    if (!user || !empresaId) return;

    try {
      setLoading(true);
      const list = await listPortfoliosDaEmpresa(empresaId, user.uid);
      setPortfolios(list);
    } catch (error) {
      console.error('Erro ao buscar portfólios:', error);
      toast.error('Erro ao carregar portfólios');
    } finally {
      setLoading(false);
    }
  }, [user, empresaId]);

  useEffect(() => {
    void fetchPortfolios();
  }, [fetchPortfolios]);

  const resetForm = () => {
    setAno('');
    setDescricao('');
    setFotoUrlInput('');
    setClippingUrlInput('');
    setEditingPortfolio(null);
    setModoPreenchimento('manual');
    setExtracting(false);
    setIaFonteClipping('url');
    setPdfLeituraIa(null);
  };

  const extrairTextoDoPdfBuffer = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let textoExtraido = '';
    for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      textoExtraido +=
        content.items
          .filter((item: { str?: string }) => typeof item.str === 'string')
          .map((item: { str?: string }) => item.str)
          .join(' ') + '\n';
    }
    return textoExtraido.length > 5000 ? textoExtraido.slice(0, 5000) : textoExtraido;
  };

  const extrairComIADoTexto = async (textoExtraido: string) => {
    const prompt = `Extraia do texto abaixo as seguintes informações sobre o portfólio/projeto:

1. Ano: O ano do projeto/portfólio (ex: 2024, 2023)
2. Descrição: Uma descrição resumida e profissional dos projetos e realizações mencionados

Retorne APENAS um JSON válido com as chaves "ano" (string) e "descricao" (string).
Se não encontrar o ano, use o ano atual (2026).
A descrição deve ser em português, clara e objetiva, descrevendo os principais projetos e realizações.

Texto do clipping:
${textoExtraido}

Formato esperado:
{
  "ano": "2024",
  "descricao": "Descrição dos projetos e realizações..."
}`;

    const resposta = await geminiChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em análise de portfólios culturais. Retorne apenas JSON válido.',
        },
        { role: 'user', content: prompt },
      ],
      maxTokens: 500,
      temperature: 0.3,
    });
    const dadosExtraidos = JSON.parse(
      resposta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    );

    if (dadosExtraidos.ano) setAno(String(dadosExtraidos.ano));
    if (dadosExtraidos.descricao) setDescricao(dadosExtraidos.descricao);
    toast.success('Dados extraídos com sucesso! Revise e ajuste se necessário.');
  };

  const extrairComIAFromPdfFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Selecione um arquivo PDF.');
      return;
    }
    setExtracting(true);
    try {
      const textoExtraido = await extrairTextoDoPdfBuffer(await file.arrayBuffer());
      await extrairComIADoTexto(textoExtraido);
    } catch (error: unknown) {
      console.error('Erro ao extrair PDF local:', error);
      toast.error('Não foi possível ler este PDF. Tente outro arquivo ou use URL.');
    } finally {
      setExtracting(false);
    }
  };

  const extrairComIAFromUrl = async () => {
    const url = normalizarUrlMedia(clippingUrlInput);
    if (!urlHttpValida(url)) {
      toast.error('Informe a URL do PDF do clipping (http ou https).');
      return;
    }
    setExtracting(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const textoExtraido = await extrairTextoDoPdfBuffer(await res.arrayBuffer());
      await extrairComIADoTexto(textoExtraido);
    } catch (error: unknown) {
      console.error('Erro ao baixar/extrair PDF da URL:', error);
      toast.error(
        'Não foi possível extrair desta URL (CORS ou link inválido). Preencha ano e descrição manualmente.'
      );
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Você precisa estar logado para cadastrar portfólios');
      return;
    }
    if (!empresaId) {
      toast.error('Empresa não selecionada.');
      return;
    }
    if (!ano || !descricao) {
      toast.error('Preencha ano e descrição');
      return;
    }

    const fotoUrl = normalizarUrlMedia(fotoUrlInput);
    const clippingUrl = normalizarUrlMedia(clippingUrlInput);

    if (!urlHttpValida(fotoUrl)) {
      toast.error('Informe a URL da imagem (http ou https).');
      return;
    }
    if (clippingUrl && !urlHttpValida(clippingUrl)) {
      toast.error('URL do clipping inválida.');
      return;
    }
    setSaving(true);

    try {
      const payload = {
        ano,
        descricao,
        fotoUrl,
        clippingUrl: clippingUrl || undefined,
      };

      if (editingPortfolio) {
        await updatePortfolioItem(
          editingPortfolio.id,
          user.uid,
          empresaId,
          payload,
          editingPortfolio.criadoEm
        );
        toast.success('Portfólio atualizado com sucesso!');
      } else {
        await createPortfolioItem(user.uid, empresaId, payload);
        toast.success('Portfólio cadastrado com sucesso!');
      }

      resetForm();
      setShowDialog(false);
      fetchPortfolios();
    } catch (error: unknown) {
      console.error('Erro ao salvar portfólio:', error);
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao salvar portfólio: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (portfolio: PortfolioItem) => {
    setEditingPortfolio(portfolio);
    setAno(portfolio.ano);
    setDescricao(portfolio.descricao);
    setFotoUrlInput(portfolio.fotoUrl || '');
    setClippingUrlInput(portfolio.clippingUrl || '');
    setModoPreenchimento('manual');
    setShowDialog(true);
  };

  const handleDelete = async (portfolio: PortfolioItem) => {
    if (!window.confirm('Tem certeza que deseja excluir este portfólio?')) return;

    try {
      const storage = getStorage();
      if (portfolio.fotoPath) {
        try {
          await deleteObject(storageRef(storage, portfolio.fotoPath));
        } catch (error) {
          console.error('Erro ao deletar foto legada:', error);
        }
      }
      if (portfolio.clippingPath) {
        try {
          await deleteObject(storageRef(storage, portfolio.clippingPath));
        } catch (error) {
          console.error('Erro ao deletar clipping legado:', error);
        }
      }

      await deletePortfolioItem(portfolio.id);
      toast.success('Portfólio excluído com sucesso!');
      fetchPortfolios();
    } catch (error: unknown) {
      console.error('Erro ao excluir portfólio:', error);
      toast.error('Erro ao excluir portfólio');
    }
  };

  if (!user) {
    return (
      <p className="text-sm text-gray-600 py-4">Faça login para gerenciar o portfólio desta empresa.</p>
    );
  }

  const fotoPreview = urlHttpValida(fotoUrlInput) ? normalizarUrlMedia(fotoUrlInput) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-semibold text-gray-900">
              Portfólio{empresaNome ? ` — ${empresaNome}` : ''}
            </h2>
            <Badge className="bg-orange-500 text-white text-xs px-2 py-1">BETA</Badge>
          </div>
          <p className="text-gray-600 text-sm">
            Itens por ano com links de imagem e clipping (PDF) — sem upload neste fluxo.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
          className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo item
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oraculo-blue" />
          <span className="ml-2">Carregando portfólios...</span>
        </div>
      ) : portfolios.length === 0 ? (
        <Card className="p-12 text-center">
          <CardContent>
            <p className="text-gray-600 mb-4">Nenhum item na galeria desta empresa.</p>
            <Button
              onClick={() => {
                resetForm();
                setShowDialog(true);
              }}
              className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar primeiro item
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolios.map((portfolio) => (
            <Card key={portfolio.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {portfolio.fotoUrl && (
                <div className="aspect-video relative overflow-hidden bg-gray-200">
                  <img
                    src={portfolio.fotoUrl}
                    alt={`Portfólio ${portfolio.ano}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-oraculo-blue" />
                    <CardTitle className="text-xl">{portfolio.ano}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(portfolio)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(portfolio)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">{portfolio.descricao}</p>
                {portfolio.clippingUrl && (
                  <a
                    href={portfolio.clippingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-oraculo-blue hover:underline text-sm"
                  >
                    <FileText className="h-4 w-4" />
                    Ver clipping
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPortfolio ? 'Editar portfólio' : 'Novo portfólio'}</DialogTitle>
            <DialogDescription>
              Foto e clipping salvos por URL. No modo IA, você pode enviar um PDF só para leitura — o
              arquivo não é armazenado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingPortfolio && (
              <div className="p-4 bg-gradient-to-r from-oraculo-blue/10 to-oraculo-purple/10 rounded-lg border border-oraculo-blue/20">
                <Label className="text-base font-semibold mb-3 block">Modo de preenchimento</Label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="modo"
                      value="ia"
                      checked={modoPreenchimento === 'ia'}
                      onChange={() => setModoPreenchimento('ia')}
                    />
                    <Brain className="h-5 w-5 text-oraculo-purple" />
                    <span className="font-medium">Extrair com IA</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="modo"
                      value="manual"
                      checked={modoPreenchimento === 'manual'}
                      onChange={() => setModoPreenchimento('manual')}
                    />
                    <span className="font-medium">Manual</span>
                  </label>
                </div>
              </div>
            )}

            {modoPreenchimento === 'ia' && !editingPortfolio && (
              <div className="space-y-3 rounded-lg border border-gray-200 p-4 bg-gray-50/80">
                <Label className="font-medium">Fonte do clipping para a IA</Label>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="ia-fonte"
                      checked={iaFonteClipping === 'url'}
                      onChange={() => setIaFonteClipping('url')}
                    />
                    URL do PDF
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="ia-fonte"
                      checked={iaFonteClipping === 'pdf'}
                      onChange={() => setIaFonteClipping('pdf')}
                    />
                    Enviar PDF (só leitura)
                  </label>
                </div>
                {iaFonteClipping === 'url' ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      id="clipping-url-ia"
                      type="url"
                      placeholder="https://…/clipping.pdf"
                      value={clippingUrlInput}
                      onChange={(e) => setClippingUrlInput(e.target.value)}
                      disabled={extracting}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={extracting}
                      onClick={() => void extrairComIAFromUrl()}
                    >
                      Extrair com IA
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="application/pdf"
                      className="cursor-pointer bg-white"
                      disabled={extracting}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setPdfLeituraIa(file);
                        void extrairComIAFromPdfFile(file);
                      }}
                    />
                    {pdfLeituraIa && (
                      <p className="text-xs text-gray-600">
                        Arquivo: {pdfLeituraIa.name} — usado só na extração, não será salvo.
                      </p>
                    )}
                  </div>
                )}
                {extracting && (
                  <div className="flex items-center gap-2 text-oraculo-blue text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Extraindo dados…
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  Depois da extração, informe a URL da foto e, se quiser guardar o link do clipping,
                  preencha a URL abaixo (opcional).
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="ano">Ano *</Label>
              <Input
                id="ano"
                type="number"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                placeholder="Ex: 2024"
                min="1900"
                max="2100"
                required
              />
            </div>

            <div>
              <Label htmlFor="descricao">Descrição *</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Projetos e realizações deste ano…"
                rows={5}
                required
              />
            </div>

            <div>
              <Label htmlFor="foto-url">URL da imagem *</Label>
              <Input
                id="foto-url"
                type="url"
                placeholder="https://…/foto.jpg"
                value={fotoUrlInput}
                onChange={(e) => setFotoUrlInput(e.target.value)}
                disabled={saving || extracting}
              />
              {fotoPreview && (
                <div className="mt-2">
                  <img
                    src={fotoPreview}
                    alt="Preview"
                    className="max-w-full h-48 object-cover rounded-lg border"
                  />
                </div>
              )}
            </div>

            {(modoPreenchimento === 'manual' ||
              editingPortfolio ||
              (modoPreenchimento === 'ia' && iaFonteClipping === 'pdf')) && (
              <div>
                <Label htmlFor="clipping-url">
                  URL do clipping (PDF ou imagem)
                  {modoPreenchimento === 'ia' && !editingPortfolio ? ' — opcional' : ''}
                </Label>
                <Input
                  id="clipping-url"
                  type="url"
                  placeholder="https://…/clipping.pdf"
                  value={clippingUrlInput}
                  onChange={(e) => setClippingUrlInput(e.target.value)}
                  disabled={saving || extracting}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
                disabled={saving || extracting}
              >
                {saving ? 'Salvando…' : extracting ? 'Extraindo…' : editingPortfolio ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
