import React, { useState, useEffect } from 'react';
import { AnaliseEdital } from '@/modules/extrator-edital/services/firebaseService';
import type { EditalData } from '@/modules/extrator-edital/types';

interface ModalEdicaoProps {
  analise: AnaliseEdital;
  onClose: () => void;
  onSave: (dados: Partial<AnaliseEdital>) => void;
}

export default function ModalEdicao({ analise, onClose, onSave }: ModalEdicaoProps) {
  const [dadosEdital, setDadosEdital] = useState<EditalData>({
    nome: analise.nome,
    proponente: analise.proponente,
    escopo: analise.escopo,
    categorias: analise.categorias,
    criterios: analise.criterios,
    dataEncerramento: analise.dataEncerramento instanceof Date ? analise.dataEncerramento.toISOString().split('T')[0] : analise.dataEncerramento,
    data_encerramento: analise.data_encerramento instanceof Date ? analise.data_encerramento.toISOString().split('T')[0] : analise.data_encerramento,
    textos_exigidos: analise.textos_exigidos,
    documentacao_exigida: analise.documentacao_exigida,
    valor_maximo_premiacao: analise.valor_maximo_premiacao,
    criado_em: analise.criado_em,
    projetos_selecionados: analise.projetos_selecionados,
    historico_edital: analise.historico_edital
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: keyof EditalData, value: string | string[]) => {
    setDadosEdital(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayInputChange = (field: keyof EditalData, value: string) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setDadosEdital(prev => ({
      ...prev,
      [field]: array
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSave({
        ...dadosEdital,
        // Converter datas para timestamps
        dataEncerramento: new Date(dadosEdital.dataEncerramento),
        data_encerramento: new Date(dadosEdital.data_encerramento)
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Editar Análise</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nome do Edital */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Edital
                </label>
                <input
                  type="text"
                  value={dadosEdital.nome}
                  onChange={(e) => handleInputChange('nome', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Proponente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proponente
                </label>
                <input
                  type="text"
                  value={dadosEdital.proponente}
                  onChange={(e) => handleInputChange('proponente', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Data de Encerramento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data de Encerramento
                </label>
                <input
                  type="text"
                  value={dadosEdital.dataEncerramento}
                  onChange={(e) => handleInputChange('dataEncerramento', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Valor Máximo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor Máximo da Premiação
                </label>
                <input
                  type="text"
                  value={dadosEdital.valor_maximo_premiacao}
                  onChange={(e) => handleInputChange('valor_maximo_premiacao', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Data de Publicação */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data de Publicação
                </label>
                <input
                  type="text"
                  value={dadosEdital.criado_em}
                  onChange={(e) => handleInputChange('criado_em', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Categorias */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categorias (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={Array.isArray(dadosEdital.categorias) ? dadosEdital.categorias.join(', ') : ''}
                  onChange={(e) => handleArrayInputChange('categorias', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Escopo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Escopo/Objetivo
              </label>
              <textarea
                value={dadosEdital.escopo}
                onChange={(e) => handleInputChange('escopo', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>

            {/* Critérios */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Critérios de Avaliação
              </label>
              <textarea
                value={dadosEdital.criterios}
                onChange={(e) => handleInputChange('criterios', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Textos Exigidos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Textos Exigidos (separados por vírgula)
              </label>
              <input
                type="text"
                value={Array.isArray(dadosEdital.textos_exigidos) ? dadosEdital.textos_exigidos.join(', ') : ''}
                onChange={(e) => handleArrayInputChange('textos_exigidos', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Botões */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors duration-200"
              >
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
