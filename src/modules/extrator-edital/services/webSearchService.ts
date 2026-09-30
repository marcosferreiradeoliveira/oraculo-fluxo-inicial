import { analyzeEdital } from './geminiService';

export interface ProjetoSelecionado {
  nome: string;
  proponente: string;
  resumo: string;
  valor: string;
  ano: string;
  fonte: string;
  url?: string;
}

export interface BuscaWebResult {
  projetosEncontrados: ProjetoSelecionado[];
  totalEncontrado: number;
  termoBuscado: string;
  sucesso: boolean;
  erro?: string;
}

export async function buscarProjetosSelecionados(
  nomeEdital: string, 
  proponente: string
): Promise<BuscaWebResult> {
  try {
    // Criar termo de busca otimizado
    const termoBusca = `"${nomeEdital}" "${proponente}" projetos selecionados premiados aprovados`;
    
    // Usar a API do Gemini para fazer busca web e análise
    const prompt = `
    Você é um especialista em buscar informações sobre editais culturais brasileiros na web.
    
    Tarefa: Buscar projetos selecionados/premiados de edições passadas do edital "${nomeEdital}" da entidade "${proponente}".
    
    Instruções:
    1. Procure por resultados de edições anteriores deste edital
    2. Identifique projetos que foram selecionados, premiados ou aprovados
    3. Extraia informações relevantes de cada projeto encontrado
    4. Retorne os dados em formato JSON estruturado
    
    Termo de busca: ${termoBusca}
    
    Retorne um JSON com a seguinte estrutura:
    {
      "projetosEncontrados": [
        {
          "nome": "Nome do projeto",
          "proponente": "Nome do proponente do projeto",
          "resumo": "Resumo breve do projeto",
          "valor": "Valor recebido (se disponível)",
          "ano": "Ano da edição",
          "fonte": "Fonte da informação",
          "url": "URL da fonte (se disponível)"
        }
      ],
      "totalEncontrado": 0,
      "termoBuscado": "${termoBusca}",
      "sucesso": true
    }
    
    Se não encontrar projetos, retorne um array vazio mas mantenha sucesso: true.
    Se houver erro na busca, defina sucesso: false e inclua uma mensagem de erro.
    `;

    const response = await analyzeEdital(prompt);
    
    // Limpar e parsear a resposta
    const cleanedResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const result: BuscaWebResult = JSON.parse(cleanedResponse);
    
    return result;
    
  } catch (error) {
    console.error('Erro na busca web:', error);
    return {
      projetosEncontrados: [],
      totalEncontrado: 0,
      termoBuscado: `"${nomeEdital}" "${proponente}"`,
      sucesso: false,
      erro: 'Erro ao buscar projetos selecionados'
    };
  }
}

export async function buscarHistoricoEdital(
  nomeEdital: string,
  proponente: string
): Promise<{
  edicoesAnteriores: string[];
  frequencia: string;
  ultimaEdicao: string;
}> {
  try {
    const prompt = `
    Busque informações sobre o histórico do edital "${nomeEdital}" da entidade "${proponente}".
    
    Retorne um JSON com:
    {
      "edicoesAnteriores": ["2023", "2022", "2021"],
      "frequencia": "anual/bienal/trimestral",
      "ultimaEdicao": "2023"
    }
    `;

    const response = await analyzeEdital(prompt);
    const cleanedResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(cleanedResponse);
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return {
      edicoesAnteriores: [],
      frequencia: 'desconhecida',
      ultimaEdicao: 'desconhecida'
    };
  }
}
