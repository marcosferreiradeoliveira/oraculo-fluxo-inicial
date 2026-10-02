import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizarMarkdownAnalise } from '@/lib/analiseMarkdownNormalize';
import { prepararCorpoAnaliseParaExibicao } from '@/lib/analiseCorpo';

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h2 className="text-2xl font-bold text-gray-900 uppercase border-b-2 border-gray-200 pb-3 mb-6 mt-8 first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-bold text-gray-900 uppercase border-b border-gray-200 pb-2 mb-4 mt-8 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2">{children}</h3>
  ),
  p: ({ children }) => <p className="text-gray-700 leading-relaxed mb-4 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-6 mb-5 space-y-2 text-gray-700">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-5 space-y-2 text-gray-700">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  hr: () => <hr className="my-8 border-gray-200" />,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
};

type AnaliseMarkdownProps = {
  content: string;
  className?: string;
  /** Remove sugestões do corpo (padrão true na tela do projeto). */
  stripSuggestions?: boolean;
};

export function AnaliseMarkdown({
  content,
  className,
  stripSuggestions = true,
}: AnaliseMarkdownProps) {
  const raw = stripSuggestions ? prepararCorpoAnaliseParaExibicao(content) : content;
  const md = normalizarMarkdownAnalise(raw);
  if (!md) return null;

  return (
    <div className={`analise-markdown max-w-none text-base ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {md}
      </ReactMarkdown>
    </div>
  );
}
