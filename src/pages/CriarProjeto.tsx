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
  'Gerar Textos'
];
const currentStep: number = 0; // Criar Projeto

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
      
      <div className="flex-1 flex flex-col md:ml-64">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Criar Novo Projeto
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Preencha os detalhes do seu projeto cultural para começar a usar o Oráculo AI.
              </p>
            </div>

            {/* Barra de progresso */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                {steps.map((step, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${index <= currentStep ? 'bg-oraculo-blue text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {index + 1}
                    </div>
                    <span className={`text-xs mt-1 text-center ${index === currentStep ? 'font-medium text-oraculo-blue' : 'text-gray-500'}`}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-oraculo-blue h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${(currentStep + 1) * 25}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-8">
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
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CriarProjeto;