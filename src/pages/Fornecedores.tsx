import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { FornecedoresPainel } from '@/components/fornecedores/FornecedoresPainel';

export default function Fornecedores() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
          <FornecedoresPainel />
        </main>
      </div>
    </div>
  );
}
