import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Crown, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const ENVIAR_CONTATO_PREMIUM_URL = 'https://us-central1-culturalapp-fb9b0.cloudfunctions.net/enviarContatoPremium';

const ContatoPremium = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    empresa: '',
    telefone: ''
  });
  const [erro, setErro] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setErro('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    
    // Validações
    if (!formData.nome.trim()) {
      setErro('Nome é obrigatório');
      return;
    }
    if (!formData.email.trim()) {
      setErro('Email é obrigatório');
      return;
    }
    if (!formData.empresa.trim()) {
      setErro('Empresa é obrigatória');
      return;
    }
    if (!formData.telefone.trim()) {
      setErro('Telefone é obrigatório');
      return;
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setErro('Email inválido');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch(ENVIAR_CONTATO_PREMIUM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.nome.trim(),
          email: formData.email.trim(),
          empresa: formData.empresa.trim(),
          telefone: formData.telefone.trim(),
        }),
      });
      
      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        throw new Error(data.error || data.message || `Erro ${response.status}`);
      }
      
      toast.success('Solicitação enviada com sucesso! Entraremos em contato em breve.');
      setEnviado(true);
    } catch (error) {
      console.error('Erro ao enviar formulário:', error);
      const msg = error instanceof Error ? error.message : 'Erro ao enviar solicitação. Tente novamente.';
      toast.error(msg);
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  if (enviado) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          
          <main className="flex-1 p-2 md:p-4">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                  Solicitação Enviada!
                </h1>
                
                <p className="text-lg text-gray-600 mb-8">
                  Recebemos sua solicitação de contato para o plano Premium Enterprise.
                  <br />
                  <strong className="text-gray-900">Entraremos em contato em breve!</strong>
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    onClick={() => navigate('/cadastro-premium')}
                    variant="outline"
                    className="px-8 py-3"
                  >
                    Voltar aos Planos
                  </Button>
                  <Button
                    onClick={() => navigate('/')}
                    className="px-8 py-3 bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
                  >
                    Ir para Início
                  </Button>
                </div>
              </div>
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
        
        <main className="flex-1 p-2 md:p-4">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white mb-4">
                <Crown className="h-8 w-8" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Plano Premium Enterprise
              </h1>
              <p className="text-xl text-gray-600">
                Preencha o formulário abaixo e entraremos em contato para apresentar o plano ideal para sua empresa
              </p>
            </div>

            {/* Form */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-2">
                    Nome *
                  </label>
                  <Input
                    id="nome"
                    name="nome"
                    type="text"
                    value={formData.nome}
                    onChange={handleChange}
                    required
                    className="w-full"
                    placeholder="Seu nome completo"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full"
                    placeholder="seu@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="empresa" className="block text-sm font-medium text-gray-700 mb-2">
                    Empresa *
                  </label>
                  <Input
                    id="empresa"
                    name="empresa"
                    type="text"
                    value={formData.empresa}
                    onChange={handleChange}
                    required
                    className="w-full"
                    placeholder="Nome da sua empresa"
                  />
                </div>

                <div>
                  <label htmlFor="telefone" className="block text-sm font-medium text-gray-700 mb-2">
                    Telefone *
                  </label>
                  <Input
                    id="telefone"
                    name="telefone"
                    type="tel"
                    value={formData.telefone}
                    onChange={handleChange}
                    required
                    className="w-full"
                    placeholder="(00) 00000-0000"
                  />
                </div>

                {erro && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 text-sm">{erro}</p>
                  </div>
                )}

                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white"
                  >
                    {loading ? 'Enviando...' : 'Enviar Solicitação'}
                  </Button>
                </div>

                <p className="text-sm text-gray-500 text-center mt-4">
                  * Campos obrigatórios
                </p>
              </form>
            </div>

            {/* Footer */}
            <div className="text-center mt-8">
              <Button
                onClick={() => navigate('/cadastro-premium')}
                variant="outline"
                className="px-6 py-2"
              >
                ← Voltar aos Planos
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ContatoPremium;

