import React, { useState, useEffect } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc, Timestamp } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Trash2, Edit, Image as ImageIcon, FileText, Calendar as CalendarIcon, Brain, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PortfolioItem {
  id: string;
  ano: string;
  descricao: string;
  fotoUrl?: string;
  fotoPath?: string;
  clippingUrl?: string;
  clippingPath?: string;
  criadoEm?: any;
}

const Portfolio = () => {
  const [user] = useAuthState(auth);
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<PortfolioItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [modoPreenchimento, setModoPreenchimento] = useState<'ia' | 'manual'>('manual');
  
  // Form states
  const [ano, setAno] = useState('');
  const [descricao, setDescricao] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [clipping, setClipping] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [clippingPreview, setClippingPreview] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchPortfolios();
    }
  }, [user]);

  const fetchPortfolios = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const portfoliosRef = collection(db, 'portfolios');
      const q = query(portfoliosRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      const portfoliosData: PortfolioItem[] = [];
      snapshot.forEach((doc) => {
        portfoliosData.push({
          id: doc.id,
          ...doc.data()
        } as PortfolioItem);
      });
      
      // Ordenar por ano (decrescente)
      portfoliosData.sort((a, b) => parseInt(b.ano) - parseInt(a.ano));
      
      setPortfolios(portfoliosData);
    } catch (error) {
      console.error('Erro ao buscar portfólios:', error);
      toast.error('Erro ao carregar portfólios');
    } finally {
      setLoading(false);
    }
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClippingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setClipping(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setClippingPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setClippingPreview(null);
      }
    }
  };

  const resetForm = () => {
    setAno('');
    setDescricao('');
    setFoto(null);
    setClipping(null);
    setFotoPreview(null);
    setClippingPreview(null);
    setEditingPortfolio(null);
    setModoPreenchimento('manual');
    setExtracting(false);
  };

  const extrairComIA = async (clippingFile: File) => {
    setExtracting(true);
    try {
      let textoExtraido = '';

      if (clippingFile.type === 'application/pdf') {
        // Extrair texto de PDF
        const arrayBuffer = await clippingFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) { // Limitar a 5 páginas
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          textoExtraido += content.items
            .filter((item: any) => typeof item.str === 'string')
            .map((item: any) => item.str)
            .join(' ') + '\n';
        }
      } else if (clippingFile.type.startsWith('image/')) {
        // Para imagens, usar OCR via OpenAI Vision (não implementado ainda)
        // Por enquanto, pedir para o usuário preencher manualmente
        toast.info('Para imagens, preencha os campos manualmente ou converta para PDF');
        setExtracting(false);
        return;
      }

      if (textoExtraido.length > 5000) {
        textoExtraido = textoExtraido.slice(0, 5000);
      }

      // Usar IA para extrair ano e descrição
      const openai = new OpenAI({ 
        apiKey: import.meta.env.VITE_OPENAI_API_KEY, 
        dangerouslyAllowBrowser: true 
      });

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

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Você é um especialista em análise de portfólios culturais.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      const resposta = completion.choices[0].message?.content || '{}';
      const dadosExtraidos = JSON.parse(resposta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

      if (dadosExtraidos.ano) {
        setAno(dadosExtraidos.ano);
      }
      if (dadosExtraidos.descricao) {
        setDescricao(dadosExtraidos.descricao);
      }

      toast.success('Dados extraídos com sucesso! Revise e ajuste se necessário.');
    } catch (error: any) {
      console.error('Erro ao extrair dados com IA:', error);
      toast.error('Erro ao extrair dados. Você pode preencher manualmente.');
    } finally {
      setExtracting(false);
    }
  };

  const handleClippingChangeIA = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setClipping(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setClippingPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setClippingPreview(null);
      }
      
      // Extrair automaticamente
      await extrairComIA(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Você precisa estar logado para cadastrar portfólios');
      return;
    }

    if (!ano || !descricao) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Se estiver no modo IA, clipping é obrigatório
    if (modoPreenchimento === 'ia' && !clipping) {
      toast.error('Selecione um clipping para extrair os dados');
      return;
    }

    if (!editingPortfolio && !foto) {
      toast.error('Selecione uma foto');
      return;
    }

    setUploading(true);
    
    try {
      const storage = getStorage();
      let fotoUrl = editingPortfolio?.fotoUrl || '';
      let fotoPath = editingPortfolio?.fotoPath || null;
      let clippingUrl = editingPortfolio?.clippingUrl || '';
      let clippingPath = editingPortfolio?.clippingPath || null;

      // Upload foto
      if (foto) {
        const timestamp = Date.now();
        fotoPath = `portfolios/${user.uid}/${timestamp}_${foto.name}`;
        const fotoRef = storageRef(storage, fotoPath);
        await uploadBytes(fotoRef, foto);
        fotoUrl = await getDownloadURL(fotoRef);
        
        // Deletar foto antiga se estiver editando
        if (editingPortfolio?.fotoPath) {
          try {
            const oldFotoRef = storageRef(storage, editingPortfolio.fotoPath);
            await deleteObject(oldFotoRef);
          } catch (error) {
            console.error('Erro ao deletar foto antiga:', error);
          }
        }
      }

      // Upload clipping
      if (clipping) {
        const timestamp = Date.now();
        clippingPath = `portfolios/${user.uid}/${timestamp}_${clipping.name}`;
        const clippingRef = storageRef(storage, clippingPath);
        await uploadBytes(clippingRef, clipping);
        clippingUrl = await getDownloadURL(clippingRef);
        
        // Deletar clipping antigo se estiver editando
        if (editingPortfolio?.clippingPath) {
          try {
            const oldClippingRef = storageRef(storage, editingPortfolio.clippingPath);
            await deleteObject(oldClippingRef);
          } catch (error) {
            console.error('Erro ao deletar clipping antigo:', error);
          }
        }
      }

      const portfolioData = {
        userId: user.uid,
        ano,
        descricao,
        fotoUrl,
        fotoPath,
        clippingUrl: clippingUrl || null,
        clippingPath,
        criadoEm: editingPortfolio?.criadoEm || Timestamp.now(),
        atualizadoEm: Timestamp.now(),
      };

      if (editingPortfolio) {
        // Atualizar
        const portfolioRef = doc(db, 'portfolios', editingPortfolio.id);
        await updateDoc(portfolioRef, portfolioData);
        toast.success('Portfólio atualizado com sucesso!');
      } else {
        // Criar novo
        await addDoc(collection(db, 'portfolios'), portfolioData);
        toast.success('Portfólio cadastrado com sucesso!');
      }

      resetForm();
      setShowDialog(false);
      fetchPortfolios();
    } catch (error: any) {
      console.error('Erro ao salvar portfólio:', error);
      toast.error('Erro ao salvar portfólio: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (portfolio: PortfolioItem) => {
    setEditingPortfolio(portfolio);
    setAno(portfolio.ano);
    setDescricao(portfolio.descricao);
    setFotoPreview(portfolio.fotoUrl || null);
    setClippingPreview(portfolio.clippingUrl || null);
    setShowDialog(true);
  };

  const handleDelete = async (portfolio: PortfolioItem) => {
    if (!window.confirm('Tem certeza que deseja excluir este portfólio?')) {
      return;
    }

    try {
      // Deletar arquivos do storage
      const storage = getStorage();
      if (portfolio.fotoPath) {
        try {
          const fotoRef = storageRef(storage, portfolio.fotoPath);
          await deleteObject(fotoRef);
        } catch (error) {
          console.error('Erro ao deletar foto:', error);
        }
      }
      if (portfolio.clippingPath) {
        try {
          const clippingRef = storageRef(storage, portfolio.clippingPath);
          await deleteObject(clippingRef);
        } catch (error) {
          console.error('Erro ao deletar clipping:', error);
        }
      }

      // Deletar documento
      await deleteDoc(doc(db, 'portfolios', portfolio.id));
      toast.success('Portfólio excluído com sucesso!');
      fetchPortfolios();
    } catch (error: any) {
      console.error('Erro ao excluir portfólio:', error);
      toast.error('Erro ao excluir portfólio: ' + (error.message || 'Erro desconhecido'));
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
            <Card className="max-w-md w-full">
              <CardHeader>
                <CardTitle>Login necessário</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Você precisa estar logado para acessar seus portfólios.</p>
              </CardContent>
            </Card>
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
        
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                      Meu Portfólio
                    </h1>
                    <Badge className="bg-orange-500 text-white text-xs px-2 py-1">BETA</Badge>
                  </div>
                  <p className="text-gray-600 text-sm md:text-base">
                    Gerencie seus portfólios por ano
                  </p>
                </div>
                <Button 
                  onClick={() => {
                    resetForm();
                    setShowDialog(true);
                  }}
                  className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Portfólio
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oraculo-blue"></div>
                <span className="ml-2">Carregando portfólios...</span>
              </div>
            ) : portfolios.length === 0 ? (
              <Card className="p-12 text-center">
                <CardContent>
                  <p className="text-gray-600 mb-4">Você ainda não tem nenhum portfólio cadastrado.</p>
                  <Button 
                    onClick={() => {
                      resetForm();
                      setShowDialog(true);
                    }}
                    className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Portfólio
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
                          Ver Clipping
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Dialog de cadastro/edição */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPortfolio ? 'Editar Portfólio' : 'Novo Portfólio'}
            </DialogTitle>
            <DialogDescription>
              {editingPortfolio 
                ? 'Edite as informações do portfólio'
                : 'Escolha entre extrair automaticamente com IA ou preencher manualmente'
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingPortfolio && (
              <div className="mb-6 p-4 bg-gradient-to-r from-oraculo-blue/10 to-oraculo-purple/10 rounded-lg border-2 border-oraculo-blue/20">
                <Label className="text-base font-semibold mb-3 block">Modo de Preenchimento</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="modo"
                      value="ia"
                      checked={modoPreenchimento === 'ia'}
                      onChange={(e) => setModoPreenchimento(e.target.value as 'ia' | 'manual')}
                      className="w-4 h-4 text-oraculo-blue"
                    />
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-oraculo-purple" />
                      <span className="font-medium">Extrair com IA</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="modo"
                      value="manual"
                      checked={modoPreenchimento === 'manual'}
                      onChange={(e) => setModoPreenchimento(e.target.value as 'ia' | 'manual')}
                      className="w-4 h-4 text-oraculo-blue"
                    />
                    <span className="font-medium">Preencher Manualmente</span>
                  </label>
                </div>
                {modoPreenchimento === 'ia' && (
                  <p className="text-sm text-gray-600 mt-2">
                    Faça upload do clipping (PDF) e a IA extrairá automaticamente o ano e a descrição
                  </p>
                )}
              </div>
            )}

            {modoPreenchimento === 'ia' && !editingPortfolio && (
              <div>
                <Label htmlFor="clipping-ia">Clipping (PDF) *</Label>
                <Input
                  id="clipping-ia"
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleClippingChangeIA}
                  className="cursor-pointer"
                  disabled={extracting}
                />
                {extracting && (
                  <div className="mt-2 flex items-center gap-2 text-oraculo-blue">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Extraindo dados com IA...</span>
                  </div>
                )}
                {clippingPreview && !extracting && (
                  <div className="mt-2">
                    {clipping?.type === 'application/pdf' ? (
                      <div className="p-4 border rounded-lg bg-gray-50">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto" />
                        <p className="text-sm text-gray-600 text-center mt-2">PDF selecionado</p>
                      </div>
                    ) : (
                      <img 
                        src={clippingPreview} 
                        alt="Preview Clipping" 
                        className="max-w-full h-48 object-cover rounded-lg border"
                      />
                    )}
                  </div>
                )}
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
                placeholder="Descreva os projetos e realizações deste ano..."
                rows={5}
                required
              />
            </div>

            <div>
              <Label htmlFor="foto">Foto {!editingPortfolio && '*'}</Label>
              <Input
                id="foto"
                type="file"
                accept="image/*"
                onChange={handleFotoChange}
                className="cursor-pointer"
                disabled={uploading || extracting}
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
              {!editingPortfolio && !foto && (
                <p className="text-sm text-gray-500 mt-1">Selecione uma foto obrigatória</p>
              )}
            </div>

            {(modoPreenchimento === 'manual' || editingPortfolio) && (
              <div>
                <Label htmlFor="clipping">Clipping (PDF ou Imagem)</Label>
                <Input
                  id="clipping"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleClippingChange}
                  className="cursor-pointer"
                  disabled={uploading || extracting}
                />
                {clippingPreview && (
                  <div className="mt-2">
                    {clippingPreview.startsWith('data:application/pdf') || clipping?.type === 'application/pdf' ? (
                      <div className="p-4 border rounded-lg bg-gray-50">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto" />
                        <p className="text-sm text-gray-600 text-center mt-2">PDF selecionado</p>
                      </div>
                    ) : (
                      <img 
                        src={clippingPreview} 
                        alt="Preview Clipping" 
                        className="max-w-full h-48 object-cover rounded-lg border"
                      />
                    )}
                  </div>
                )}
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
                disabled={uploading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
                disabled={uploading || extracting}
              >
                {uploading ? 'Salvando...' : extracting ? 'Extraindo...' : editingPortfolio ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Portfolio;