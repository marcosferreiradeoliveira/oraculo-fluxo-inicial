
import React from 'react';
import type { EditalData, Documento } from '../types';
import { ClipboardIcon } from './icons/ClipboardIcon';

interface ResultDisplayProps {
  data: EditalData;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ data }) => {

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert('JSON copiado para a área de transferência!');
  };

  return (
    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <DataItem label="Nome do Edital" value={data.nome} />
        <DataItem label="Proponente" value={data.proponente} />
        <div className="md:col-span-2">
            <DataItem label="Escopo/Objetivo" value={data.escopo} />
        </div>
        <DataItem label="Data de Encerramento" value={data.dataEncerramento ? (data.dataEncerramento instanceof Date ? data.dataEncerramento.toLocaleDateString('pt-BR') : data.dataEncerramento) : 'Não informado'} />
        <DataItem label="Valor Máximo da Premiação" value={data.valor_maximo_premiacao} />
        <DataItem label="Data de Publicação" value={data.criado_em} />
        
        <div className="md:col-span-2">
          <DataItem label="Categorias" value={data.categorias} isList />
        </div>
        <div className="md:col-span-2">
          <DataItem label="Textos Exigidos para Inscrição" value={data.textos_exigidos} isList />
        </div>
        <div className="md:col-span-2">
            <DocumentationItem docs={data.documentacao_exigida} />
        </div>
        <div className="md:col-span-2">
          <DataItem label="Critérios de Avaliação" value={data.criterios} isPreformatted />
        </div>
      </div>
      <button 
        onClick={handleCopyJson}
        className="mt-6 w-full flex items-center justify-center space-x-2 bg-gray-200 hover:bg-gray-300 text-purple-700 font-semibold py-2 px-4 rounded-lg transition-colors duration-300"
      >
        <ClipboardIcon className="w-5 h-5" />
        <span>Copiar JSON</span>
      </button>
    </div>
  );
};

interface DataItemProps {
    label: string;
    value: string | string[];
    isList?: boolean;
    isPreformatted?: boolean;
}

const DataItem: React.FC<DataItemProps> = ({ label, value, isList, isPreformatted }) => {
    return (
        <div className="border-b border-gray-200 pb-3">
            <h3 className="text-sm font-semibold text-purple-600 mb-1">{label}</h3>
            {isList && Array.isArray(value) ? (
                <ul className="list-disc list-inside space-y-1 pl-2">
                    {value.map((item, index) => (
                        <li key={index} className="text-gray-700">{item || 'Não informado'}</li>
                    ))}
                </ul>
            ) : isPreformatted ? (
                 <p className="text-gray-700 whitespace-pre-wrap font-mono text-sm">{value || 'Não informado'}</p>
            ) : (
                <p className="text-gray-800">{Array.isArray(value) ? value.join(', ') : (value || 'Não informado')}</p>
            )}
        </div>
    )
}

interface DocumentationItemProps {
    docs: Documento[];
}

const DocumentationItem: React.FC<DocumentationItemProps> = ({ docs }) => {
    const docsInscricao = docs?.filter(d => d.fase?.toLowerCase() === 'inscrição') || [];
    const docsContratacao = docs?.filter(d => d.fase?.toLowerCase() === 'contratação') || [];
    
    if (!docs || docs.length === 0) {
        return (
             <div className="border-b border-gray-200 pb-3">
                <h3 className="text-sm font-semibold text-purple-600 mb-1">Documentação Exigida</h3>
                <p className="text-gray-500 italic">Nenhuma documentação específica encontrada.</p>
             </div>
        )
    }

    return (
        <div className="border-b border-gray-200 pb-3">
            <h3 className="text-sm font-semibold text-purple-600 mb-2">Documentação Exigida</h3>
            {docsInscricao.length > 0 && (
                <div className='mb-3'>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Para Inscrição</h4>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                        {docsInscricao.map((doc, index) => <li key={`insc-${index}`} className="text-gray-700">{doc.nome}</li>)}
                    </ul>
                </div>
            )}
            {docsContratacao.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Para Contratação</h4>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                        {docsContratacao.map((doc, index) => <li key={`cont-${index}`} className="text-gray-700">{doc.nome}</li>)}
                    </ul>
                </div>
            )}
             {docsInscricao.length === 0 && docsContratacao.length === 0 && (
                 <p className="text-gray-500 italic">Nenhuma documentação com fase especificada encontrada.</p>
             )}
        </div>
    )
}


export default ResultDisplay;
