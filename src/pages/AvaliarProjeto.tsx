import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getFirestore, collection, getDocs, query, where, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import CriarImg from '@/assets/Criar.jpeg';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Loader2, Check, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const dicasProjetos = [
  "💡 Dica: Seja específico e detalhado na descrição do seu projeto. Quanto mais informações você fornecer, melhor será a avaliação.",
  "📋 Dica: Certifique-se de que seu projeto está alinhado com os critérios do edital selecionado. Isso aumenta significativamente suas chances de aprovação.",
  "🎯 Dica: Destaque o impacto social e cultural do seu projeto. Avaliadores valorizam projetos que beneficiam comunidades e promovem a cultura.",
  "📊 Dica: Apresente um cronograma realista e viável. Projetos bem planejados têm maior credibilidade junto aos avaliadores.",
  "💰 Dica: Elabore um orçamento detalhado e coerente. Cada rubrica deve estar justificada e alinhada com as atividades propostas.",
  "👥 Dica: Apresente a equipe envolvida e suas qualificações. A experiência da equipe é um fator importante na avaliação.",
  "🌍 Dica: Demonstre como seu projeto contribui para a democratização do acesso à cultura e para a diversidade cultural.",
  "📝 Dica: Revise cuidadosamente todos os textos antes de enviar. Erros de português podem prejudicar a avaliação do seu projeto.",
  "🎨 Dica: Seja criativo, mas mantenha a coerência. Projetos inovadores que são bem fundamentados têm maior chance de sucesso.",
  "✅ Dica: Certifique-se de que todos os documentos exigidos pelo edital estão completos e corretos antes do envio."
];

const PRODUCTION_FUNCTIONS = 'https://us-central1-culturalapp-fb9b0.cloudfunctions.net';
const FUNCTIONS_BASE = import.meta.env.DEV && import.meta.env.VITE_FUNCTIONS_BASE_URL
  ? import.meta.env.VITE_FUNCTIONS_BASE_URL
  : PRODUCTION_FUNCTIONS;
const AVALIAR_PROJETO_IA_URL = `${FUNCTIONS_BASE}/avaliarProjetoIA`;
const ALTERAR_TEXTO_COM_IA_URL = `${FUNCTIONS_BASE}/alterarTextoComIA`;

/** Projeto de exemplo pré-preenchido para avaliação sem login */
const PROJETO_EXEMPLO = {
  nome: 'Festival de Música e Poesia na Praça',
  descricao: `Projeto de realização de um festival gratuito de música e poesia em praça pública, com 4 apresentações ao longo de um fim de semana.

Objetivos: democratizar o acesso à cultura, valorizar artistas locais e de outras regiões, e promover o encontro entre música e literatura.

Público-alvo: população em geral, famílias e jovens. Estimativa de 2.000 pessoas no total.

Atividades principais: curadoria de 8 artistas (bandas e poetas), montagem de palco e som, divulgação em redes sociais e rádio comunitária, mediação cultural antes de cada apresentação, registro em vídeo para divulgação posterior.

Equipe: 1 produtor, 1 assistente de produção, 2 técnicos de som e luz, 1 mediador cultural. Parceria com associação de moradores para divulgação e apoio logístico.

Cronograma: pré-produção em 2 meses (contratações, licenças, divulgação); realização em 2 dias; pós-produção (edição de vídeo e prestação de contas) em 1 mês.`,
};

const formatarNomeEdital = (s: string) => {
  if (!s || typeof s !== 'string') return s;
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : s;
};

const steps = [
  'Criar Projeto',
  'Avaliar com IA',
  'Alterar com IA',
  'Gerar Textos',
  'Criar Orçamento',
  'Criar Cronograma',
  'Documentos de Inscrição',
  'Preencher Anexos'
];

// Função utilitária para limpar markdown
const limparMarkdown = (texto: string): string => {
  return texto
    .replace(/####\s*/g, '')
    .replace(/###\s*/g, '')
    .replace(/##\s*/g, '')
    .replace(/#\s*/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .trim();
};

// Função para formatar texto para exibição (remove markdown)
const formatarTextoParaExibicao = (texto: string): string => {
  return limparMarkdown(texto);
};

/** Quebra o texto da análise em seções com título (1. ADEQUAÇÃO..., 2. PONTOS FORTES..., 3. PONTOS FRACOS...) para exibir títulos formatados */
const parsearSecoesAnalise = (texto: string): Array<{ titulo?: string; conteudo: string }> => {
  if (!texto || !texto.trim()) return [];
  const limpo = limparMarkdown(texto).trim();
  // Split por início de seção numerada: newline seguido de "1. ", "2. ", etc.
  const partes = limpo.split(/\n(?=\d+\.\s)/);
  const titulosConhecidos = [
    /^(\d+\.\s*)?ADEQUAÇÃO\s+AOS\s+CRITÉRIOS\s+DO\s+EDITAL/i,
    /^(\d+\.\s*)?PONTOS\s+FORTES\s+DO\s+PROJETO/i,
    /^(\d+\.\s*)?PONTOS\s+FRACOS\s+E\s+GAPS/i,
    /^(\d+\.\s*)?SUGESTÕES\s+DE\s+MELHORIA/i,
    /^(\d+\.\s*)?NOTA\s+ESTIMADA/i,
  ];
  const resultado: Array<{ titulo?: string; conteudo: string }> = [];
  for (let i = 0; i < partes.length; i++) {
    const bloco = partes[i].trim();
    if (!bloco) continue;
    const primeiraLinha = bloco.split('\n')[0]?.trim() || '';
    const resto = bloco.includes('\n') ? bloco.slice(bloco.indexOf('\n') + 1).trim() : '';
    const ehTitulo = titulosConhecidos.some((r) => r.test(primeiraLinha));
    if (ehTitulo && primeiraLinha) {
      const tituloLimpo = primeiraLinha.replace(/^\d+\.\s*/, '').replace(/[:.]\s*$/, '').trim();
      resultado.push({ titulo: tituloLimpo, conteudo: resto });
    } else {
      resultado.push({ conteudo: bloco });
    }
  }
  return resultado;
};

// Função para extrair sugestões (igual Projeto.tsx)
const extrairSugestoes = (analiseTexto: string): string[] => {
  let matches: string[] = [];
  if (!analiseTexto || analiseTexto.trim().length === 0) return matches;
  
  const textoLimpo = analiseTexto
    .replace(/###?\s*\d+\.\s*NOTA\s+ESTIMADA.*?(?=###?\s*\d+\.|$)/is, '')
    .replace(/###?\s*\d+\.\s*PONTOS\s+FORTES.*?(?=###?\s*\d+\.|$)/is, '')
    .replace(/###?\s*\d+\.\s*PONTOS\s+FRACOS.*?(?=###?\s*\d+\.|$)/is, '')
    .replace(/###?\s*\d+\.\s*ADEQUAÇÃO.*?(?=###?\s*\d+\.|$)/is, '');
  
  const padrao1 = /(?:^|\n)[-•]\s*Sugestão:\s*(.+?)(?=\n\n|\n[-•]\s*Sugestão:|$)/gis;
  let match;
  while ((match = padrao1.exec(textoLimpo)) !== null) {
    const sugestao = limparMarkdown(match[1].trim());
    if (sugestao.length > 15 && !sugestao.match(/\d+\/\d+/) && !sugestao.match(/^###/)) {
      matches.push(sugestao);
    }
  }
  
  const padrao2 = /\d+[\.\)]\s*Sugestão:\s*(.+?)(?=\n\n|\d+[\.\)]\s*Sugestão:|$)/gis;
  while ((match = padrao2.exec(textoLimpo)) !== null) {
    const sugestao = limparMarkdown(match[1].trim());
    if (sugestao.length > 15 && !sugestao.match(/\d+\/\d+/) && !sugestao.match(/^###/)) {
      matches.push(sugestao);
    }
  }
  
  const secaoSugestoes = textoLimpo.match(/sugest[õo]es?\s+de\s+melhoria:?\s*(.+?)(?=\n\n[A-Z]|\n\n\d+\.|$)/is);
  if (secaoSugestoes) {
    const listaSugestoes = secaoSugestoes[1]
      .split(/\n/)
      .map(line => {
        const limpa = line.trim().replace(/^[-•\d.)\s]+/, '').replace(/^Sugestão:\s*/i, '');
        return limparMarkdown(limpa);
      })
      .filter(line => line.length > 20 && !line.match(/\d+\/\d+/) && !line.match(/^###/));
    matches.push(...listaSugestoes);
  }
  
  const linhas = textoLimpo.split('\n');
  let dentroSecaoSugestoes = false;
  for (const linha of linhas) {
    if (linha.match(/sugest[õo]es?\s+de\s+melhoria/i)) {
      dentroSecaoSugestoes = true;
      continue;
    }
    if (dentroSecaoSugestoes && linha.match(/^[-•]\s*(.+)/)) {
      const sugestao = limparMarkdown(linha.replace(/^[-•]\s*/, '').trim());
      if (sugestao.length > 15 && !sugestao.match(/\d+\/\d+/) && !sugestao.match(/^###/)) {
        matches.push(sugestao);
      }
    }
    if (dentroSecaoSugestoes && linha.trim() === '') {
      dentroSecaoSugestoes = false;
    }
  }
  
  const padrao5 = /(?:^|\n)\s*Sugestão:\s*(.+?)(?=\n\n|\n\s*Sugestão:|$)/gis;
  while ((match = padrao5.exec(textoLimpo)) !== null) {
    const sugestao = limparMarkdown(match[1].trim());
    if (sugestao.length > 15 && !sugestao.match(/\d+\/\d+/) && !sugestao.match(/^###/)) {
      matches.push(sugestao);
    }
  }
  
  const titulosSecao = [
    /^\d+\.\s*\*?NOTA\s+ESTIMADA\s*\(?\d*\s*[-–]?\s*\d*\)?/i,
    /^\d+\.\s*\*?PONTOS\s+FORTES/i,
    /^\d+\.\s*\*?PONTOS\s+FRACOS/i,
    /^\d+\.\s*\*?ADEQUAÇÃO\s+AOS\s+CRITÉRIOS/i,
    /^\d+\.\s*\*?SUGESTÕES\s+DE\s+MELHORIA/i,
  ];
  const ehTituloSecao = (texto: string) => titulosSecao.some(r => r.test(texto.trim()));
  
  return matches
    .filter(s => !ehTituloSecao(s) && s.trim().length > 10)
    .filter((s, i, arr) => {
      const index = arr.findIndex(item => item.trim().toLowerCase() === s.trim().toLowerCase());
      return index === i;
    });
};

// Função para remover contexto de portfolio da resposta
const removerContextoPortfolioDaResposta = (texto: string): string => {
  if (!texto || !texto.trim()) return texto;
  const markers = [
    /CONTEXTO ADICIONAL\s*[-–]?\s*PORTFOLIO DO PROPONENTE/i,
    /PORTFOLIO DO PROPONENTE\s*\(APENAS PARA REFERÊNCIA/i,
    /\[CONTEXTO INTERNO\s*[-–]?\s*NÃO FAZER PARTE/i,
  ];
  let out = texto;
  for (const m of markers) {
    const idx = out.search(m);
    if (idx >= 0) {
      out = out.substring(0, idx).trim();
    }
  }
  // Remove também blocos entre ---
  out = out.replace(/---[\s\S]*?---/g, '').trim();
  return out;
};

// Função para remover sugestões do texto
const removerSugestoesDoTexto = (texto: string): string => {
  if (!texto) return texto;
  let textoLimpo = texto;
  textoLimpo = textoLimpo.replace(
    /4\.[\s\*\-\d\.]*[Ss]ugest[õo]es?[\s\*\-\d\.]*([Dd]e[\s\*\-\d\.]*[Mm]elhoria)?[:\s]*[\s\S]*?(?=\n\s*(?:5\.|\*\*5\.|ANÁLISE\s+DETALHADA|$))/i,
    ''
  );
  const linhas = textoLimpo.split('\n');
  const linhasFiltradas = linhas.filter(linha => {
    const linhaTrimmed = linha.trim();
    const linhaLower = linhaTrimmed.toLowerCase();
    if (!linhaTrimmed) return true;
    if (/^[Ss]ugest[ãa]o\s+\d+[:.]\s/.test(linhaTrimmed)) return false;
    if (/^\d+[\.\)]\s*[Ss]ugest[ãa]o:\s/.test(linhaTrimmed)) return false;
    if (/^[-•]\s*[Ss]ugest[ãa]o:\s/.test(linhaTrimmed)) return false;
    if (linhaLower.includes('sugestões de melhoria') || linhaLower.includes('sugestoes de melhoria')) return false;
    return true;
  });
  textoLimpo = linhasFiltradas.join('\n');
  textoLimpo = textoLimpo.replace(/\n{3,}/g, '\n\n');
  return textoLimpo.trim();
};

const AvaliarProjeto = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editalIdParam = searchParams.get('edital');
  const iniciarDireto = searchParams.get('iniciar') === '1';
  const [user] = useAuthState(auth);
  const iniciarJaDisparado = useRef(false);
  const [veioDiretoParaAnalise, setVeioDiretoParaAnalise] = useState(iniciarDireto);

  const [nome, setNome] = useState(PROJETO_EXEMPLO.nome);
  const [descricao, setDescricao] = useState(PROJETO_EXEMPLO.descricao);
  const [editalAssociado, setEditalAssociado] = useState('');
  const [editais, setEditais] = useState<{ id: string; nome: string; orgao?: string; [k: string]: unknown }[]>([]);
  const [loadingEditais, setLoadingEditais] = useState(true);
  const [analisando, setAnalisando] = useState(false);
  const [mostrarAnalise, setMostrarAnalise] = useState(false);
  const [analiseConteudo, setAnaliseConteudo] = useState('');
  const [erroIA, setErroIA] = useState<string | null>(null);
  const [statusIA, setStatusIA] = useState('');
  const [subEtapasIA, setSubEtapasIA] = useState<string[]>([]);
  const [dicaAtual, setDicaAtual] = useState(0);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [descricaoEditada, setDescricaoEditada] = useState('');
  const [mostrarAlterarIA, setMostrarAlterarIA] = useState(false);
  const [aprovacoes, setAprovacoes] = useState<boolean[]>([]);
  const [gerandoSugestao, setGerandoSugestao] = useState<number | null>(null);
  const [textoAnterior, setTextoAnterior] = useState<string>('');
  const [sugestaoPersonalizada, setSugestaoPersonalizada] = useState('');
  const [aplicandoSugestaoPersonalizada, setAplicandoSugestaoPersonalizada] = useState(false);
  const refSecaoAnalise = useRef<HTMLDivElement>(null);

  // Quando o stream da avaliação começar, levar o usuário para a seção da análise (após primeiro chunk, quando a seção já está no DOM)
  useEffect(() => {
    if (analisando && analiseConteudo && refSecaoAnalise.current) {
      refSecaoAnalise.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [analisando, analiseConteudo]);

  // Alternar dicas a cada 5 segundos quando estiver analisando
  useEffect(() => {
    if (!analisando || !mostrarAnalise) return;
    const interval = setInterval(() => {
      setDicaAtual((prev) => (prev + 1) % dicasProjetos.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [analisando, mostrarAnalise]);

  const fetchEditalData = async (editalNome: string) => {
    const db = getFirestore();
    const q = query(collection(db, 'editais'), where('nome', '==', editalNome));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0].data();
      return {
        texto_edital: d.texto_edital || '',
        criterios: d.criterios || '',
        texto_selecionados: d.texto_selecionados || '',
      };
    }
    return { texto_edital: '', criterios: '', texto_selecionados: '' };
  };

  useEffect(() => {
    const fetchEditais = async () => {
      const db = getFirestore();
      const snap = await getDocs(collection(db, 'editais'));
      const now = new Date();
      const editaisFiltrados = snap.docs
        .map((d) => {
          const data = d.data();
          const dataEncerramento = data.data_encerramento?.toDate?.() ?? data.data_encerramento ?? data.dataEncerramento?.toDate?.() ?? data.dataEncerramento;
          return {
            id: d.id,
            nome: data.nome || data.titulo || 'Edital',
            orgao: data.orgao || data.proponente || '',
            ...data,
            data_encerramento: dataEncerramento,
          };
        })
        .filter((edital) => {
          let dataEnc: Date | null = null;
          const raw = edital.data_encerramento ?? (edital as { dataEncerramento?: Date }).dataEncerramento;
          if (raw) dataEnc = raw instanceof Date ? raw : new Date(raw);
          if (!dataEnc || isNaN(dataEnc.getTime())) return false;
          return dataEnc > now;
        });
      let listaFinal = editaisFiltrados;
      if (editalIdParam && !editaisFiltrados.some((e) => e.id === editalIdParam)) {
        const ref = doc(db, 'editais', editalIdParam);
        const docSnap = await getDoc(ref);
        if (docSnap.exists()) {
          const data = docSnap.data();
          listaFinal = [
            ...editaisFiltrados,
            {
              id: docSnap.id,
              nome: data?.nome || data?.titulo || 'Edital',
              orgao: data?.orgao || data?.proponente || '',
              ...data,
            },
          ];
        }
      }
      listaFinal.sort((a, b) => ((a as { destaque?: boolean }).destaque ? 0 : 1) - ((b as { destaque?: boolean }).destaque ? 0 : 1));
      setEditais(listaFinal);
      setLoadingEditais(false);
    };
    fetchEditais();
  }, [editalIdParam]);

  // Pré-selecionar edital: por ?edital=id ou primeiro da lista ao carregar
  useEffect(() => {
    if (editais.length === 0) return;
    const currentInList = editais.some((e) => e.nome === editalAssociado);
    if (currentInList && editalAssociado) return;
    if (editalIdParam) {
      const naLista = editais.find((e) => e.id === editalIdParam);
      if (naLista?.nome) setEditalAssociado(naLista.nome);
    } else {
      setEditalAssociado(editais[0].nome);
    }
  }, [editalIdParam, editais, editalAssociado]);

  // Vindo da home com ?iniciar=1: ir direto para "O Oráculo está consultando as musas" (sem form)
  useEffect(() => {
    if (!iniciarDireto || iniciarJaDisparado.current) return;
    if (loadingEditais || !editalAssociado) {
      // Ainda carregando: já mostra estado de loading para não exibir form
      setStatusIA('O Oráculo está consultando as musas...');
      setSubEtapasIA(['Preparando avaliação...']);
      setMostrarAnalise(true);
      return;
    }
    iniciarJaDisparado.current = true;
    setVeioDiretoParaAnalise(true);
    navigate('/avaliar-projeto', { replace: true });
    handleAvaliar({ preventDefault: () => {} } as React.FormEvent);
  }, [iniciarDireto, loadingEditais, editalAssociado, navigate]);

  const handleAvaliar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroIA(null);
    setAnaliseConteudo('');
    if (!nome.trim() || !descricao.trim()) {
      setErroIA('Preencha nome e descrição do projeto.');
      return;
    }
    if (!editalAssociado) {
      setErroIA('Selecione um edital.');
      return;
    }

    // Configurar estados iniciais (igual CriarProjeto)
    setMostrarAnalise(true);
    setErroIA(null);
    setStatusIA('O Oráculo está consultando as musas...');
    setSubEtapasIA(['Consultando as musas da inspiração...']);
    setAnalisando(true);

    // Força uma atualização síncrona do DOM
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 100);
      });
    });

    try {
      setStatusIA('Coletando dados do projeto e edital...');
      setSubEtapasIA(['Lendo edital e critérios...']);

      const editalData = await fetchEditalData(editalAssociado);
      if (!editalData.criterios?.trim()) {
        setErroIA('O edital selecionado não possui critérios cadastrados.');
        setAnalisando(false);
        setMostrarAnalise(false);
        return;
      }

      setStatusIA('Enviando para análise da IA...');
      setSubEtapasIA(['Aguardando resposta da IA...']);

      const payload = {
        projetoId: null,
        textoProjeto: descricao.slice(0, 2000),
        nomeProjeto: nome,
        nomeEdital: editalAssociado,
        criteriosEdital: editalData.criterios,
        textoEdital: editalData.texto_edital,
        portfolio: '',
        projetosSelecionados: (editalData.texto_selecionados || '').slice(0, 2000),
        stream: true,
      };

      const response = await fetch(AVALIAR_PROJETO_IA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 429) {
          let msg = 'Aguarde alguns segundos antes de solicitar uma nova análise.';
          try {
            const data = JSON.parse(errText);
            if (data.message) msg = data.message;
          } catch (_) {}
          setErroIA(msg);
        } else {
          setErroIA(`Erro ${response.status}: ${errText.slice(0, 300)}`);
        }
        setAnalisando(false);
        setMostrarAnalise(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      if (!reader) {
        setErroIA('Resposta do servidor sem conteúdo. Tente novamente.');
        setAnalisando(false);
        setMostrarAnalise(false);
        return;
      }

      setStatusIA('Recebendo análise...');
      let streamDone = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          streamDone = true;
          // Processar buffer restante antes de sair
          if (buffer.trim()) {
            const lines = buffer.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.content) {
                    fullContent += data.content;
                  }
                  // Quando done=true, usar data.fullContent se disponível (mais completo)
                  if (data.done && data.fullContent) {
                    fullContent = data.fullContent;
                  }
                } catch (e) {
                  console.warn('Erro ao parsear último chunk:', e);
                }
              }
            }
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullContent += data.content;
                setAnaliseConteudo(fullContent);
              }
              if (data.done) {
                // Quando done=true, usar data.fullContent se disponível (mais completo que acumulado)
                if (data.fullContent) {
                  fullContent = data.fullContent;
                }
                setAnaliseConteudo(fullContent);
                streamDone = true;
              }
            } catch (e) {
              console.warn('Erro ao parsear chunk:', e, line);
            }
          }
        }
        if (streamDone) break;
      }
      
      // Garantir que temos o conteúdo completo após o loop
      if (streamDone && fullContent) {
        setAnaliseConteudo(fullContent);
      }

      if (!fullContent || !fullContent.trim()) {
        setErroIA('A análise não retornou conteúdo. Verifique se o edital tem critérios e tente novamente.');
        setAnalisando(false);
        setMostrarAnalise(false);
        setStatusIA('');
        return;
      }

      // Extrair sugestões da análise completa
      const sugestoesExtraidas = extrairSugestoes(fullContent);
      setSugestoes(sugestoesExtraidas);
      setAprovacoes(new Array(sugestoesExtraidas.length).fill(false)); // Inicializar array de aprovações
      setDescricaoEditada(descricao); // Inicializar com descrição atual
      
      setAnalisando(false);
      setMostrarAnalise(false);
      setStatusIA('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro de conexão. Tente novamente.';
      setErroIA(msg);
      setAnalisando(false);
      setMostrarAnalise(false);
      setStatusIA('');
    }
  };

  // Handler para aplicar sugestão
  const handleAprovar = async (idx: number) => {
    const textoBase = descricaoEditada || descricao;
    if (!textoBase.trim() || !sugestoes[idx]?.trim()) {
      toast.error('Erro: texto ou sugestão inválidos');
      return;
    }
    
    setTextoAnterior(textoBase);
    const novasAprovacoes = [...aprovacoes];
    novasAprovacoes[idx] = true;
    setAprovacoes(novasAprovacoes);
    setGerandoSugestao(idx);
    
    // Scroll para o campo de texto
    setTimeout(() => {
      const el = document.getElementById('texto-do-projeto');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
    
    try {
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
      
      const response = await fetch(ALTERAR_TEXTO_COM_IA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          textoAtual: textoBase,
          sugestao: sugestoes[idx],
          portfolio: portfolioTexto,
          userId: user?.uid,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro ao alterar texto: ${response.status}`);
      }
      
      // Processar resposta streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let novoTexto = '';
      
      if (!reader) {
        throw new Error('Não foi possível ler a resposta do servidor');
      }
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                novoTexto += parsed.content;
                setDescricaoEditada(removerContextoPortfolioDaResposta(novoTexto));
              }
              if (parsed.type === 'complete' && parsed.fullText) {
                novoTexto = parsed.fullText;
                setDescricaoEditada(removerContextoPortfolioDaResposta(novoTexto));
              }
            } catch {
              // Ignorar erros de parsing
            }
          }
        }
      }
      
      if (novoTexto.trim()) {
        const textoLimpo = removerContextoPortfolioDaResposta(novoTexto);
        setTextoAnterior(textoBase);
        setDescricaoEditada(textoLimpo);
        toast.success('Sugestão aplicada! Revise as alterações no texto abaixo.');
      }
    } catch (e) {
      // Reverter aprovação em caso de erro
      const novasAprovacoes = [...aprovacoes];
      novasAprovacoes[idx] = false;
      setAprovacoes(novasAprovacoes);
      toast.error('Erro ao aplicar sugestão. Tente novamente.');
      console.error('Erro ao aplicar sugestão:', e);
    } finally {
      setGerandoSugestao(null);
    }
  };

  // Handler para aplicar sugestão personalizada
  const handleAplicarSugestaoPersonalizada = async () => {
    if (!sugestaoPersonalizada.trim()) {
      toast.error('Por favor, digite uma sugestão antes de aplicar.');
      return;
    }
    
    const textoBase = descricaoEditada || descricao;
    if (!textoBase.trim()) {
      toast.error('Erro: texto do projeto inválido');
      return;
    }
    
    setTextoAnterior(textoBase);
    setAplicandoSugestaoPersonalizada(true);
    
    // Scroll para o campo de texto
    setTimeout(() => {
      const el = document.getElementById('texto-do-projeto');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
    
    try {
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
      
      const response = await fetch(ALTERAR_TEXTO_COM_IA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          textoAtual: textoBase,
          sugestao: sugestaoPersonalizada,
          portfolio: portfolioTexto,
          userId: user?.uid,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro ao alterar texto: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let novoTexto = '';
      
      if (!reader) {
        throw new Error('Não foi possível ler a resposta do servidor');
      }
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                novoTexto += parsed.content;
                setDescricaoEditada(removerContextoPortfolioDaResposta(novoTexto));
              }
              if (parsed.type === 'complete' && parsed.fullText) {
                novoTexto = parsed.fullText;
                setDescricaoEditada(removerContextoPortfolioDaResposta(novoTexto));
              }
            } catch {
              // Ignorar erros de parsing
            }
          }
        }
      }
      
      if (novoTexto.trim()) {
        const textoLimpo = removerContextoPortfolioDaResposta(novoTexto);
        setTextoAnterior(textoBase);
        setDescricaoEditada(textoLimpo);
        setSugestaoPersonalizada('');
        toast.success('Sugestão aplicada! Revise as alterações no texto abaixo.');
        setTimeout(() => {
          const el = document.getElementById('texto-do-projeto');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    } catch (e) {
      toast.error('Erro ao aplicar sugestão. Tente novamente.');
      console.error('Erro ao processar sugestão personalizada:', e);
    } finally {
      setAplicandoSugestaoPersonalizada(false);
    }
  };

  // Criar projeto e continuar fluxo (quando usuário clicar em "Continuar" ou qualquer step)
  const criarProjetoEContinuar = async (stepIndex?: number) => {
    if (!user) {
      // Salvar dados em sessionStorage para restaurar após login ou para acessar gerar-textos sem login
      const payload = {
        nome,
        descricao: descricaoEditada || descricao,
        editalAssociado,
        analiseConteudo,
        editalId: editais.find(e => e.nome === editalAssociado)?.id || editalIdParam || null,
      };
      sessionStorage.setItem('avaliarProjeto_dados', JSON.stringify(payload));
      // Se clicou em "Gerar Textos" (step 3), ir para a seção sem pedir login
      if (stepIndex === 3) {
        navigate('/avaliar-projeto/gerar-textos');
        return;
      }
      navigate('/cadastro?redirect=/avaliar-projeto&continuar=true');
      return;
    }

    try {
      const db = getFirestore();
      const editalSelecionado = editais.find(e => e.nome === editalAssociado);
      const projetoData: any = {
        nome,
        descricao: descricaoEditada || descricao, // Usar descrição editada se disponível
        analise_ia: analiseConteudo,
        data_criacao: serverTimestamp(),
        data_atualizacao: serverTimestamp(),
        user_id: user.uid,
        etapa_atual: 1, // já tem análise
      };
      if (editalSelecionado) {
        projetoData.edital_id = editalSelecionado.id;
        projetoData.edital_associado = editalAssociado;
      }
      // Incluir textos gerados na página avaliar-projeto/gerar-textos (sem login) se existirem
      try {
        const saved = sessionStorage.getItem('avaliarProjeto_dados');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.textos_gerados && typeof parsed.textos_gerados === 'object' && Object.keys(parsed.textos_gerados).length > 0) {
            projetoData.textos_gerados = parsed.textos_gerados;
          }
        }
      } catch {
        // ignore
      }
      const docRef = await addDoc(collection(db, 'projetos'), projetoData);
      
      // Navegar para o step apropriado
      const routes = [
        `/projeto/${docRef.id}`,
        `/projeto/${docRef.id}`,
        `/projeto/${docRef.id}/alterar-com-ia`,
        `/projeto/${docRef.id}/gerar-textos`,
        `/projeto/${docRef.id}/criar-orcamento`,
        `/projeto/${docRef.id}/criar-cronograma`,
        `/projeto/${docRef.id}/documentos-inscricao`,
        `/projeto/${docRef.id}/preencher-anexos`
      ];
      const targetStep = stepIndex !== undefined ? stepIndex : 3; // Default: Gerar Textos
      navigate(routes[targetStep] || routes[3]);
      toast.success('Projeto criado! Continue criando seu projeto.');
    } catch (err) {
      toast.error('Erro ao criar projeto. Tente novamente.');
      console.error(err);
    }
  };

  // Verificar se há dados salvos após login
  useEffect(() => {
    const dadosSalvos = sessionStorage.getItem('avaliarProjeto_dados');
    if (dadosSalvos && user) {
      try {
        const dados = JSON.parse(dadosSalvos);
        setNome(dados.nome || nome);
        const descricaoRestaurada = dados.descricao || descricao;
        setDescricao(descricaoRestaurada);
        setDescricaoEditada(descricaoRestaurada); // Restaurar também a descrição editada
        setEditalAssociado(dados.editalAssociado || editalAssociado);
        if (dados.analiseConteudo) {
          setAnaliseConteudo(dados.analiseConteudo);
          // Extrair sugestões da análise restaurada
          const sugestoesExtraidas = extrairSugestoes(dados.analiseConteudo);
          setSugestoes(sugestoesExtraidas);
          setAprovacoes(new Array(sugestoesExtraidas.length).fill(false)); // Inicializar array de aprovações
        }
        sessionStorage.removeItem('avaliarProjeto_dados');
        // Se tem análise, criar projeto automaticamente
        if (dados.analiseConteudo) {
          criarProjetoEContinuar(3);
        }
      } catch (_) {}
    }
  }, [user]);

  // Mostrar tela das musas só até chegar o primeiro chunk; depois exibir análise em streaming
  const soMostrarMusas = mostrarAnalise && analisando && !analiseConteudo.trim();
  if (soMostrarMusas) {
    return (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-oraculo-blue/95 to-oraculo-purple/95 rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl border-2 border-white/20">
            <div className="flex flex-col items-center">
              {/* Animação bem humorada das musas */}
              <div className="relative mb-6">
                {/* Círculo central com ícone do Oráculo */}
                <div className="relative w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm animate-pulse">
                  <Brain className="h-12 w-12 text-white animate-bounce" />
                </div>
                
                {/* Musas girando ao redor */}
                <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <span className="text-2xl animate-bounce" style={{ animationDelay: '0s' }}>🎭</span>
                  </div>
                  <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2">
                    <span className="text-2xl animate-bounce" style={{ animationDelay: '0.3s' }}>🎨</span>
                  </div>
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
                    <span className="text-2xl animate-bounce" style={{ animationDelay: '0.6s' }}>📚</span>
                  </div>
                  <div className="absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <span className="text-2xl animate-bounce" style={{ animationDelay: '0.9s' }}>✨</span>
                  </div>
                </div>
                
                {/* Partículas mágicas */}
                <div className="absolute inset-0">
                  <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-yellow-300 rounded-full animate-ping" style={{ animationDelay: '0s' }}></div>
                  <div className="absolute top-3/4 right-1/4 w-2 h-2 bg-pink-300 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                  <div className="absolute bottom-1/4 left-3/4 w-2 h-2 bg-blue-300 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
                </div>
              </div>
              
              {/* Texto principal */}
              <h3 className="text-2xl font-bold text-white mb-3 text-center animate-pulse">
                O Oráculo está consultando as musas
              </h3>
              
              {/* Status da análise */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 w-full mb-4">
                <p className="text-sm text-white/90 text-center font-medium">
                  {statusIA || 'Consultando as musas da inspiração...'}
                </p>
                {subEtapasIA.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {subEtapasIA.slice(-3).map((etapa, idx) => (
                      <p key={idx} className="text-xs text-white/70 text-center animate-fade-in">
                        • {etapa}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Barra de progresso animada */}
              <div className="w-full bg-white/20 rounded-full h-2 mb-4 overflow-hidden">
                <div className="bg-white h-2 rounded-full animate-progress" style={{
                  width: '100%',
                  animation: 'progress 2s ease-in-out infinite'
                }}></div>
              </div>
              
              {/* Caixa de dicas rotativas */}
              <div className="w-full bg-white/20 backdrop-blur-sm rounded-lg p-4 mb-4 border border-white/30">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div className="flex-1">
                    <p className="text-xs text-white/80 font-semibold mb-1 uppercase tracking-wide">Dica do Oráculo</p>
                    <p className="text-sm text-white/95 leading-relaxed animate-fade-in">
                      {dicasProjetos[dicaAtual]}
                    </p>
                  </div>
                </div>
                {/* Indicador de progresso das dicas */}
                <div className="flex gap-1 mt-3 justify-center">
                  {dicasProjetos.map((_, index) => (
                    <div
                      key={index}
                      className={`h-1 rounded-full transition-all duration-500 ${
                        index === dicaAtual
                          ? 'bg-white w-8'
                          : 'bg-white/40 w-1'
                      }`}
                    />
                  ))}
                </div>
              </div>
              
              {erroIA && (
                <div className="mt-4 p-3 bg-red-500/90 text-white rounded-md text-sm w-full backdrop-blur-sm">
                  {erroIA}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Estilos CSS inline para animações */}
        <style>{`
          @keyframes progress {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(0%); }
            100% { transform: translateX(100%); }
          }
          .animate-progress {
            animation: progress 2s ease-in-out infinite;
          }
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.5s ease-out;
          }
        `}</style>
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 md:mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Teste a avaliação de projetos</h1>
              <p className="text-gray-600 mt-2 text-lg">
                Veja como o sistema funciona usando um projeto fictício.
              </p>
            </div>

            {/* Vindo da home com ?iniciar=1: ir direto para "O Oráculo está consultando as musas" — sem form, sem tela vazia */}
            {veioDiretoParaAnalise && !analiseConteudo && (
              <div ref={refSecaoAnalise} className="bg-white rounded-xl shadow-md overflow-hidden mb-8 border-t-4 border-oraculo-blue">
                <div className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white px-4 md:px-8 py-4 md:py-6 rounded-t-xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Brain className="h-6 w-6 md:h-8 md:w-8 flex-shrink-0" />
                    <h2 className="text-lg md:text-2xl font-bold">Análise do Oráculo</h2>
                  </div>
                  <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm font-medium">{statusIA || 'O Oráculo está consultando as musas...'}</span>
                  </div>
                </div>
                <div className="p-4 md:p-8">
                  {erroIA ? (
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm mb-4">{erroIA}</div>
                  ) : (
                    <div className="py-8 space-y-4">
                      <p className="text-gray-700 font-medium">{statusIA || 'O Oráculo está consultando as musas...'}</p>
                      <ul className="space-y-1 text-gray-600 text-sm">
                        {(subEtapasIA.length ? subEtapasIA.slice(-3) : ['Consultando as musas da inspiração...']).map((etapa, idx) => (
                          <li key={idx}>• {etapa}</li>
                        ))}
                      </ul>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-oraculo-blue h-2 rounded-full animate-pulse" style={{ width: analisando ? '60%' : '30%' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Formulário só aparece se não veio direto e não tiver análise ainda */}
            {!analiseConteudo && !veioDiretoParaAnalise && (
              <>
                <div className="mb-3">
                  <p className="text-xs text-gray-500 font-medium">Projeto de exemplo — você pode editar</p>
                </div>

                <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
              <div className="p-4 md:p-8">
                <form onSubmit={handleAvaliar} className="space-y-5">
                  {/* Etapa 1: só Nome e Edital + Continuar */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Nome do projeto</label>
                    <input
                      type="text"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Edital</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue"
                      value={editalAssociado}
                      onChange={(e) => setEditalAssociado(e.target.value)}
                      disabled={loadingEditais}
                    >
                      <option value="">Selecione um edital</option>
                      {editais.map((edital) => (
                        <option key={edital.id} value={edital.nome}>
                          {formatarNomeEdital(edital.nome)} - {edital.orgao || ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {erroIA && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      {erroIA}
                    </div>
                  )}
                  {analisando && (
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {statusIA || 'Analisando...'}
                    </div>
                  )}

                  <p className="text-sm text-gray-500 text-center">Leva menos de 10 segundos</p>
                  <button
                    type="submit"
                    disabled={analisando || loadingEditais || !nome.trim() || !editalAssociado}
                    className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white py-3 rounded-lg font-semibold shadow-md hover:opacity-90 transition disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {analisando ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4" />
                        Fazer avaliação
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

                {/* Bloco: O que você vai descobrir */}
                <div className="mb-6 mt-6 p-5 md:p-6 bg-gradient-to-br from-oraculo-blue/5 to-oraculo-purple/5 border-2 border-oraculo-blue/20 rounded-xl flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">O que você vai descobrir com a avaliação:</h2>
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-oraculo-blue font-bold">•</span>
                        <span>Pontos fracos do projeto</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-oraculo-blue font-bold">•</span>
                        <span>Riscos de reprovação</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-oraculo-blue font-bold">•</span>
                        <span>Sugestões de melhoria</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-oraculo-blue font-bold">•</span>
                        <span>Nota estimada</span>
                      </li>
                    </ul>
                  </div>
                  <div className="flex-shrink-0 w-full md:w-auto md:min-w-[200px]">
                    <img src={CriarImg} alt="Avaliar projeto" className="rounded-xl shadow max-h-48 w-full md:w-56 object-cover" />
                  </div>
                </div>
              </>
            )}

            {/* Após análise: mostrar estrutura igual Projeto.tsx */}
            {analiseConteudo && (
              <>
                {/* Header com nome e botão próximo passo */}
                <div className="mb-6 md:mb-8">
                  <div className="mb-2">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 min-w-0">
                      {nome}
                    </h1>
                  </div>
                  {editalAssociado && (
                    <div className="mt-1">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-oraculo-blue/5 border border-oraculo-blue/20">
                        <span className="text-xs font-semibold uppercase tracking-wide text-oraculo-blue/80">Edital de avaliação</span>
                        <span className="text-oraculo-blue/60 font-medium">·</span>
                        <span className="text-gray-700 text-sm md:text-base font-medium break-words">{editalAssociado}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Bar with Clickable Steps — etapa atual = Alterar com IA (índice 2) na seção Análise do Oráculo */}
                <div className="mb-6 md:mb-8 overflow-hidden">
                  <div className="flex items-center gap-2 md:justify-between mb-2 overflow-x-auto pb-2 md:pb-0 min-w-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {steps.map((step, index) => {
                      const etapaAtualAnalise = 2; // Alterar com IA = step atual quando está na tela de análise
                      const podeNavegar = index <= etapaAtualAnalise || (index === 3 && analiseConteudo); // 0, 1, 2 sempre; 3 (Gerar Textos) se tiver análise
                      const creditosStep: Record<number, number> = { 1: 5, 3: 1, 4: 3, 5: 3 };
                      const cred = creditosStep[index];
                      return (
                        <div key={index} className="flex flex-col items-center flex-shrink-0 min-w-[3.5rem] md:min-w-0">
                          <button 
                            onClick={() => podeNavegar && criarProjetoEContinuar(index)}
                            className={`h-8 w-8 rounded-full flex items-center justify-center ${
                              podeNavegar
                                ? 'bg-oraculo-blue text-white hover:bg-oraculo-blue/90 cursor-pointer' 
                                : 'bg-gray-200 text-gray-600 cursor-not-allowed'
                            }`}
                            disabled={!podeNavegar}
                            aria-label={`Ir para ${step}`}
                          >
                            {index + 1}
                          </button>
                          <button 
                            onClick={() => podeNavegar && criarProjetoEContinuar(index)}
                            disabled={!podeNavegar}
                            className={`text-xs mt-1 text-center whitespace-nowrap ${
                              index === etapaAtualAnalise 
                                ? 'font-medium text-oraculo-blue' 
                                : podeNavegar
                                  ? 'text-oraculo-blue hover:underline cursor-pointer' 
                                  : 'text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {step}
                            {typeof cred === 'number' && <span className="block text-[10px] text-gray-500 font-normal">{cred} {cred === 1 ? 'crédito' : 'créditos'}</span>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 min-w-0">
                    <div 
                      className="bg-oraculo-blue h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${((2 + 1) / steps.length) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Texto do Projeto + Descreva o que quer melhorar — mesmo box */}
                {analiseConteudo && (
                  <div id="texto-do-projeto" className="bg-white rounded-xl shadow-md overflow-hidden mb-8 border-t-4 border-oraculo-purple">
                    <div className="p-4 md:p-8">
                      <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Texto do Projeto</h3>
                        <p className="text-sm text-gray-600">
                          Revise e edite o texto do seu projeto conforme necessário:
                        </p>
                      </div>
                      {(gerandoSugestao !== null || aplicandoSugestaoPersonalizada) && (
                        <div className="mb-3 p-3 bg-amber-50 border-2 border-amber-400 rounded-lg flex items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                          <span className="text-amber-900 font-medium">
                            Gerando alterações no texto...
                          </span>
                        </div>
                      )}
                      <textarea
                        className="w-full border-2 border-gray-300 rounded-lg px-5 py-4 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition min-h-[400px] text-gray-800 leading-relaxed resize-y mb-8"
                        value={descricaoEditada || descricao}
                        onChange={(e) => setDescricaoEditada(e.target.value)}
                        placeholder="Cole aqui todas as informações do seu projeto cultural..."
                        disabled={gerandoSugestao !== null || aplicandoSugestaoPersonalizada}
                      />

                      <h3 className="text-xl font-bold text-gray-900 mb-4">
                        Descreva o que quer melhorar e a IA ajusta o projeto
                      </h3>
                      <textarea
                        className="w-full border-2 border-gray-300 rounded-lg px-5 py-4 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition min-h-[120px] text-gray-800 leading-relaxed resize-y mb-4"
                        value={sugestaoPersonalizada}
                        onChange={(e) => setSugestaoPersonalizada(e.target.value)}
                        placeholder="Ex: Adicione mais detalhes sobre o cronograma de execução..."
                        disabled={aplicandoSugestaoPersonalizada || gerandoSugestao !== null}
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={handleAplicarSugestaoPersonalizada}
                          disabled={aplicandoSugestaoPersonalizada || !sugestaoPersonalizada.trim() || gerandoSugestao !== null}
                          className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white px-6 py-2"
                        >
                          {aplicandoSugestaoPersonalizada ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Aplicando...
                            </>
                          ) : (
                            'Aplicar Sugestão'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Análise completa (igual Projeto.tsx) — exibida em streaming */}
                <div ref={refSecaoAnalise} className="bg-white rounded-xl shadow-md overflow-hidden mb-8 border-t-4 border-oraculo-blue">
                  <div className="mb-8">
                    <div className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white px-4 md:px-8 py-4 md:py-6 rounded-t-xl flex items-center justify-between gap-3 md:gap-4 flex-wrap">
                      <div className="flex items-center gap-3 md:gap-4">
                        <Brain className="h-6 w-6 md:h-8 md:w-8 text-white flex-shrink-0" />
                        <h2 className="text-lg md:text-2xl font-bold">Análise do Oráculo</h2>
                      </div>
                      {analisando && (
                        <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm font-medium">Recebendo análise...</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-white border-2 border-gray-200 rounded-b-xl shadow-xl overflow-hidden">
                      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
                        {/* Nota Estimada - Card Especial */}
                        {(() => {
                          const notaPattern = /Nota:\s*(\d+)\/(\d+)\.?/gi;
                          const notas: Array<{ obtida: number; maxima: number }> = [];
                          let match;
                          while ((match = notaPattern.exec(analiseConteudo)) !== null) {
                            const obtida = parseInt(match[1]);
                            const maxima = parseInt(match[2]);
                            if (!isNaN(obtida) && !isNaN(maxima) && maxima > 0) {
                              notas.push({ obtida, maxima });
                            }
                          }
                          let notaGlobal = 0;
                          let notaMaximaTotal = 0;
                          if (notas.length > 0) {
                            const somaObtidas = notas.reduce((acc, n) => acc + n.obtida, 0);
                            const somaMaximas = notas.reduce((acc, n) => acc + n.maxima, 0);
                            notaGlobal = Math.round((somaObtidas / somaMaximas) * 100);
                            notaMaximaTotal = somaMaximas;
                          } else {
                            const notaSection = analiseConteudo.match(/5\.\s*\*\*Nota estimada.*?:\*\*\s*(\d+)/i);
                            if (notaSection && notaSection[1]) {
                              notaGlobal = parseInt(notaSection[1]);
                              notaMaximaTotal = 100;
                            } else {
                              const patterns = [/Nota estimada.*?:\s*(\d+)/i, /Nota estimada.*?\):\s*(\d+)/i];
                              for (const pattern of patterns) {
                                const m = analiseConteudo.match(pattern);
                                if (m && m[1]) {
                                  const nota = parseInt(m[1]);
                                  if (nota >= 0 && nota <= 100) {
                                    notaGlobal = nota;
                                    notaMaximaTotal = 100;
                                    break;
                                  }
                                }
                              }
                            }
                          }
                          if (notaGlobal === 0 && notaMaximaTotal === 0) return null;
                          return (
                            <div className="bg-gradient-to-r from-oraculo-blue/85 to-oraculo-purple/85 rounded-2xl p-8 text-white text-center mb-8">
                              <div className="flex items-center justify-center mb-4">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                                  <span className="text-3xl font-bold">📊</span>
                                </div>
                              </div>
                              <h3 className="text-2xl font-bold mb-2">Nota Estimada</h3>
                              <div className="text-6xl font-black mb-4">{notaGlobal}</div>
                              <div className="text-lg opacity-90">
                                de {notaMaximaTotal} pontos
                                {notas.length > 0 && (
                                  <span className="block text-sm mt-1 opacity-75">
                                    ({notas.reduce((acc, n) => acc + n.obtida, 0)}/{notaMaximaTotal} pontos obtidos)
                                  </span>
                                )}
                              </div>
                              <div className="mt-4 w-full bg-white/20 rounded-full h-3">
                                <div 
                                  className="bg-white rounded-full h-3 transition-all duration-1000 ease-out"
                                  style={{ width: `${notaGlobal}%` }}
                                ></div>
                              </div>
                              <p className="mt-6 text-white/90 text-sm md:text-base font-medium">
                                Esta é a mesma análise que você receberá no seu projeto real.
                              </p>
                            </div>
                          );
                        })()}

                        {/* Bloco separado: conclusão + próximo passo — só após a nota aparecer */}
                        {!analisando && (
                          <div className="mt-14 md:mt-16 mb-10 md:mb-12">
                            <p className="text-sm text-gray-500 mb-3">Este foi um projeto fictício apenas para demonstração.</p>
                            <div className="rounded-[10px] border border-[#E5E7EB] bg-[#FFFFFF] p-8 md:p-10 shadow-sm">
                              <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
                                <div className="flex-1 flex flex-col items-start gap-4 text-left w-full">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Próximo passo</span>
                                  <p className="text-xl font-semibold text-gray-900 leading-tight" style={{ fontWeight: 600 }}>
                                    Pronto para avaliar<br />o seu projeto real?
                                  </p>
                                  <p className="text-sm font-medium text-gray-700">Ao criar seu projeto você poderá:</p>
                                  <ul className="text-sm space-y-1 list-none pl-0" style={{ color: '#4B5563' }}>
                                    <li>• Gerar textos completos para editais</li>
                                    <li>• Criar orçamento automaticamente</li>
                                    <li>• Montar cronograma em minutos</li>
                                  </ul>
                                  <Button
                                    size="lg"
                                    onClick={() => user ? navigate('/criar-projeto') : navigate('/cadastro?redirect=/criar-projeto')}
                                    className="bg-[#22C55E] hover:bg-[#1ea34f] text-white font-semibold text-lg md:text-xl min-h-[48px] py-[14px] px-[22px] md:py-5 md:px-7 rounded-[10px] shadow-[0_10px_22px_rgba(0,0,0,0.18)] hover:shadow-[0_12px_26px_rgba(0,0,0,0.22)] transition-all border-0 mt-5"
                                  >
                                    Criar meu projeto gratuitamente
                                  </Button>
                                  <img
                                    src={CriarImg}
                                    alt="Criar projeto"
                                    className="w-full max-w-sm rounded-xl object-cover md:hidden mt-2"
                                  />
                                </div>
                                <div className="flex-shrink-0 w-full md:w-80 hidden md:block">
                                  <img
                                    src={CriarImg}
                                    alt="Criar projeto"
                                    className="w-full rounded-xl shadow-md object-cover"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Conteúdo da análise formatado — seções com títulos (2. PONTOS FORTES, 3. PONTOS FRACOS, etc.) */}
                        <div className="prose prose-sm max-w-none text-gray-700 space-y-8">
                          {parsearSecoesAnalise(removerSugestoesDoTexto(analiseConteudo)).map((sec, idx) => (
                            <div key={idx}>
                              {sec.titulo && (
                                <div className="border-b-2 border-gray-300 pb-3 mb-4">
                                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 uppercase tracking-tight">
                                    {sec.titulo}
                                  </h2>
                                </div>
                              )}
                              {sec.conteudo ? (
                                <pre className="whitespace-pre-wrap font-sans text-sm md:text-base leading-relaxed text-gray-700 mt-2">
                                  {sec.conteudo}
                                </pre>
                              ) : null}
                            </div>
                          ))}
                        </div>

                        {/* Sugestões de Melhoria */}
                        {sugestoes.length > 0 && (
                          <>
                            <div className="border-b-2 border-gray-300 pb-4 mb-6 mt-8">
                              <h2 className="text-2xl font-bold text-gray-900">
                                Sugestões de Melhoria
                              </h2>
                            </div>
                            {sugestoes.map((sugestao, idx) => (
                              <div key={`sugestao-${idx}`} className={`bg-gradient-to-r from-oraculo-blue/5 to-oraculo-purple/5 p-6 rounded-xl border-l-4 shadow-sm mb-4 ${aprovacoes[idx] ? 'border-green-500 bg-green-50/50' : 'border-oraculo-blue'}`}>
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="text-base text-gray-800 leading-relaxed">
                                      <span className={`text-lg font-medium ${aprovacoes[idx] ? 'text-green-700' : 'text-gray-800'}`}>
                                        💡 Sugestão {idx + 1}: {limparMarkdown(sugestao)}
                                      </span>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    className={aprovacoes[idx] 
                                      ? 'bg-green-500 hover:bg-green-600 text-white px-4 py-2 text-sm font-medium' 
                                      : 'bg-oraculo-blue hover:bg-oraculo-blue/90 text-white px-4 py-2 text-sm font-medium'}
                                    onClick={() => handleAprovar(idx)}
                                    disabled={gerandoSugestao !== null || aprovacoes[idx]}
                                  >
                                    {gerandoSugestao === idx ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Aplicando...
                                      </>
                                    ) : aprovacoes[idx] ? (
                                      <>
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Sugestão aplicada
                                      </>
                                    ) : (
                                      <>
                                        <Check className="h-4 w-4 mr-1" />
                                        Aplicar
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CTA repetido ao final — mesmo bloco separado, sem repetir a frase de demonstração */}
                  {!analisando && (
                    <div className="mt-14 md:mt-16">
                      <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] p-8 md:p-10 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
                          <div className="flex-1 flex flex-col items-start gap-4 text-left w-full">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Próximo passo</span>
                            <p className="text-xl font-semibold text-gray-900 leading-tight" style={{ fontWeight: 600 }}>
                              Pronto para avaliar<br />o seu projeto real?
                            </p>
                            <p className="text-sm font-medium text-gray-700">Ao criar seu projeto você poderá:</p>
                            <ul className="text-sm space-y-1 list-none pl-0" style={{ color: '#4B5563' }}>
                              <li>• Gerar textos completos para editais</li>
                              <li>• Criar orçamento automaticamente</li>
                              <li>• Montar cronograma em minutos</li>
                            </ul>
                            <Button
                              size="lg"
                              onClick={() => user ? navigate('/criar-projeto') : navigate('/cadastro?redirect=/criar-projeto')}
                              className="bg-[#22C55E] hover:bg-[#1ea34f] text-white font-semibold text-base md:text-lg min-h-[48px] py-[14px] px-[22px] rounded-[10px] shadow-[0_10px_22px_rgba(0,0,0,0.18)] hover:shadow-[0_12px_26px_rgba(0,0,0,0.22)] transition-all border-0 mt-5"
                            >
                              Criar meu projeto gratuitamente
                            </Button>
                            <img
                              src={CriarImg}
                              alt="Criar projeto"
                              className="w-full max-w-sm rounded-xl object-cover md:hidden mt-2"
                            />
                          </div>
                          <div className="flex-shrink-0 w-full md:w-80 hidden md:block">
                            <img
                              src={CriarImg}
                              alt="Criar projeto"
                              className="w-full rounded-xl shadow-md object-cover"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
};

export default AvaliarProjeto;
