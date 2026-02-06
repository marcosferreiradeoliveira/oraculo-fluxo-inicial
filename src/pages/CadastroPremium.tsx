import React, { useState, useEffect } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { Check, Star, Users, Building2, Crown } from 'lucide-react';
import { trackSubscriptionCompleted } from '@/lib/analytics';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Declarar tipo do Facebook Pixel
declare global {
  interface Window {
    fbq: (command: string, eventName: string, params?: Record<string, unknown>) => void;
  }
}

const CadastroPremium = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState({ email: '', userId: '', planType: null, isPremium: false });
  const [isAnnual, setIsAnnual] = useState(true); // Padrão: anual
  const [paymentProcessed, setPaymentProcessed] = useState(false); // Evitar processar múltiplas vezes
  const [showLimiteProjetosPopup, setShowLimiteProjetosPopup] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (searchParams.get('motivo') === 'limite_projetos') {
      setShowLimiteProjetosPopup(true);
    }
  }, [searchParams]);

  const motivoCreditosInsuficientes = searchParams.get('motivo') === 'creditos_insuficientes';

  useEffect(() => {
    const fetchUserData = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (user) {
        // Sempre definir email e userId do auth, mesmo se o documento do Firestore não existir
        const baseUserData = {
          email: user.email || '',
          userId: user.uid,
          planType: null as string | null,
          isPremium: false
        };

        try {
          const db = getFirestore();
          const userDoc = await getDocFromServer(doc(db, 'usuarios', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData({
              ...baseUserData,
              planType: data.planType || null,
              isPremium: data.isPremium || false
            });
          } else {
            // Se o documento não existe, ainda definir os dados básicos do auth
            setUserData(baseUserData);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          // Fallback para cache se getDocFromServer falhar
          try {
            const db = getFirestore();
            const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              setUserData({
                ...baseUserData,
                planType: data.planType || null,
                isPremium: data.isPremium || false
              });
            } else {
              // Se o documento não existe, ainda definir os dados básicos do auth
              setUserData(baseUserData);
            }
          } catch (fallbackError) {
            console.error('Error fetching user data (fallback):', fallbackError);
            // Mesmo em caso de erro, definir os dados básicos do auth
            setUserData(baseUserData);
          }
        }
      }
    };

    fetchUserData();
  }, []);

  // Verificar retorno do Stripe e disparar eventos de conversão
  useEffect(() => {
    const status = searchParams.get('status');
    const sessionId = searchParams.get('session_id');
    
    if (status === 'success' && sessionId && !paymentProcessed) {
      setPaymentProcessed(true);
      
      const processPaymentSuccess = async () => {
        try {
          // Buscar dados da sessão do Stripe no Firestore (se disponível)
          const db = getFirestore();
          const sessionDoc = await getDoc(doc(db, 'stripe_sessions', sessionId));
          let planType = 'basico';
          let planPrice = 99.00; // Valor padrão
          let isAnnualPlan = false;
          
          if (sessionDoc.exists()) {
            const sessionData = sessionDoc.data();
            planType = sessionData.planType || 'basico';
            // Os valores podem ser calculados baseados no planType
            if (planType === 'essencial') {
              planPrice = 349.00;
            } else if (planType === 'basico') {
              planPrice = 99.00;
            }
          }
          
          // Disparar evento do Facebook Pixel (Purchase)
          if (typeof window !== 'undefined' && window.fbq) {
            window.fbq('track', 'Purchase', {
              value: planPrice,
              currency: 'BRL',
              content_name: `Plano ${planType.charAt(0).toUpperCase() + planType.slice(1)}`,
            });
            console.log('[Meta Pixel] Evento Purchase disparado:', { value: planPrice, currency: 'BRL' });
          }
          
          // Disparar nosso evento de analytics
          trackSubscriptionCompleted({
            planType: planType,
            isAnnual: isAnnualPlan,
            planPrice: planPrice,
            transactionId: sessionId,
          });
          
          // Limpar parâmetros da URL para evitar reprocessamento
          window.history.replaceState({}, '', '/cadastro-premium');
        } catch (error) {
          console.error('Erro ao processar sucesso do pagamento:', error);
        }
      };
      
      processPaymentSuccess();
    }
  }, [searchParams, paymentProcessed]);

  const handlePlanSelection = async (planType: string) => {
    // Se for Premium, redirecionar para formulário de contato
    if (planType === 'premium') {
      navigate('/contato-premium');
      return;
    }

    // Verificar autenticação diretamente do Firebase Auth
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user || !user.email || !user.uid) {
      alert('Por favor, faça login para assinar um plano.');
      return;
    }

    // Usar dados do auth.currentUser como fallback se userData ainda não carregou
    const userId = userData.userId || user.uid;
    const userEmail = userData.email || user.email || '';

    if (!userId || !userEmail) {
      alert('Por favor, faça login para assinar um plano.');
      return;
    }

    setLoading(true);
    try {
      console.log('[CadastroPremium] Iniciando criação de checkout Stripe:', { planType, userEmail, userId });
      
      // Criar assinatura recorrente mensal no Stripe com o tipo de plano selecionado
      const response = await fetch('https://us-central1-culturalapp-fb9b0.cloudfunctions.net/criarAssinaturaPremiumStripe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          email: userEmail,
          planType: planType, // Passar o tipo de plano selecionado
          isAnnual: isAnnual, // Passar se é anual ou mensal
        }),
      });

      console.log('[CadastroPremium] Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro ao criar assinatura: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log('[CadastroPremium] Success data:', data);
      
      if (data.checkout_url) {
        // Redirecionar para o checkout do Stripe
        window.location.href = data.checkout_url;
      } else {
        throw new Error('Link de pagamento não retornado');
      }
    } catch (error) {
      console.error('[CadastroPremium] Error creating checkout:', error);
      alert(`Erro ao processar pagamento: ${error instanceof Error ? error.message : 'Tente novamente.'}`);
      setLoading(false);
    }
  };

  const plans = [
    {
      name: 'Básico',
      subtitle: 'Produtor Iniciante ou Individual',
      description: '1 usuário, até 3 projetos ativos/ano',
      focus: 'Criação (Foco na Captação)',
      price: 'R$ 99,00',
      period: '/mês',
      annualPrice: 'R$ 990,00',
      annualPeriod: '/ano',
      discount: '17% de desconto',
      features: [
        'Importação automática e detalhamento de Editais',
        'Acesso ao Polo de Conhecimento (e-books, podcasts)',
        'Avaliação Inteligente do Projeto com notas e sugestões iniciais'
      ],
      buttonText: 'Escolher Plano',
      icon: Users,
      popular: false
    },
    {
      name: 'Essencial',
      subtitle: 'Produtora Pequena/Média',
      description: 'Até 5 usuários, infinitos projetos',
      focus: 'Criação e Execução (Foco em Captação e Conformidade)',
      price: 'R$ 349',
      period: '/mês',
      annualPrice: 'R$ 3.476,04',
      annualPeriod: '/ano',
      discount: '17% de desconto',
      features: [
        'Todas as funcionalidades do Básico com infinitos projetos'
      ],
      buttonText: 'Escolher Plano',
      icon: Building2,
      popular: true
    },
    {
      name: 'Premium',
      subtitle: 'Agências e Produtoras Grandes',
      description: 'Usuários Ilimitados, Projetos Ilimitados',
      focus: 'Criação e Execução (Foco em Performance e Auditoria Rigorosa)',
      price: 'Preço sob consulta',
      period: '',
      annualPrice: '',
      annualPeriod: '',
      discount: 'Modelo Enterprise com Venda Consultiva',
      features: [
        'Todas as funcionalidades do Essencial',
        'Export para prestação de contas',
        'Customização de critérios para avaliação de notas com IA',
        'Desenvolvimento de módulos customizados'
      ],
      buttonText: 'Solicitar Contato',
      icon: Crown,
      popular: false
    }
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        
        <main className="flex-1 p-2 md:p-4">
          <div className="max-w-7xl mx-auto">
            {/* Aviso: veio por créditos insuficientes em alguma seção — só quando motivo na URL */}
            {motivoCreditosInsuficientes && (
              <div className="mb-6 p-4 rounded-xl bg-amber-50 border-2 border-amber-200 text-amber-900">
                <p className="text-sm md:text-base font-medium">
                  Você não tem créditos suficientes para esta ação. Assine um plano para uso ilimitado.
                </p>
              </div>
            )}
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Planos e Preços
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
                Escolha o plano ideal para o seu perfil e acelere seus projetos culturais
              </p>
              
              {/* Toggle Anual/Mensal */}
              <div className="flex items-center justify-center gap-4">
                <span className={`text-sm font-medium ${!isAnnual ? 'text-gray-900' : 'text-gray-500'}`}>
                  Mensal
                </span>
                <button
                  onClick={() => setIsAnnual(!isAnnual)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isAnnual ? 'bg-gradient-to-r from-oraculo-blue to-oraculo-purple' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isAnnual ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`text-sm font-medium ${isAnnual ? 'text-gray-900' : 'text-gray-500'}`}>
                  Anual
                </span>
                {isAnnual && (
                  <span className="ml-2 inline-block px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                    17% de desconto
                  </span>
                )}
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              {plans.map((plan, index) => {
                const IconComponent = plan.icon;
                return (
                  <div
                    key={plan.name}
                    className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl ${
                      plan.popular 
                        ? 'border-oraculo-blue scale-105' 
                        : 'border-gray-200 hover:border-oraculo-blue/50'
                    }`}
                  >
                    {/* Popular Badge */}
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <div className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
                          <Star className="h-4 w-4" />
                          Mais Popular
                        </div>
                      </div>
                    )}

                    <div className="p-8">
                      {/* Plan Header */}
                      <div className="text-center mb-8">
                        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                          plan.popular 
                            ? 'bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          <IconComponent className="h-8 w-8" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                        <p className="text-gray-600 font-medium">{plan.subtitle}</p>
                        <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                        <p className="text-sm text-oraculo-blue font-medium mt-2">{plan.focus}</p>
                      </div>

                      {/* Pricing */}
                      <div className="text-center mb-8">
                        {plan.name === 'Premium' ? (
                          <div className="mb-2">
                            <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                          </div>
                        ) : (
                          <>
                            {isAnnual ? (
                              <>
                                {(() => {
                                  // Calcular valor mensal do plano anual
                                  let monthlyEquivalent = '';
                                  let annualTotal = '';
                                  if (plan.annualPrice && plan.annualPrice.includes('R$')) {
                                    try {
                                      const cleanPrice = plan.annualPrice
                                        .replace('R$', '')
                                        .replace(/\./g, '') // Remove pontos (milhares)
                                        .replace(',', '.') // Substitui vírgula por ponto
                                        .trim();
                                      const annualNum = parseFloat(cleanPrice);
                                      if (!isNaN(annualNum) && annualNum > 0) {
                                        const monthlyNum = annualNum / 12;
                                        monthlyEquivalent = monthlyNum.toLocaleString('pt-BR', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        });
                                        annualTotal = annualNum.toLocaleString('pt-BR', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        });
                                      }
                                    } catch (e) {
                                      console.error('Erro ao calcular equivalente mensal:', e);
                                    }
                                  }
                                  return monthlyEquivalent ? (
                                    <>
                                      <div className="flex items-baseline justify-center mb-2">
                                        <span className="text-2xl font-medium text-gray-600 mr-2">12x de</span>
                                        <span className="text-4xl font-bold text-gray-900">R$ {monthlyEquivalent}</span>
                                      </div>
                                      <div className="flex flex-col items-center mb-2">
                                        <div className="text-sm text-gray-600">
                                          Total: <span className="font-semibold text-gray-900">R$ {annualTotal}</span> {plan.annualPeriod}
                                        </div>
                                        <div className="text-sm text-gray-400 line-through mt-1">
                                          {plan.price}{plan.period}
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex items-baseline justify-center mb-2">
                                      <span className="text-4xl font-bold text-gray-900">{plan.annualPrice}</span>
                                      <span className="text-gray-600 ml-1">{plan.annualPeriod}</span>
                                    </div>
                                  );
                                })()}
                              </>
                            ) : (
                              <>
                                <div className="flex items-baseline justify-center mb-2">
                                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                                  <span className="text-gray-600 ml-1">{plan.period}</span>
                                </div>
                                {plan.name === 'Básico' && !isAnnual && (
                                  <div className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 mb-2">
                                    7 dias grátis para testar
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                        {plan.discount && plan.name !== 'Premium' && !isAnnual && plan.name !== 'Básico' && (
                          <div className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                            Economize 17% com plano anual
                          </div>
                        )}
                        {plan.discount && plan.name === 'Básico' && !isAnnual && (
                          <div className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                            Economize 17% com plano anual
                          </div>
                        )}
                        {plan.name === 'Premium' && plan.discount && (
                          <div className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-oraculo-purple/10 text-oraculo-purple">
                            {plan.discount}
                          </div>
                        )}
                      </div>

                      {/* Features */}
                      <div className="mb-8">
                        <ul className="space-y-4">
                          {plan.features.map((feature, featureIndex) => (
                            <li key={featureIndex} className="flex items-start gap-3">
                              <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                              <span className="text-gray-700 text-sm">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Módulo Prestação de Contas - Apenas para Essencial */}
                      {plan.name === 'Essencial' && (
                        <div className="mb-8 p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200">
                          <h4 className="text-lg font-bold text-gray-900 mb-4">Módulo Prestação de Contas</h4>
                          <ul className="space-y-3 mb-6">
                            <li className="flex items-start gap-3">
                              <Check className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                              <span className="text-gray-700 text-sm">Analise de notas fiscais com IA</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <Check className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                              <span className="text-gray-700 text-sm">Controle inteligente de rubricas</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <Check className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                              <span className="text-gray-700 text-sm">Documentação de comunicação com fornecedores e financeiro</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <Check className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                              <span className="text-gray-700 text-sm">Cadastro de fornecedores</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <Check className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                              <span className="text-gray-700 text-sm">Export para prestação de contas</span>
                            </li>
                          </ul>
                        </div>
                      )}

                      {/* Button */}
                      {(() => {
                        // Verificar se este é o plano atual do usuário
                        const currentPlanType = userData.planType;
                        let isCurrentPlan = false;
                        
                        if (currentPlanType === 'basico' && plan.name === 'Básico') {
                          isCurrentPlan = true;
                        } else if (currentPlanType === 'essencial' && plan.name === 'Essencial') {
                          isCurrentPlan = true;
                        } else if (currentPlanType === 'premium' && plan.name === 'Premium') {
                          isCurrentPlan = true;
                        }
                        
                        return (
                          <Button
                            onClick={() => {
                              if (isCurrentPlan) return; // Não fazer nada se for o plano atual
                              // Mapear nome do plano para o tipo correto
                              let planType = 'basico';
                              if (plan.name === 'Essencial') {
                                planType = 'essencial';
                              } else if (plan.name === 'Premium') {
                                planType = 'premium';
                              }
                              handlePlanSelection(planType);
                            }}
                            disabled={loading || isCurrentPlan}
                            className={`w-full py-4 text-lg font-semibold ${
                              isCurrentPlan
                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                : plan.popular
                                ? 'bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white'
                                : plan.name === 'Premium'
                                ? 'bg-oraculo-purple hover:bg-oraculo-purple/90 text-white'
                                : 'bg-gray-900 hover:bg-gray-800 text-white'
                            }`}
                          >
                            {loading ? 'Processando...' : isCurrentPlan ? 'Seu plano atual' : plan.buttonText}
                          </Button>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer CTA */}
            <div className="text-center bg-gradient-to-r from-oraculo-blue/5 to-oraculo-purple/5 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Pronto para acelerar seus projetos culturais?
              </h3>
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                Junte-se a centenas de produtores que já transformaram seus projetos com o Oráculo Cultural.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="px-8 py-3"
                >
                  Voltar ao Início
                </Button>
                <Button
                  onClick={() => navigate('/conta')}
                  className="px-8 py-3 bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
                >
                  Minha Conta
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <Dialog open={showLimiteProjetosPopup} onOpenChange={(open) => {
        if (!open) {
          setShowLimiteProjetosPopup(false);
          window.history.replaceState({}, '', '/cadastro-premium');
        }
      }}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Limite de projetos atingido</DialogTitle>
            <DialogDescription className="text-gray-600">
              O máximo de 3 projetos foi atingido. Faça upgrade do seu plano para criar mais projetos.
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => {
              setShowLimiteProjetosPopup(false);
              window.history.replaceState({}, '', '/cadastro-premium');
            }}
            className="w-full mt-4 bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
          >
            Entendi
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CadastroPremium;