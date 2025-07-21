import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '@/lib/firebase';
import { getFirestore, collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import CriarImg from '@/assets/Criar.jpeg';
import { Link } from 'react-router-dom';
import OpenAI from 'openai';

const categorias = [
  'Audiovisual',
  'Teatro',
  'Dança',
  'Música',
  'Literatura',
  'Artes Visuais',
  'Cultura Popular',
  'Patrimônio',
  'Circo',
  'Outra'
];

const steps = [
  'Criar Projeto',
  'Avaliar com IA',
  'Alterar com IA',
  'Gerar Textos',
  'Gerar Orçamento',
  'Gerar Cronograma',
  'Gerar Cartas de anuência'
];
const currentStep = 0; // Criar Projeto

const CriarProjeto = () => {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('Outra');
  const [editalAssociado, setEditalAssociado] = useState('');
  const [editais, setEditais] = useState<any[]>([]);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [resumo, setResumo] = useState('');
  const [showResumo, setShowResumo] = useState(false);
  const [etapasIA] = useState([
    'Lendo projeto',
    'Extraindo pontos-chave',
    'Resumindo',
    'Salvando projeto',
  ]);
  const [etapaAtualIA, setEtapaAtualIA] = useState<number>(0);

  useEffect(() => {
    const fetchEditais = async () => {
      const db = getFirestore();
      const snap = await getDocs(collection(db, 'editais'));
      setEditais(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchEditais();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    setEtapaAtualIA(0);
    try {
      const user = auth.currentUser;
      if (!user) {
        setErro('Você precisa estar logado para criar um projeto.');
        setLoading(false);
        return;
      }
      setEtapaAtualIA(1); // Extraindo pontos-chave
      // (Simulação de extração, pode ser expandido no futuro)
      setEtapaAtualIA(2); // Resumindo
      // Chama a OpenAI para gerar o resumo
      const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY, dangerouslyAllowBrowser: true });
      const prompt = `Resuma de forma objetiva o projeto cultural abaixo, destacando: objetivo, justificativa, público-alvo, orçamento estimado, cronograma e diferenciais. O resumo deve ser claro, direto e útil para avaliação em editais.\n\nTEXTO DO PROJETO:\n${descricao}`;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Você é um especialista em projetos culturais.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.3,
      });
      const resumoGerado = completion.choices[0].message?.content || '';
      setResumo(resumoGerado);
      setShowResumo(true);
      setEtapaAtualIA(3); // Salvando projeto
      // Salva no Firestore
      const db = getFirestore();
      const docRef = await addDoc(collection(db, 'projetos'), {
        nome,
        descricao,
        resumo: resumoGerado,
        categoria,
        edital_associado: editalAssociado,
        data_criacao: serverTimestamp(),
        data_atualizacao: serverTimestamp(),
        user_id: user.uid,
        etapa_atual: 1, // já vai para Avaliar com IA
      });
      // Redireciona para Avaliar com IA
      navigate(`/projeto/${docRef.id}`);
    } catch (err) {
      setErro('Erro ao criar projeto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 flex items-start justify-start p-8 gap-8 animate-fade-in">
          <div className="w-full max-w-md">
            {/* Breadcrumbs/Stepper */}
            <nav className="mb-8">
              <ol className="flex flex-wrap items-center gap-2 text-sm">
                {steps.map((step, idx) => (
                  <li key={step} className="flex items-center gap-2">
                    {idx === 0 ? (
                      <span className={`px-3 py-1 rounded-full font-medium ${idx === currentStep ? 'bg-oraculo-blue text-white' : 'bg-gray-200 text-gray-700'}`}>{step}</span>
                    ) : (
                      <span className={`px-3 py-1 rounded-full font-medium bg-gray-200 text-gray-700`}>{step}</span>
                    )}
                    {idx < steps.length - 1 && <span className="text-gray-400">→</span>}
                  </li>
                ))}
              </ol>
            </nav>
            <h1 className="text-2xl font-bold text-gray-900 mb-6 text-left">Criar novo projeto</h1>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Nome do projeto</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Categoria</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                  value={categoria}
                  onChange={e => setCategoria(e.target.value)}
                  required
                >
                  {categorias.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Edital associado</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                  value={editalAssociado}
                  onChange={e => setEditalAssociado(e.target.value)}
                >
                  <option value="">Nenhum</option>
                  {editais.map((edital) => (
                    <option key={edital.id} value={edital.nome}>{edital.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Descrição</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition min-h-[160px]"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  required
                  placeholder="Cole aqui todas as informações do seu projeto cultural. Depois vamos refinar o projeto com uso de IA e análise dos últimos selecionados do edital."
                />
              </div>
              {erro && <div className="text-red-500 text-sm text-center">{erro}</div>}
              {loading && (
                <div className="mb-4">
                  <div className="bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 text-gray-700 text-sm font-medium text-center animate-pulse">
                    {etapasIA[etapaAtualIA]}
                  </div>
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white py-2.5 rounded-lg font-semibold shadow hover:opacity-90 transition"
                disabled={loading}
              >
                {loading ? 'Salvando...' : 'Criar projeto'}
              </button>
            </form>
            {showResumo && resumo && (
              <div className="bg-white border rounded-lg p-4 shadow mb-4">
                <h2 className="text-lg font-bold text-oraculo-blue mb-2">Resumo gerado pela IA</h2>
                <div className="whitespace-pre-line text-gray-800 text-sm">{resumo}</div>
                <div className="text-xs text-gray-500 mt-2">Você será redirecionado em instantes...</div>
              </div>
            )}
          </div>
          <aside className="hidden lg:block w-full max-w-sm ml-8">
            <div className="bg-gradient-to-br from-oraculo-blue/10 to-oraculo-purple/10 border-l-4 border-oraculo-blue rounded-xl p-6 shadow flex flex-col gap-2">
              <img src={CriarImg} alt="Dica do Oráculo" className="rounded-lg mb-3 w-full object-cover max-h-40" />
              <h2 className="text-lg font-semibold text-oraculo-blue mb-2 flex items-center gap-2">
                <span role="img" aria-label="Dica">💡</span> Dica do Oráculo
              </h2>
              <p className="text-gray-700 text-sm mb-2">
                Este é o seu primeiro passo!<br/>
                <br/>
                É fundamental que a ideia inicial do projeto venha do seu repertório, da sua vivência e dos seus sonhos.<br/>
                <br/>
                A IA pode ajudar a refinar, estruturar e potencializar sua proposta, mas a originalidade e a autenticidade nascem de você.<br/>
                <br/>
                Use este espaço para colocar tudo o que faz seu projeto ser único — depois, juntos, vamos aprimorar com inteligência artificial e exemplos de projetos já selecionados.
              </p>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
};

export default CriarProjeto; 