import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, Save, DollarSign, Sparkles } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RubricaOrcamento {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  quantidadeUnidade: number;
  valorUnitario: number;
  total: number;
}

interface ProjetoDocument {
  id: string;
  nome?: string;
  edital_id?: string;
  orcamento?: {
    teto: number;
    rubricas: RubricaOrcamento[];
  };
  [key: string]: any;
}

interface EditalDocument {
  id: string;
  teto?: number;
  valor_maximo?: number;
  orcamento_limite?: number;
  limite_orcamento?: number;
  [key: string]: any;
}

const UNIDADES = [
  'achê',
  'serviço',
  'dia',
  'dias',
  'mês',
  'meses',
  'semana',
  'semanas',
  'quilômetro',
  'quilômetros',
  'km',
  'locação',
  'pessoa',
  'pessoas',
  'verba',
  'verbas',
  'unidade',
  'unidades',
  'hora',
  'horas'
];

const CriarOrcamento = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [projeto, setProjeto] = useState<ProjetoDocument | null>(null);
  const [edital, setEdital] = useState<EditalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [gerandoOrcamento, setGerandoOrcamento] = useState(false);
  const [tetoOrcamento, setTetoOrcamento] = useState<number>(0);
  const [rubricas, setRubricas] = useState<RubricaOrcamento[]>([]);

  const steps = ['Criação do Projeto', 'Detalhamento', 'Alterar com IA', 'Gerar Textos', 'Criar Orçamento', 'Preencher Anexos'];
  const currentStep = 4;

  useEffect(() => {
    const fetchProjeto = async () => {
      if (!id || !user) {
        setLoading(false);
        navigate('/');
        return;
      }

      setLoading(true);
      try {
        const db = getFirestore();
        const projetoRef = doc(db, 'projetos', id);
        const projetoSnap = await getDoc(projetoRef);

        if (!projetoSnap.exists()) {
          console.error('Projeto não encontrado');
          setLoading(false);
          navigate('/');
          return;
        }

        const projetoData = {
          id: projetoSnap.id,
          ...projetoSnap.data()
        } as ProjetoDocument;

        setProjeto(projetoData);

        // Buscar edital para obter o teto do orçamento
        if (projetoData.edital_id) {
          try {
            const editalRef = doc(db, 'editais', projetoData.edital_id);
            const editalSnap = await getDoc(editalRef);
            
            if (editalSnap.exists()) {
              const editalData = {
                id: editalSnap.id,
                ...editalSnap.data()
              } as EditalDocument;
              
              setEdital(editalData);
              
              // Buscar teto do orçamento do edital (tentar diferentes campos possíveis)
              const tetoEdital = editalData.teto || 
                                 editalData.valor_maximo || 
                                 editalData.orcamento_limite || 
                                 editalData.limite_orcamento || 
                                 0;
              
              // Só definir o teto do edital se não houver um já salvo no orçamento
              if (tetoEdital > 0) {
                // Verificar se já existe um teto salvo no orçamento do projeto
                if (!projetoData.orcamento?.teto || projetoData.orcamento.teto === 0) {
                  setTetoOrcamento(tetoEdital);
                }
              }
            }
          } catch (error) {
            console.error('Erro ao buscar edital:', error);
          }
        }

        // Carregar orçamento existente se houver
        if (projetoData.orcamento) {
          // Se já tem teto salvo no orçamento, usar ele (pode ter sido editado)
          if (projetoData.orcamento.teto && projetoData.orcamento.teto > 0) {
            setTetoOrcamento(projetoData.orcamento.teto);
          }
          setRubricas(projetoData.orcamento.rubricas || []);
        } else {
          // Inicializar com uma rubrica vazia
          setRubricas([{
            id: Date.now().toString(),
            nome: '',
            quantidade: 1,
            unidade: 'unidade',
            quantidadeUnidade: 1,
            valorUnitario: 0,
            total: 0
          }]);
        }

        setLoading(false);
      } catch (error) {
        console.error('Erro ao carregar projeto:', error);
        setLoading(false);
      }
    };

    fetchProjeto();
  }, [id, navigate, user]);

  // Calcular total da linha automaticamente
  const calcularTotal = (quantidade: number, quantidadeUnidade: number, valorUnitario: number): number => {
    return quantidade * quantidadeUnidade * valorUnitario;
  };

  // Atualizar rubrica
  const atualizarRubrica = (id: string, campo: keyof RubricaOrcamento, valor: any) => {
    setRubricas(prev => prev.map(rubrica => {
      if (rubrica.id === id) {
        const atualizada = { ...rubrica, [campo]: valor };
        
        // Recalcular total se quantidade, quantidadeUnidade ou valorUnitario mudaram
        if (campo === 'quantidade' || campo === 'quantidadeUnidade' || campo === 'valorUnitario') {
          atualizada.total = calcularTotal(
            campo === 'quantidade' ? valor : atualizada.quantidade,
            campo === 'quantidadeUnidade' ? valor : atualizada.quantidadeUnidade,
            campo === 'valorUnitario' ? valor : atualizada.valorUnitario
          );
        }
        
        return atualizada;
      }
      return rubrica;
    }));
  };

  // Adicionar nova rubrica
  const adicionarRubrica = () => {
    setRubricas(prev => [...prev, {
      id: Date.now().toString(),
      nome: '',
      quantidade: 1,
      unidade: 'unidade',
      quantidadeUnidade: 1,
      valorUnitario: 0,
      total: 0
    }]);
  };

  // Remover rubrica
  const removerRubrica = (id: string) => {
    if (rubricas.length === 1) {
      alert('É necessário ter pelo menos uma rubrica.');
      return;
    }
    setRubricas(prev => prev.filter(r => r.id !== id));
  };

  // Calcular total geral
  const calcularTotalGeral = (): number => {
    return rubricas.reduce((total, rubrica) => total + rubrica.total, 0);
  };

  // Gerar orçamento com IA em streaming
  const gerarOrcamento = async () => {
    if (!projeto) {
      alert('Erro: Projeto não carregado.');
      return;
    }

    if (!tetoOrcamento || tetoOrcamento <= 0) {
      alert('Por favor, defina um teto de orçamento antes de gerar.');
      return;
    }

    setGerandoOrcamento(true);
    // Limpar rubricas existentes para começar do zero
    setRubricas([]);
    
    try {
      // Buscar dados do projeto para enviar à IA
      const descricaoProjeto = projeto.descricao || '';
      const nomeProjeto = projeto.nome || 'Projeto';
      const resumoProjeto = projeto.resumo || '';

      // Buscar portfolio do usuário se houver
      let portfolioTexto = '';
      if (user) {
        try {
          const db = getFirestore();
          const userDocRef = doc(db, 'usuarios', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            portfolioTexto = userDoc.data().portfolio || '';
          }
        } catch (err) {
          console.error('Erro ao buscar portfolio:', err);
        }
      }

      const endpoint = 'https://us-central1-culturalapp-fb9b0.cloudfunctions.net/gerarTextosProjeto';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projetoId: id,
          tipo: 'orcamento',
          dadosProjeto: {
            ...projeto,
            portfolio: portfolioTexto,
            teto: tetoOrcamento // Enviar teto nos dados do projeto
          },
          prompt: `Gere um orçamento detalhado para o projeto. TETO MÁXIMO ABSOLUTO: R$ ${tetoOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. CRÍTICO: A soma de TODAS as rubricas DEVE ser igual ou menor que R$ ${tetoOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Gere rubricas variadas e detalhadas, distribuindo o valor total entre elas de forma coerente com as necessidades do projeto.`,
          userId: user?.uid
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro ao gerar orçamento: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      // Processar resposta streaming e ir criando rubricas progressivamente
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let textoAcumulado = '';
      let idCounter = Date.now();
      let rubricasProcessadas = new Set<string>();

      if (!reader) {
        throw new Error('Não foi possível ler a resposta do servidor');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              break;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              // Processar chunks de conteúdo em streaming
              if (parsed.type === 'chunk' && parsed.content) {
                textoAcumulado += parsed.content;
                
                // Processar e extrair rubricas progressivamente a cada chunk
                // Usar debounce para não processar a cada caractere
                clearTimeout((window as any).timeoutRubricas);
                (window as any).timeoutRubricas = setTimeout(() => {
                  setRubricas(prev => {
                    // Extrair todas as rubricas do texto acumulado até agora
                    const todasRubricas = extrairRubricasDoTextoStream(textoAcumulado, idCounter);
                    
                    // Criar um mapa de rubricas únicas baseado em nome+valor
                    const mapaRubricas = new Map<string, RubricaOrcamento>();
                    
                    // Primeiro, adicionar as existentes
                    prev.forEach(r => {
                      const chave = `${r.nome.toLowerCase().trim()}_${Math.round(r.total * 100)}`;
                      if (!mapaRubricas.has(chave)) {
                        mapaRubricas.set(chave, r);
                      }
                    });
                    
                    // Depois, adicionar novas rubricas
                    todasRubricas.forEach(rubrica => {
                      const chave = `${rubrica.nome.toLowerCase().trim()}_${Math.round(rubrica.total * 100)}`;
                      if (!mapaRubricas.has(chave) && rubrica.nome.trim() && rubrica.total > 0) {
                        mapaRubricas.set(chave, rubrica);
                      }
                    });
                    
                    const todasAtualizadas = Array.from(mapaRubricas.values());
                    
                    // Verificar e ajustar para respeitar o teto máximo
                    let totalAtual = todasAtualizadas.reduce((sum, r) => sum + r.total, 0);
                    if (totalAtual > tetoOrcamento && todasAtualizadas.length > 0) {
                      // Redimensionar proporcionalmente para respeitar o teto
                      const fatorAjuste = tetoOrcamento / totalAtual;
                      todasAtualizadas.forEach(r => {
                        r.total = Math.round(r.total * fatorAjuste * 100) / 100;
                        r.valorUnitario = r.total;
                      });
                    }
                    
                    return todasAtualizadas;
                  });
                }, 500); // Processar a cada 500ms para evitar muitas atualizações
              }
              
              // Processar quando completo
              if (parsed.type === 'complete') {
                clearTimeout((window as any).timeoutRubricas);
                const textoFinal = parsed.fullText || textoAcumulado;
                setRubricas(prev => {
                  // Extrair todas as rubricas do texto final
                  const rubricasFinais = extrairRubricasDoTexto(textoFinal);
                  
                  // Garantir que o total não ultrapasse o teto
                  let totalFinal = rubricasFinais.reduce((sum, r) => sum + r.total, 0);
                  if (totalFinal > tetoOrcamento && rubricasFinais.length > 0) {
                    // Redimensionar proporcionalmente
                    const fatorAjuste = tetoOrcamento / totalFinal;
                    rubricasFinais.forEach(r => {
                      r.total = Math.round(r.total * fatorAjuste * 100) / 100;
                      r.valorUnitario = r.total;
                    });
                  }
                  
                  return rubricasFinais.length > 0 ? rubricasFinais : prev;
                });
              }
            } catch (e) {
              // Ignorar erros de parsing, continuar processando
              console.debug('Erro ao parsear chunk:', e);
            }
          }
        }
      }

      // Se chegou aqui sem evento complete, processar texto final acumulado
      if (textoAcumulado) {
        setRubricas(prev => {
          // Se já processou rubricas no streaming, só ajustar se necessário
          if (prev.length > 0) {
            let totalAtual = prev.reduce((sum, r) => sum + r.total, 0);
            if (totalAtual > tetoOrcamento) {
              const fatorAjuste = tetoOrcamento / totalAtual;
              const ajustadas = prev.map(r => ({
                ...r,
                total: Math.round(r.total * fatorAjuste * 100) / 100,
                valorUnitario: Math.round(r.total * fatorAjuste * 100) / 100
              }));
              return ajustadas;
            }
            return prev;
          }
          
          // Se não tem rubricas, processar texto final
          const rubricasFinais = extrairRubricasDoTexto(textoAcumulado);
          let totalFinal = rubricasFinais.reduce((sum, r) => sum + r.total, 0);
          
          if (totalFinal > tetoOrcamento && rubricasFinais.length > 0) {
            const fatorAjuste = tetoOrcamento / totalFinal;
            rubricasFinais.forEach(r => {
              r.total = Math.round(r.total * fatorAjuste * 100) / 100;
              r.valorUnitario = r.total;
            });
          }
          
          return rubricasFinais.length > 0 ? rubricasFinais : prev;
        });
      }

    } catch (error) {
      console.error('Erro ao gerar orçamento:', error);
      alert(`Erro ao gerar orçamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setGerandoOrcamento(false);
    }
  };

  // Extrair rubricas do texto em streaming (versão otimizada para processamento incremental)
  const extrairRubricasDoTextoStream = (texto: string, idCounterBase: number): RubricaOrcamento[] => {
    const rubricas: RubricaOrcamento[] = [];
    const linhas = texto.split('\n');
    
    let idCounter = idCounterBase;
    const rubricasProcessadas = new Set<string>();
    
    linhas.forEach((linha, index) => {
      const linhaLimpa = linha.trim();
      if (!linhaLimpa) return;

      // Padrão 1: "Nome: R$ valor" ou "Nome - R$ valor"
      const padrao1 = /^(.+?)\s*[:\-]\s*R\$\s*([\d.,]+)/i;
      const match1 = linhaLimpa.match(padrao1);

      if (match1) {
        const nome = match1[1].trim().replace(/^\d+[\.\)]\s*/, '');
        const valorStr = match1[2].trim().replace(/\./g, '').replace(',', '.');
        const valorTotal = parseFloat(valorStr) || 0;
        
        const chave = `${nome.toLowerCase()}_${valorTotal}`;
        if (nome && valorTotal > 0 && !rubricasProcessadas.has(chave)) {
          rubricasProcessadas.add(chave);
          rubricas.push({
            id: (idCounter++).toString(),
            nome,
            quantidade: 1,
            unidade: 'unidade',
            quantidadeUnidade: 1,
            valorUnitario: valorTotal,
            total: valorTotal
          });
        }
      }

      // Padrão 2: Linhas que contêm valores monetários e nomes
      if (!match1) {
        const padrao2 = /R\$\s*([\d.,]+)/i;
        const match2 = linhaLimpa.match(padrao2);

        if (match2) {
          const partes = linhaLimpa.split(/R\$/i);
          if (partes.length >= 2) {
            const nome = partes[0].trim().replace(/^\d+[\.\)]\s*/, '').replace(/[:\-]\s*$/, '');
            const valorStr = match2[1].trim().replace(/\./g, '').replace(',', '.');
            const valorTotal = parseFloat(valorStr) || 0;
            
            const chave = `${nome.toLowerCase()}_${valorTotal}`;
            if (nome && valorTotal > 0 && nome.length > 2 && !rubricasProcessadas.has(chave)) {
              rubricasProcessadas.add(chave);
              rubricas.push({
                id: (idCounter++).toString(),
                nome,
                quantidade: 1,
                unidade: 'unidade',
                quantidadeUnidade: 1,
                valorUnitario: valorTotal,
                total: valorTotal
              });
            }
          }
        }
      }
    });

    return rubricas;
  };

  // Extrair rubricas do texto do orçamento (versão completa)
  const extrairRubricasDoTexto = (texto: string): RubricaOrcamento[] => {
    const rubricas: RubricaOrcamento[] = [];
    const linhas = texto.split('\n');
    
    let idCounter = Date.now();
    const rubricasProcessadas = new Set<string>();
    
    linhas.forEach((linha) => {
      const linhaLimpa = linha.trim();
      if (!linhaLimpa) return;

      // Padrão 1: "Nome: R$ valor" ou "Nome - R$ valor"
      const padrao1 = /^(.+?)\s*[:\-]\s*R\$\s*([\d.,]+)/i;
      const match1 = linhaLimpa.match(padrao1);

      if (match1) {
        const nome = match1[1].trim().replace(/^\d+[\.\)]\s*/, '');
        const valorStr = match1[2].trim().replace(/\./g, '').replace(',', '.');
        const valorTotal = parseFloat(valorStr) || 0;
        
        const chave = `${nome.toLowerCase().trim()}_${valorTotal}`;
        if (nome && valorTotal > 0 && !rubricasProcessadas.has(chave)) {
          rubricasProcessadas.add(chave);
          rubricas.push({
            id: (idCounter++).toString(),
            nome,
            quantidade: 1,
            unidade: 'unidade',
            quantidadeUnidade: 1,
            valorUnitario: valorTotal,
            total: valorTotal
          });
        }
      }

      // Padrão 2: Linhas que contêm valores monetários e nomes
      if (!match1) {
        const padrao2 = /R\$\s*([\d.,]+)/i;
        const match2 = linhaLimpa.match(padrao2);

        if (match2) {
          const partes = linhaLimpa.split(/R\$/i);
          if (partes.length >= 2) {
            const nome = partes[0].trim().replace(/^\d+[\.\)]\s*/, '').replace(/[:\-]\s*$/, '');
            const valorStr = match2[1].trim().replace(/\./g, '').replace(',', '.');
            const valorTotal = parseFloat(valorStr) || 0;
            
            const chave = `${nome.toLowerCase().trim()}_${valorTotal}`;
            if (nome && valorTotal > 0 && nome.length > 2 && !rubricasProcessadas.has(chave)) {
              rubricasProcessadas.add(chave);
              rubricas.push({
                id: (idCounter++).toString(),
                nome,
                quantidade: 1,
                unidade: 'unidade',
                quantidadeUnidade: 1,
                valorUnitario: valorTotal,
                total: valorTotal
              });
            }
          }
        }
      }
    });

    return rubricas;
  };

  // Salvar orçamento
  const salvarOrcamento = async () => {
    if (!id) return;

    setSalvando(true);
    try {
      const db = getFirestore();
      const projetoRef = doc(db, 'projetos', id);
      
      await updateDoc(projetoRef, {
        orcamento: {
          teto: tetoOrcamento,
          rubricas: rubricas,
          totalGeral: calcularTotalGeral(),
          atualizado_em: serverTimestamp()
        }
      });

      alert('Orçamento salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error);
      alert('Erro ao salvar orçamento. Por favor, tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-oraculo-blue mb-4" />
            <p className="text-gray-600">Carregando projeto...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="bg-white rounded-lg p-6 shadow-sm text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Erro ao carregar o projeto</h2>
            <p className="text-gray-600 mb-4">Não foi possível carregar as informações do projeto.</p>
            <Button onClick={() => navigate('/')} className="bg-oraculo-blue hover:bg-oraculo-blue/90">
              Voltar
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const totalGeral = calcularTotalGeral();
  const diferencaTeto = tetoOrcamento - totalGeral;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Criar Orçamento
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Crie um orçamento detalhado para o projeto "{projeto.nome || 'sem nome'}"
              </p>
            </div>

            {/* Barra de progresso */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                {steps.map((step, index) => {
                  const isClickable = index <= currentStep;
                  return (
                    <div
                      key={index}
                      className={`flex flex-col items-center ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    >
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                          index <= currentStep
                            ? 'bg-oraculo-blue text-white hover:bg-oraculo-blue/90'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <span
                        className={`text-xs mt-1 text-center transition-colors ${
                          index === currentStep
                            ? 'font-medium text-oraculo-blue'
                            : index < currentStep
                              ? 'text-oraculo-blue hover:underline'
                              : 'text-gray-500'
                        }`}
                      >
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-oraculo-blue h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              {/* Teto do Orçamento */}
              <div className="p-6 border-b">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <Label htmlFor="teto" className="text-base font-semibold mb-2 block">
                      Teto do Orçamento (R$)
                    </Label>
                    <Input
                      id="teto"
                      type="number"
                      step="0.01"
                      min="0"
                      value={tetoOrcamento === 0 ? '' : tetoOrcamento}
                      onChange={(e) => {
                        const valorDigitado = e.target.value;
                        // Se o campo está vazio, manter como 0 internamente mas mostrar vazio
                        if (valorDigitado === '' || valorDigitado.trim() === '') {
                          setTetoOrcamento(0);
                        } else {
                          const valor = parseFloat(valorDigitado) || 0;
                          setTetoOrcamento(valor);
                        }
                      }}
                      className="text-lg h-11"
                      placeholder="0.00"
                    />
                    {edital && tetoOrcamento > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        Sugerido do edital: {edital.titulo || edital.nome || 'Edital associado'} (você pode editar)
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col justify-end" style={{ paddingTop: '28px' }}>
                    <Button
                      onClick={gerarOrcamento}
                      disabled={gerandoOrcamento || tetoOrcamento <= 0}
                      className="bg-gradient-to-r from-oraculo-purple to-oraculo-blue hover:opacity-90 text-white px-6 py-2 h-11 whitespace-nowrap"
                    >
                      {gerandoOrcamento ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Gerar Orçamento
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tabela de Rubricas */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Rubricas do Orçamento</h2>
                  <Button
                    onClick={adicionarRubrica}
                    className="bg-oraculo-blue hover:bg-oraculo-blue/90 text-white"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Rubrica
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left p-3 font-semibold text-gray-700">Nome da Rubrica</th>
                        <th className="text-center p-3 font-semibold text-gray-700">Quantidade</th>
                        <th className="text-center p-3 font-semibold text-gray-700">Unidade</th>
                        <th className="text-center p-3 font-semibold text-gray-700">Qtd. Unidade</th>
                        <th className="text-center p-3 font-semibold text-gray-700">Valor Unitário (R$)</th>
                        <th className="text-center p-3 font-semibold text-gray-700">Total (R$)</th>
                        <th className="text-center p-3 font-semibold text-gray-700">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rubricas.map((rubrica, index) => (
                        <tr key={rubrica.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3">
                            <Input
                              value={rubrica.nome}
                              onChange={(e) => atualizarRubrica(rubrica.id, 'nome', e.target.value)}
                              placeholder="Ex: Material gráfico"
                              className="min-w-[200px]"
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={rubrica.quantidade}
                              onChange={(e) => atualizarRubrica(rubrica.id, 'quantidade', parseFloat(e.target.value) || 0)}
                              className="text-center w-20"
                            />
                          </td>
                          <td className="p-3">
                            <Select
                              value={rubrica.unidade}
                              onValueChange={(value) => atualizarRubrica(rubrica.id, 'unidade', value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UNIDADES.map((unidade) => (
                                  <SelectItem key={unidade} value={unidade}>
                                    {unidade}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={rubrica.quantidadeUnidade}
                              onChange={(e) => atualizarRubrica(rubrica.id, 'quantidadeUnidade', parseFloat(e.target.value) || 0)}
                              className="text-center w-24"
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={rubrica.valorUnitario}
                              onChange={(e) => atualizarRubrica(rubrica.id, 'valorUnitario', parseFloat(e.target.value) || 0)}
                              className="text-center w-28"
                            />
                          </td>
                          <td className="p-3">
                            <div className="text-center font-semibold text-gray-900 bg-gray-100 px-3 py-2 rounded">
                              {rubrica.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removerRubrica(rubrica.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold">
                        <td colSpan={5} className="p-3 text-right">
                          Total Geral:
                        </td>
                        <td className="p-3 text-center text-lg text-oraculo-blue">
                          {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                      {tetoOrcamento > 0 && (
                        <tr className="bg-blue-50">
                          <td colSpan={5} className="p-3 text-right">
                            Diferença (Teto - Total):
                          </td>
                          <td className={`p-3 text-center font-semibold ${
                            diferencaTeto >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {diferencaTeto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td></td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="p-6 border-t bg-gray-50 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/projeto/${id}/gerar-textos`)}
                  className="border-gray-300"
                >
                  Voltar
                </Button>
                <div className="flex gap-3">
                  <Button
                    onClick={salvarOrcamento}
                    disabled={salvando}
                    className="bg-oraculo-blue hover:bg-oraculo-blue/90 text-white"
                  >
                    {salvando ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Salvar Orçamento
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => navigate(`/projeto/${id}/preencher-anexos`)}
                    className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white"
                  >
                    Próximo: Preencher Anexos
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CriarOrcamento;
