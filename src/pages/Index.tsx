
import React from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { QuickAccessCards } from '@/components/QuickAccessCards';
import { FeaturedGuides } from '@/components/FeaturedGuides';
import { RecentContent } from '@/components/RecentContent';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Brain } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <DashboardSidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <DashboardHeader />
        
        {/* Main Content */}
        <main className="flex-1 p-8 animate-fade-in">
          <div className="max-w-7xl mx-auto">
            {/* Welcome Message */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Bem-vinda ao seu Oráculo Cultural! ✨
              </h1>
              <p className="text-gray-600">
                Aqui você encontra todas as ferramentas e conteúdos para transformar seus projetos culturais em realidade.
              </p>
            </div>

            {/* Quick Access Section */}
            <QuickAccessCards />

            {/* Featured Guides Section */}
            <FeaturedGuides />

            {/* Recent Content Section */}
            <RecentContent />

            {/* Grid of cards for IA Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
              <Card
                className="hover:shadow-lg transition-shadow mb-8"
              >
                <CardHeader>
                  <div className="text-xl font-semibold mb-2">Analisar meu Projeto com a IA</div>
                  <CardDescription className="mb-4">
                    Use o poder da inteligência artificial para analisar e otimizar seu projeto cultural
                  </CardDescription>
                  <button
                    className="bg-oraculo-blue text-white px-6 py-2 rounded font-semibold hover:opacity-90 transition"
                  >
                    Começar agora
                  </button>
                </CardHeader>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
