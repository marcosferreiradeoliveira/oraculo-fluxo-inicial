import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_MODEL =
  (import.meta.env.VITE_GEMINI_MODEL as string | undefined)?.trim() || 'gemini-3.8-flash';

function getApiKey(): string {
  const key = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
  if (!key) {
    throw new Error('VITE_GEMINI_API_KEY não configurada no .env');
  }
  return key;
}

async function generateJson(prompt: string, maxOutputTokens = 8192): Promise<string> {
  const genAI = new GoogleGenerativeAI(getApiKey());
  const model = genAI.getGenerativeModel({
    model: DEFAULT_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens,
    },
  });
  const result = await model.generateContent(prompt);
  return result.response.text() || '';
}

/** Tarefas genéricas JSON (busca web, histórico). */
export async function runGeminiJsonTask(prompt: string): Promise<string> {
  return generateJson(prompt, 4096);
}

export async function analyzeEdital(text: string): Promise<string> {
  const prompt = `
Você é um especialista em analisar editais culturais brasileiros. Extraia informações do texto e retorne JSON.

Campos obrigatórios:
- nome (string): nome oficial do edital
- proponente (string): entidade organizadora
- escopo (string): resumo/objetivo
- categorias (array de strings)
- criterios (string): critérios de avaliação completos
- dataEncerramento (string AAAA-MM-DD)
- data_encerramento (igual a dataEncerramento)
- textos_exigidos (array de strings)
- documentacao_exigida (array de objetos { nome, fase })
- valor_maximo_premiacao (string)
- criado_em (string ISO data de hoje)
- projetos_selecionados (array, pode ser vazio)
- historico_edital (objeto com edicoesAnteriores, frequencia, ultimaEdicao — pode ser vazio)

Texto do Edital:
---
${text.slice(0, 120_000)}
---
`;

  return generateJson(prompt);
}
