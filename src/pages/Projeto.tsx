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
  const [statusIA, setStatusIA] = useState<string>('');
  const [subEtapasIA, setSubEtapasIA] = useState<string[]>([]);
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
        const data = { id: snap.id, ...(snap.data() as any) };
        setProjeto(data);
        setEtapaAtual(typeof (data as any).etapa_atual === 'number' ? (data as any).etapa_atual : 1);
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
        criterios: editalDoc.criterios || '',
        texto_selecionados: editalDoc.texto_selecionados || '',
      };
    }
    return { texto_edital: '', criterios: '', texto_selecionados: '' };
  };

  // Função para analisar com IA
  const analisarComIA = async () => {
    setAnalisando(true);
    setAnalise(null);
    setErroIA(null);
    setSubEtapasIA([]);
    try {
      setStatusIA('Coletando dados do projeto e edital...');
      setSubEtapasIA(['Lendo o texto do projeto...', 'Lendo o edital...', 'Lendo critérios do edital...']);
      let dadosConsolidados = {
        texto_edital: '',
        criterios: '',
        texto_selecionados: '',
        nome_edital: projeto.edital_associado || '',
        resumo_projeto: projeto.resumo || projeto.descricao?.slice(0, 2000) || '',
      };
      if (projeto.edital_associado) {
        const res = await fetchEditalESelecionados(projeto.edital_associado);
        console.log('[Oraculo] Dados do edital associado:', res);
        dadosConsolidados.texto_edital = res.texto_edital;
        dadosConsolidados.criterios = res.criterios;
        dadosConsolidados.texto_selecionados = res.texto_selecionados;
      }
      // Validação e fallback dos critérios
      if (!dadosConsolidados.criterios) {
        // Tenta extrair critérios do texto do edital (simplesmente pega um trecho, pode ser melhorado com IA no futuro)
        if (dadosConsolidados.texto_edital) {
          // Exemplo: tenta pegar linhas que contenham "critério" ou "avaliação"
          const possiveis = dadosConsolidados.texto_edital.split('\n').filter(l => /crit[eé]rio|avalia[cç][aã]o|pontua[cç][aã]o/i.test(l));
          if (possiveis.length > 0) {
            dadosConsolidados.criterios = possiveis.join(' ');
          }
        }
        if (!dadosConsolidados.criterios) {
          alert('Atenção: O campo CRITÉRIOS do edital está vazio ou não foi encontrado. O resultado da IA pode ser prejudicado. Verifique o cadastro do edital no Firestore.');
        }
      }
      setStatusIA('Construindo prompt para análise...');
      setSubEtapasIA(prev => [...prev, 'Cruzando projeto com critérios do edital...', 'Comparando com projetos selecionados anteriores...', 'Preparando dados para IA...']);
      // Monta o prompt só agora, com todos os dados já consolidados
      const prompt = `Você é um avaliador de projetos culturais. Avalie o projeto abaixo considerando especialmente o edital selecionado: "${dadosConsolidados.nome_edital}". Utilize os critérios desse edital de forma recorrente em sua análise, citando-os explicitamente sempre que possível.\n\nPROJETO:\n${dadosConsolidados.resumo_projeto}\n\nEDITAL SELECIONADO: ${dadosConsolidados.nome_edital || 'Nenhum'}\nCRITÉRIOS DO EDITAL:\n${dadosConsolidados.criterios || dadosConsolidados.texto_edital || 'Nenhum critério de edital fornecido.'}\n\nPROJETOS SELECIONADOS ANTERIORES (para contexto comparativo):\n${dadosConsolidados.texto_selecionados ? dadosConsolidados.texto_selecionados.slice(0, 3000) : 'Nenhum texto de projetos selecionados fornecido.'}\n\nForneça uma análise detalhada com:\n1. Adequação aos critérios do edital (✅/❌) - cite o edital e os critérios\n2. Pontos fortes do projeto\n3. Pontos fracos do projeto\n4. Sugestões de melhoria: Liste as sugestões para aumentar a chance de aprovação, cada uma começando explicitamente com \"Sugestão: \" e relacionando com o edital quando possível\n5. Nota estimada (0-100)\n\nANÁLISE DETALHADA:`;
      setStatusIA('Enviando para análise da IA...');
      setSubEtapasIA(prev => [...prev, 'Enviando dados para IA...', 'Aguardando resposta da IA...']);
      const endpoint = '/api/analisar-projeto';
      const payload = { prompt };
      console.log('[Oraculo] Chamando endpoint:', endpoint);
      console.log('[Oraculo] Payload enviado:', payload);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log('[Oraculo] Status da resposta:', response.status);
      let data;
      const text = await response.text();
      console.log('[Oraculo] Texto da resposta:', text);
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        console.error('[Oraculo] Erro ao fazer parse do JSON:', text);
        throw new Error('Resposta inválida do servidor: ' + text);
      }
      if (!response.ok) {
        console.error('[Oraculo] Erro HTTP:', response.status, data && data.error);
        throw new Error((data && data.error) || `Erro HTTP: ${response.status}`);
      }
      setSubEtapasIA(prev => [...prev, 'Recebendo análise da IA...', 'Processando resultado...']);
      const analiseIA = data.analise;
      setAnalise(analiseIA);
      setStatusIA('Análise concluída!');
      setSubEtapasIA(prev => [...prev, 'Análise concluída!']);
      if (id) {
        const db = getFirestore();
        const ref = doc(db, 'projetos', id);
        await updateDoc(ref, { analise_ia: analiseIA });
        if (etapaAtual < 2) await avancarEtapa(2);
        setAnalise(null); // Limpa a análise antes de redirecionar
        navigate(`/projeto/${id}/alterar-com-ia`);
      }
    } catch (e: any) {
      setErroIA(e.message || 'Ocorreu um erro desconhecido ao processar a análise.');
      console.error(e);
    } finally {
      setAnalisando(false);
      setStatusIA('');
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
              <h2 className="text-lg font-semibold mb-1">Resumo do Projeto</h2>
              <p className="text-gray-700 whitespace-pre-line">{projeto.resumo || projeto.descricao}</p>
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
              {analisando && statusIA && (
                <div className="mt-4 mb-2 bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 text-gray-700 text-sm font-medium text-center animate-pulse">
                  {statusIA}
                  <ul className="mt-2 text-left text-xs text-gray-600 list-disc list-inside">
                    {subEtapasIA.map((etapa, idx) => (
                      <li key={idx}>{etapa}</li>
                    ))}
                  </ul>
                </div>
              )}
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