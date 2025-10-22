import React, { useState, useEffect } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Check, Star, Users, Building2, Crown } from 'lucide-react';

const CadastroPremium = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState({ email: '', userId: '' });

  useEffect(() => {
    const fetchUserData = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (user) {
        try {
          const db = getFirestore();
          const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
          if (userDoc.exists()) {
            setUserData({
              email: user.email || '',
              userId: user.uid
            });
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };

    fetchUserData();
  }, []);

  const handlePlanSelection = async (planType: string) => {
    if (!userData.email || !userData.userId) {
      alert('Por favor, faça login para assinar um plano.');
      return;
    }

    setLoading(true);
    try {
      const functions = getFunctions();
      const criarCheckoutPremium = httpsCallable(functions, 'criarCheckoutPremium');
      const result = await criarCheckoutPremium({ 
        planType,
        userEmail: userData.email,
        userId: userData.userId
      });
      
      if (result.data && (result.data as any).init_point) {
        window.open((result.data as any).init_point, '_blank');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert('Erro ao processar pagamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const plans = [
    {
      name: 'Básico',
      subtitle: 'Produtor Iniciante ou Individual',
      description: '1 usuário, até 3 projetos ativos/ano',
      focus: 'Criação (Foco na Captação)',
      price: 'R$ 99',
      period: '/mês',
      annualPrice: 'R$ 990',
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
      description: '3-5 usuários, até 10 projetos ativos/ano',
      focus: 'Criação e Execução (Foco em Captação e Conformidade)',
      price: 'R$ 349',
      period: '/mês',
      annualPrice: 'R$ 3,490',
      annualPeriod: '/ano',
      discount: '17% de desconto',
      features: [
        'Todas as funcionalidades do Básico',
        'Geração Automática e Inteligente de textos de projeto (justificativa/objetivos)',
        'Auditoria financeira prévia: Comparação do orçamento com índices de mercado',
        'Módulo Execução completo (Controle de rubricas, importação de notas fiscais)'
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
      price: 'Sob Consulta',
      period: '',
      annualPrice: '',
      annualPeriod: '',
      discount: 'Modelo Enterprise com Venda Consultiva',
      features: [
        'Todas as funcionalidades do Essencial',
        'Armazenamento de Histórico da Empresa para adequação de projetos',
        'Dashboard Estatístico em Tempo Real (LTV, perdas/ganhos, clipping)',
        'IA para Validação Rigorosa de Notas Fiscais com todos os requisitos de Edital',
        'Envio de mensagens automatizado aos fornecedores'
      ],
      buttonText: 'Falar com Vendas',
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
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Planos e Preços
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Escolha o plano ideal para o seu perfil e acelere seus projetos culturais
              </p>
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
                        <div className="flex items-baseline justify-center mb-2">
                          <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                          <span className="text-gray-600 ml-1">{plan.period}</span>
                        </div>
                        {plan.annualPrice && (
                          <div className="flex items-baseline justify-center mb-2">
                            <span className="text-lg text-gray-600">ou {plan.annualPrice}</span>
                            <span className="text-gray-600 ml-1">{plan.annualPeriod}</span>
                          </div>
                        )}
                        {plan.discount && (
                          <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                            plan.name === 'Premium' 
                              ? 'bg-oraculo-purple/10 text-oraculo-purple' 
                              : 'bg-green-100 text-green-700'
                          }`}>
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

                      {/* Button */}
                      <Button
                        onClick={() => handlePlanSelection(plan.name.toLowerCase())}
                        disabled={loading}
                        className={`w-full py-4 text-lg font-semibold ${
                          plan.popular
                            ? 'bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white'
                            : plan.name === 'Premium'
                            ? 'bg-oraculo-purple hover:bg-oraculo-purple/90 text-white'
                            : 'bg-gray-900 hover:bg-gray-800 text-white'
                        }`}
                      >
                        {loading ? 'Processando...' : plan.buttonText}
                      </Button>
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
    </div>
  );
};

export default CadastroPremium;