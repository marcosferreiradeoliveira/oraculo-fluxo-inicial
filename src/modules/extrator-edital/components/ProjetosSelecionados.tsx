import React from 'react';
import type { ProjetoSelecionado, HistoricoEdital } from '../types';

interface ProjetosSelecionadosProps {
  projetos: ProjetoSelecionado[];
  historico: HistoricoEdital | undefined;
  isLoading: boolean;
}

export default function ProjetosSelecionados({ projetos, historico, isLoading }: ProjetosSelecionadosProps) {
  if (isLoading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-blue-700 font-medium">Buscando projetos selecionados de edições anteriores...</span>
        </div>
      </div>
    );
  }

  if (!projetos || projetos.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Projetos Selecionados de Edições Anteriores</h3>
        <p className="text-gray-600 text-sm">
          Nenhum projeto selecionado foi encontrado para edições anteriores deste edital.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-blue-800">
          Projetos Selecionados de Edições Anteriores
        </h3>
        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
          {projetos.length} encontrado{projetos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {historico && (
        <div className="mb-4 p-3 bg-blue-100 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-800 mb-1">Histórico do Edital</h4>
          <div className="text-sm text-blue-700">
            <p><strong>Frequência:</strong> {historico.frequencia}</p>
            <p><strong>Última edição:</strong> {historico.ultimaEdicao}</p>
            {historico.edicoesAnteriores.length > 0 && (
              <p><strong>Edições anteriores:</strong> {historico.edicoesAnteriores.join(', ')}</p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {projetos.map((projeto, index) => (
          <div key={index} className="bg-white border border-blue-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-gray-800 text-sm">{projeto.nome}</h4>
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                {projeto.ano}
              </span>
            </div>
            
            <div className="space-y-1 text-sm text-gray-600">
              <p><strong>Proponente:</strong> {projeto.proponente}</p>
              {projeto.valor && (
                <p><strong>Valor:</strong> {projeto.valor}</p>
              )}
              <p><strong>Resumo:</strong> {projeto.resumo}</p>
              <p><strong>Fonte:</strong> {projeto.fonte}</p>
              {projeto.url && (
                <a 
                  href={projeto.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline text-xs"
                >
                  Ver fonte original
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
