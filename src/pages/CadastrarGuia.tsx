import React, { useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Sparkles } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import { GuiaEspecialBlocosForm } from '@/components/GuiaEspecialBlocosForm';
import type { GuiaEspecialCampos } from '@/types/guia-especial';

const CadastrarGuia = () => {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [pdf, setPdf] = useState<File | null>(null);
  const [imagem, setImagem] = useState<File | null>(null);
  const [especial, setEspecial] = useState(false);
  const [landingPageUrl, setLandingPageUrl] = useState('');
  const [valorPromocional, setValorPromocional] = useState('');
  const [valorOriginalOverride, setValorOriginalOverride] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [stripeProductId, setStripeProductId] = useState('');
  const [blocos, setBlocos] = useState<Partial<GuiaEspecialCampos>>({});
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    
    // Função para verificar se há conteúdo real no HTML
    const hasContent = (html: string): boolean => {
      if (!html) return false;
      // Remove tags HTML e espaços em branco
      const textContent = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      return textContent.length > 0;
    };
    
    // Validações
    if (!titulo || !hasContent(descricao) || !imagem) {
      setErro('Preencha todos os campos obrigatórios e selecione a imagem.');
      return;
    }
    
    // Se for guia especial, URL da landing page e valor promocional são obrigatórios
    if (especial) {
      if (!landingPageUrl.trim()) {
        setErro('Para guias especiais, a URL da landing page é obrigatória.');
        return;
      }
      if (!valorPromocional.trim()) {
        setErro('Para guias especiais, o valor promocional é obrigatório.');
        return;
      }
      const valorPromo = parseFloat(valorPromocional.replace(/[^\d,.-]/g, '').replace(',', '.'));
      if (isNaN(valorPromo) || valorPromo <= 0) {
        setErro('O valor promocional deve ser um número válido maior que zero.');
        return;
      }
    }
    
    // PDF é opcional para guias especiais
    if (!especial && !pdf) {
      setErro('Para guias normais, o PDF é obrigatório.');
      return;
    }
    
    setUploading(true);
    try {
      const storage = getStorage();
      
      // Upload Imagem (obrigatório)
      const imgRef = storageRef(storage, `guias/${Date.now()}_${imagem.name}`);
      await uploadBytes(imgRef, imagem);
      const imgUrl = await getDownloadURL(imgRef);
      
      // Upload PDF (opcional para guias especiais)
      let pdfUrl = '';
      if (pdf) {
        const pdfRef = storageRef(storage, `guias/${Date.now()}_${pdf.name}`);
        await uploadBytes(pdfRef, pdf);
        pdfUrl = await getDownloadURL(pdfRef);
      }
      
      // Salvar no Firestore
      const dadosGuia: any = {
        titulo,
        descricao,
        imgUrl,
        criadoEm: new Date(),
        especial: especial || false,
      };
      
      // Adicionar PDF URL apenas se existir
      if (pdfUrl) {
        dadosGuia.pdfUrl = pdfUrl;
      }
      
      // Adicionar landing page URL, valores, YouTube e blocos CMS se for especial
      if (especial && landingPageUrl.trim()) {
        dadosGuia.landingPageUrl = landingPageUrl.trim();
        const valorPromo = parseFloat(valorPromocional.replace(/[^\d,.-]/g, '').replace(',', '.'));
        dadosGuia.valorPromocional = valorPromo;
        const ancora = valorOriginalOverride.trim()
          ? parseFloat(valorOriginalOverride.replace(/[^\d,.-]/g, '').replace(',', '.'))
          : NaN;
        dadosGuia.valorOriginal = !isNaN(ancora) && ancora > 0 ? ancora : valorPromo * 1.5;
        if (youtubeUrl.trim()) dadosGuia.youtubeUrl = youtubeUrl.trim();
        if (stripeProductId.trim()) dadosGuia.stripeProductId = stripeProductId.trim();
        // Blocos 1–7 (conversão) — não sobrescrever valorOriginal/valorPromocional
        Object.entries(blocos).forEach(([k, v]) => {
          if (k === 'valorOriginal' || k === 'valorPromocional') return;
          if (v === undefined || v === null) return;
          if (typeof v === 'string' && !v.trim()) return;
          if (Array.isArray(v) && v.length === 0) return;
          (dadosGuia as any)[k] = v;
        });
      }
      
      await addDoc(collection(db, 'guias'), dadosGuia);
      navigate('/biblioteca');
    } catch (e: any) {
      setErro('Erro ao cadastrar guia: ' + (e.message || e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 p-8 animate-fade-in flex items-center justify-center">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Cadastrar Novo Guia</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-sm font-medium mb-1">Título</label>
                  <Input value={titulo} onChange={e => setTitulo(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Descrição</label>
                  <RichTextEditor
                    value={descricao}
                    onChange={setDescricao}
                    placeholder="Digite a descrição do guia. Use os botões da barra de ferramentas para formatar o texto (negrito, itálico, listas, etc.)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use os botões da barra de ferramentas para formatar o texto sem precisar escrever código HTML.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Imagem de Capa</label>
                  <Input type="file" accept="image/*" onChange={e => setImagem(e.target.files?.[0] || null)} required />
                </div>
                
                {/* Checkbox para Guia Especial */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-oraculo-blue/5 to-oraculo-purple/5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={especial}
                      onChange={e => setEspecial(e.target.checked)}
                      className="w-4 h-4 text-oraculo-blue rounded focus:ring-oraculo-blue"
                    />
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-oraculo-purple" />
                      <span className="font-medium text-sm">Guia Especial</span>
                    </div>
                  </label>
                  <CardDescription className="mt-2 ml-6 text-xs">
                    Guias especiais aparecem primeiro na lista e direcionam para uma landing page paga
                  </CardDescription>
                </div>
                
                {/* Campos para Guia Especial */}
                {especial && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        URL da Landing Page <span className="text-red-500">*</span>
                      </label>
                      <Input 
                        type="url" 
                        value={landingPageUrl} 
                        onChange={e => setLandingPageUrl(e.target.value)} 
                        placeholder="https://exemplo.com/landing-page"
                        required={especial}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        URL da página onde o usuário será redirecionado ao clicar no guia especial
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Valor Promocional (R$) <span className="text-red-500">*</span>
                      </label>
                      <Input 
                        type="text" 
                        value={valorPromocional} 
                        onChange={e => setValorPromocional(e.target.value)} 
                        placeholder="99,90"
                        required={especial}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Valor real que será cobrado.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Valor Original / Âncora (R$) <span className="text-gray-400 text-xs">(opcional)</span>
                      </label>
                      <Input 
                        type="text" 
                        value={valorOriginalOverride} 
                        onChange={e => setValorOriginalOverride(e.target.value)} 
                        placeholder="149,90"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Se vazio, será 50% a mais que o promocional.
                      </p>
                      {valorPromocional && !valorOriginalOverride && !isNaN(parseFloat(valorPromocional.replace(/[^\d,.-]/g, '').replace(',', '.'))) && (
                        <p className="text-xs text-oraculo-purple mt-1 font-medium">
                          Valor original calculado: R$ {(parseFloat(valorPromocional.replace(/[^\d,.-]/g, '').replace(',', '.')) * 1.5).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        URL do Vídeo do YouTube <span className="text-gray-400 text-xs">(opcional)</span>
                      </label>
                      <Input 
                        type="url" 
                        value={youtubeUrl} 
                        onChange={e => setYoutubeUrl(e.target.value)} 
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        URL completa do vídeo do YouTube (será exibido na página de detalhes)
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Stripe Product ID <span className="text-gray-400 text-xs">(opcional)</span>
                      </label>
                      <Input 
                        type="text" 
                        value={stripeProductId} 
                        onChange={e => setStripeProductId(e.target.value)} 
                        placeholder="prod_xxxxxxxxxxxxx"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Se informado, será usado o Product ID do Stripe para criar o checkout. Caso contrário, será criado dinamicamente.
                      </p>
                    </div>
                    <GuiaEspecialBlocosForm value={blocos} onChange={setBlocos} />
                  </>
                )}
                
                {/* Campo PDF (opcional para guias especiais) */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    PDF do Guia {!especial && <span className="text-red-500">*</span>}
                    {especial && <span className="text-gray-400 text-xs ml-2">(opcional)</span>}
                  </label>
                  <Input 
                    type="file" 
                    accept="application/pdf" 
                    onChange={e => setPdf(e.target.files?.[0] || null)} 
                    required={!especial}
                  />
                  {especial && (
                    <p className="text-xs text-gray-500 mt-1">
                      Para guias especiais, o PDF é opcional. O usuário será redirecionado para a landing page.
                    </p>
                  )}
                </div>
                
                {erro && <div className="text-red-500 text-sm">{erro}</div>}
                <Button type="submit" className="w-full bg-oraculo-blue text-white" disabled={uploading}>
                  {uploading ? 'Cadastrando...' : 'Cadastrar Guia'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default CadastrarGuia; 