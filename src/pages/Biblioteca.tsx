
import React from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Download, Star } from 'lucide-react';

const Biblioteca = () => {
  const guias = [
    {
      title: "Guia Funarte Ações Continuadas 2025",
      description: "Estratégias completas para projetos de ações continuadas",
      category: "Editais Federais",
      rating: 4.9,
      downloads: 1247,
      image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=300&h=200&fit=crop"
    },
    {
      title: "Guia Editais de Literatura SECEC-RJ",
      description: "Como estruturar projetos literários para editais estaduais",
      category: "Literatura",
      rating: 4.8,
      downloads: 892,
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=200&fit=crop"
    },
    {
      title: "Guia PNAB - O que você precisa saber",
      description: "Plano Nacional Aldir Blanc: todas as oportunidades",
      category: "Políticas Públicas",
      rating: 4.9,
      downloads: 2156,
      image: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=300&h=200&fit=crop"
    },
    {
      title: "O Guia do Orçamento Perfeito",
      description: "Como elaborar orçamentos que impressionam avaliadores",
      category: "Gestão Financeira",
      rating: 4.7,
      downloads: 1534,
      image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=300&h=200&fit=crop"
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
                <BookOpen className="h-8 w-8 text-oraculo-blue" />
                Biblioteca de Guias
              </h1>
              <p className="text-gray-600">
                Acesse nossa coleção completa de guias estratégicos, ebooks e estudos especializados em cultura.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {guias.map((guia, index) => (
                <Card key={index} className="hover:shadow-lg transition-all hover:-translate-y-1">
                  <div className="aspect-video relative overflow-hidden rounded-t-lg">
                    <img 
                      src={guia.image} 
                      alt={guia.title}
                      className="w-full h-full object-cover"
                    />
                    <Badge 
                      className="absolute top-3 left-3 bg-oraculo-magenta/90 text-white"
                    >
                      {guia.category}
                    </Badge>
                  </div>
                  
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg leading-tight">
                      {guia.title}
                    </CardTitle>
                    <CardDescription>
                      {guia.description}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-oraculo-gold text-oraculo-gold" />
                        <span className="text-sm font-medium">{guia.rating}</span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {guia.downloads} downloads
                      </span>
                    </div>
                    
                    <Button className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90">
                      <Download className="h-4 w-4 mr-2" />
                      Baixar Guia
                    </Button>
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

export default Biblioteca;
