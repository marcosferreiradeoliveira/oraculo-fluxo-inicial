require('dotenv').config();
/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Forçar novo deploy e garantir apenas v2
const { onRequest } = require("firebase-functions/v2/https");
const { OpenAI } = require("openai");
const mercadopago = require("mercadopago");
const mp = new mercadopago.MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN });
const preference = new mercadopago.Preference(mp);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

exports.analisarProjeto = onRequest(async (req, res) => {
  // Configurar CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Responder a requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).send('');
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
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
    console.error('Error calling OpenAI API:', error);
    // Garante que sempre retorna JSON válido, mesmo em erro inesperado
    return res.status(500).json({ error: error && error.message ? error.message : 'Failed to get analysis from AI.' });
  }
});

exports.gerarTexto = onRequest(async (req, res) => {
  // Configurar CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Responder a requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).send('');
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  try {
    const { projetoId, tipo, dadosProjeto, prompt } = req.body;
    
    if (!projetoId || !tipo || !dadosProjeto) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validar tipos permitidos
    const tiposValidos = ['justificativa', 'objetivos', 'metodologia', 'resultados_esperados', 'cronograma', 'orcamento'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de texto inválido' });
    }
    
    // Criar prompt específico para orçamento
    let promptEspecifico = prompt;
    if (tipo === 'orcamento') {
      promptEspecifico = `Você é um especialista em elaboração de orçamentos para projetos culturais. 
      Crie um orçamento detalhado e realista para o projeto cultural descrito abaixo.
      Inclua todas as rubricas necessárias como: produção, divulgação, recursos humanos, materiais, equipamentos, etc.
      Seja específico com valores e justificativas para cada item.
      
      DADOS DO PROJETO:
      Nome: ${dadosProjeto.nome || 'Não informado'}
      Descrição: ${dadosProjeto.descricao || 'Não informado'}
      Resumo: ${dadosProjeto.resumo || 'Não informado'}
      
      Gere um orçamento completo e profissional:`;
    }
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: tipo === 'orcamento' 
            ? 'Você é um especialista em orçamentos para projetos culturais. Crie orçamentos detalhados, realistas e bem estruturados.'
            : 'Você é um especialista em elaboração de projetos culturais para leis de incentivo. Gere textos claros, objetivos e bem estruturados.'
        },
        { role: 'user', content: promptEspecifico },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });
    
    const textoGerado = completion.choices[0].message?.content || 'Erro ao gerar texto.';
    
    return res.status(200).json({ 
      texto: textoGerado,
      tipo: tipo,
      projetoId: projetoId
    });
    
  } catch (error) {
    console.error('Error generating text:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to generate text' 
    });
  }
});

exports.criarCheckoutPremium = onRequest(async (req, res) => {
  try {
    const preferenceData = {
      items: [
        {
          title: "Assinatura Oráculo Premium",
          unit_price: 97,
          quantity: 1,
        },
      ],
      back_urls: {
        success: "https://oraculocultural.com.br/cadastro-premium?status=success",
        failure: "https://oraculocultural.com.br/cadastro-premium?status=failure",
        pending: "https://oraculocultural.com.br/cadastro-premium?status=pending",
      },
      auto_return: "approved",
    };
    const response = await preference.create(preferenceData);
    res.status(200).json({ init_point: response.init_point });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
// setGlobalOptions({ maxInstances: 10 }); // This line is removed as per the edit hint.

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
