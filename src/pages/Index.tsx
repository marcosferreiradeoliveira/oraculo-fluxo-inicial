
import React from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { QuickAccessCards } from '@/components/QuickAccessCards';
import { FeaturedGuides } from '@/components/FeaturedGuides';
import { RecentContent } from '@/components/RecentContent';

const Index = () => {
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
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
