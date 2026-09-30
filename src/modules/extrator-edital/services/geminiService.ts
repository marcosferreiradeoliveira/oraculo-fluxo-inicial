import { GoogleGenAI, Type } from '@google/genai';

function getAiClient(): GoogleGenAI {
  const API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY não configurada no .env');
  }
  return new GoogleGenAI({ apiKey: API_KEY });
}

const schema = {
  type: Type.OBJECT,
  properties: {
    nome: { type: Type.STRING, description: 'O nome oficial e completo do edital.' },
    proponente: {
      type: Type.STRING,
      description: "A entidade, empresa ou instituição que está propondo/organizando o edital.",
    },
    escopo: { type: Type.STRING, description: 'O escopo, objetivo ou resumo principal do edital.' },
    categorias: {
      type: Type.ARRAY,
      description: 'Categorias ou modalidades elegíveis.',
      items: { type: Type.STRING },
    },
    criterios: { type: Type.STRING, description: 'Critérios de avaliação e pontuações.' },
    dataEncerramento: { type: Type.STRING, description: 'Data final AAAA-MM-DD.' },
    data_encerramento: { type: Type.STRING, description: 'Idêntica a dataEncerramento.' },
    textos_exigidos: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    documentacao_exigida: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nome: { type: Type.STRING },
          fase: { type: Type.STRING },
        },
        required: ['nome', 'fase'],
      },
    },
    valor_maximo_premiacao: { type: Type.STRING },
    criado_em: { type: Type.STRING },
    projetos_selecionados: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nome: { type: Type.STRING },
          proponente: { type: Type.STRING },
          resumo: { type: Type.STRING },
          valor: { type: Type.STRING },
          ano: { type: Type.STRING },
          fonte: { type: Type.STRING },
        },
      },
    },
    historico_edital: {
      type: Type.OBJECT,
      properties: {
        edicoesAnteriores: { type: Type.ARRAY, items: { type: Type.STRING } },
        frequencia: { type: Type.STRING },
        ultimaEdicao: { type: Type.STRING },
      },
    },
  },
  required: [
    'nome',
    'proponente',
    'escopo',
    'categorias',
    'criterios',
    'dataEncerramento',
    'data_encerramento',
    'textos_exigidos',
    'documentacao_exigida',
    'valor_maximo_premiacao',
    'criado_em',
  ],
};

export async function analyzeEdital(text: string): Promise<string> {
  const model = 'gemini-2.5-flash';

  const prompt = `
      Você é um especialista em analisar editais culturais brasileiros. Extraia informações do texto e retorne JSON conforme o schema.

      Texto do Edital:
      ---
      ${text}
      ---
    `;

  const response = await getAiClient().models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0.2,
    },
  });

  return response.text ?? '';
}
