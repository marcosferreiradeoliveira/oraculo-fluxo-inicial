import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Brain, Loader2 } from 'lucide-react';
import AnalisarImg from '@/assets/Analisar.jpeg';
import OpenAI from 'openai';

const steps = [
  'Criar Projeto',
  'Avaliar com IA',
  'Alterar com IA',
  'Gerar Textos',
  'Gerar Orçamento',
  'Gerar Cronograma',
  'Gerar Cartas de anuência'
];
const currentStep = 2; // Alterar com IA

const AlterarComIA = () => {
  const { id } = useParams();
  const [projeto, setProjeto] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analise, setAnalise] = useState<string | null>(null);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [descricaoEditada, setDescricaoEditada] = useState<string>('');
  const [aprovacoes, setAprovacoes] = useState<boolean[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    document.title = 'Alterar com IA - Oráculo Cultural';
  }, []);

  useEffect(() => {
    const fetchProjeto = async () => {
      if (!id) return;
      setLoading(true);
      const db = getFirestore();
      const ref = doc(db, 'projetos', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setProjeto(data);
        setAnalise((data as any).analise_ia || null);
        setDescricaoEditada(data.descricao || '');
        // Recupera aprovações salvas
        if (Array.isArray(data.sugestoes_aprovadas)) {
          setAprovacoes(data.sugestoes_aprovadas);
        }
      }
      setLoading(false);
    };
    fetchProjeto();
  }, [id]);

  useEffect(() => {
    if (analise) {
      // Extrai sugestões da análise (cada linha que começa com "Sugestão:")
      const regex = /Sugestão: ?(.+)/gi;
      const matches = [...analise.matchAll(regex)].map(m => m[1].trim());
      setSugestoes(matches);
      // Se já há aprovações salvas, mantém, senão inicializa tudo como false
      setAprovacoes(prev => prev.length === matches.length ? prev : matches.map(() => false));
    }
  }, [analise]);

  const handleAprovar = async (idx: number) => {
    // Marca sugestão como aprovada
    const novasAprovacoes = [...aprovacoes];
    novasAprovacoes[idx] = true;
    setAprovacoes(novasAprovacoes);
    setGerando(true);
    try {
      const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY, dangerouslyAllowBrowser: true });
      const prompt = `Você é um especialista em projetos culturais. Reescreva o texto do projeto abaixo, incorporando a seguinte sugestão de alteração para aumentar as chances de aprovação em editais. Mantenha o texto claro, objetivo e profissional.\n\nTEXTO ATUAL DO PROJETO:\n${descricaoEditada}\n\nSUGESTÃO DE ALTERAÇÃO:\n${sugestoes[idx]}\n\nNOVO TEXTO DO PROJETO:`;
      let novoTexto = '';
      const stream = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Você é um especialista em projetos culturais.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1200,
        temperature: 0.3,
        stream: true,
      });
      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          novoTexto += content;
          setDescricaoEditada(novoTexto);
        }
      }
      setGerando(false);
    } catch (e) {
      setGerando(false);
      setDescricaoEditada(prev => prev + '\n' + sugestoes[idx]);
    }
  };

  const handleSalvar = async () => {
    if (!id) return;
    setSalvando(true);
    const db = getFirestore();
    const ref = doc(db, 'projetos', id);
    await updateDoc(ref, { descricao: descricaoEditada, sugestoes_aprovadas: aprovacoes });
    setSalvando(false);
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 flex items-center justify-center p-8 animate-fade-in">
            <p>Carregando projeto...</p>
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
          <main className="flex-1 flex items-center justify-center p-8 animate-fade-in">
            <p>Projeto não encontrado.</p>
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
        <main className="flex-1 p-8 animate-fade-in flex gap-8 items-start justify-start">
          <div className="max-w-3xl mx-0 flex-1">
            {/* Breadcrumbs/Stepper */}
            <nav className="mb-8">
              <ol className="flex flex-wrap items-center gap-2 text-sm">
                {steps.map((step, idx) => (
                  <li key={step} className="flex items-center gap-2">
                    {idx === 0 ? (
                      <Link to="/criar-projeto" className={`px-3 py-1 rounded-full font-medium ${idx === currentStep ? 'bg-oraculo-blue text-white' : 'bg-gray-200 text-gray-700'} hover:underline`}>{step}</Link>
                    ) : idx === 1 ? (
                      <Link to={`/projeto/${id}`} className={`px-3 py-1 rounded-full font-medium ${idx === currentStep ? 'bg-oraculo-blue text-white' : 'bg-gray-200 text-gray-700'} hover:underline`}>{step}</Link>
                    ) : (
                      <span className={`px-3 py-1 rounded-full font-medium ${idx === currentStep ? 'bg-oraculo-blue text-white' : 'bg-gray-200 text-gray-700'}`}>{step}</span>
                    )}
                    {idx < steps.length - 1 && <span className="text-gray-400">→</span>}
                  </li>
                ))}
              </ol>
            </nav>
            <h1 className="text-3xl font-bold text-oraculo-blue mb-2 text-left">Alterar com IA</h1>
            <p className="text-gray-600 text-lg mb-6 text-left">Veja a análise do Oráculo e utilize as sugestões para aprimorar seu projeto.</p>
            <h1 className="text-3xl font-bold text-gray-900 mb-4 text-left">{projeto.nome}</h1>
            <div className="mb-4">
              <span className="inline-block bg-oraculo-blue/10 text-oraculo-blue px-3 py-1 rounded-full text-xs font-semibold mr-2">
                {projeto.categoria}
              </span>
              {projeto.edital_associado && (
                <span className="inline-block bg-oraculo-purple/10 text-oraculo-purple px-3 py-1 rounded-full text-xs font-semibold">
                  Edital: {projeto.edital_associado}
                </span>
              )}
            </div>
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-1">Descrição</h2>
              <textarea
                className="w-full border rounded p-2 text-gray-700 min-h-[120px] mb-2"
                value={descricaoEditada}
                onChange={e => setDescricaoEditada(e.target.value)}
                disabled={gerando}
              />
              {gerando && (
                <div className="flex items-center gap-2 text-oraculo-blue mb-2 animate-pulse">
                  <Loader2 className="animate-spin h-5 w-5" />
                  Produzindo o texto...
                </div>
              )}
              <Button onClick={handleSalvar} disabled={salvando || gerando} className="mb-4">
                {salvando ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
            {sugestoes.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-2 text-oraculo-blue">Sugestões de Alteração da IA</h2>
                <ul className="space-y-2">
                  {sugestoes.map((sug, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Button size="sm" variant={aprovacoes[idx] ? 'default' : 'outline'} disabled={aprovacoes[idx] || gerando} onClick={() => handleAprovar(idx)}>
                        {aprovacoes[idx] ? 'Aprovada' : 'Aprovar'}
                      </Button>
                      <span className={aprovacoes[idx] ? 'line-through text-gray-400' : ''}>{sug}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6 bg-white border rounded-lg p-4 text-gray-800 whitespace-pre-line text-sm shadow">
              <strong className="block text-oraculo-blue mb-2">Análise do Oráculo:</strong>
              {analise ? analise : <span className="text-gray-400">Nenhuma análise encontrada para este projeto.</span>}
            </div>
          </div>
          <aside className="hidden lg:block w-full max-w-sm ml-8">
            <div className="bg-gradient-to-br from-oraculo-blue/10 to-oraculo-purple/10 border-l-4 border-oraculo-blue rounded-xl p-6 shadow flex flex-col gap-2">
              <img src={AnalisarImg} alt="Análise do Oráculo" className="rounded-lg mb-3 w-full object-cover max-h-40" />
              <h2 className="text-lg font-semibold text-oraculo-blue mb-2 flex items-center gap-2">
                <span role="img" aria-label="Dica">🤖</span> Dica do Oráculo
              </h2>
              <p className="text-gray-700 text-sm mb-2">
                Utilize as sugestões da análise para aprimorar seu projeto antes de avançar para os próximos passos.
              </p>
              <Button size="lg" className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-lg px-8 py-4 flex items-center gap-2 mt-2" asChild>
                <Link to={`/projeto/${id}/gerar-textos`}>Gerar Textos</Link>
              </Button>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
};

export default AlterarComIA; 