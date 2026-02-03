import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2, Save, DollarSign, Sparkles, FileDown, FileText, CheckCircle2, Undo2 } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

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

// Função para detectar unidade baseada no nome da rubrica
const detectarUnidade = (nomeRubrica: string, textoLinha?: string): string => {
  const nomeLower = nomeRubrica.toLowerCase();
  
  // Verificar se há unidade mencionada explicitamente no texto da linha
  if (textoLinha) {
    const padraoUnidade = new RegExp(`(?:\\(unidade:\\s*|unidade:\\s*|por\\s+|/\\s*)([a-záêêéíóôú]+)`, 'i');
    const match = textoLinha.match(padraoUnidade);
    if (match && match[1]) {
      let unidadeEncontrada = match[1].toLowerCase().trim();
      // Normalizar plural/singular
      if (unidadeEncontrada === 'dias') return 'dia';
      if (unidadeEncontrada === 'meses') return 'mês';
      if (unidadeEncontrada === 'semanas') return 'semana';
      if (unidadeEncontrada === 'quilômetros' || unidadeEncontrada === 'quilometros' || unidadeEncontrada === 'km') return 'km';
      if (unidadeEncontrada === 'pessoas') return 'pessoa';
      if (unidadeEncontrada === 'verbas') return 'verba';
      if (unidadeEncontrada === 'unidades') return 'unidade';
      if (unidadeEncontrada === 'horas') return 'hora';
      if (UNIDADES.includes(unidadeEncontrada)) {
        return unidadeEncontrada;
      }
    }
  }
  
  // Detectar por palavras-chave no nome da rubrica (mais específico primeiro)
  
  // DIÁRIA - deve vir antes de "dia" genérico
  if (nomeLower.includes('diária') || nomeLower.includes('diaria') || nomeLower.includes('per diem') || nomeLower.includes('perdiem')) {
    return 'dia';
  }
  
  // LOCAÇÃO/ALUGUEL
  if (nomeLower.includes('locação') || nomeLower.includes('locacao') || nomeLower.includes('aluguel') || 
      nomeLower.includes('aluguel') || nomeLower.includes('locar') || nomeLower.includes('arrendamento')) {
    return 'mês';
  }
  
  // TRANSPORTE/KM
  if (nomeLower.includes('transporte') || nomeLower.includes('deslocamento') || nomeLower.includes('combustível') || 
      nomeLower.includes('combustivel') || nomeLower.includes('quilômetro') || nomeLower.includes('quilometro') || 
      nomeLower.includes(' km') || nomeLower.includes('km ') || nomeLower.includes('viagem') || nomeLower.includes('passagem')) {
    return 'km';
  }
  
  // MÃO DE OBRA/PESSOAS
  if (nomeLower.includes('mão de obra') || nomeLower.includes('mao de obra') || nomeLower.includes('mão-de-obra') ||
      nomeLower.includes('profissional') || nomeLower.includes('técnico') || nomeLower.includes('tecnico') || 
      nomeLower.includes('artista') || nomeLower.includes('diretor') || nomeLower.includes('produtor') ||
      nomeLower.includes('ator') || nomeLower.includes('atriz') || nomeLower.includes('músico') || nomeLower.includes('musico') ||
      nomeLower.includes('cenógrafo') || nomeLower.includes('cenografo') || nomeLower.includes('iluminador') ||
      nomeLower.includes('som') || nomeLower.includes('figurinista') || nomeLower.includes('maquiador') ||
      nomeLower.includes('equipe') || nomeLower.includes('staff') || nomeLower.includes('pessoal')) {
    return 'pessoa';
  }
  
  // SEMANA
  if (nomeLower.includes('semana') || nomeLower.includes('semanal')) {
    return 'semana';
  }
  
  // HORA
  if ((nomeLower.includes('hora') || nomeLower.includes('horas')) && 
      !nomeLower.includes('horário') && !nomeLower.includes('horario') && !nomeLower.includes('horarios')) {
    return 'hora';
  }
  
  // MATERIAL/EQUIPAMENTO - itens físicos
  if (nomeLower.includes('material') || nomeLower.includes('equipamento') || nomeLower.includes('insumo') || 
      nomeLower.includes('item') || nomeLower.includes('aparelho') || nomeLower.includes('máquina') || nomeLower.includes('maquina') ||
      nomeLower.includes('computador') || nomeLower.includes('notebook') || nomeLower.includes('câmera') || nomeLower.includes('camera') ||
      nomeLower.includes('fone') || nomeLower.includes('microfone') || nomeLower.includes('caixa de som') ||
      nomeLower.includes('projetor') || nomeLower.includes('impressora') || nomeLower.includes('papel') ||
      nomeLower.includes('cartolina') || nomeLower.includes('tinta') || nomeLower.includes('pincel') ||
      nomeLower.includes('tela') || nomeLower.includes('cabo') || nomeLower.includes('adaptador')) {
    return 'unidade';
  }
  
  // DIVULGAÇÃO/PUBLICIDADE/MARKETING - serviços especializados
  if (nomeLower.includes('divulgação') || nomeLower.includes('divulgacao') || nomeLower.includes('publicidade') || 
      nomeLower.includes('marketing') || nomeLower.includes('assessoria de imprensa') || nomeLower.includes('press release') ||
      nomeLower.includes('redes sociais') || nomeLower.includes('social media') || nomeLower.includes('influencer') ||
      nomeLower.includes('patrocínio') || nomeLower.includes('patrocinio')) {
    return 'serviço';
  }
  
  // PRODUÇÃO/COORDENAÇÃO - verbas gerais
  if (nomeLower.includes('produção') || nomeLower.includes('producao') || nomeLower.includes('coordenação') ||
      nomeLower.includes('coordenacao') || nomeLower.includes('gerência') || nomeLower.includes('gerencia') ||
      nomeLower.includes('administração') || nomeLower.includes('administracao') || nomeLower.includes('gestão') ||
      nomeLower.includes('gestao') || nomeLower.includes('verba') || nomeLower.includes('recursos')) {
    return 'verba';
  }
  
  // HOSPEDAGEM - diária
  if (nomeLower.includes('hospedagem') || nomeLower.includes('hotel') || nomeLower.includes('pousada') ||
      nomeLower.includes('acomodação') || nomeLower.includes('acomodacao')) {
    return 'dia';
  }
  
  // ALIMENTAÇÃO - pode ser dia ou serviço
  if (nomeLower.includes('alimentação') || nomeLower.includes('alimentacao') || nomeLower.includes('refeição') ||
      nomeLower.includes('refeicao') || nomeLower.includes('catering') || nomeLower.includes('buffet')) {
    return 'serviço';
  }
  
  // PADRÃO: usar serviço para coisas genéricas, não unidade
  return 'serviço';
};

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
  const [rubricasAnteriores, setRubricasAnteriores] = useState<RubricaOrcamento[]>([]); // Guardar versão anterior antes de aplicar alterações
  const [temAlteracoesPendentes, setTemAlteracoesPendentes] = useState(false); // Flag para indicar se há alterações não salvas
  const [sugestoesAlteracoes, setSugestoesAlteracoes] = useState<string>('');
  const [processandoAlteracoes, setProcessandoAlteracoes] = useState(false);

  const steps = ['Criar Projeto', 'Avaliar com IA', 'Alterar com IA', 'Gerar Textos', 'Criar Orçamento', 'Criar Cronograma', 'Documentos de Inscrição', 'Preencher Anexos'];
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
      toast.error('Rubrica necessária', {
        description: 'É necessário ter pelo menos uma rubrica.',
        duration: 4000,
      });
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
      toast.error('Erro ao carregar projeto', {
        description: 'Não foi possível carregar as informações do projeto.',
        duration: 4000,
      });
      return;
    }

    if (!tetoOrcamento || tetoOrcamento <= 0) {
      toast.error('Teto do orçamento necessário', {
        description: 'Por favor, defina um teto de orçamento antes de gerar.',
        duration: 4000,
      });
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
                // Usar debounce maior para esperar mais texto antes de processar
                // Isso evita mostrar versões muito curtas
                clearTimeout((window as any).timeoutRubricas);
                (window as any).timeoutRubricas = setTimeout(() => {
                  // Só processar se tiver uma quantidade mínima de texto
                  // Isso garante que estamos processando um orçamento mais completo
                  if (textoAcumulado.length > 200) {
                    setRubricas(prev => {
                      // Extrair todas as rubricas do texto acumulado até agora
                      const todasRubricas = extrairRubricasDoTextoStream(textoAcumulado, idCounter);
                      
                      // Só atualizar se encontrou mais rubricas que já temos
                      // Isso previne substituir um orçamento completo por uma versão parcial
                      if (todasRubricas.length >= prev.length) {
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
                        let novoValor = r.total * fatorAjuste;
                        // Arredondar para valores bem redondos
                        if (novoValor >= 10000) {
                          novoValor = Math.round(novoValor / 1000) * 1000;
                        } else if (novoValor >= 1000) {
                          novoValor = Math.round(novoValor / 100) * 100;
                        } else if (novoValor >= 100) {
                          novoValor = Math.round(novoValor / 50) * 50;
                        } else if (novoValor >= 10) {
                          novoValor = Math.round(novoValor / 10) * 10;
                        } else {
                          novoValor = Math.round(novoValor / 5) * 5;
                        }
                        r.total = novoValor;
                        r.valorUnitario = novoValor;
                      });
                    }
                        
                        return todasAtualizadas;
                      }
                      // Se não encontrou mais rubricas, manter as anteriores
                      return prev;
                    });
                  }
                }, 1000); // Processar a cada 1 segundo para aguardar mais texto
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
                      let novoValor = r.total * fatorAjuste;
                      // Arredondar para valores bem redondos
                      if (novoValor >= 10000) {
                        novoValor = Math.round(novoValor / 1000) * 1000;
                      } else if (novoValor >= 1000) {
                        novoValor = Math.round(novoValor / 100) * 100;
                      } else if (novoValor >= 100) {
                        novoValor = Math.round(novoValor / 50) * 50;
                      } else if (novoValor >= 10) {
                        novoValor = Math.round(novoValor / 10) * 10;
                      } else {
                        novoValor = Math.round(novoValor / 5) * 5;
                      }
                      r.total = novoValor;
                      r.valorUnitario = novoValor;
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
              const ajustadas = prev.map(r => {
                let novoValor = r.total * fatorAjuste;
                // Arredondar para valores bem redondos
                if (novoValor >= 10000) {
                  novoValor = Math.round(novoValor / 1000) * 1000;
                } else if (novoValor >= 1000) {
                  novoValor = Math.round(novoValor / 100) * 100;
                } else if (novoValor >= 100) {
                  novoValor = Math.round(novoValor / 50) * 50;
                } else if (novoValor >= 10) {
                  novoValor = Math.round(novoValor / 10) * 10;
                } else {
                  novoValor = Math.round(novoValor / 5) * 5;
                }
                return {
                  ...r,
                  total: novoValor,
                  valorUnitario: novoValor
                };
              });
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
              let novoValor = r.total * fatorAjuste;
              // Arredondar para valores bem redondos
              if (novoValor >= 10000) {
                novoValor = Math.round(novoValor / 1000) * 1000;
              } else if (novoValor >= 1000) {
                novoValor = Math.round(novoValor / 100) * 100;
              } else if (novoValor >= 100) {
                novoValor = Math.round(novoValor / 50) * 50;
              } else if (novoValor >= 10) {
                novoValor = Math.round(novoValor / 10) * 10;
              } else {
                novoValor = Math.round(novoValor / 5) * 5;
              }
              r.total = novoValor;
              r.valorUnitario = novoValor;
            });
            // Verificar novamente após arredondamento e ajustar se necessário
            totalFinal = rubricasFinais.reduce((sum, r) => sum + r.total, 0);
            if (totalFinal > tetoOrcamento) {
              const fatorAjusteFinal = tetoOrcamento / totalFinal;
              rubricasFinais.forEach(r => {
                let valorAjustado = r.total * fatorAjusteFinal;
                // Arredondar novamente após ajuste final
                if (valorAjustado >= 10000) {
                  valorAjustado = Math.round(valorAjustado / 1000) * 1000;
                } else if (valorAjustado >= 1000) {
                  valorAjustado = Math.round(valorAjustado / 100) * 100;
                } else if (valorAjustado >= 100) {
                  valorAjustado = Math.round(valorAjustado / 50) * 50;
                } else if (valorAjustado >= 10) {
                  valorAjustado = Math.round(valorAjustado / 10) * 10;
                } else {
                  valorAjustado = Math.round(valorAjustado / 5) * 5;
                }
                r.total = valorAjustado;
                r.valorUnitario = valorAjustado;
              });
            }
          }
          
          return rubricasFinais.length > 0 ? rubricasFinais : prev;
        });
      }

    } catch (error) {
      console.error('Erro ao gerar orçamento:', error);
      toast.error('Erro ao gerar orçamento', {
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        duration: 5000,
      });
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
      let linhaLimpa = linha.trim();
      // Remover marcadores de lista no início (-, *, •, etc.)
      linhaLimpa = linhaLimpa.replace(/^[-*•]\s+/, '').trim();
      if (!linhaLimpa) return;

      // Ignorar linhas que são totais, somas ou justificativas (não são rubricas)
      const linhaLower = linhaLimpa.toLowerCase();
      
      // Verificar se é um total/soma
      if (linhaLower.includes('total') || linhaLower.includes('soma') || linhaLower.includes('subtotal') || 
          linhaLower.includes('total do orçamento') || linhaLower.includes('total geral') ||
          linhaLower === 'total:' || linhaLower.startsWith('total ') || 
          linhaLower.includes('valor total') || linhaLower.includes('totalizador')) {
        return;
      }
      
      // Verificar se é uma justificativa/explicação (linha que NÃO contém R$)
      if (!linhaLimpa.match(/R\$\s*[\d.,]+/i)) {
        // Se não tem valor monetário, pode ser justificativa
        if (linhaLower.startsWith('justificativa') || linhaLower.startsWith('justificat') ||
            linhaLower.startsWith('observação') || linhaLower.startsWith('observacao') ||
            linhaLower.startsWith('observa') || linhaLower.startsWith('nota:') ||
            linhaLower.startsWith('nota ') || linhaLower.startsWith('explicação') ||
            linhaLower.startsWith('explicacao') || linhaLower.startsWith('explica') ||
            linhaLower.startsWith('descrição') || linhaLower.startsWith('descricao') ||
            linhaLower.startsWith('motivo') || linhaLower.startsWith('razão') ||
            linhaLower.startsWith('razao') || linhaLower.startsWith('porque') ||
            linhaLower.startsWith('por que') || linhaLower.includes('esta rubrica') ||
            linhaLower.includes('esta verba') || linhaLower.includes('este item') ||
            linhaLower.includes('para justificar') || linhaLower.includes('objetivo') ||
            linhaLower.includes('finalidade') || linhaLower.includes('necessário') ||
            linhaLower.includes('necessario') || linhaLower.length > 100) {
          return;
        }
      }

      // Padrão 1: "Nome: R$ valor" ou "Nome - R$ valor"
      const padrao1 = /^(.+?)\s*[:\-]\s*R\$\s*([\d.,]+)/i;
      const match1 = linhaLimpa.match(padrao1);

      if (match1) {
        let nome = match1[1].trim().replace(/^\d+[\.\)]\s*/, '').replace(/^-\s*/, '');
        // Remover unidade do nome da rubrica (ex: "Nome (unidade: verba)" -> "Nome")
        nome = nome.replace(/\s*\(unidade\s*:\s*[^)]+\)/gi, '').trim();
        nome = nome.replace(/\s*\(por\s+[^)]+\)/gi, '').trim();
        nome = nome.replace(/\s*\/\s*[a-záêêéíóôú]+$/i, '').trim();
        const valorStr = match1[2].trim().replace(/\./g, '').replace(',', '.');
        const valorTotal = parseFloat(valorStr) || 0;
        
        const chave = `${nome.toLowerCase()}_${valorTotal}`;
        if (nome && valorTotal > 0 && !rubricasProcessadas.has(chave)) {
          rubricasProcessadas.add(chave);
          const unidadeDetectada = detectarUnidade(nome, linhaLimpa);
          rubricas.push({
            id: (idCounter++).toString(),
            nome,
            quantidade: 1,
            unidade: unidadeDetectada,
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
            let nome = partes[0].trim().replace(/^\d+[\.\)]\s*/, '').replace(/[:\-]\s*$/, '');
            // Remover unidade do nome da rubrica (ex: "Nome (unidade: verba)" -> "Nome")
            nome = nome.replace(/\s*\(unidade\s*:\s*[^)]+\)/gi, '').trim();
            nome = nome.replace(/\s*\(por\s+[^)]+\)/gi, '').trim();
            nome = nome.replace(/\s*\/\s*[a-záêêéíóôú]+$/i, '').trim();
            const valorStr = match2[1].trim().replace(/\./g, '').replace(',', '.');
            const valorTotal = parseFloat(valorStr) || 0;
            
            const chave = `${nome.toLowerCase()}_${valorTotal}`;
            if (nome && valorTotal > 0 && nome.length > 2 && !rubricasProcessadas.has(chave)) {
              rubricasProcessadas.add(chave);
              const unidadeDetectada = detectarUnidade(nome, linhaLimpa);
              rubricas.push({
                id: (idCounter++).toString(),
                nome,
                quantidade: 1,
                unidade: unidadeDetectada,
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
      let linhaLimpa = linha.trim();
      // Remover marcadores de lista no início (-, *, •, etc.)
      linhaLimpa = linhaLimpa.replace(/^[-*•]\s+/, '').trim();
      if (!linhaLimpa) return;

      // Ignorar linhas que são totais, somas ou justificativas (não são rubricas)
      const linhaLower = linhaLimpa.toLowerCase();
      
      // Verificar se é um total/soma
      if (linhaLower.includes('total') || linhaLower.includes('soma') || linhaLower.includes('subtotal') || 
          linhaLower.includes('total do orçamento') || linhaLower.includes('total geral') ||
          linhaLower === 'total:' || linhaLower.startsWith('total ') || 
          linhaLower.includes('valor total') || linhaLower.includes('totalizador')) {
        return;
      }
      
      // Verificar se é uma justificativa/explicação (linha que NÃO contém R$)
      if (!linhaLimpa.match(/R\$\s*[\d.,]+/i)) {
        // Se não tem valor monetário, pode ser justificativa
        if (linhaLower.startsWith('justificativa') || linhaLower.startsWith('justificat') ||
            linhaLower.startsWith('observação') || linhaLower.startsWith('observacao') ||
            linhaLower.startsWith('observa') || linhaLower.startsWith('nota:') ||
            linhaLower.startsWith('nota ') || linhaLower.startsWith('explicação') ||
            linhaLower.startsWith('explicacao') || linhaLower.startsWith('explica') ||
            linhaLower.startsWith('descrição') || linhaLower.startsWith('descricao') ||
            linhaLower.startsWith('motivo') || linhaLower.startsWith('razão') ||
            linhaLower.startsWith('razao') || linhaLower.startsWith('porque') ||
            linhaLower.startsWith('por que') || linhaLower.includes('esta rubrica') ||
            linhaLower.includes('esta verba') || linhaLower.includes('este item') ||
            linhaLower.includes('para justificar') || linhaLower.includes('objetivo') ||
            linhaLower.includes('finalidade') || linhaLower.includes('necessário') ||
            linhaLower.includes('necessario') || linhaLower.length > 100) {
          return;
        }
      }

      // Padrão 1: "Nome: R$ valor" ou "Nome - R$ valor"
      const padrao1 = /^(.+?)\s*[:\-]\s*R\$\s*([\d.,]+)/i;
      const match1 = linhaLimpa.match(padrao1);

      if (match1) {
        let nome = match1[1].trim().replace(/^\d+[\.\)]\s*/, '').replace(/^-\s*/, '');
        // Remover unidade do nome da rubrica (ex: "Nome (unidade: verba)" -> "Nome")
        nome = nome.replace(/\s*\(unidade\s*:\s*[^)]+\)/gi, '').trim();
        nome = nome.replace(/\s*\(por\s+[^)]+\)/gi, '').trim();
        nome = nome.replace(/\s*\/\s*[a-záêêéíóôú]+$/i, '').trim();
        const valorStr = match1[2].trim().replace(/\./g, '').replace(',', '.');
        // Arredondar para valores bem redondos, sem centavos
        let valorTotal = parseFloat(valorStr) || 0;
        if (valorTotal > 0) {
          if (valorTotal >= 10000) {
            // Valores muito grandes: múltiplos de 1000
            valorTotal = Math.round(valorTotal / 1000) * 1000;
          } else if (valorTotal >= 1000) {
            // Valores grandes: múltiplos de 100
            valorTotal = Math.round(valorTotal / 100) * 100;
          } else if (valorTotal >= 100) {
            // Valores médios: múltiplos de 50
            valorTotal = Math.round(valorTotal / 50) * 50;
          } else if (valorTotal >= 10) {
            // Valores pequenos: múltiplos de 10
            valorTotal = Math.round(valorTotal / 10) * 10;
          } else {
            // Valores muito pequenos: múltiplos de 5
            valorTotal = Math.round(valorTotal / 5) * 5;
          }
        }
        
        const chave = `${nome.toLowerCase().trim()}_${valorTotal}`;
        if (nome && valorTotal > 0 && !rubricasProcessadas.has(chave)) {
          rubricasProcessadas.add(chave);
          const unidadeDetectada = detectarUnidade(nome, linhaLimpa);
          rubricas.push({
            id: (idCounter++).toString(),
            nome,
            quantidade: 1,
            unidade: unidadeDetectada,
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
            let nome = partes[0].trim().replace(/^\d+[\.\)]\s*/, '').replace(/[:\-]\s*$/, '').replace(/^-\s*/, '');
            // Remover unidade do nome da rubrica (ex: "Nome (unidade: verba)" -> "Nome")
            nome = nome.replace(/\s*\(unidade\s*:\s*[^)]+\)/gi, '').trim();
            nome = nome.replace(/\s*\(por\s+[^)]+\)/gi, '').trim();
            nome = nome.replace(/\s*\/\s*[a-záêêéíóôú]+$/i, '').trim();
            const valorStr = match2[1].trim().replace(/\./g, '').replace(',', '.');
            // Arredondar para valores bem redondos, sem centavos
            let valorTotal = parseFloat(valorStr) || 0;
            if (valorTotal > 0) {
              if (valorTotal >= 10000) {
                // Valores muito grandes: múltiplos de 1000
                valorTotal = Math.round(valorTotal / 1000) * 1000;
              } else if (valorTotal >= 1000) {
                // Valores grandes: múltiplos de 100
                valorTotal = Math.round(valorTotal / 100) * 100;
              } else if (valorTotal >= 100) {
                // Valores médios: múltiplos de 50
                valorTotal = Math.round(valorTotal / 50) * 50;
              } else if (valorTotal >= 10) {
                // Valores pequenos: múltiplos de 10
                valorTotal = Math.round(valorTotal / 10) * 10;
              } else {
                // Valores muito pequenos: múltiplos de 5
                valorTotal = Math.round(valorTotal / 5) * 5;
              }
            }
            
            const chave = `${nome.toLowerCase().trim()}_${valorTotal}`;
            if (nome && valorTotal > 0 && nome.length > 2 && !rubricasProcessadas.has(chave)) {
              rubricasProcessadas.add(chave);
              const unidadeDetectada = detectarUnidade(nome, linhaLimpa);
              rubricas.push({
                id: (idCounter++).toString(),
                nome,
                quantidade: 1,
                unidade: unidadeDetectada,
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

  // Processar alterações sugeridas
  const processarAlteracoes = async () => {
    if (!sugestoesAlteracoes.trim() || rubricas.length === 0 || !projeto) {
      toast.error('Preencha as sugestões', {
        description: 'Por favor, preencha as sugestões de alterações e tenha rubricas no orçamento.',
        duration: 4000,
      });
      return;
    }

    setProcessandoAlteracoes(true);
    
    // Guardar versão anterior das rubricas antes de aplicar alterações
    setRubricasAnteriores([...rubricas]);
    
    try {
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
      
      // Criar contexto do orçamento atual
      const orcamentoAtual = rubricas.map((r, idx) => 
        `${idx + 1}. ${r.nome}: Quantidade ${r.quantidade} ${r.unidade}, ${r.quantidadeUnidade} unidade(s), Valor unitário R$ ${r.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Total R$ ${r.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ).join('\n');

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
            teto: tetoOrcamento,
            orcamentoAtual: orcamentoAtual,
            totalGeral: calcularTotalGeral()
          },
          prompt: `Aplique as seguintes sugestões de alterações ao orçamento abaixo.

CRÍTICO - REGRA OBRIGATÓRIA: A soma total de TODAS as rubricas DEVE ser IGUAL ou MENOR que o TETO MÁXIMO de R$ ${tetoOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. 

IMPORTANTE:
- Se as alterações sugeridas fizerem o total ultrapassar o teto, você DEVE ajustar os valores das rubricas proporcionalmente ou remover/adicionar rubricas para manter o total dentro do teto.
- O teto máximo de R$ ${tetoOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NÃO pode ser ultrapassado sob nenhuma circunstância.
- Use valores redondos (múltiplos de 100 para valores >= 1000, múltiplos de 50 para valores >= 100, múltiplos de 10 para valores >= 10).

SUGESTÕES DE ALTERAÇÕES:
${sugestoesAlteracoes}

ORÇAMENTO ATUAL:
${orcamentoAtual}

TETO MÁXIMO ABSOLUTO: R$ ${tetoOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
TOTAL ATUAL: R$ ${calcularTotalGeral().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

Gere um orçamento atualizado aplicando as alterações sugeridas, mas GARANTINDO que o total final seja igual ou menor que R$ ${tetoOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.

Formate cada rubrica como: "Nome da Rubrica: R$ valor" ou "Nome da Rubrica - R$ valor". Use valores redondos, sem centavos.`,
          userId: user?.uid
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro ao processar alterações: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      // Processar resposta streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let textoAcumulado = '';
      let idCounter = Date.now();

      if (!reader) {
        throw new Error('Não foi possível ler a resposta do servidor');
      }

      // Limpar rubricas anteriores antes de aplicar as novas
      setRubricas([]);

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
              
              if (parsed.type === 'chunk' && parsed.content) {
                textoAcumulado += parsed.content;
                
                clearTimeout((window as any).timeoutRubricasAlteracoes);
                (window as any).timeoutRubricasAlteracoes = setTimeout(() => {
                  if (textoAcumulado.length > 200) {
                    setRubricas(prev => {
                      const todasRubricas = extrairRubricasDoTextoStream(textoAcumulado, idCounter);
                      
                      if (todasRubricas.length >= prev.length) {
                        const mapaRubricas = new Map<string, RubricaOrcamento>();
                        
                        prev.forEach(r => {
                          const chave = `${r.nome.toLowerCase().trim()}_${Math.round(r.total * 100)}`;
                          if (!mapaRubricas.has(chave)) {
                            mapaRubricas.set(chave, r);
                          }
                        });
                        
                        todasRubricas.forEach(rubrica => {
                          const chave = `${rubrica.nome.toLowerCase().trim()}_${Math.round(rubrica.total * 100)}`;
                          if (!mapaRubricas.has(chave) && rubrica.nome.trim() && rubrica.total > 0) {
                            mapaRubricas.set(chave, rubrica);
                          }
                        });
                        
                        const todasAtualizadas = Array.from(mapaRubricas.values());
                        
                        // Sempre verificar e garantir que o teto é respeitado
                        let totalAtual = todasAtualizadas.reduce((sum, r) => sum + r.total, 0);
                        if (totalAtual > tetoOrcamento && todasAtualizadas.length > 0) {
                          // Ajustar proporcionalmente para respeitar o teto máximo
                          const fatorAjuste = tetoOrcamento / totalAtual;
                          todasAtualizadas.forEach(r => {
                            let novoValor = r.total * fatorAjuste;
                            // Arredondar para valores bem redondos
                            if (novoValor >= 10000) {
                              novoValor = Math.round(novoValor / 1000) * 1000;
                            } else if (novoValor >= 1000) {
                              novoValor = Math.round(novoValor / 100) * 100;
                            } else if (novoValor >= 100) {
                              novoValor = Math.round(novoValor / 50) * 50;
                            } else if (novoValor >= 10) {
                              novoValor = Math.round(novoValor / 10) * 10;
                            } else {
                              novoValor = Math.round(novoValor / 5) * 5;
                            }
                            r.total = novoValor;
                            r.valorUnitario = novoValor;
                          });
                          // Verificar novamente após arredondamento
                          totalAtual = todasAtualizadas.reduce((sum, r) => sum + r.total, 0);
                          if (totalAtual > tetoOrcamento) {
                            // Se ainda ultrapassou, ajustar novamente com arredondamento
                            const fatorAjusteFinal = tetoOrcamento / totalAtual;
                            todasAtualizadas.forEach(r => {
                              let valorAjustado = r.total * fatorAjusteFinal;
                              // Arredondar novamente após ajuste final
                              if (valorAjustado >= 10000) {
                                valorAjustado = Math.round(valorAjustado / 1000) * 1000;
                              } else if (valorAjustado >= 1000) {
                                valorAjustado = Math.round(valorAjustado / 100) * 100;
                              } else if (valorAjustado >= 100) {
                                valorAjustado = Math.round(valorAjustado / 50) * 50;
                              } else if (valorAjustado >= 10) {
                                valorAjustado = Math.round(valorAjustado / 10) * 10;
                              } else {
                                valorAjustado = Math.round(valorAjustado / 5) * 5;
                              }
                              r.total = valorAjustado;
                              r.valorUnitario = valorAjustado;
                            });
                          }
                        }
                        
                        return todasAtualizadas;
                      }
                      return prev;
                    });
                  }
                }, 1000);
              }
              
              if (parsed.type === 'complete') {
                clearTimeout((window as any).timeoutRubricasAlteracoes);
                const textoFinal = parsed.fullText || textoAcumulado;
                setRubricas(prev => {
                  const rubricasFinais = extrairRubricasDoTexto(textoFinal);
                  
                  // Sempre verificar e garantir que o teto é respeitado
                  let totalFinal = rubricasFinais.reduce((sum, r) => sum + r.total, 0);
                  if (totalFinal > tetoOrcamento && rubricasFinais.length > 0) {
                    // Ajustar proporcionalmente para respeitar o teto máximo
                    const fatorAjuste = tetoOrcamento / totalFinal;
                    rubricasFinais.forEach(r => {
                      let novoValor = r.total * fatorAjuste;
                      // Arredondar para valores bem redondos
                      if (novoValor >= 10000) {
                        novoValor = Math.round(novoValor / 1000) * 1000;
                      } else if (novoValor >= 1000) {
                        novoValor = Math.round(novoValor / 100) * 100;
                      } else if (novoValor >= 100) {
                        novoValor = Math.round(novoValor / 50) * 50;
                      } else if (novoValor >= 10) {
                        novoValor = Math.round(novoValor / 10) * 10;
                      } else {
                        novoValor = Math.round(novoValor / 5) * 5;
                      }
                      r.total = novoValor;
                      r.valorUnitario = novoValor;
                    });
                    // Verificar novamente após arredondamento
                    totalFinal = rubricasFinais.reduce((sum, r) => sum + r.total, 0);
                    if (totalFinal > tetoOrcamento) {
                      // Se ainda ultrapassou, ajustar novamente com arredondamento
                      const fatorAjusteFinal = tetoOrcamento / totalFinal;
                      rubricasFinais.forEach(r => {
                        let valorAjustado = r.total * fatorAjusteFinal;
                        // Arredondar novamente após ajuste final
                        if (valorAjustado >= 10000) {
                          valorAjustado = Math.round(valorAjustado / 1000) * 1000;
                        } else if (valorAjustado >= 1000) {
                          valorAjustado = Math.round(valorAjustado / 100) * 100;
                        } else if (valorAjustado >= 100) {
                          valorAjustado = Math.round(valorAjustado / 50) * 50;
                        } else if (valorAjustado >= 10) {
                          valorAjustado = Math.round(valorAjustado / 10) * 10;
                        } else {
                          valorAjustado = Math.round(valorAjustado / 5) * 5;
                        }
                        r.total = valorAjustado;
                        r.valorUnitario = valorAjustado;
                      });
                    }
                  }
                  
                  return rubricasFinais.length > 0 ? rubricasFinais : prev;
                });
              }
            } catch (e) {
              console.debug('Erro ao parsear chunk:', e);
            }
          }
        }
      }

      // Limpar o campo de sugestões após processar
      setSugestoesAlteracoes('');
      
      // Marcar que há alterações pendentes (não salvas ainda)
      setTemAlteracoesPendentes(true);
      
      // Mostrar toast estilizado de sucesso
      toast.success('Alterações aplicadas com sucesso!', {
        description: 'Revise o orçamento e aprove as alterações ou volte à versão anterior.',
        duration: 6000,
        icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
        className: 'bg-green-50 border-green-200',
        style: {
          background: 'linear-gradient(to right, #f0fdf4, #dcfce7)',
          border: '1px solid #86efac',
          borderRadius: '0.5rem',
          padding: '1rem',
        }
      });

    } catch (error) {
      console.error('Erro ao processar alterações:', error);
      toast.error('Erro ao processar alterações', {
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        duration: 5000,
      });
    } finally {
      setProcessandoAlteracoes(false);
    }
  };

  // Desfazer alterações e voltar para versão anterior
  const desfazerAlteracoes = () => {
    if (rubricasAnteriores.length > 0) {
      setRubricas([...rubricasAnteriores]);
      setTemAlteracoesPendentes(false);
      setRubricasAnteriores([]);
      toast.success('Alterações desfeitas', {
        description: 'Orçamento restaurado para a versão anterior.',
        duration: 3000,
      });
    }
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

      // Limpar flag de alterações pendentes após salvar
      setTemAlteracoesPendentes(false);
      setRubricasAnteriores([]);

      toast.success('Orçamento salvo com sucesso!', {
        description: 'O orçamento foi salvo no projeto.',
        duration: 4000,
        icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
      });
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error);
      toast.error('Erro ao salvar orçamento', {
        description: 'Por favor, tente novamente.',
        duration: 5000,
      });
    } finally {
      setSalvando(false);
    }
  };

  // Exportar para PDF
  const exportarParaPDF = () => {
    const totalGeral = calcularTotalGeral();
    
    // Criar conteúdo HTML para o PDF
    let html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #1a1a1a; margin-bottom: 10px; }
            h2 { color: #333; margin-top: 20px; margin-bottom: 10px; }
            .info { margin-bottom: 20px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .total { font-weight: bold; font-size: 1.1em; margin-top: 20px; }
            .teto { margin-top: 10px; }
          </style>
        </head>
        <body>
          <h1>Orçamento - ${projeto?.nome || 'Projeto'}</h1>
          <div class="info">
            <p><strong>Teto do Orçamento:</strong> R$ ${tetoOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          
          <h2>Rubricas</h2>
          <table>
            <thead>
              <tr>
                <th>Nome da Rubrica</th>
                <th class="text-center">Quantidade</th>
                <th class="text-center">Unidade</th>
                <th class="text-center">Qtd. Unidade</th>
                <th class="text-right">Valor Unitário (R$)</th>
                <th class="text-right">Total (R$)</th>
              </tr>
            </thead>
            <tbody>
    `;

    rubricas.forEach(rubrica => {
      html += `
        <tr>
          <td>${rubrica.nome || ''}</td>
          <td class="text-center">${rubrica.quantidade}</td>
          <td class="text-center">${rubrica.unidade}</td>
          <td class="text-center">${rubrica.quantidadeUnidade}</td>
          <td class="text-right">${rubrica.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="text-right">${rubrica.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
          
          <div class="total">
            <p><strong>Total Geral:</strong> R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p class="teto"><strong>Diferença do Teto:</strong> R$ ${(tetoOrcamento - totalGeral).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </body>
      </html>
    `;

    // Criar nova janela e imprimir
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  // Exportar para XLS (Excel) - usando CSV formatado
  const exportarParaXLS = () => {
    const totalGeral = calcularTotalGeral();
    
    // Criar conteúdo CSV (que pode ser aberto no Excel como XLS)
    let csv = `\ufeffOrçamento - ${projeto?.nome || 'Projeto'}\n\n`;
    csv += `Teto do Orçamento;R$ ${tetoOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
    csv += `Nome da Rubrica;Quantidade;Unidade;Qtd. Unidade;Valor Unitário (R$);Total (R$)\n`;
    
    rubricas.forEach(rubrica => {
      const nome = (rubrica.nome || '').replace(/"/g, '""');
      csv += `"${nome}";${rubrica.quantidade};"${rubrica.unidade}";${rubrica.quantidadeUnidade};${rubrica.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })};${rubrica.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    });
    
    csv += `\nTotal Geral;R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    csv += `Diferença do Teto;R$ ${(tetoOrcamento - totalGeral).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;

    // Criar blob e fazer download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `orcamento_${projeto?.nome?.replace(/[^a-z0-9]/gi, '_') || 'projeto'}_${new Date().toISOString().split('T')[0]}.xls`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

              {/* Campo de Sugestões de Alterações */}
              <div className="p-6 border-b border-gray-200">
                <Label htmlFor="sugestoes" className="text-base font-semibold text-gray-900 mb-2 block">
                  Sugestões de Alterações ao Orçamento
                </Label>
                <Textarea
                  id="sugestoes"
                  value={sugestoesAlteracoes}
                  onChange={(e) => setSugestoesAlteracoes(e.target.value)}
                  placeholder="Digite suas sugestões de alterações ou observações sobre o orçamento..."
                  className="min-h-[100px] resize-y mb-3"
                  rows={4}
                />
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Use este campo para adicionar comentários, sugestões ou observações sobre o orçamento gerado.
                  </p>
                  <Button
                    onClick={processarAlteracoes}
                    disabled={!sugestoesAlteracoes.trim() || processandoAlteracoes || rubricas.length === 0}
                    className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white"
                  >
                    {processandoAlteracoes ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Aplicar Alterações
                      </>
                    )}
                  </Button>
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
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={exportarParaPDF}
                      disabled={rubricas.length === 0}
                      variant="outline"
                      className="border-gray-300 hover:bg-gray-50"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Exportar PDF
                    </Button>
                    <Button
                      onClick={exportarParaXLS}
                      disabled={rubricas.length === 0}
                      variant="outline"
                      className="border-gray-300 hover:bg-gray-50"
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      Exportar XLS
                    </Button>
                    {temAlteracoesPendentes && (
                      <Button
                        onClick={desfazerAlteracoes}
                        disabled={!rubricasAnteriores.length || processandoAlteracoes}
                        variant="outline"
                        className="border-orange-300 text-orange-700 hover:bg-orange-50"
                      >
                        <Undo2 className="mr-2 h-4 w-4" />
                        Desfazer Alterações
                      </Button>
                    )}
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
                  </div>
                  <Button
                    onClick={() => navigate(`/projeto/${id}/criar-cronograma`)}
                    className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white"
                  >
                    Próximo: Criar Cronograma
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
