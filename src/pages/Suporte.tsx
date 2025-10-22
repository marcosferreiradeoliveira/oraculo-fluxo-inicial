import React, { useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import emailjs from '@emailjs/browser';

const Suporte = () => {
  const [assunto, setAssunto] = useState('');
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  const faqItems = [
    {
      pergunta: "Como funciona o Oráculo AI?",
      resposta: "Nossa IA analisa editais e projetos culturais usando algoritmos especializados...",
      categoria: "IA"
    },
    {
      pergunta: "Posso cancelar minha assinatura a qualquer momento?",
      resposta: "Sim, você pode cancelar sua assinatura a qualquer momento através da área de conta...",
      categoria: "Assinatura"
    },
    {
      pergunta: "Os guias são atualizados regularmente?",
      resposta: "Sim, nossa equipe atualiza os guias sempre que há mudanças nos editais...",
      categoria: "Conteúdo"
    },
    {
      pergunta: "Como baixar os infográficos?",
      resposta: "Clique no botão 'Baixar' em qualquer infográfico para fazer download em alta resolução...",
      categoria: "Recursos"
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!assunto.trim() || !email.trim() || !mensagem.trim()) {
      toast.error('Por favor, preencha todos os campos');
      return;
    }

    if (!email.includes('@')) {
      toast.error('Por favor, insira um email válido');
      return;
    }

    setEnviando(true);
    
    try {
      // Configurar EmailJS
      const serviceId = 'service_7c0g6tp';
      const templateId = 'template_gnb12x7';
      const publicKey = '5kHIvMHjw-9HBbLeW';
      
      // Dados do template
      const templateParams = {
        from_name: email,
        from_email: email,
        subject: assunto,
        message: mensagem,
        to_name: 'Equipe Oráculo Cultural'
      };
      
      // Enviar email
      await emailjs.send(serviceId, templateId, templateParams, publicKey);
      
      toast.success('Mensagem enviada com sucesso! Entraremos em contato em breve.');
      
      // Limpar formulário
      setAssunto('');
      setEmail('');
      setMensagem('');
      
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <HelpCircle className="h-8 w-8 text-oraculo-blue" />
                Centro de Suporte
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Estamos aqui para ajudar. Encontre respostas para suas dúvidas ou entre em contato com nossa equipe.
              </p>
            </div>


            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* FAQ */}
              <Card>
                <CardHeader>
                  <CardTitle>Perguntas Frequentes</CardTitle>
                  <CardDescription>
                    Respostas para as dúvidas mais comuns
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {faqItems.map((item, index) => (
                      <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900 flex-1">
                            {item.pergunta}
                          </h4>
                          <Badge variant="secondary" className="ml-2">
                            {item.categoria}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          {item.resposta}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full mt-4">
                    Ver Todas as Perguntas
                  </Button>
                </CardContent>
              </Card>

              {/* Formulário de Contato */}
              <Card>
                <CardHeader>
                  <CardTitle>Envie sua Dúvida</CardTitle>
                  <CardDescription>
                    Não encontrou a resposta? Entre em contato conosco
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="assunto">Assunto</Label>
                      <Input 
                        id="assunto" 
                        value={assunto}
                        onChange={(e) => setAssunto(e.target.value)}
                        placeholder="Qual é o tema da sua dúvida?"
                        disabled={enviando}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Seu Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        disabled={enviando}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="mensagem">Mensagem</Label>
                      <Textarea 
                        id="mensagem" 
                        value={mensagem}
                        onChange={(e) => setMensagem(e.target.value)}
                        placeholder="Descreva sua dúvida ou problema em detalhes..."
                        className="min-h-[120px] resize-none"
                        disabled={enviando}
                        required
                      />
                    </div>
                    
                    <Button 
                      type="submit"
                      className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
                      disabled={enviando}
                    >
                      {enviando ? 'Enviando...' : 'Enviar Mensagem'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Suporte;
