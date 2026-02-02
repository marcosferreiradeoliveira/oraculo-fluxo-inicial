import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, CreditCard, Calendar, AlertCircle, ArrowUp, X, CheckCircle, Clock, Sparkles, User, ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SubscriptionData {
  planType: string;
  status: string;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  amount: number;
  currency: string;
  interval: string;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  date: number;
  status: string;
  description: string;
}

const GerenciarAssinatura = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hasPendingSession, setHasPendingSession] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const db = getFirestore();
          const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
          let userDoc;
          
          // Tentar getDocFromServer primeiro, se falhar usar getDoc como fallback
          try {
            userDoc = await getDocFromServer(userDocRef);
          } catch (serverError) {
            console.warn('[GerenciarAssinatura] getDocFromServer falhou, usando getDoc:', serverError);
            userDoc = await getDoc(userDocRef);
          }
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            console.log('[GerenciarAssinatura] Dados do usuário carregados:', {
              isPremium: data.isPremium,
              stripeSubscriptionId: data.stripeSubscriptionId,
              planType: data.planType,
              premiumStatus: data.premiumStatus,
              stripeCustomerId: data.stripeCustomerId
            });
            setUserData(data);
            
            // Buscar dados da assinatura se tiver subscriptionId
            if (data.stripeSubscriptionId) {
              console.log('[GerenciarAssinatura] Carregando dados da assinatura:', data.stripeSubscriptionId);
              await carregarDadosAssinatura(data.stripeSubscriptionId);
              await carregarPagamentos(data.stripeSubscriptionId);
            } else {
              console.log('[GerenciarAssinatura] Nenhuma subscriptionId encontrada, verificando sessões pendentes');
              // Verificar se há sessões pendentes
              await verificarSessoesPendentes(firebaseUser.uid);
            }
          } else {
            console.log('[GerenciarAssinatura] Documento do usuário não encontrado');
          }
        } catch (error) {
          console.error('[GerenciarAssinatura] Erro ao carregar dados:', error);
          toast.error('Erro ao carregar dados da assinatura');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const verificarSessoesPendentes = async (userId: string) => {
    try {
      const db = getFirestore();
      const sessionsRef = collection(db, 'stripe_sessions');
      const q = query(
        sessionsRef,
        where('userId', '==', userId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      setHasPendingSession(!querySnapshot.empty);
    } catch (error) {
      console.error('Erro ao verificar sessões pendentes:', error);
    }
  };

  const sincronizarAssinatura = async () => {
    if (!user) return;
    
    setSyncing(true);
    try {
      // Buscar assinaturas do Stripe para este usuário
      const response = await fetch('https://us-central1-culturalapp-fb9b0.cloudfunctions.net/sincronizarAssinaturaUsuario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
        }),
      });

      if (response.ok) {
        toast.success('Assinatura sincronizada com sucesso!');
        // Recarregar dados do usuário
        const db = getFirestore();
        const userDocRef = doc(db, 'usuarios', user.uid);
        const userDoc = await getDocFromServer(userDocRef);
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          
          if (data.stripeSubscriptionId) {
            await carregarDadosAssinatura(data.stripeSubscriptionId);
            await carregarPagamentos(data.stripeSubscriptionId);
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Erro ao sincronizar assinatura');
      }
    } catch (error) {
      console.error('Erro ao sincronizar assinatura:', error);
      toast.error('Erro ao sincronizar assinatura');
    } finally {
      setSyncing(false);
    }
  };

  const carregarDadosAssinatura = async (subscriptionId: string) => {
    try {
      const response = await fetch('https://us-central1-culturalapp-fb9b0.cloudfunctions.net/buscarDetalhesAssinatura', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscriptionId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSubscriptionData(data);
      } else {
        console.error('Erro ao buscar detalhes da assinatura');
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes da assinatura:', error);
    }
  };

  const carregarPagamentos = async (subscriptionId: string) => {
    setLoadingPayments(true);
    try {
      const response = await fetch('https://us-central1-culturalapp-fb9b0.cloudfunctions.net/listarPagamentosAssinatura', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscriptionId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPayments(data.payments || []);
      } else {
        console.error('Erro ao buscar pagamentos');
      }
    } catch (error) {
      console.error('Erro ao buscar pagamentos:', error);
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleCancelarAssinatura = async () => {
    if (!userData?.stripeSubscriptionId) {
      toast.error('Assinatura não encontrada');
      return;
    }

    setCanceling(true);
    try {
      const response = await fetch('https://us-central1-culturalapp-fb9b0.cloudfunctions.net/cancelarAssinatura', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: userData.stripeSubscriptionId,
        }),
      });

      if (response.ok) {
        toast.success('Assinatura cancelada com sucesso. Você terá acesso até o final do período pago.');
        setShowCancelDialog(false);
        // Recarregar dados
        await carregarDadosAssinatura(userData.stripeSubscriptionId);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erro ao cancelar assinatura');
      }
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      toast.error('Erro ao cancelar assinatura');
    } finally {
      setCanceling(false);
    }
  };

  const handleUpgrade = () => {
    navigate('/cadastro-premium');
  };

  const formatarData = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatarMoeda = (amount: number, currency: string = 'brl') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getPlanName = (planType: string) => {
    switch (planType) {
      case 'premium':
        return 'Premium Enterprise';
      case 'essencial':
        return 'Essencial';
      case 'basico':
        return 'Básico';
      default:
        return 'Desconhecido';
    }
  };

  const getPlanPrice = (planType: string) => {
    switch (planType) {
      case 'premium':
        return 'R$ 1,00';
      case 'essencial':
        return 'R$ 349,00';
      case 'basico':
        return 'R$ 99,00';
      default:
        return '-';
    }
  };

  const getPlanBenefits = (planType: string) => {
    switch (planType) {
      case 'premium':
        return [
          'Todas as funcionalidades do Essencial',
          'Export para prestação de contas',
          'Customização de critérios para avaliação de notas com IA',
          'Desenvolvimento de módulos customizados',
          'Usuários Ilimitados',
          'Projetos Ilimitados',
        ];
      case 'essencial':
        return [
          'Todas as funcionalidades do Básico',
          'Geração Automática e Inteligente de textos de projeto (justificativa/objetivos)',
          'Auditoria financeira prévia: Comparação do orçamento com índices de mercado',
          'Módulo Execução completo (Controle de rubricas, importação de notas fiscais)',
          'Até 5 usuários',
          'Infinitos projetos',
        ];
      case 'basico':
        return [
          'Importação automática e detalhamento de Editais',
          'Acesso ao Polo de Conhecimento (e-books, podcasts)',
          'Avaliação Inteligente do Projeto com notas e sugestões iniciais',
          '1 usuário',
          'Até 3 projetos ativos/ano',
        ];
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 p-4 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oraculo-blue mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando dados da assinatura...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Debug: log dos dados antes da verificação
  console.log('[GerenciarAssinatura] Verificando condições:', {
    hasUserData: !!userData,
    isPremium: userData?.isPremium,
    stripeSubscriptionId: userData?.stripeSubscriptionId,
    planType: userData?.planType,
    premiumStatus: userData?.premiumStatus,
    shouldShowNoSubscription: !userData?.isPremium || !userData?.stripeSubscriptionId
  });

  // Verificar se tem assinatura ativa: precisa ter subscriptionId E (isPremium OU premiumStatus active)
  const hasActiveSubscription = userData?.stripeSubscriptionId && 
    (userData?.isPremium || userData?.premiumStatus === 'active');

  if (!hasActiveSubscription) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 p-4">
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Nenhuma assinatura ativa</h2>
                    <p className="text-gray-600 mb-6">
                      {hasPendingSession 
                        ? 'Sua assinatura está sendo processada. Isso pode levar alguns minutos. Clique em "Sincronizar" para atualizar.'
                        : 'Você não possui uma assinatura ativa no momento.'}
                    </p>
                    <div className="flex gap-4 justify-center">
                      {hasPendingSession && (
                        <Button 
                          onClick={sincronizarAssinatura} 
                          disabled={syncing}
                          variant="outline"
                          className="border-oraculo-blue text-oraculo-blue hover:bg-oraculo-blue/10"
                        >
                          {syncing ? 'Sincronizando...' : 'Sincronizar Assinatura'}
                        </Button>
                      )}
                      <Button onClick={() => navigate('/cadastro-premium')} className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple">
                        Assinar Agora
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
        <main className="flex-1 p-4">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <Button
                  onClick={() => navigate('/conta')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Minha Conta
                </Button>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Gerenciar Assinatura</h1>
                <p className="text-gray-600">Gerencie sua assinatura, visualize pagamentos e altere seu plano</p>
              </div>
            </div>

            {/* Informações da Assinatura Atual */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-oraculo-gold" />
                  Assinatura Atual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Plano</p>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-gradient-to-r from-oraculo-gold to-oraculo-magenta text-white">
                        {getPlanName(userData?.planType || 'basico')}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Valor</p>
                    <p className="text-xl font-bold text-gray-900">{getPlanPrice(userData?.planType || 'basico')}/mês</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Status</p>
                    <Badge 
                      className={
                        subscriptionData?.status === 'active' && !subscriptionData?.cancelAtPeriodEnd
                          ? 'bg-green-500 text-white'
                          : subscriptionData?.cancelAtPeriodEnd
                          ? 'bg-yellow-500 text-white'
                          : 'bg-gray-500 text-white'
                      }
                    >
                      {subscriptionData?.cancelAtPeriodEnd 
                        ? 'Cancelando no final do período' 
                        : subscriptionData?.status === 'active'
                        ? 'Ativa'
                        : subscriptionData?.status || 'Carregando...'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Próxima cobrança</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {subscriptionData?.currentPeriodEnd 
                        ? formatarData(subscriptionData.currentPeriodEnd)
                        : 'Carregando...'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex gap-4">
                  <Button 
                    onClick={handleUpgrade}
                    className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple"
                  >
                    <ArrowUp className="h-4 w-4 mr-2" />
                    Alterar Plano
                  </Button>
                  {!subscriptionData?.cancelAtPeriodEnd && (
                    <Button 
                      variant="outline"
                      onClick={() => setShowCancelDialog(true)}
                      className="border-red-500 text-red-500 hover:bg-red-50"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar Assinatura
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Box de Benefícios */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-oraculo-purple" />
                  Benefícios do Plano
                </CardTitle>
                <CardDescription>
                  Recursos e funcionalidades incluídos no seu plano atual
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getPlanBenefits(userData?.planType || 'basico').map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{benefit}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Histórico de Pagamentos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-oraculo-blue" />
                  Histórico de Pagamentos
                </CardTitle>
                <CardDescription>Visualize todos os pagamentos realizados</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPayments ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oraculo-blue mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando pagamentos...</p>
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-8">
                    <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Nenhum pagamento encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {payments.map((payment) => (
                      <div 
                        key={payment.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${
                            payment.status === 'paid' 
                              ? 'bg-green-100 text-green-600' 
                              : payment.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-600'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {payment.status === 'paid' ? (
                              <CheckCircle className="h-5 w-5" />
                            ) : (
                              <Clock className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{payment.description}</p>
                            <p className="text-sm text-gray-600">{formatarData(payment.date)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{formatarMoeda(payment.amount, payment.currency)}</p>
                          <Badge 
                            className={
                              payment.status === 'paid'
                                ? 'bg-green-500 text-white'
                                : payment.status === 'pending'
                                ? 'bg-yellow-500 text-white'
                                : 'bg-gray-500 text-white'
                            }
                          >
                            {payment.status === 'paid' ? 'Pago' : payment.status === 'pending' ? 'Pendente' : 'Falhou'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Dialog de Cancelamento */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Assinatura</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar sua assinatura? Você continuará tendo acesso até{' '}
              {subscriptionData?.currentPeriodEnd 
                ? formatarData(subscriptionData.currentPeriodEnd)
                : 'o final do período pago'}.
              Após essa data, você perderá o acesso aos recursos premium.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} disabled={canceling}>
              Não, manter assinatura
            </Button>
            <Button 
              onClick={handleCancelarAssinatura} 
              disabled={canceling}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {canceling ? 'Cancelando...' : 'Sim, cancelar assinatura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GerenciarAssinatura;

