import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  obterTodasAnalises,
  excluirAnalise,
  atualizarAnalise,
  AnaliseEdital,
} from '@/modules/extrator-edital/services/firebaseService';
import { DocumentIcon } from './icons/DocumentIcon';
import Loader from './Loader';
import ErrorMessage from './ErrorMessage';
import ModalEdicao from './ModalEdicao';
import ModalVisualizacao from './ModalVisualizacao';

export default function Dashboard() {
  const [analises, setAnalises] = useState<AnaliseEdital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');
  const [analiseSelecionada, setAnaliseSelecionada] = useState<AnaliseEdital | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarModalVisualizacao, setMostrarModalVisualizacao] = useState(false);

  useEffect(() => {
    carregarAnalises();
  }, []);

  const carregarAnalises = async () => {
    try {
      setLoading(true);
      console.log('Carregando análises da coleção: editais');
      const dados = await obterTodasAnalises();
      console.log('Análises carregadas:', dados);
      setAnalises(dados);
    } catch (err: any) {
      console.error('Erro ao carregar análises:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExcluir = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta análise?')) {
      try {
        await excluirAnalise(id);
        setAnalises(analises.filter(a => a.id !== id));
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  const handleEditar = (analise: AnaliseEdital) => {
    setAnaliseSelecionada(analise);
    setMostrarModal(true);
  };

  const handleVisualizar = (analise: AnaliseEdital) => {
    setAnaliseSelecionada(analise);
    setMostrarModalVisualizacao(true);
  };

  const handleSalvarEdicao = async (dadosAtualizados: Partial<AnaliseEdital>) => {
    if (!analiseSelecionada?.id) return;

    try {
      await atualizarAnalise(analiseSelecionada.id, dadosAtualizados);
      setMostrarModal(false);
      setAnaliseSelecionada(null);
      carregarAnalises(); // Recarregar dados
    } catch (err: any) {
      setError(err.message);
    }
  };

  const analisesFiltradas = analises.filter(analise =>
    (analise.nome?.toLowerCase() || '').includes(filtro.toLowerCase()) ||
    (analise.proponente?.toLowerCase() || '').includes(filtro.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage 
        message={error} 
        onRetry={carregarAnalises}
        showRetry={true}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard de Editais</h2>
          <p className="text-gray-600">Gerencie suas análises de editais</p>
        </div>
        <div className="text-sm text-gray-500">
          {analises.length} análise{analises.length !== 1 ? 's' : ''} cadastrada{analises.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Filtro */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <input
          type="text"
          placeholder="Buscar por nome do edital ou proponente..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Lista de Editais */}
      <div className="grid gap-4">
        {analisesFiltradas.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <DocumentIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filtro ? 'Nenhum resultado encontrado' : 'Nenhum edital cadastrado'}
            </h3>
            <p className="text-gray-500">
              {filtro ? 'Tente ajustar os filtros de busca' : 'Comece analisando um edital para vê-lo aqui'}
            </p>
          </div>
        ) : (
          analisesFiltradas.map((analise) => (
            <div key={analise.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <DocumentIcon className="w-6 h-6 text-purple-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {analise.nome || 'Nome não disponível'}
                    </h3>
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {analise.status || 'N/A'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Proponente:</span>
                      <p>{analise.proponente || 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="font-medium">Data de Encerramento:</span>
                      <p>
                        {analise.dataEncerramento 
                          ? (analise.dataEncerramento instanceof Date 
                              ? analise.dataEncerramento.toLocaleDateString('pt-BR') 
                              : analise.dataEncerramento)
                          : 'Não informado'
                        }
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">Valor Máximo:</span>
                      <p>{analise.valor_maximo_premiacao || 'Não informado'}</p>
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-gray-500">
                    <p><span className="font-medium">Arquivo:</span> {analise.nomeArquivo}</p>
                    <p><span className="font-medium">Analisado em:</span> {new Date(analise.dataAnalise).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 ml-4">
                  {analise.id ? (
                    <Link
                      to={`/edital/${analise.id}`}
                      className="bg-oraculo-blue/10 hover:bg-oraculo-blue/20 text-oraculo-blue font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                      Detalhe Oráculo
                    </Link>
                  ) : null}
                  <button
                    onClick={() => handleVisualizar(analise)}
                    className="bg-green-100 hover:bg-green-200 text-green-800 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Visualizar
                  </button>
                  <button
                    onClick={() => handleEditar(analise)}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => analise.id && handleExcluir(analise.id)}
                    className="bg-red-100 hover:bg-red-200 text-red-800 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Edição */}
      {mostrarModal && analiseSelecionada && (
        <ModalEdicao
          analise={analiseSelecionada}
          onClose={() => {
            setMostrarModal(false);
            setAnaliseSelecionada(null);
          }}
          onSave={handleSalvarEdicao}
        />
      )}

      {/* Modal de Visualização */}
      {mostrarModalVisualizacao && analiseSelecionada && (
        <ModalVisualizacao
          analise={analiseSelecionada}
          onClose={() => {
            setMostrarModalVisualizacao(false);
            setAnaliseSelecionada(null);
          }}
        />
      )}
    </div>
  );
}
