import React, { useState, useEffect } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

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
            const userData = userDoc.data();
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

  const handlePremium = async () => {
    if (!userData.email || !userData.userId) {
      alert('Por favor, faça login para assinar o plano premium.');
      return;
    }

    // Call the onPremiumClick function to log this action
    try {
      const functions = getFunctions();
      const onPremiumClick = httpsCallable(functions, 'onPremiumClick');
      await onPremiumClick({});
    } catch (error) {
      console.error('Error logging premium click:', error);
      // Don't stop the flow if logging fails
    }

    setLoading(true);
    try {
      const res = await fetch('https://analisarprojeto-665760404958.us-central1.run.app/criarAssinaturaPremium', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email,
          userId: userData.userId
        })
      });
      
      const data = await res.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (e) {
      console.error('Erro ao criar assinatura:', e);
      alert('Erro ao processar sua assinatura. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col md:ml-64">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 text-center">
              <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-4">
                Torne-se Membro Premium
              </h1>
              <p className="text-gray-600 text-sm md:text-base max-w-2xl mx-auto">
                Desbloqueie todo o potencial do Oráculo Cultural com recursos exclusivos e suporte prioritário.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl shadow-lg p-10 max-w-lg w-full text-center">
                <h1 className="text-3xl font-bold text-oraculo-blue mb-4">Acesse o Oráculo Premium</h1>
                <p className="text-lg text-gray-700 mb-6">
                  Torne-se premium e tenha acesso ilimitado a todos os guias, podcasts exclusivos, análises avançadas com IA e muito mais!
                </p>
                <ul className="text-left text-gray-600 mb-6 space-y-2">
                  <li>✔️ Baixe quantos guias quiser</li>
                  <li>✔️ Ouça todos os podcasts sem limites</li>
                  <li>✔️ Acesso prioritário a novos conteúdos</li>
                  <li>✔️ Suporte premium</li>
                  <li>✔️ E muito mais!</li>
                </ul>
                <Button 
                  className="w-full bg-oraculo-gold hover:bg-oraculo-gold/90 text-white text-lg py-3 font-semibold mb-2" 
                  onClick={handlePremium}
                  disabled={loading || !userData.email}
                >
                  {loading ? 'Processando...' : 'Assinar Plano Premium - R$29,90/mês'}
                </Button>
                <p className="text-sm text-gray-500 mt-2">
                  Já é premium? Faça login normalmente para acessar todos os recursos.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CadastroPremium; 