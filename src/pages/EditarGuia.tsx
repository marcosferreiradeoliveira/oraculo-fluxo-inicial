import React, { useState, useEffect } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useNavigate, useParams } from 'react-router-dom';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import RichTextEditor from '@/components/RichTextEditor';
import { GuiaEspecialBlocosForm } from '@/components/GuiaEspecialBlocosForm';
import type { GuiaEspecialCampos } from '@/types/guia-especial';

const EditarGuia = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
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
  const [imgUrlAtual, setImgUrlAtual] = useState('');
  const [pdfUrlAtual, setPdfUrlAtual] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    // Verificar se é o usuário autorizado
    if (user?.email !== 'marcosferreira@mobcontent.com.br') {
      navigate('/inteligencia-mercado');
      return;
    }

    const fetchGuia = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'guias', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTitulo(data.titulo || '');
          setDescricao(data.descricao || '');
          setEspecial(data.especial || false);
          setLandingPageUrl(data.landingPageUrl || '');
          setValorPromocional(data.valorPromocional != null ? String(data.valorPromocional).replace('.', ',') : '');
          setValorOriginalOverride(data.valorOriginal != null ? String(data.valorOriginal).replace('.', ',') : '');
          setYoutubeUrl(data.youtubeUrl || '');
          setStripeProductId(data.stripeProductId || '');
          setImgUrlAtual(data.imgUrl || '');
          setPdfUrlAtual(data.pdfUrl || '');
          const blocoKeys: (keyof GuiaEspecialCampos)[] = [
            'subtituloImpacto', 'promessaPrincipal', 'beneficiosChave', 'etiquetaPosicionamento',
            'blocoVoceJaPassou', 'listaDores', 'consequenciaNaoResolver', 'blocoUrgenciaContextual',
            'autorNome', 'autorBio', 'provaSocial1', 'provaSocial2Nome', 'provaSocial2Perfil', 'provaSocial2Texto', 'provaSocial3',
            'oQueSeraCapaz', 'antesDepoisAntes', 'antesDepoisDepois',
            'textoAncoragemValor', 'beneficioEconomico', 'badgeRiscoBaixo',
            'paraQuemEh', 'paraQuemNaoEh', 'faq1Pergunta', 'faq1Resposta', 'faq2Pergunta', 'faq2Resposta', 'faq3Pergunta', 'faq3Resposta',
            'ctaTextoPrincipal', 'ctaTextoSecundario', 'microcopySeguranca',
          ];
          const b: Partial<GuiaEspecialCampos> = {};
          blocoKeys.forEach((k) => { if (data[k] !== undefined && data[k] !== null) (b as any)[k] = data[k]; });
          setBlocos(b);
        } else {
          navigate('/inteligencia-mercado');
        }
      } catch (error) {
        console.error('Erro ao buscar guia:', error);
        navigate('/inteligencia-mercado');
      } finally {
        setLoading(false);
      }
    };

    fetchGuia();
  }, [id, navigate, user]);

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
    if (!titulo || !hasContent(descricao)) {
      setErro('Preencha todos os campos obrigatórios.');
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
    
    // PDF é opcional para guias especiais, mas se não for especial e não tiver PDF atual nem novo, erro
    if (!especial && !pdfUrlAtual && !pdf) {
      setErro('Para guias normais, o PDF é obrigatório.');
      return;
    }
    
    setUploading(true);
    try {
      const storage = getStorage();
      
      let imgUrl = imgUrlAtual;
      // Upload nova imagem se fornecida
      if (imagem) {
        const imgRef = storageRef(storage, `guias/${Date.now()}_${imagem.name}`);
        await uploadBytes(imgRef, imagem);
        imgUrl = await getDownloadURL(imgRef);
      }
      
      let pdfUrl = pdfUrlAtual;
      // Upload novo PDF se fornecido
      if (pdf) {
        const pdfRef = storageRef(storage, `guias/${Date.now()}_${pdf.name}`);
        await uploadBytes(pdfRef, pdf);
        pdfUrl = await getDownloadURL(pdfRef);
      }
      
      // Atualizar no Firestore
      if (!id) {
        setErro('ID do guia não encontrado.');
        return;
      }

      const dadosGuia: any = {
        titulo,
        descricao,
        imgUrl,
        especial: especial || false,
      };
      
      // Adicionar PDF URL
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
        else dadosGuia.youtubeUrl = null;
        if (stripeProductId.trim()) dadosGuia.stripeProductId = stripeProductId.trim();
        else dadosGuia.stripeProductId = null;
        Object.entries(blocos).forEach(([k, v]) => {
          if (k === 'valorOriginal' || k === 'valorPromocional') return;
          if (v === undefined || v === null) return;
          if (typeof v === 'string' && !v.trim()) return;
          if (Array.isArray(v) && v.length === 0) return;
          (dadosGuia as any)[k] = v;
        });
      } else if (!especial) {
        dadosGuia.landingPageUrl = null;
        dadosGuia.valorOriginal = null;
        dadosGuia.valorPromocional = null;
        dadosGuia.youtubeUrl = null;
      }
      
      const docRef = doc(db, 'guias', id);
      await updateDoc(docRef, dadosGuia);
      
      // Redirecionar para página de detalhes se for especial, senão para biblioteca
      if (especial) {
        navigate(`/guia-especial/${id}`);
      } else {
        navigate('/biblioteca');
      }
    } catch (e: any) {
      setErro('Erro ao atualizar guia: ' + (e.message || e));
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 p-8 animate-fade-in flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oraculo-blue mx-auto"></div>
              <p className="mt-4 text-gray-600">Carregando guia...</p>
            </div>
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
        <main className="flex-1 p-8 animate-fade-in">
          <div className="max-w-2xl mx-auto">
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>

            <Card className="w-full">
              <CardHeader>
                <CardTitle>Editar Guia</CardTitle>
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
                    <p className="text-xs text-gray-500 mt-2">
                      Use os botões da barra de ferramentas para formatar o texto sem precisar escrever código HTML.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Imagem de Capa</label>
                    {imgUrlAtual && (
                      <div className="mb-2">
                        <img src={imgUrlAtual} alt="Imagem atual" className="w-32 h-20 object-cover rounded border" />
                        <p className="text-xs text-gray-500 mt-1">Imagem atual</p>
                      </div>
                    )}
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={e => setImagem(e.target.files?.[0] || null)} 
                    />
                    <p className="text-xs text-gray-500 mt-1">Deixe em branco para manter a imagem atual</p>
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
                  
                  {/* Campo PDF */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      PDF do Guia {!especial && <span className="text-red-500">*</span>}
                      {especial && <span className="text-gray-400 text-xs ml-2">(opcional)</span>}
                    </label>
                    {pdfUrlAtual && (
                      <div className="mb-2">
                        <a 
                          href={pdfUrlAtual} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-oraculo-blue hover:underline"
                        >
                          Ver PDF atual
                        </a>
                      </div>
                    )}
                    <Input 
                      type="file" 
                      accept="application/pdf" 
                      onChange={e => setPdf(e.target.files?.[0] || null)} 
                      required={!especial && !pdfUrlAtual}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {especial 
                        ? 'Para guias especiais, o PDF é opcional. Deixe em branco para manter o PDF atual.'
                        : 'Deixe em branco para manter o PDF atual'}
                    </p>
                  </div>
                  
                  {erro && <div className="text-red-500 text-sm">{erro}</div>}
                  <div className="flex gap-3">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1" 
                      onClick={() => navigate(-1)}
                      disabled={uploading}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 bg-oraculo-blue text-white" 
                      disabled={uploading}
                    >
                      {uploading ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EditarGuia;
