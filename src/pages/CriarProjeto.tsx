import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '@/lib/firebase';
import { getFirestore, collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import CriarImg from '@/assets/Criar.jpeg';
import { Link } from 'react-router-dom';

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
    try {
      const user = auth.currentUser;
      if (!user) {
        setErro('Você precisa estar logado para criar um projeto.');
        setLoading(false);
        return;
      }
      const db = getFirestore();
      await addDoc(collection(db, 'projetos'), {
        nome,
        descricao,
        categoria,
        edital_associado: editalAssociado,
        data_criacao: serverTimestamp(),
        data_atualizacao: serverTimestamp(),
        user_id: user.uid,
      });
      navigate('/oraculo-ai');
    } catch (err: any) {
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
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white py-2.5 rounded-lg font-semibold shadow hover:opacity-90 transition"
                disabled={loading}
              >
                {loading ? 'Salvando...' : 'Criar projeto'}
              </button>
            </form>
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