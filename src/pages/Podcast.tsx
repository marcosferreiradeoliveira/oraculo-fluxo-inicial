
import React from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Headphones, Play, Clock, Calendar } from 'lucide-react';

const Podcast = () => {
  const episodios = [
    {
      numero: 45,
      titulo: "Acessibilidade Atitudinal: O Diferencial na Avaliação",
      descricao: "Como projetos inclusivos conquistam mais pontos nos editais",
      duracao: "32 min",
      data: "15 Jan 2024",
      categoria: "Inclusão",
      destaque: true
    },
    {
      numero: 44,
      titulo: "Orçamento que Convence: Estratégias Práticas",
      descricao: "Dicas para elaborar planilhas orçamentárias impecáveis",
      duracao: "28 min",
      data: "08 Jan 2024",
      categoria: "Gestão"
    },
    {
      numero: 43,
      titulo: "Lei Paulo Gustavo: Oportunidades em 2024",
      descricao: "Análise completa dos recursos disponíveis este ano",
      duracao: "35 min",
      data: "01 Jan 2024",
      categoria: "Editais"
    },
    {
      numero: 42,
      titulo: "Contrapartida Social: Como Elaborar e Executar",
      descricao: "Exemplos práticos de contrapartidas que impressionam",
      duracao: "25 min",
      data: "25 Dez 2023",
      categoria: "Estratégia"
    }
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        
        <main className="flex-1 p-8 animate-fade-in">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <Headphones className="h-8 w-8 text-oraculo-blue" />
                Podcast Oráculo Cultural
              </h1>
              <p className="text-gray-600">
                Insights semanais sobre o universo dos editais e projetos culturais, direto dos especialistas.
              </p>
            </div>

            {/* Episódio em Destaque */}
            <Card className="mb-8 bg-gradient-to-r from-oraculo-blue/5 to-oraculo-purple/5 border-oraculo-blue/20">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-oraculo-magenta text-white">Mais Recente</Badge>
                  <Badge variant="outline">Episódio #{episodios[0].numero}</Badge>
                </div>
                <CardTitle className="text-2xl">{episodios[0].titulo}</CardTitle>
                <CardDescription className="text-lg">
                  {episodios[0].descricao}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 mb-6">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>{episodios[0].duracao}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>{episodios[0].data}</span>
                  </div>
                  <Badge variant="secondary">{episodios[0].categoria}</Badge>
                </div>
                <Button size="lg" className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90">
                  <Play className="h-5 w-5 mr-2" />
                  Reproduzir Episódio
                </Button>
              </CardContent>
            </Card>

            {/* Lista de Episódios */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Todos os Episódios</h2>
              
              {episodios.map((episodio, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            #{episodio.numero}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {episodio.categoria}
                          </Badge>
                        </div>
                        
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {episodio.titulo}
                        </h3>
                        
                        <p className="text-gray-600 mb-3">
                          {episodio.descricao}
                        </p>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{episodio.duracao}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{episodio.data}</span>
                          </div>
                        </div>
                      </div>
                      
                      <Button variant="outline" className="ml-4">
                        <Play className="h-4 w-4 mr-2" />
                        Ouvir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Podcast;
