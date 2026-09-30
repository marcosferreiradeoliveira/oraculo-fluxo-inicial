import React from 'react';
import { AnaliseEdital } from '@/modules/extrator-edital/services/firebaseService';
import { DocumentIcon } from './icons/DocumentIcon';

interface ModalVisualizacaoProps {
  analise: AnaliseEdital;
  onClose: () => void;
}

export default function ModalVisualizacao({ analise, onClose }: ModalVisualizacaoProps) {
  const formatarData = (data: any) => {
    if (!data) return 'Não informado';
    if (data instanceof Date) {
      return data.toLocaleDateString('pt-BR');
    }
    return data;
  };

  const formatarArray = (array: string[] | undefined) => {
    if (!array || !Array.isArray(array) || array.length === 0) {
      return 'Não informado';
    }
    return array.join(', ');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3">
              <DocumentIcon className="w-8 h-8 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-900">Visualização Completa do Edital</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Informações Básicas */}
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Informações Básicas</h3>
                <div className="space-y-3">
                  <div>
                    <span className="font-medium text-gray-700">Nome do Edital:</span>
                    <p className="text-gray-900">{analise.nome || 'Não informado'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Proponente:</span>
                    <p className="text-gray-900">{analise.proponente || 'Não informado'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Data de Encerramento:</span>
                    <p className="text-gray-900">{formatarData(analise.dataEncerramento)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Valor Máximo:</span>
                    <p className="text-gray-900">{analise.valor_maximo_premiacao || 'Não informado'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Data de Publicação:</span>
                    <p className="text-gray-900">{analise.criado_em || 'Não informado'}</p>
                  </div>
                </div>
              </div>

              {/* Escopo */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Escopo/Objetivo</h3>
                <p className="text-gray-700">{analise.escopo || 'Não informado'}</p>
              </div>

              {/* Categorias */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Categorias</h3>
                <p className="text-gray-700">{formatarArray(analise.categorias)}</p>
              </div>

              {/* Textos Exigidos */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Textos Exigidos</h3>
                <p className="text-gray-700">{formatarArray(analise.textos_exigidos)}</p>
              </div>
            </div>

            {/* Informações Detalhadas */}
            <div className="space-y-6">
              {/* Critérios de Avaliação */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Critérios de Avaliação</h3>
                <div className="bg-white p-3 rounded border">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {analise.criterios || 'Não informado'}
                  </pre>
                </div>
              </div>

              {/* Documentação Exigida */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Documentação Exigida</h3>
                {analise.documentacao_exigida && analise.documentacao_exigida.length > 0 ? (
                  <div className="space-y-3">
                    {analise.documentacao_exigida.map((doc, index) => (
                      <div key={index} className="bg-white p-3 rounded border">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-800">{doc.nome}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            doc.fase === 'inscrição' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {doc.fase}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-700">Nenhuma documentação específica encontrada.</p>
                )}
              </div>

              {/* Projetos Selecionados */}
              {analise.projetos_selecionados && analise.projetos_selecionados.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Projetos Selecionados de Edições Anteriores</h3>
                  <div className="space-y-3">
                    {analise.projetos_selecionados.map((projeto, index) => (
                      <div key={index} className="bg-white p-3 rounded border">
                        <h4 className="font-semibold text-gray-800">{projeto.nome}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          <strong>Proponente:</strong> {projeto.proponente}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Ano:</strong> {projeto.ano}
                        </p>
                        {projeto.valor && (
                          <p className="text-sm text-gray-600">
                            <strong>Valor:</strong> {projeto.valor}
                          </p>
                        )}
                        <p className="text-sm text-gray-600 mt-2">{projeto.resumo}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          <strong>Fonte:</strong> {projeto.fonte}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Histórico do Edital */}
              {analise.historico_edital && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Histórico do Edital</h3>
                  <div className="space-y-2">
                    <p className="text-gray-700">
                      <strong>Frequência:</strong> {analise.historico_edital.frequencia || 'Não informado'}
                    </p>
                    <p className="text-gray-700">
                      <strong>Última edição:</strong> {analise.historico_edital.ultimaEdicao || 'Não informado'}
                    </p>
                    {analise.historico_edital.edicoesAnteriores && analise.historico_edital.edicoesAnteriores.length > 0 && (
                      <p className="text-gray-700">
                        <strong>Edições anteriores:</strong> {analise.historico_edital.edicoesAnteriores.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Informações do Arquivo */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Informações do Arquivo</h3>
                <div className="space-y-2">
                  <p className="text-gray-700">
                    <strong>Arquivo:</strong> {analise.nomeArquivo || 'Não informado'}
                  </p>
                  <p className="text-gray-700">
                    <strong>Status:</strong> 
                    <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                      analise.status === 'sucesso' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {analise.status || 'N/A'}
                    </span>
                  </p>
                  <p className="text-gray-700">
                    <strong>Analisado em:</strong> {formatarData(analise.dataAnalise)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 mt-6">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
