import React from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const CadastroPremium = () => {
  const navigate = useNavigate();

  const handlePremium = async () => {
    try {
      const res = await fetch('https://analisarprojeto-665760404958.us-central1.run.app/criarCheckoutPremium', { method: 'POST' });
      const data = await res.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        alert('Erro ao iniciar pagamento. Tente novamente.');
      }
    } catch (e) {
      alert('Erro ao iniciar pagamento. Tente novamente.');
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 p-8 flex items-center justify-center animate-fade-in">
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
            <Button className="w-full bg-oraculo-gold text-white text-lg py-3 font-semibold mb-2" onClick={handlePremium}>
              Quero ser Premium
            </Button>
            <p className="text-sm text-gray-500 mt-2">
              Já é premium? Faça login normalmente para acessar todos os recursos.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CadastroPremium; 