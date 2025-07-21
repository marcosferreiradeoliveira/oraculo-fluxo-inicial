
import React from 'react';
import { Brain, Headphones, BookOpen, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const quickActions = [
  {
    title: 'Analisar meu Projeto com a IA',
    description: 'Use o poder da inteligência artificial para analisar e otimizar seu projeto cultural',
    icon: Brain,
    gradient: 'from-oraculo-blue to-oraculo-purple',
    href: '/oraculo-ai'
  },
  {
    title: 'Ouvir o Último Podcast',
    description: 'Acompanhe as discussões mais atuais sobre o mercado cultural brasileiro',
    icon: Headphones,
    gradient: 'from-oraculo-purple to-oraculo-magenta',
    href: '/podcast'
  },
  {
    title: 'Explorar a Biblioteca de Guias',
    description: 'Acesse nossa coleção completa de ebooks e estudos estratégicos',
    icon: BookOpen,
    gradient: 'from-oraculo-magenta to-oraculo-gold',
    href: '/biblioteca'
  }
];

export function QuickAccessCards() {
  const navigate = useNavigate();
  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Por onde vamos começar?</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quickActions.map((action) => (
          <Card key={action.title} className="card-hover cursor-pointer group overflow-hidden">
            <CardContent className="p-6">
              <div className={`w-12 h-12 bg-gradient-to-r ${action.gradient} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <action.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{action.title}</h3>
              <p className="text-gray-600 text-sm mb-4">{action.description}</p>
              {action.title === 'Ouvir o Último Podcast' ? (
                <Button
                  variant="ghost"
                  className="p-0 h-auto text-oraculo-blue hover:text-oraculo-purple group"
                  onClick={() => navigate('/podcast')}
                >
                  Começar agora
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              ) : action.title === 'Explorar a Biblioteca de Guias' ? (
                <Button
                  variant="ghost"
                  className="p-0 h-auto text-oraculo-blue hover:text-oraculo-purple group"
                  onClick={() => navigate('/biblioteca')}
                >
                  Começar agora
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              ) : (
                <Button 
                  variant="ghost" 
                  className="p-0 h-auto text-oraculo-blue hover:text-oraculo-purple group"
                >
                  Começar agora
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
