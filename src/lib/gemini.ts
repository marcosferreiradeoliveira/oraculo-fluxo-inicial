/**
 * Cliente Gemini no browser (substitui OpenAI nos fluxos locais).
 * Preferir Cloud Functions em produção; aqui cobre OraculoAI/Portfolio.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_MODEL = 'gemini-3.8-flash';

function getApiKey() {
  const key = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  if (!key) {
    throw new Error('VITE_GEMINI_API_KEY não configurada no .env');
  }
  return key;
}

function splitMessages(messages: { role: string; content: string }[]) {
  const systemParts: string[] = [];
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemParts.push(msg.content);
      continue;
    }
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  if (contents.length && contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: '(continuar)' }] });
  }

  return {
    systemInstruction: systemParts.filter(Boolean).join('\n\n') || undefined,
    contents,
  };
}

export async function geminiChatCompletion(opts: {
  messages: { role: string; content: string }[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
}): Promise<string> {
  const genAI = new GoogleGenerativeAI(getApiKey());
  const { systemInstruction, contents } = splitMessages(opts.messages);
  const model = genAI.getGenerativeModel({
    model: opts.model || DEFAULT_MODEL,
    ...(systemInstruction ? { systemInstruction } : {}),
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.3,
    },
  });

  const result = await model.generateContent({ contents });
  return result.response.text() || '';
}
