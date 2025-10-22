import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc, DocumentData } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Brain, Loader2 } from 'lucide-react';
import AnalisarImg from '@/assets/Analisar.jpeg';
import OpenAI from 'openai';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';

const steps = [
  'Criar Projeto',
  'Avaliar com IA',
  'Alterar com IA',
  'Gerar Textos'
];
const currentStep: number = 2; // Alterar com IA

interface Projeto extends DocumentData {
  id: string;
  descricao?: string;
  edital_associado?: string;
  analise_ia?: string;
  // Add other properties as needed
}

const AlterarComIA = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [editalNome, setEditalNome] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [analise, setAnalise] = useState<string | null>(null);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [descricaoEditada, setDescricaoEditada] = useState<string>('');
  const [aprovacoes, setAprovacoes] = useState<boolean[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    document.title = 'Alterar com IA - Oráculo Cultural';
  }, []);

  // Verificar status premium do usuário
  useEffect(() => {
    const checkPremiumStatus = async () => {
      if (!user) return;
      try {
        const db = getFirestore();
        // Changed from 'users' to 'usuarios' to match the webhook
        const userRef = doc(db, 'usuarios', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          console.log('User data from Firestore:', userData);
          setIsPremium(userData.isPremium === true);
        }
      } catch (error) {
        console.error('Erro ao verificar status premium:', error);
      }
    };
    checkPremiumStatus();
  }, [user]);

  // Função para verificar premium e redirecionar se necessário
  const checkPremiumAccess = () => {
    if (!isPremium) {
      navigate('/cadastro-premium');
      return false;
    }
    return true;
  };

  useEffect(() => {
    const fetchProjeto = async () => {
      if (!id) return;
      setLoading(true);
      const db = getFirestore();
      try {
        console.log('Fetching project with ID:', id);
        const ref = doc(db, 'projetos', id);
        const snap = await getDoc(ref);
        
        if (!snap.exists()) {
          console.error('Project not found');
          setLoading(false);
          return;
        }

        const data = { id: snap.id, ...snap.data() } as Projeto;
        console.log('Project data:', data);
        setProjeto(data);
        setAnalise((data as any).analise_ia || null);
        setDescricaoEditada(data.descricao || '');
        
        // Fetch edital name if edital_associado exists
        if (data.edital_associado) {
          console.log('Fetching edital with ID:', data.edital_associado);
          try {
            const editalRef = doc(db, 'editais', data.edital_associado);
            console.log('Edital ref path:', editalRef.path);
            const editalSnap = await getDoc(editalRef);
            
            console.log('Edital document exists:', editalSnap.exists());
            if (editalSnap.exists()) {
              const editalData = editalSnap.data();
              console.log('Edital document data:', editalData);
              
              // Check all possible name fields
              const possibleNameFields = ['nome', 'titulo', 'name', 'title', 'editalName'];
              const nameField = possibleNameFields.find(field => field in editalData);
              console.log('Available fields in edital document:', Object.keys(editalData));
              
              const name = nameField ? editalData[nameField] : `Edital: ${data.edital_associado}`;
              console.log('Using field for name:', nameField, 'Value:', name);
              setEditalNome(name);
            } else {
              console.warn('Edital document not found, using ID as fallback');
              setEditalNome(`Edital: ${data.edital_associado}`);
            }
          } catch (error) {
            console.error('Error fetching edital:', error);
            setEditalNome(`Edital: ${data.edital_associado}`);
          }
        }
        
        // Load saved approvals
        if (Array.isArray(data.sugestoes_aprovadas)) {
          setAprovacoes(data.sugestoes_aprovadas);
        }
      } catch (error) {
        console.error('Error in fetchProjeto:', error);
      } finally {
        setLoading(false);
      }
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
    // Verificar se o usuário é premium
    if (!checkPremiumAccess()) {
      return;
    }
    
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
    // Verificar se o usuário é premium
    if (!checkPremiumAccess()) {
      return;
    }
    
    if (!id) return;
    setSalvando(true);
    try {
      const db = getFirestore();
      const ref = doc(db, 'projetos', id);
      await updateDoc(ref, { descricao: descricaoEditada, sugestoes_aprovadas: aprovacoes });
      // Navega para a página de Gerar Textos após salvar
      navigate(`/projeto/${id}/gerar-textos`);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      alert('Ocorreu um erro ao salvar as alterações. Por favor, tente novamente.');
    } finally {
      setSalvando(false);
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
        
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Alterar com IA
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Use a IA para melhorar seu projeto com base nas sugestões fornecidas.
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
              <div className="p-4">
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
                <div className="flex gap-2">
                  <Button onClick={handleSalvar} disabled={salvando || gerando} className="mb-4">
                    {salvando ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                  <Button 
                    onClick={() => id && navigate(`/projeto/${id}/gerar-textos`)}
                    className="mb-4 bg-oraculo-blue hover:bg-oraculo-blue/90"
                  >
                    Gerar Textos
                  </Button>
                </div>
              </div>
              {sugestoes.length > 0 && (
                <div className="p-4">
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
              <div className="p-4 bg-gray-50 border-t">
                <strong className="block text-oraculo-blue mb-2">Análise do Oráculo:</strong>
                {analise ? analise : <span className="text-gray-400">Nenhuma análise encontrada para este projeto.</span>}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AlterarComIA;