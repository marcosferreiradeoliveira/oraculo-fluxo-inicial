import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ArrowRight } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';

interface ProjetoDocument {
  id: string;
  nome?: string;
  [key: string]: any;
}

const CriarCronograma = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [projeto, setProjeto] = useState<ProjetoDocument | null>(null);
  const [loading, setLoading] = useState(true);

  const steps = ['Criar Projeto', 'Avaliar com IA', 'Alterar com IA', 'Gerar Textos', 'Criar Orçamento', 'Criar Cronograma', 'Preencher Anexos'];
  const currentStep = 5;

  useEffect(() => {
    const fetchProjeto = async () => {
      if (!id || !user) {
        setLoading(false);
        return;
      }

      try {
        const db = getFirestore();
        const projetoRef = doc(db, 'projetos', id);
        const projetoSnap = await getDoc(projetoRef);
        
        if (projetoSnap.exists()) {
          setProjeto({ id: projetoSnap.id, ...projetoSnap.data() } as ProjetoDocument);
        }
      } catch (error) {
        console.error('Erro ao carregar projeto:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjeto();
  }, [id, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 flex items-center justify-center p-8">
            <p className="text-gray-600">Carregando...</p>
          </main>
        </div>
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 flex items-center justify-center p-8">
            <p className="text-gray-600">Projeto não encontrado</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Criar Cronograma
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Cronograma do projeto "{projeto.nome || 'sem nome'}"
              </p>
            </div>

            {/* Barra de progresso */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                {steps.map((step, index) => {
                  const isClickable = index <= currentStep;
                  return (
                    <div
                      key={index}
                      className={`flex flex-col items-center ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                      onClick={() => {
                        if (isClickable) {
                          const routes = [
                            `/projeto/${id}`,
                            `/projeto/${id}`,
                            `/projeto/${id}/alterar-com-ia`,
                            `/projeto/${id}/gerar-textos`,
                            `/projeto/${id}/criar-orcamento`,
                            `/projeto/${id}/criar-cronograma`,
                            `/projeto/${id}/preencher-anexos`
                          ];
                          if (routes[index]) {
                            navigate(routes[index]);
                          }
                        }
                      }}
                    >
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                          index <= currentStep
                            ? 'bg-oraculo-blue text-white hover:bg-oraculo-blue/90'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <span
                        className={`text-xs mt-1 text-center transition-colors ${
                          index === currentStep
                            ? 'font-medium text-oraculo-blue'
                            : index < currentStep
                            ? 'text-oraculo-blue'
                            : 'text-gray-500'
                        }`}
                      >
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-oraculo-blue h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Card "Em Breve" */}
            <Card className="bg-white shadow-lg border-2 border-gray-200">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-r from-oraculo-blue/10 to-oraculo-purple/10 flex items-center justify-center">
                    <Clock className="h-12 w-12 text-oraculo-blue" />
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold text-gray-900 mb-2">
                  Em Breve
                </CardTitle>
                <CardDescription className="text-lg text-gray-600">
                  A funcionalidade de criação de cronograma está em desenvolvimento
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-6 pb-8">
                <p className="text-gray-700 text-base">
                  Estamos trabalhando para trazer uma ferramenta completa e intuitiva para criação de cronogramas de projetos culturais.
                </p>
                <p className="text-gray-600 text-sm">
                  Em breve você poderá criar cronogramas detalhados com atividades, prazos e marcos importantes do seu projeto.
                </p>
                <div className="pt-4">
                  <Button
                    onClick={() => navigate(`/projeto/${id}/preencher-anexos`)}
                    className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white px-8 py-3 text-base font-semibold flex items-center gap-2 mx-auto"
                  >
                    Continuar para Preencher Anexos
                    <ArrowRight className="h-5 w-5" />
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

export default CriarCronograma;
