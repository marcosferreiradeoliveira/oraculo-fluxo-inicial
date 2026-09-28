/**
 * Servidor Express legado — IA via Gemini
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createGeminiClient } = require('./functions/geminiClient');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const ai = createGeminiClient(
  process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'oraculo-is'
  });
}
const db = admin.firestore();

app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Oraculo API is running', ai: 'gemini' });
});

app.post('/analisarProjeto', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const completion = await ai.chat.completions.create({
      model: 'gemini-3.8-flash',
      messages: [
        { role: 'system', content: 'Você é um consultor especialista em projetos culturais, agindo como um avaliador rigoroso, porém construtivo.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1500,
      temperature: 0.2,
    });

    const analiseIA = completion.choices[0].message?.content || 'Sem resposta da IA.';
    return res.status(200).json({ analise: analiseIA });
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return res.status(500).json({ error: error?.message || 'Failed to get analysis from AI.' });
  }
});

app.post('/gerar-texto', async (req, res) => {
  try {
    const { projetoId, tipo, dadosProjeto } = req.body;

    if (!projetoId || !tipo || !dadosProjeto) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    const projetoRef = db.collection('projetos').doc(projetoId);
    const projetoDoc = await projetoRef.get();

    if (!projetoDoc.exists) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    let promptEspecifico = '';
    const tituloProjeto = dadosProjeto.nome || 'o projeto';

    switch (tipo) {
      case 'justificativa':
        promptEspecifico = `Crie uma justificativa para o projeto "${tituloProjeto}" que demonstre a importância e relevância cultural do projeto. `;
        break;
      case 'objetivos':
        promptEspecifico = `Descreva os objetivos do projeto "${tituloProjeto}" de forma clara e mensurável. `;
        break;
      case 'metodologia':
        promptEspecifico = `Descreva a metodologia que será utilizada no projeto "${tituloProjeto}", detalhando as etapas e processos. `;
        break;
      case 'resultados_esperados':
        promptEspecifico = `Liste os resultados esperados para o projeto "${tituloProjeto}", incluindo indicadores de sucesso. `;
        break;
      case 'cronograma':
        promptEspecifico = `Crie um cronograma detalhado para o projeto "${tituloProjeto}" com as principais atividades e prazos. `;
        break;
      default:
        return res.status(400).json({ error: 'Tipo de texto inválido' });
    }

    promptEspecifico += `\n\nInformações do projeto:\n`;
    if (dadosProjeto.descricao) promptEspecifico += `Descrição: ${dadosProjeto.descricao}\n`;
    if (dadosProjeto.objetivos) promptEspecifico += `Objetivos: ${dadosProjeto.objetivos}\n`;
    if (dadosProjeto.metodologia) promptEspecifico += `Metodologia: ${dadosProjeto.metodologia}\n`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (res.flush) res.flush();
    };

    const stream = await ai.chat.completions.create({
      model: 'gemini-3.8-flash',
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em redação de projetos culturais para leis de incentivo. Gere textos claros, objetivos e bem estruturados.'
        },
        { role: 'user', content: promptEspecifico },
      ],
      stream: true,
      max_tokens: 1500,
      temperature: 0.7,
    });

    let fullText = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullText += content;
        sendEvent({ type: 'chunk', content });
      }
    }

    sendEvent({ type: 'done', text: fullText });
    await projetoRef.update({ [`textos.${tipo}`]: fullText });
    res.end();
  } catch (error) {
    console.error('Error generating text:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: error?.message || 'Erro ao gerar texto' });
    }
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (Gemini)`);
});
