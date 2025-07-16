import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Brain } from 'lucide-react';
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
const currentStep = 1; // Avaliar com IA

const Projeto = () => {
  const { id } = useParams();
  const [projeto, setProjeto] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analisando, setAnalisando] = useState(false);
  const [analise, setAnalise] = useState<string | null>(null);
  const [erroIA, setErroIA] = useState<string | null>(null);
  const [etapaAtual, setEtapaAtual] = useState<number>(1); // 1 = Avaliar com IA
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Oráculo Cultural';
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
        setEtapaAtual(typeof data.etapa_atual === 'number' ? data.etapa_atual : 1);
      }
      setLoading(false);
    };
    fetchProjeto();
  }, [id]);

  // Função para avançar etapa
  const avancarEtapa = async (novaEtapa: number) => {
    if (!id) return;
    setEtapaAtual(novaEtapa);
    const db = getFirestore();
    const ref = doc(db, 'projetos', id);
    await updateDoc(ref, { etapa_atual: novaEtapa });
  };

  // Função para buscar textos do edital e selecionados
  const fetchEditalESelecionados = async (editalNome: string) => {
    const db = getFirestore();
    // Busca o edital pelo nome
    const editalQuery = query(collection(db, 'editais'), where('nome', '==', editalNome));
    const editalSnap = await getDocs(editalQuery);
    if (!editalSnap.empty) {
      const editalDoc = editalSnap.docs[0].data();
      return {
        texto_edital: editalDoc.texto_edital || '',
        texto_selecionados: editalDoc.texto_selecionados || '',
      };
    }
    return { texto_edital: '', texto_selecionados: '' };
  };

  // Função para analisar com IA
  const analisarComIA = async () => {
    setAnalisando(true);
    setAnalise(null);
    setErroIA(null);
    try {
      // Busca textos do edital e selecionados
      let texto_edital = '';
      let texto_selecionados = '';
      if (projeto.edital_associado) {
        const res = await fetchEditalESelecionados(projeto.edital_associado);
        texto_edital = res.texto_edital;
        texto_selecionados = res.texto_selecionados;
      }
      // Monta o prompt
      const prompt = `Você é um avaliador de projetos culturais. Analise o projeto abaixo:\n\nPROJETO:\n${projeto.descricao?.slice(0, 2000)}\n\nConsiderando:\nCRITÉRIOS DO EDITAL:\n${texto_edital ? texto_edital.slice(0, 4000) : 'Nenhum texto de edital fornecido.'}\n\nPROJETOS SELECIONADOS ANTERIORES (para contexto comparativo):\n${texto_selecionados ? texto_selecionados.slice(0, 3000) : 'Nenhum texto de projetos selecionados fornecido.'}\n\nForneça uma análise detalhada com:\n1. Adequação aos critérios do edital (✅/❌)\n2. Pontos fortes do projeto\n3. Pontos fracos do projeto\n4. Sugestões de melhoria: Liste as sugestões para aumentar a chance de aprovação, cada uma começando explicitamente com \"Sugestão: \".\n5. Nota estimada (0-100)\n\nANÁLISE DETALHADA:`;

      // Chama a OpenAI
      const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY, dangerouslyAllowBrowser: true });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Você é um avaliador de projetos culturais.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1200,
        temperature: 0.2,
      });
      const analiseIA = completion.choices[0].message?.content || 'Sem resposta da IA.';
      setAnalise(analiseIA);
      // Salva a análise no Firestore
      if (id) {
        const db = getFirestore();
        const ref = doc(db, 'projetos', id);
        await updateDoc(ref, { analise_ia: analiseIA });
        // Avança para a próxima etapa (Alterar com IA)
        if (etapaAtual < 2) await avancarEtapa(2);
        // Redireciona para a página Alterar com IA
        navigate(`/projeto/${id}/alterar-com-ia`);
      }
    } catch (e: any) {
      setErroIA(e.message || 'Erro ao analisar com IA.');
    } finally {
      setAnalisando(false);
    }
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
                    {idx < etapaAtual ? (
                      <span className={`px-3 py-1 rounded-full font-medium bg-green-100 text-green-700 flex items-center gap-1`}>
                        <span className="font-bold">✓</span> {step}
                      </span>
                    ) : idx === etapaAtual ? (
                      idx === 0 ? (
                        <Link to="/criar-projeto" className="px-3 py-1 rounded-full font-medium bg-oraculo-blue text-white hover:underline">{step}</Link>
                      ) : idx === 2 ? (
                        <Link to={`/projeto/${id}/alterar-com-ia`} className="px-3 py-1 rounded-full font-medium bg-oraculo-blue text-white hover:underline">{step}</Link>
                      ) : (
                        <span className="px-3 py-1 rounded-full font-medium bg-oraculo-blue text-white">{step}</span>
                      )
                    ) : (
                      <span className="px-3 py-1 rounded-full font-medium bg-gray-200 text-gray-700">{step}</span>
                    )}
                    {idx < steps.length - 1 && <span className="text-gray-400">→</span>}
                  </li>
                ))}
              </ol>
            </nav>
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
              <p className="text-gray-700 whitespace-pre-line">{projeto.descricao}</p>
            </div>
          </div>
          <aside className="hidden lg:block w-full max-w-sm ml-8">
            <div className="bg-gradient-to-br from-oraculo-blue/10 to-oraculo-purple/10 border-l-4 border-oraculo-blue rounded-xl p-6 shadow flex flex-col gap-2">
              <img src={AnalisarImg} alt="Análise do Oráculo" className="rounded-lg mb-3 w-full object-cover max-h-40" />
              <h2 className="text-lg font-semibold text-oraculo-blue mb-2 flex items-center gap-2">
                <span role="img" aria-label="Dica">🤖</span> Como funciona a análise do Oráculo
              </h2>
              <p className="text-gray-700 text-sm mb-2">
                Agora chegou a hora de avaliar seu projeto.<br/><br/>
                O Oráculo olha seu projeto como um avaliador, levando em conta não só os critérios do edital, mas também os últimos selecionados e uma base grande de projetos culturais bem-sucedidos.<br/><br/>
                Ele não vai alterar seu projeto, mas sim sugerir mudanças, que você pode aceitar ou não.
              </p>
              <Button size="lg" className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-lg px-8 py-4 flex items-center gap-2 mt-2" onClick={analisarComIA} disabled={analisando}>
                <Brain className="h-6 w-6" />
                {analisando ? 'Analisando...' : 'Analisar com IA'}
              </Button>
              {analise && (
                <div className="mt-6 bg-white border rounded-lg p-4 text-gray-800 whitespace-pre-line text-sm shadow">
                  <strong className="block text-oraculo-blue mb-2">Análise do Oráculo:</strong>
                  {analise}
                </div>
              )}
              {erroIA && (
                <div className="mt-4 text-red-500 text-sm text-center">{erroIA}</div>
              )}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
};

export default Projeto; 