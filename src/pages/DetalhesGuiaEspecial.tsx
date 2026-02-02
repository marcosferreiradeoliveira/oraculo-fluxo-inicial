import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ExternalLink, Sparkles, Edit, Play, Download, Loader2, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuthState } from 'react-firebase-hooks/auth';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { trackGuiaEspecialCtaClicked, trackGuiaEspecialPaymentSuccess, trackGuiaEspecialPdfDownloaded } from '@/lib/analytics';
import type { GuiaEspecialCampos } from '@/types/guia-especial';

declare global {
  interface Window {
    fbq: (command: string, eventName: string, params?: Record<string, unknown>) => void;
  }
}
import { parseLines } from '@/types/guia-especial';
import autorFoto from '@/assets/autor-marcos.png';
import imgAnalisar from '@/assets/Analisar.jpeg';


interface Guia extends Partial<GuiaEspecialCampos> {
  id: string;
  titulo: string;
  descricao: string;
  imgUrl: string;
  pdfUrl?: string;
  landingPageUrl?: string;
  especial?: boolean;
  valorOriginal?: number;
  valorPromocional?: number;
  youtubeUrl?: string;
  criadoEm?: any;
}

function arr(x: string[] | undefined): string[] {
  return Array.isArray(x) ? x.filter(Boolean) : [];
}

const DetalhesGuiaEspecial = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [guia, setGuia] = useState<Guia | null>(null);
  const [loading, setLoading] = useState(true);
  const [user] = useAuthState(auth);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loadingStripe, setLoadingStripe] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  const GUIA_CHECKOUT_URL = 'https://us-central1-culturalapp-fb9b0.cloudfunctions.net/criarCheckoutGuiaStripe';
  
  // Verificar se o pagamento foi concluído com sucesso
  const paymentSuccess = searchParams.get('payment') === 'success';
  const sessionId = searchParams.get('session_id') || undefined;

  // Debug: verificar se paymentSuccess está sendo detectado
  useEffect(() => {
    if (paymentSuccess) {
      console.log('[DetalhesGuiaEspecial] Pagamento sucesso detectado:', {
        paymentSuccess,
        sessionId,
        guiaId: guia?.id,
        guiaTitulo: guia?.titulo,
        pdfUrl: guia?.pdfUrl,
      });
    }
  }, [paymentSuccess, sessionId, guia?.id, guia?.titulo, guia?.pdfUrl]);

  // Tracking de sucesso de pagamento (apenas uma vez quando a página carrega)
  useEffect(() => {
    if (paymentSuccess && guia?.id) {
      const valorPago = guia.valorPromocional ?? guia.valorOriginal ?? 0;
      trackGuiaEspecialPaymentSuccess({
        guia_id: guia.id,
        guia_titulo: guia.titulo,
        valor_pago: valorPago,
        session_id: sessionId,
        user_id: user?.uid,
        is_guest: !user,
      });

      // Facebook / Meta Pixel: conversão de venda para Facebook Ads
      if (typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'Purchase', {
          value: valorPago,
          currency: 'BRL',
          content_name: guia.titulo || 'Guia Especial',
          content_type: 'product',
          content_ids: [guia.id],
        });
      }
    }
  }, [paymentSuccess, guia?.id, guia?.titulo, guia?.valorPromocional, guia?.valorOriginal, sessionId, user]);

  useEffect(() => {
    // Verificar email do usuário
    if (user?.email) {
      setUserEmail(user.email);
    } else if (user?.uid) {
      // Se não tiver email no auth, buscar do Firestore
      const fetchUserEmail = async () => {
        try {
          const userDocRef = doc(db, 'usuarios', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserEmail(userData.email || null);
          }
        } catch (error) {
          console.error('Erro ao buscar email do usuário:', error);
        }
      };
      fetchUserEmail();
    } else {
      setUserEmail(null);
    }
  }, [user]);

  useEffect(() => {
    const fetchGuia = async () => {
      setLoading(true);
      try {
        if (!id) {
          setLoading(false);
          return;
        }
        
        const docRef = doc(db, 'guias', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Guia;
          setGuia(data);
        } else {
          // Se não encontrar, redirecionar para página de guias
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
  }, [id, navigate]);

  // Função para extrair o ID do vídeo do YouTube
  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  };

  const scrollToCta = () => {
    ctaRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleGarantaAgora = async (ctaSlot: 'final_main' | 'final_micro') => {
    trackGuiaEspecialCtaClicked({
      cta_slot: ctaSlot,
      cta_text: ctaSlot === 'final_main' ? (guia?.ctaTextoPrincipal || 'Garanta agora') : 'Comece agora • Acesso imediato',
      guia_id: guia?.id,
      guia_titulo: guia?.titulo,
      action: 'navigate_to_premium',
    });

    if (!guia?.id) return;

    const payload = {
      guiaId: guia.id,
      ...(user
        ? { userId: user.uid, email: user.email || userEmail || '' }
        : { userId: 'guest', email: '' }),
    };

    setLoadingStripe(true);
    try {
      const res = await fetch(GUIA_CHECKOUT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || `Erro ${res.status}`);
      }

      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      throw new Error('Link de pagamento não retornado');
    } catch (e) {
      setLoadingStripe(false);
      alert(`Erro ao redirecionar para o pagamento: ${e instanceof Error ? e.message : 'Tente novamente.'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto">
          <DashboardHeader />
          <main className="p-8">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oraculo-blue"></div>
              <span className="ml-4 text-lg">Carregando guia...</span>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!guia) {
    return (
      <div className="flex h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto">
          <DashboardHeader />
          <main className="p-8">
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">Guia não encontrado</p>
              <Button 
                onClick={() => navigate('/inteligencia-mercado')}
                className="mt-4"
              >
                Voltar para Guias
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 overflow-auto">
        <DashboardHeader />
        <main className="p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            {/* Botão Editar - Apenas para marcosferreira@mobcontent.com.br */}
            {userEmail === 'marcosferreira@mobcontent.com.br' && (
              <div className="flex justify-end mb-6">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/editar-guia/${id}`)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar Guia
                </Button>
              </div>
            )}

            {/* Banner de Sucesso após Pagamento */}
            {paymentSuccess && (
              <Card className="mb-6 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                        <CheckCircle className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                        Pagamento confirmado! 🎉
                      </h2>
                      <p className="text-gray-700 mb-4">
                        Obrigado pela sua compra! {guia?.pdfUrl ? 'Seu guia especial está pronto para download.' : 'Estamos processando seu pedido.'}
                      </p>
                      {guia?.pdfUrl ? (
                        <Button
                          onClick={() => {
                            trackGuiaEspecialPdfDownloaded({
                              guia_id: guia.id,
                              guia_titulo: guia.titulo,
                              session_id: sessionId,
                            });
                            window.open(guia.pdfUrl, '_blank');
                          }}
                          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90 text-white px-6 py-3 text-base font-semibold flex items-center gap-2"
                        >
                          <Download className="h-5 w-5" />
                          Baixar PDF do Guia
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-amber-700 text-sm font-medium">
                            ⚠️ O PDF do guia ainda não está disponível.
                          </p>
                          <p className="text-gray-600 text-sm">
                            Entre em contato com o suporte através do email <strong>suporte@oraculocultural.com.br</strong> ou pelo WhatsApp para receber seu guia.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card Principal */}
            <Card className="overflow-hidden">
              {/* Imagem de Capa */}
              <div className="relative w-full h-64 md:h-96 overflow-hidden">
                <img 
                  src={guia.imgUrl} 
                  alt={guia.titulo}
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/50 to-black/30" />
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <div className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      ESPECIAL
                    </div>
                    {guia.etiquetaPosicionamento && (
                      <span className="bg-white/20 text-white px-3 py-1 rounded-full text-xs font-medium">
                        {guia.etiquetaPosicionamento}
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">
                    {guia.titulo}
                  </h1>
                  {/* Subtítulo OU promessa (evitar duplicação — escolher um) */}
                  {guia.subtituloImpacto ? (
                    <p className="text-white/90 text-base md:text-lg mb-2">{guia.subtituloImpacto}</p>
                  ) : guia.promessaPrincipal ? (
                    <p className="text-white/95 font-semibold text-sm md:text-base mb-2">{guia.promessaPrincipal}</p>
                  ) : null}
                  {arr(guia.beneficiosChave).length > 0 && (
                    <ul className="text-white/90 text-sm md:text-base space-y-1 mb-2 list-disc list-inside">
                      {arr(guia.beneficiosChave).map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Botão Baixe Agora - direciona para o card de preço/CTA */}
              <div className="px-6 md:px-8 pt-4 pb-2 border-b border-gray-100">
                <Button
                  onClick={() => {
                    trackGuiaEspecialCtaClicked({
                      cta_slot: 'hero',
                      cta_text: 'Baixe agora',
                      guia_id: guia.id,
                      guia_titulo: guia.titulo,
                      action: 'scroll_to_price',
                    });
                    scrollToCta();
                  }}
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white px-6 py-4 text-base font-semibold"
                >
                  <Download className="h-5 w-5" />
                  Baixe agora
                </Button>
              </div>

              {/* Conteúdo */}
              <CardContent className="p-6 md:p-8">
                {/* BLOCO 2 — Dor, Identificação e Urgência */}
                {(guia.blocoVoceJaPassou || arr(guia.listaDores).length > 0 || guia.consequenciaNaoResolver || guia.blocoUrgenciaContextual) && (
                  <div className="mb-8 p-5 rounded-xl bg-amber-50 border border-amber-200">
                    {guia.blocoVoceJaPassou && (
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Você já passou por isso?</h3>
                    )}
                    {guia.blocoVoceJaPassou && <p className="text-gray-700 mb-3">{guia.blocoVoceJaPassou}</p>}
                    {arr(guia.listaDores).length > 0 && (
                      <ul className="list-disc list-inside text-gray-700 space-y-1 mb-3">
                        {arr(guia.listaDores).map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}
                    {guia.consequenciaNaoResolver && (
                      <div className="flex gap-3 p-4 rounded-lg bg-amber-100 border border-amber-400 mb-3">
                        <span className="text-amber-600 font-bold text-lg shrink-0" aria-hidden>⚠️</span>
                        <p className="text-gray-800 font-semibold text-sm md:text-base">{guia.consequenciaNaoResolver}</p>
                      </div>
                    )}
                    {guia.blocoUrgenciaContextual && (
                      <p className="text-oraculo-purple font-semibold text-sm">{guia.blocoUrgenciaContextual}</p>
                    )}
                  </div>
                )}

                {/* BLOCO — Autor / Responsável pelo conteúdo ("Quem está por trás disso?") */}
                {(guia.autorNome || guia.autorBio) && (
                  <div className="mb-8 p-5 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl" aria-hidden>👤</span>
                      <h3 className="text-lg font-semibold text-gray-900">Autor do conteúdo</h3>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                      <img
                        src={autorFoto}
                        alt={guia.autorNome || 'Autor do conteúdo'}
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover shrink-0 border-2 border-gray-200"
                      />
                      <div className="min-w-0 flex-1">
                        {guia.autorNome && <p className="font-medium text-gray-900 mb-2">Nome: {guia.autorNome}</p>}
                        {guia.autorBio && (
                          <div className="text-gray-700 text-sm space-y-1">
                            {parseLines(guia.autorBio).map((line, i) => (
                              <p key={i}>{line}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* BLOCO — Autoridade / Prova técnica ("Isso é sério / confiável?") */}
                {(guia.provaSocial1 || guia.provaSocial3) && (
                  <div className="mb-8 p-5 rounded-xl bg-blue-50/80 border border-blue-200">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl" aria-hidden>📊</span>
                      <h3 className="text-lg font-semibold text-gray-900">Metodologia validada na prática</h3>
                    </div>
                    <div className="text-gray-700 text-sm space-y-2">
                      {guia.provaSocial1 && <p className="font-medium text-gray-800">{guia.provaSocial1}</p>}
                      {guia.provaSocial3 && <p className="text-gray-600">{guia.provaSocial3}</p>}
                    </div>
                  </div>
                )}

                {/* BLOCO — Depoimentos / Prova social humana ("Funciona para pessoas como eu?") */}
                {(guia.provaSocial2Nome || guia.provaSocial2Texto) && (
                  <div className="mb-8 p-5 rounded-xl bg-amber-50/50 border border-amber-200">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl" aria-hidden>⭐</span>
                      <h3 className="text-lg font-semibold text-gray-900">O que produtores culturais dizem</h3>
                    </div>
                    <blockquote className="border-l-4 border-amber-400 pl-4 py-2 text-gray-700 italic">
                      {guia.provaSocial2Texto && <p>{guia.provaSocial2Texto}</p>}
                      {(guia.provaSocial2Nome || guia.provaSocial2Perfil) && (
                        <footer className="text-sm text-gray-500 mt-2 not-italic">
                          — {[guia.provaSocial2Nome, guia.provaSocial2Perfil].filter(Boolean).join(', ')}
                        </footer>
                      )}
                    </blockquote>
                  </div>
                )}

                {/* CTA 2 — Após prova social (quem se convenceu pela confiança) */}
                {(guia.provaSocial2Nome || guia.provaSocial2Texto) && (
                  <div className="mb-8 flex flex-col items-center gap-2 text-center">
                    <p className="text-gray-600 text-sm">Acesso imediato • Download direto</p>
                    <Button
                      onClick={() => {
                        trackGuiaEspecialCtaClicked({
                          cta_slot: 'after_prova_social',
                          cta_text: 'Baixar o guia agora',
                          guia_id: guia.id,
                          guia_titulo: guia.titulo,
                          action: 'scroll_to_price',
                        });
                        scrollToCta();
                      }}
                      className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white px-6 py-4 text-base font-semibold"
                    >
                      <Download className="h-5 w-5" />
                      Baixar o guia agora
                    </Button>
                  </div>
                )}

                {/* Bloco 4 — Conteúdo do Guia (lista técnica) + Resultados práticos (cards) */}
                <div className="mb-8">
                  {/* Conteúdo do Guia — foto à esquerda, lista técnica à direita */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 md:p-5">
                    <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">
                      <div className="w-full md:w-52 lg:w-64 shrink-0 order-1">
                        <img
                          src={guia.imgUrl}
                          alt={guia.titulo}
                          className="w-full rounded-lg object-cover aspect-[3/4] border border-gray-200"
                        />
                      </div>
                      <div className="min-w-0 order-2">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xl" aria-hidden>📖</span>
                          <h2 className="text-xl font-semibold text-gray-900">Conteúdo do Guia</h2>
                        </div>
                        <div 
                          className="prose prose-gray max-w-none text-gray-700 leading-relaxed text-base [&_ul]:list-disc [&_ul]:list-inside [&_li]:my-1 [&_ul]:space-y-0.5"
                          dangerouslySetInnerHTML={{ __html: guia.descricao || '' }}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Resultados práticos — texto à esquerda, uma imagem à direita */}
                  {arr(guia.oQueSeraCapaz).length > 0 && (
                    <div className="mt-6 rounded-lg border border-purple-100 bg-purple-50/60 p-4 md:p-5">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Resultados práticos</h4>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
                        <ul className="list-none space-y-2 order-2 md:order-1">
                          {arr(guia.oQueSeraCapaz).map((a, i) => (
                            <li key={i} className="flex items-start gap-3 text-gray-800">
                              <span className="text-green-600 shrink-0 mt-0.5" aria-hidden>✅</span>
                              <span className="text-sm font-medium leading-snug">{a}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="w-full md:w-64 lg:w-80 shrink-0 order-1 md:order-2">
                          <img
                            src={imgAnalisar}
                            alt=""
                            className="w-full rounded-lg object-cover aspect-[4/3] border border-purple-100"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {(guia.antesDepoisAntes || guia.antesDepoisDepois) && (
                    <div className="mt-4 grid md:grid-cols-2 gap-4">
                      {guia.antesDepoisAntes && (
                        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                          <h4 className="font-semibold text-red-800 mb-2">Antes</h4>
                          <ul className="text-gray-700 text-sm list-none space-y-2">
                            {parseLines(guia.antesDepoisAntes).map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-red-600 shrink-0 mt-0.5" aria-hidden>❌</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {guia.antesDepoisDepois && (
                        <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                          <h4 className="font-semibold text-green-800 mb-2">Depois</h4>
                          <ul className="text-gray-700 text-sm list-none space-y-2">
                            {parseLines(guia.antesDepoisDepois).map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-green-700 shrink-0 mt-0.5" aria-hidden>✅</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CTA 3 — Após Antes/Depois (quem se convenceu emocionalmente) */}
                  {(guia.antesDepoisAntes || guia.antesDepoisDepois) && (
                    <div className="mt-6 flex flex-col items-center gap-2 text-center">
                      <p className="text-gray-600 text-sm">Acesso imediato</p>
                      <Button
                        onClick={() => {
                          trackGuiaEspecialCtaClicked({
                            cta_slot: 'after_antes_depois',
                            cta_text: 'Quero esta tranquilidade',
                            guia_id: guia.id,
                            guia_titulo: guia.titulo,
                            action: 'scroll_to_price',
                          });
                          scrollToCta();
                        }}
                        className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white px-6 py-4 text-base font-semibold"
                      >
                        <Download className="h-5 w-5" />
                        Quero esta tranquilidade
                      </Button>
                    </div>
                  )}
                </div>

                {/* Vídeo do YouTube (se disponível) */}
                {guia.youtubeUrl && getYouTubeVideoId(guia.youtubeUrl) && (
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                      <Play className="h-5 w-5 text-oraculo-blue" />
                      <h2 className="text-xl font-semibold text-gray-900">Vídeo</h2>
                    </div>
                    <div className="w-full rounded-xl overflow-hidden shadow-lg">
                      <div className="relative" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                          className="absolute top-0 left-0 w-full h-full"
                          src={`https://www.youtube.com/embed/${getYouTubeVideoId(guia.youtubeUrl)}`}
                          title={guia.titulo}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* BLOCO 6 — Redução de Objeções */}
                {(guia.paraQuemEh || guia.paraQuemNaoEh || guia.faq1Pergunta || guia.faq2Pergunta || guia.faq3Pergunta) && (
                  <div className="mb-8 p-5 rounded-xl bg-gray-50 border border-gray-200">
                    {guia.paraQuemEh && (
                      <div className="mb-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Para quem é este guia</h3>
                        <p className="text-gray-700 text-sm">{guia.paraQuemEh}</p>
                      </div>
                    )}
                    {guia.paraQuemNaoEh && (
                      <div className="mb-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Para quem NÃO é</h3>
                        <p className="text-gray-700 text-sm">{guia.paraQuemNaoEh}</p>
                      </div>
                    )}
                    {(guia.faq1Pergunta || guia.faq2Pergunta || guia.faq3Pergunta) && (
                      <div className="space-y-4 mt-4">
                        {[1, 2, 3].map((i) => {
                          const p = (guia as any)[`faq${i}Pergunta`];
                          const r = (guia as any)[`faq${i}Resposta`];
                          if (!p && !r) return null;
                          return (
                            <div key={i}>
                              <h4 className="font-medium text-gray-900">{p}</h4>
                              {r && <p className="text-gray-600 text-sm mt-1">{r}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-gray-200 my-8" />

                {/* Preço e Call to Action (Blocos 5 + 7) */}
                <div ref={ctaRef} className="bg-gradient-to-r from-oraculo-blue/10 to-oraculo-purple/10 rounded-xl p-6 md:p-8 scroll-mt-6">
                  {/* Benefício econômico e âncora ANTES do preço (aumenta conversão) */}
                  {guia.beneficioEconomico && (
                    <p className="text-center text-gray-800 font-medium text-sm md:text-base mb-3">{guia.beneficioEconomico}</p>
                  )}
                  {guia.textoAncoragemValor && (
                    <p className="text-center text-oraculo-purple font-medium mb-4">{guia.textoAncoragemValor}</p>
                  )}
                  {/* Exibição de Preço */}
                  {guia.valorOriginal && guia.valorPromocional && (
                    <div className="text-center mb-6">
                      <div className="flex items-center justify-center gap-3 mb-2">
                        <span className="text-2xl md:text-3xl text-gray-400 line-through">
                          R$ {guia.valorOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-3xl md:text-4xl font-bold text-oraculo-purple">
                          R$ {guia.valorPromocional.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {guia.valorOriginal > guia.valorPromocional && (
                        <p className="text-sm text-gray-600">
                          Economia de R$ {(guia.valorOriginal - guia.valorPromocional).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  )}
                  {arr(guia.badgeRiscoBaixo).length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                      {arr(guia.badgeRiscoBaixo).map((b, i) => (
                        <span key={i} className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                          {b}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                      Acesse o Conteúdo Completo
                    </h3>
                    {guia.ctaTextoSecundario ? (
                      <p className="text-gray-600 text-sm md:text-base">{guia.ctaTextoSecundario}</p>
                    ) : (
                      <p className="text-gray-600 text-sm md:text-base">
                        Clique no botão abaixo para acessar e fazer o download.
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={() => handleGarantaAgora('final_main')}
                    disabled={loadingStripe}
                    className="w-full md:w-auto mx-auto flex items-center justify-center gap-2 bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white px-8 py-6 text-lg font-semibold disabled:opacity-70"
                    size="lg"
                  >
                    {loadingStripe ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Redirecionando ao pagamento...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-5 w-5" />
                        {guia.ctaTextoPrincipal || 'Garanta agora'}
                      </>
                    )}
                  </Button>
                  {/* Micro-CTA repetido (converte mais, especialmente em mobile) */}
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleGarantaAgora('final_micro')}
                      disabled={loadingStripe}
                      className="text-oraculo-purple font-semibold text-sm hover:underline focus:outline-none focus:ring-2 focus:ring-oraculo-purple focus:ring-offset-2 rounded px-2 py-1 disabled:opacity-60 disabled:pointer-events-none"
                    >
                      Comece agora • Acesso imediato
                    </button>
                  </div>
                  {arr(guia.microcopySeguranca).length > 0 && (
                    <div className="flex flex-wrap justify-center gap-4 mt-4 text-gray-500 text-xs">
                      {arr(guia.microcopySeguranca).map((m, i) => (
                        <span key={i}>{m}</span>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Modal de Autenticação */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle>Acesso Restrito</DialogTitle>
            <DialogDescription>
              Para acessar este guia especial, é necessário fazer login ou criar uma conta.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <Button 
              className="w-full bg-oraculo-blue text-white" 
              onClick={() => {
                setShowAuthModal(false);
                navigate(guia?.id ? `/cadastro?redirect=/guia-especial/${guia.id}` : '/cadastro');
              }}
            >
              Criar Conta / Entrar
            </Button>
            <Button 
              variant="outline"
              className="w-full" 
              onClick={() => setShowAuthModal(false)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DetalhesGuiaEspecial;
