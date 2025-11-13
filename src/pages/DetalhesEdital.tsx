import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  DollarSign, 
  FileText, 
  CheckCircle, 
  Clock, 
  Building,
  List,
  ClipboardList,
  History,
  Award,
  Plus
} from 'lucide-react';

interface Edital {
  id: string;
  nome: string;
  escopo?: string;
  criterios?: string;
  categorias?: string[];
  data_encerramento?: any;
  dataEncerramento?: any;
  valor_maximo_premiacao?: string;
  textos_exigidos?: string[];
  documentacao_exigida?: Array<{
    nome: string;
    fase: string;
  }>;
  historico_edital?: {
    ultimaEdicao?: string;
    frequencia?: string;
    edicoesAnteriores?: string[];
  };
  proponente?: string;
  criado_em?: any;
  status?: string;
  projetos_selecionados?: any[];
  nomeArquivo?: string;
  pdf_url?: string;
}

const DetalhesEdital = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [edital, setEdital] = useState<Edital | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEdital = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      
      try {
        const editalRef = doc(db, 'editais', id);
        const editalSnap = await getDoc(editalRef);
        
        if (editalSnap.exists()) {
          const data = editalSnap.data();
          setEdital({ 
            id: editalSnap.id, 
            ...data,
            // Normaliza os nomes dos campos
            nome: data.nome || 'Edital sem nome',
            data_encerramento: data.data_encerramento || data.dataEncerramento
          } as Edital);
        } else {
          console.error('Edital não encontrado');
          setEdital(null);
        }
      } catch (error) {
        console.error('Erro ao buscar edital:', error);
        setEdital(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEdital();
  }, [id]);

  const formatDate = (dateField: any) => {
    if (!dateField) return 'Não informado';
    
    if (typeof dateField === 'object' && 'seconds' in dateField) {
      return new Date(dateField.seconds * 1000).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } else if (typeof dateField === 'string') {
      return dateField;
    }
    return 'Data inválida';
  };

  const getDaysRemaining = (dateField: any) => {
    if (!dateField) return null;
    
    let deadlineDate: Date;
    if (typeof dateField === 'object' && 'seconds' in dateField) {
      deadlineDate = new Date(dateField.seconds * 1000);
    } else if (typeof dateField === 'string') {
      deadlineDate = new Date(dateField);
    } else {
      return null;
    }
    
    const now = new Date();
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1">
          <DashboardHeader />
          <main className="p-8">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oraculo-blue"></div>
              <span className="ml-4 text-lg">Carregando edital...</span>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!edital) {
    return (
      <div className="flex h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1">
          <DashboardHeader />
          <main className="p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Edital não encontrado</h2>
              <Button onClick={() => navigate('/oraculo-ai')}>
                Voltar para Editais
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const daysRemaining = getDaysRemaining(edital.data_encerramento || edital.dataEncerramento);

  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 overflow-auto">
        <DashboardHeader />
        <main className="p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/oraculo-ai')}
              className="mb-4"
            >
              ← Voltar para Editais
            </Button>
            
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{edital.nome}</h1>
                {edital.proponente && (
                  <div className="flex items-center text-gray-600 mb-4">
                    <Building className="h-5 w-5 mr-2" />
                    <span className="text-lg">{edital.proponente}</span>
                  </div>
                )}
              </div>
              
              {daysRemaining !== null && (
                <Badge 
                  className={`text-lg px-4 py-2 ${
                    daysRemaining < 7 
                      ? 'bg-red-500' 
                      : daysRemaining < 30 
                      ? 'bg-yellow-500' 
                      : 'bg-green-500'
                  } text-white`}
                >
                  {daysRemaining > 0 ? `${daysRemaining} dias restantes` : 'Prazo encerrado'}
                </Badge>
              )}
            </div>

            {/* Botão Criar Projeto */}
            <Button 
              size="lg"
              onClick={() => navigate('/criar-projeto')}
              className="mt-6 bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Criar Projeto para este Edital
            </Button>
          </div>

          {/* Key Information Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Data de Encerramento</p>
                    <p className="text-lg font-semibold">
                      {formatDate(edital.data_encerramento || edital.dataEncerramento)}
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-oraculo-blue" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Valor Máximo</p>
                    <p className="text-lg font-semibold">
                      {edital.valor_maximo_premiacao || 'Não informado'}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Status</p>
                    <p className="text-lg font-semibold capitalize">
                      {edital.status || 'Aberto'}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Escopo */}
          {edital.escopo && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Escopo do Edital
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">{edital.escopo}</p>
              </CardContent>
            </Card>
          )}

          {/* Critérios de Avaliação */}
          {edital.criterios && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Critérios de Avaliação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">{edital.criterios}</p>
              </CardContent>
            </Card>
          )}

          {/* Categorias */}
          {edital.categorias && Array.isArray(edital.categorias) && edital.categorias.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <List className="h-5 w-5" />
                  Categorias Aceitas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {edital.categorias.map((categoria, index) => (
                    <Badge key={index} variant="outline" className="text-sm px-3 py-1">
                      {categoria}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Textos Exigidos */}
          {edital.textos_exigidos && Array.isArray(edital.textos_exigidos) && edital.textos_exigidos.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Textos Exigidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {edital.textos_exigidos.map((texto, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{texto}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Documentação Exigida */}
          {edital.documentacao_exigida && Array.isArray(edital.documentacao_exigida) && edital.documentacao_exigida.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Documentação Exigida
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {edital.documentacao_exigida.map((doc, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <FileText className="h-5 w-5 text-oraculo-blue mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-gray-900 font-medium">{doc.nome}</p>
                        <p className="text-sm text-gray-500 capitalize">Fase: {doc.fase}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Histórico do Edital */}
          {edital.historico_edital && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico do Edital
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {edital.historico_edital.ultimaEdicao && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Última Edição</p>
                      <p className="text-lg font-semibold">{edital.historico_edital.ultimaEdicao}</p>
                    </div>
                  )}
                  {edital.historico_edital.frequencia && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Frequência</p>
                      <p className="text-lg font-semibold">{edital.historico_edital.frequencia}</p>
                    </div>
                  )}
                  {edital.historico_edital.edicoesAnteriores && Array.isArray(edital.historico_edital.edicoesAnteriores) && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Edições Anteriores</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {edital.historico_edital.edicoesAnteriores.map((edicao, index) => (
                          <Badge key={index} variant="secondary">{edicao}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Projetos Selecionados */}
          {edital.projetos_selecionados && Array.isArray(edital.projetos_selecionados) && edital.projetos_selecionados.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Projetos Selecionados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  {edital.projetos_selecionados.length} projeto(s) selecionado(s)
                </p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 mt-8">
            {edital.pdf_url && (
              <Button 
                size="lg"
                variant="default"
                onClick={() => window.open(edital.pdf_url, '_blank')}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Ver PDF do Edital
              </Button>
            )}
            <Button 
              size="lg"
              variant="outline"
              onClick={() => navigate('/oraculo-ai')}
            >
              Voltar para Editais
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DetalhesEdital;

