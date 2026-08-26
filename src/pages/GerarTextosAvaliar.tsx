import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, CheckCircle, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';

const GERAR_TEXTO_PROMPT = `Você é um especialista em elaboração de projetos culturais para leis de incentivo. Gere um texto claro, objetivo e bem estruturado para o seguinte item do projeto: `;

const TIPO_MAP: Record<string, string> = {
  justificativa: 'justificativa',
  objetivos: 'objetivos',
  metodologia: 'metodologia',
  resultados_esperados: 'resultados_esperados',
  cronograma: 'cronograma',
  orcamento: 'orcamento',
};

const TIPOS_PADRAO = ['justificativa', 'objetivos', 'metodologia', 'resultados_esperados', 'cronograma', 'orcamento'];

export default function GerarTextosAvaliar() {
  const navigate = useNavigate();
  const [dados, setDados] = useState<{
    nome: string;
    descricao: string;
    editalAssociado?: string;
    analiseConteudo?: string;
    editalId?: string | null;
  } | null>(null);
  const [editalTipos, setEditalTipos] = useState<string[]>(TIPOS_PADRAO);
  const [loading, setLoading] = useState(true);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [gerando, setGerando] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const steps = ['Criar Projeto', 'Avaliar com IA', 'Alterar com IA', 'Gerar Textos', 'Criar Orçamento', 'Criar Cronograma', 'Documentos de Inscrição', 'Preencher Anexos'];
  const currentStep = 3;
  const totalVisible = 5;
  const startIndex = Math.max(0, Math.min(currentStep - 2, steps.length - totalVisible));
  const visibleSteps = steps.slice(startIndex, startIndex + totalVisible);

  useEffect(() => {
    const raw = sessionStorage.getItem('avaliarProjeto_dados');
    if (!raw) {
      navigate('/avaliar-projeto', { replace: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setDados(parsed);
      if (parsed.editalId) {
        getDoc(doc(getFirestore(), 'editais', parsed.editalId))
          .then((snap) => {
            if (snap.exists()) {
              const textosexigidos = (snap.data() as { textos_exigidos?: string[] }).textos_exigidos;
              if (textosexigidos && Array.isArray(textosexigidos) && textosexigidos.length > 0) {
                setEditalTipos(textosexigidos);
              }
            }
          })
          .catch(() => {});
      }
    } catch {
      navigate('/avaliar-projeto', { replace: true });
      return;
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const gerarTexto = async (tipo: string): Promise<boolean> => {
    if (!dados || gerando) return false;
    const tipoMapeado = TIPO_MAP[tipo] || tipo;
    setGerando(tipo);
    setTextos((prev) => ({ ...prev, [tipo]: '' }));

    const dadosProjeto = {
      nome: dados.nome,
      descricao: dados.descricao,
      analise_ia: dados.analiseConteudo,
      edital_associado: dados.editalAssociado,
    };

    try {
      const response = await fetch('https://us-central1-culturalapp-fb9b0.cloudfunctions.net/gerarTextosProjeto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projetoId: 'avaliar-projeto', // Backend exige projetoId; valor sentinela para fluxo sem login
          tipo: tipoMapeado,
          dadosProjeto,
          prompt: GERAR_TEXTO_PROMPT + tipoMapeado,
          userId: null,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = (err as { message?: string }).message || (err as { error?: string }).error || `Erro ${response.status}`;
        toast.error(msg);
        setGerando(null);
        return false;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = (await response.json()) as { texto?: string };
        if (data.texto && data.texto.trim()) {
          setTextos((prev) => ({ ...prev, [tipo]: data.texto!.trim() }));
          toast.success('Texto gerado.');
          setGerando(null);
          return true;
        }
      }
      if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
        const decoder = new TextDecoder('utf-8');
        const reader = response.body?.getReader();
        let fullText = '';
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const parsed = JSON.parse(line.slice(6).trim());
              if (parsed.type === 'chunk' && parsed.content) {
                fullText += parsed.content;
                setTextos((prev) => ({ ...prev, [tipo]: fullText }));
                if (textareaRef.current) {
                  textareaRef.current.value = fullText;
                  textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
                }
              } else if (parsed.type === 'complete' && parsed.fullText) {
                fullText = parsed.fullText;
                setTextos((prev) => ({ ...prev, [tipo]: fullText }));
                break;
              }
            } catch {
              // ignore
            }
          }
        }
        toast.success('Texto gerado.');
        setGerando(null);
        return true;
      }

      toast.error('Resposta do servidor não reconhecida.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar texto.');
    }
    setGerando(null);
    return false;
  };

  const handleCopiar = (tipo: string) => {
    const t = textos[tipo];
    if (t) {
      navigator.clipboard.writeText(t);
      toast.success('Copiado.');
    }
  };

  const handleDownload = (tipo: string) => {
    const t = textos[tipo];
    if (!t) return;
    const blob = new Blob([t], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tipo}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Download iniciado.');
  };

  const handleContinuar = () => {
    const payload = sessionStorage.getItem('avaliarProjeto_dados');
    if (payload) {
      try {
        const obj = JSON.parse(payload);
        obj.textos_gerados = textos;
        sessionStorage.setItem('avaliarProjeto_dados', JSON.stringify(obj));
      } catch {
        // ignore
      }
    }
    navigate('/cadastro?redirect=/avaliar-projeto&continuar=true');
  };

  if (loading || !dados) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-oraculo-blue" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          <div className="max-w-5xl mx-auto w-full min-w-0">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Gerar Textos</h1>
                <p className="text-gray-600 text-sm md:text-base">
                  Gere textos para as diferentes seções do seu projeto (projeto modelo — sem login).
                </p>
              </div>
              <div className="flex flex-col items-stretch sm:items-end gap-1.5 flex-shrink-0 w-full sm:w-auto">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Próximo passo</span>
                <Button
                  size="lg"
                  onClick={handleContinuar}
                  className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white w-full sm:w-auto px-4 sm:px-6 md:px-8 py-3 sm:py-2.5 text-sm sm:text-base font-semibold"
                >
                  Salvar projeto e continuar <span className="ml-2 opacity-90">→</span>
                </Button>
              </div>
            </div>

            <div className="mb-8 min-w-0">
              <div className="flex items-center justify-between gap-0.5 sm:gap-2 mb-2 min-w-0">
                {visibleSteps.map((step, i) => {
                  const index = startIndex + i;
                  const isClickable = index <= currentStep;
                  const route = index === 0 || index === 1 || index === 2 ? '/avaliar-projeto' : '#';
                  return (
                    <button
                      key={index}
                      onClick={() => isClickable && route !== '#' && navigate(route)}
                      className={`flex flex-col items-center min-w-0 flex-1 ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                      disabled={!isClickable}
                    >
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                          index <= currentStep ? 'bg-oraculo-blue text-white hover:bg-oraculo-blue/90' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <span
                        className={`text-[10px] sm:text-xs mt-1 text-center transition-colors truncate w-full block px-0.5 ${
                          index === currentStep ? 'font-medium text-oraculo-blue' : index < currentStep ? 'text-oraculo-blue hover:underline' : 'text-gray-500'
                        }`}
                        title={step}
                      >
                        {step}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-oraculo-blue h-2 rounded-full transition-all duration-300" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden min-w-0">
              <div className="p-4 border-b min-w-0">
                <h2 className="text-lg font-semibold text-gray-800">Gerar Textos</h2>
                <p className="text-sm text-gray-500 mt-1">Para cada tipo, use o botão para gerar com IA ou escreva na caixa. Faça login depois para salvar o projeto.</p>
              </div>
              <div className="p-4 space-y-8">
                {editalTipos.map((tipo) => {
                  const titulo = tipo
                    .split('_')
                    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                    .join(' ');
                  return (
                    <div key={tipo} className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50/50">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <FileText className="h-5 w-5 text-oraculo-blue" />
                        {titulo}
                        {textos[tipo] && <CheckCircle className="h-5 w-5 text-green-500" />}
                      </h3>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Button
                          onClick={() => gerarTexto(tipo)}
                          disabled={!!gerando}
                          className="bg-oraculo-blue hover:bg-oraculo-blue/90 text-white"
                        >
                          {gerando === tipo ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Gerando...
                            </>
                          ) : (
                            'Criar Texto com IA'
                          )}
                        </Button>
                        {textos[tipo] && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => handleCopiar(tipo)} className="border-gray-300 text-gray-700">
                              <Copy className="mr-2 h-4 w-4" />
                              Copiar
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDownload(tipo)} className="border-gray-300 text-gray-700">
                              <Download className="mr-2 h-4 w-4" />
                              Baixar
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="relative">
                        <textarea
                          ref={gerando === tipo ? textareaRef : undefined}
                          className="w-full min-h-[200px] max-h-[400px] p-4 border border-gray-200 rounded-lg text-gray-800 bg-white resize-y overflow-y-auto focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue"
                          readOnly={gerando === tipo}
                          value={textos[tipo] || ''}
                          placeholder={gerando === tipo ? 'Gerando texto, aguarde...' : `Digite ou gere o texto para ${titulo.toLowerCase()}...`}
                          onChange={(e) => setTextos((prev) => ({ ...prev, [tipo]: e.target.value }))}
                        />
                        {gerando === tipo && (
                          <div className="absolute bottom-3 right-3 flex items-center bg-white/95 px-3 py-1.5 rounded-full shadow border text-sm">
                            <Loader2 className="h-4 w-4 animate-spin text-oraculo-blue mr-2" />
                            <span className="text-gray-700">Gerando...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 p-4 bg-oraculo-blue/5 border border-oraculo-blue/20 rounded-xl">
              <p className="text-sm text-gray-700 mb-3">
                Este é um fluxo de demonstração. Para salvar seu projeto e continuar com orçamento, cronograma e anexos, clique em &quot;Salvar projeto e continuar&quot; para criar sua conta ou fazer login.
              </p>
              <Button onClick={handleContinuar} className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white">
                Salvar projeto e continuar
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
