import React from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { HelpCircle, MessageCircle, Book, Phone, Mail, Clock } from 'lucide-react';

const Suporte = () => {
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col md:ml-64">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Formas de Contato */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center pb-3">
                  <MessageCircle className="h-12 w-12 text-oraculo-blue mx-auto mb-3" />
                  <CardTitle>Chat ao Vivo</CardTitle>
                  <CardDescription>
                    Resposta imediata para dúvidas urgentes
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <Badge className="bg-green-100 text-green-800 mb-3">
                    <Clock className="h-3 w-3 mr-1" />
                    Online agora
                  </Badge>
                  <Button className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90">
                    Iniciar Chat
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center pb-3">
                  <Mail className="h-12 w-12 text-oraculo-magenta mx-auto mb-3" />
                  <CardTitle>Email</CardTitle>
                  <CardDescription>
                    Para questões mais complexas e detalhadas
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-sm text-gray-600 mb-3">
                    Resposta em até 24h
                  </p>
                  <Button variant="outline" className="w-full">
                    suporte@oraculocultural.com
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center pb-3">
                  <Book className="h-12 w-12 text-oraculo-gold mx-auto mb-3" />
                  <CardTitle>Base de Conhecimento</CardTitle>
                  <CardDescription>
                    Tutoriais e guias de uso da plataforma
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-sm text-gray-600 mb-3">
                    +50 artigos disponíveis
                  </p>
                  <Button variant="outline" className="w-full">
                    Explorar Artigos
                  </Button>
                </CardContent>
              </Card>
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
                  <form className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="assunto">Assunto</Label>
                      <Input id="assunto" placeholder="Qual é o tema da sua dúvida?" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Seu Email</Label>
                      <Input id="email" type="email" placeholder="seu@email.com" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="mensagem">Mensagem</Label>
                      <Textarea 
                        id="mensagem" 
                        placeholder="Descreva sua dúvida ou problema em detalhes..."
                        className="min-h-[120px] resize-none"
                      />
                    </div>
                    
                    <Button className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90">
                      Enviar Mensagem
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
