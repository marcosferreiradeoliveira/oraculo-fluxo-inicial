
import React from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Brain, FileText, Target, Lightbulb, FolderOpen, Calendar, MapPin, Clock, DollarSign, Plus } from 'lucide-react';

const OraculoAI = () => {
  const meusProjetos = [
    {
      nome: "Festival de Música Independente",
      status: "Em andamento",
      edital: "Funarte - Ações Continuadas 2025",
      ultimaAnalise: "3 dias atrás",
      statusColor: "bg-oraculo-blue"
    },
    {
      nome: "Oficinas de Teatro Comunitário",
      status: "Aguardando resultado",
      edital: "SECEC-RJ - Literatura",
      ultimaAnalise: "1 semana atrás",
      statusColor: "bg-oraculo-gold"
    },
    {
      nome: "Exposição Arte Digital",
      status: "Rascunho",
      edital: "Lei Aldir Blanc",
      ultimaAnalise: "2 semanas atrás",
      statusColor: "bg-gray-400"
    }
  ];

  const editaisAbertos = [
    {
      titulo: "Funarte - Ações Continuadas 2025",
      orgao: "Fundação Nacional de Artes",
      valor: "R$ 120.000",
      prazo: "15 dias",
      area: "Múltiplas linguagens",
      dificuldade: "Alta"
    },
    {
      titulo: "SECEC-RJ - Fomento à Literatura",
      orgao: "Secretaria de Cultura do RJ",
      valor: "R$ 50.000",
      prazo: "8 dias",
      area: "Literatura",
      dificuldade: "Média"
    },
    {
      titulo: "Lei Aldir Blanc - Municipais",
      orgao: "Prefeituras participantes",
      valor: "R$ 30.000",
      prazo: "22 dias",
      area: "Cultura popular",
      dificuldade: "Baixa"
    },
    {
      titulo: "ProAC - Editais Regulares",
      orgao: "Governo do Estado de SP",
      valor: "R$ 80.000",
      prazo: "30 dias",
      area: "Artes visuais",
      dificuldade: "Média"
    }
  ];

  const getDificuldadeColor = (dificuldade: string) => {
    switch (dificuldade) {
      case 'Baixa': return 'bg-green-500';
      case 'Média': return 'bg-oraculo-gold';
      case 'Alta': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

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

            {/* Seção Meus Projetos Culturais */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FolderOpen className="h-6 w-6 text-oraculo-blue" />
                  Meus Projetos Culturais
                </h2>
                <Button className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Projeto
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {meusProjetos.map((projeto, index) => (
                  <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-2">{projeto.nome}</CardTitle>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2 h-2 rounded-full ${projeto.statusColor}`}></div>
                            <span className="text-sm font-medium">{projeto.status}</span>
                          </div>
                        </div>
                      </div>
                      <CardDescription className="space-y-1">
                        <div className="flex items-center gap-1 text-xs">
                          <FileText className="h-3 w-3" />
                          {projeto.edital}
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <Clock className="h-3 w-3" />
                          Última análise: {projeto.ultimaAnalise}
                        </div>
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>

            {/* Seção Editais Abertos */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="h-6 w-6 text-oraculo-magenta" />
                  Editais Abertos
                </h2>
                <Button variant="outline">
                  Ver todos os editais
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {editaisAbertos.map((edital, index) => (
                  <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between mb-2">
                        <CardTitle className="text-lg flex-1">{edital.titulo}</CardTitle>
                        <Badge className={`${getDificuldadeColor(edital.dificuldade)} text-white`}>
                          {edital.dificuldade}
                        </Badge>
                      </div>
                      <CardDescription className="space-y-2">
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3" />
                          {edital.orgao}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {edital.valor}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {edital.prazo}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">{edital.area}</div>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button variant="outline" className="w-full">
                        Analisar com IA
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
