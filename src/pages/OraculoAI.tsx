
import React from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Brain, FileText, Target, Lightbulb } from 'lucide-react';

const OraculoAI = () => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        
        <main className="flex-1 p-8 animate-fade-in">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <Brain className="h-8 w-8 text-oraculo-blue" />
                Oráculo AI
              </h1>
              <p className="text-gray-600">
                Sua inteligência artificial especializada em projetos culturais. Analise editais, desenvolva propostas e otimize suas estratégias.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-oraculo-magenta" />
                    Análise de Editais
                  </CardTitle>
                  <CardDescription>
                    Cole o texto do edital e receba insights estratégicos
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5 text-oraculo-blue" />
                    Desenvolvimento de Propostas
                  </CardTitle>
                  <CardDescription>
                    Crie propostas alinhadas com os critérios do edital
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lightbulb className="h-5 w-5 text-oraculo-gold" />
                    Otimização de Estratégias
                  </CardTitle>
                  <CardDescription>
                    Melhore suas chances de aprovação
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Chat com o Oráculo AI</CardTitle>
                <CardDescription>
                  Faça perguntas sobre seu projeto ou cole um edital para análise
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Cole aqui o texto do edital ou faça sua pergunta sobre projetos culturais..."
                  className="min-h-[150px] resize-none"
                />
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">
                    Máximo 10.000 caracteres
                  </p>
                  <Button className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90">
                    Analisar com IA
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default OraculoAI;
