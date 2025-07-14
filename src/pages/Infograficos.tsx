
import React from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Download, Eye, Share2 } from 'lucide-react';

const Infograficos = () => {
  const infograficos = [
    {
      titulo: "O Ecossistema do Fomento no Brasil",
      descricao: "Mapa visual completo dos principais órgãos e programas de fomento cultural",
      categoria: "Panorama",
      visualizacoes: 3420,
      downloads: 892,
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop"
    },
    {
      titulo: "Timeline dos Editais 2024",
      descricao: "Cronograma visual com todas as datas importantes dos principais editais",
      categoria: "Planejamento",
      visualizacoes: 2156,
      downloads: 654,
      image: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&h=300&fit=crop"
    },
    {
      titulo: "Anatomia de um Projeto Vencedor",
      descricao: "Estrutura visual dos elementos que fazem projetos serem aprovados",
      categoria: "Estratégia",
      visualizacoes: 4782,
      downloads: 1247,
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop"
    },
    {
      titulo: "Critérios de Avaliação por Área",
      descricao: "Comparativo visual dos critérios mais valorizados em cada linguagem artística",
      categoria: "Avaliação",
      visualizacoes: 1834,
      downloads: 432,
      image: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400&h=300&fit=crop"
    },
    {
      titulo: "Fluxo de Prestação de Contas",
      descricao: "Passo a passo visual para não errar na prestação de contas",
      categoria: "Prestação de Contas",
      visualizacoes: 2967,
      downloads: 789,
      image: "https://images.unsplash.com/photo-1554224154-26032fced8bd?w=400&h=300&fit=crop"
    },
    {
      titulo: "Recursos Disponíveis por Estado",
      descricao: "Mapa interativo dos recursos culturais disponíveis em cada estado brasileiro",
      categoria: "Recursos",
      visualizacoes: 5123,
      downloads: 1567,
      image: "https://images.unsplash.com/photo-1569096959817-56e6e0165f06?w=400&h=300&fit=crop"
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
                <BarChart3 className="h-8 w-8 text-oraculo-blue" />
                Infográficos
              </h1>
              <p className="text-gray-600">
                Visualizações claras e objetivas para entender melhor o universo dos editais culturais.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {infograficos.map((info, index) => (
                <Card key={index} className="hover:shadow-lg transition-all hover:-translate-y-1">
                  <div className="aspect-[4/3] relative overflow-hidden rounded-t-lg">
                    <img 
                      src={info.image} 
                      alt={info.titulo}
                      className="w-full h-full object-cover"
                    />
                    <Badge 
                      className="absolute top-3 left-3 bg-oraculo-magenta/90 text-white"
                    >
                      {info.categoria}
                    </Badge>
                  </div>
                  
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg leading-tight">
                      {info.titulo}
                    </CardTitle>
                    <CardDescription>
                      {info.descricao}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        <span>{info.visualizacoes}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Download className="h-4 w-4" />
                        <span>{info.downloads}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
                        size="sm"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Baixar
                      </Button>
                      <Button variant="outline" size="sm">
                        <Share2 className="h-4 w-4" />
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

export default Infograficos;
