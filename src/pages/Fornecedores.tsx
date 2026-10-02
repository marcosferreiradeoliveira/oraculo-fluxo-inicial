import React from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { FornecedoresPainel } from '@/components/fornecedores/FornecedoresPainel';

const Fornecedores = () => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />

      <div className="flex-1 flex flex-col">
        <DashboardHeader />

        <main className="flex-1 p-2 md:p-4 animate-fade-in">
          <div className="max-w-7xl mx-auto">
            <FornecedoresPainel />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Fornecedores;
