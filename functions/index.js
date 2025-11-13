const { onRequest } = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const { OpenAI } = require("openai");
const mercadopago = require("mercadopago");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Lazy initialization helpers
let openaiInstance = null;
let mpInstance = null;
let preferenceInstance = null;

function getOpenAI() {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY || "" 
    });
  }
  return openaiInstance;
}

function getMercadoPago() {
  if (!mpInstance) {
    mpInstance = new mercadopago.MercadoPagoConfig({ 
      accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || "" 
    });
    preferenceInstance = new mercadopago.Preference(mpInstance);
  }
  return { mp: mpInstance, preference: preferenceInstance };
}

exports.avaliarProjetoIA = onRequest(async (req, res) => {
  // Set CORS headers BEFORE any checks
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '3600');
  
  // Handle preflight requests FIRST
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  try {
    // Receber dados do projeto, edital, critérios e portfolio
    const { 
      textoProjeto, 
      nomeProjeto, 
      nomeEdital, 
      criteriosEdital, 
      textoEdital,
      portfolio,
      projetosSelecionados,
      userId
    } = req.body;
      
    if (!textoProjeto || !criteriosEdital) {
      return res.status(400).json({ error: 'Texto do projeto e critérios do edital são obrigatórios' });
    }
    
    // Buscar dados do usuário (equipeBio e portfolio) se userId fornecido
    let equipeBio = '';
    let userPortfolio = portfolio || '';
    
    if (userId) {
      try {
        const userDoc = await db.collection('usuarios').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          equipeBio = userData.equipeBio || '';
          // Se portfolio não foi enviado no body, buscar do usuário
          if (!userPortfolio) {
            userPortfolio = userData.portfolio || '';
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        // Continuar sem os dados do usuário em caso de erro
      }
    }
    
    // Construir o prompt detalhado de avaliação
    const prompt = `Você é um avaliador experiente de projetos culturais para leis de incentivo fiscal. 
Sua tarefa é avaliar rigorosamente o projeto apresentado contra os critérios específicos do edital e o histórico do proponente.

${nomeProjeto ? `**PROJETO:** ${nomeProjeto}` : ''}

**TEXTO DO PROJETO PARA AVALIAÇÃO:**
${textoProjeto}

**EDITAL:** ${nomeEdital || 'Não especificado'}

**CRITÉRIOS DO EDITAL QUE DEVEM SER AVALIADOS:**
${criteriosEdital}

${textoEdital ? `**TEXTO COMPLETO DO EDITAL (para contexto adicional):**\n${textoEdital}` : ''}

${equipeBio ? `**EQUIPE E BIOGRAFIA DO PROPONENTE:**\n${equipeBio}\n\nConsidere a qualificação e experiência da equipe ao avaliar a viabilidade do projeto.` : ''}

${userPortfolio ? `**PORTFOLIO E EXPERIÊNCIAS DO PROPONENTE:**\n${userPortfolio}\n\nUse estas informações para avaliar a capacidade técnica e operacional do proponente de executar o projeto.` : ''}

${projetosSelecionados ? `**PROJETOS JÁ SELECIONADOS NESTE EDITAL (para referência comparativa):**\n${projetosSelecionados.slice(0, 2000)}\n\nUse como referência de qualidade e adequação esperada.` : ''}

**INSTRUÇÕES DE AVALIAÇÃO:**

1. **ADEQUAÇÃO AOS CRITÉRIOS DO EDITAL**: Analise item por item como o projeto atende (ou não atende) cada critério específico. Cite exatamente os critérios e avalie com ✅ ou ❌.

2. **PONTOS FORTES DO PROJETO**: Destaque 3-4 pontos fortes bem fundamentados e específicos.

3. **PONTOS FRACOS E GAPS**: Identifique claramente o que falta no projeto ou o que precisa ser melhorado.

4. **SUGESTÕES DE MELHORIA**: Forneça 4-5 sugestões práticas e específicas para aumentar a chance de aprovação. Cada sugestão deve:
   - Começar com "Sugestão: "
   - Ser acionável e implementável
   - Relacionar-se diretamente com os critérios do edital
   - Considerar o portfolio do proponente (se fornecido)

5. **NOTA ESTIMADA (0-100)**: Atribua uma nota justificada considerando:
   - Adequação aos critérios do edital (peso: 40%)
   - Viabilidade e capacidade de execução (peso: 30%)
   - Qualidade técnica e inovação (peso: 20%)
   - Impacto cultural e relevância (peso: 10%)

Seja objetivo, específico e construtivo. Baseie sua análise nos critérios reais do edital fornecido.`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'Você é um avaliador oficial de projetos culturais com décadas de experiência em leis de incentivo fiscal. Seu papel é ser rigoroso mas construtivo, sempre buscando melhorar a qualidade dos projetos apresentados.' 
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });
    
    const analiseIA = completion.choices[0].message?.content || 'Sem resposta da IA.';
    
    return res.status(200).json({ analise: analiseIA });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return res.status(500).json({ 
      error: error && error.message ? error.message : 'Failed to get analysis from AI.' 
    });
  }
});

exports.gerarTexto = onRequest(async (req, res) => {
  // Set CORS headers BEFORE any checks
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '3600');
  
  // Handle preflight requests FIRST
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  
  try {
    const { projetoId, tipo, dadosProjeto, prompt, userId } = req.body;
    
    if (!projetoId || !tipo || !dadosProjeto) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Buscar dados do usuário (equipeBio e portfolio) se userId fornecido
    let equipeBio = '';
    let userPortfolio = dadosProjeto.portfolio || '';
    
    if (userId) {
      try {
        const userDoc = await db.collection('usuarios').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          equipeBio = userData.equipeBio || '';
          // Se portfolio não foi enviado no dadosProjeto, buscar do usuário
          if (!userPortfolio) {
            userPortfolio = userData.portfolio || '';
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        // Continuar sem os dados do usuário em caso de erro
      }
    }
    
    // Permitir qualquer tipo de texto (para suportar categorias personalizadas)
    // A validação agora aceita qualquer string como tipo
    // const tiposValidos = ['justificativa', 'objetivos', 'metodologia', 'resultados_esperados', 'cronograma', 'orcamento'];
    // if (!tiposValidos.includes(tipo)) {
    //   return res.status(400).json({ error: 'Tipo de texto inválido' });
    // }
    
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
    
    // Adicionar equipeBio e portfolio ao prompt se disponíveis
    let contextInfo = '';
    if (equipeBio) {
      contextInfo += `\n\nEQUIPE E BIOGRAFIA DO PROPONENTE:\n${equipeBio}\n\nConsidere a qualificação e experiência da equipe ao gerar o texto.`;
    }
    if (userPortfolio) {
      contextInfo += `\n\nPORTFOLIO E EXPERIÊNCIAS DO PROPONENTE:\n${userPortfolio}\n\nUse estas informações para contextualizar e enriquecer o texto gerado.`;
    }
    const promptFinal = promptEspecifico + contextInfo;
    
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: tipo === 'orcamento' 
            ? 'Você é um especialista em orçamentos para projetos culturais. Crie orçamentos detalhados, realistas e bem estruturados. IMPORTANTE: NÃO use asteriscos (**) ou marcadores markdown no texto gerado.'
            : 'Você é um especialista em elaboração de projetos culturais para leis de incentivo. Gere textos claros, objetivos e bem estruturados. IMPORTANTE: NÃO use asteriscos (**) ou marcadores markdown no texto gerado.'
        },
        { role: 'user', content: promptFinal },
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

exports.gerarTextosProjeto = onRequest(async (req, res) => {
  // Set CORS headers BEFORE any checks
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '3600');
  
  // Handle preflight requests FIRST
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  
  try {
    const { projetoId, tipo, dadosProjeto, prompt, userId } = req.body;
    
    if (!projetoId || !tipo || !dadosProjeto) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Buscar dados do usuário (equipeBio e portfolio) se userId fornecido
    let equipeBio = '';
    let userPortfolio = dadosProjeto.portfolio || '';
    
    if (userId) {
      try {
        const userDoc = await db.collection('usuarios').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          equipeBio = userData.equipeBio || '';
          // Se portfolio não foi enviado no dadosProjeto, buscar do usuário
          if (!userPortfolio) {
            userPortfolio = userData.portfolio || '';
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        // Continuar sem os dados do usuário em caso de erro
      }
    }
    
    // Permitir qualquer tipo de texto (para suportar categorias personalizadas)
    // A validação agora aceita qualquer string como tipo
    // const tiposValidos = ['justificativa', 'objetivos', 'metodologia', 'resultados_esperados', 'cronograma', 'orcamento'];
    // if (!tiposValidos.includes(tipo)) {
    //   return res.status(400).json({ error: 'Tipo de texto inválido' });
    // }
    
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
    
    // Adicionar equipeBio e portfolio ao prompt se disponíveis
    let contextInfo = '';
    if (equipeBio) {
      contextInfo += `\n\nEQUIPE E BIOGRAFIA DO PROPONENTE:\n${equipeBio}\n\nConsidere a qualificação e experiência da equipe ao gerar o texto.`;
    }
    if (userPortfolio) {
      contextInfo += `\n\nPORTFOLIO E EXPERIÊNCIAS DO PROPONENTE:\n${userPortfolio}\n\nUse estas informações para contextualizar e enriquecer o texto gerado.`;
    }
    const promptFinal = promptEspecifico + contextInfo;
    
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: tipo === 'orcamento' 
            ? 'Você é um especialista em orçamentos para projetos culturais. Crie orçamentos detalhados, realistas e bem estruturados. IMPORTANTE: NÃO use asteriscos (**) ou marcadores markdown no texto gerado.'
            : 'Você é um especialista em elaboração de projetos culturais para leis de incentivo. Gere textos claros, objetivos e bem estruturados. IMPORTANTE: NÃO use asteriscos (**) ou marcadores markdown no texto gerado.'
        },
        { role: 'user', content: promptFinal },
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

exports.criarCheckoutPremium = onRequest(
  { 
    cors: true,
    maxInstances: 10,
    invoker: 'public'
  }, 
  async (req, res) => {
    // Set CORS headers explicitly
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    console.log('[criarCheckoutPremium] Request received:', req.method);
    console.log('[criarCheckoutPremium] Request body:', req.body);
    
    try {
      // Verificar se as variáveis de ambiente estão configuradas
      if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
        throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
      }
      
      console.log('[criarCheckoutPremium] Getting MercadoPago instance...');
      const { preference } = getMercadoPago();
      
      const preferenceData = {
        items: [
          {
            id: "premium-plan",
            title: "Assinatura Oráculo Premium",
            description: "Plano Premium do Oráculo Cultural",
            category_id: "services",
            quantity: 1,
            currency_id: "BRL",
            unit_price: 97.00
          },
        ],
        payer: {
          email: req.body.userEmail || "email@example.com"
        },
        back_urls: {
          success: "https://oraculocultural.com.br/cadastro-premium?status=success",
          failure: "https://oraculocultural.com.br/cadastro-premium?status=failure",
          pending: "https://oraculocultural.com.br/cadastro-premium?status=pending",
        },
        auto_return: "approved",
        notification_url: "https://oraculocultural.com.br/webhook",
        statement_descriptor: "ORACULO PREMIUM",
        external_reference: req.body.userId || "unknown"
      };
      
      console.log('[criarCheckoutPremium] Creating preference with data:', JSON.stringify(preferenceData));
      
      // Use the correct SDK v2 method with body wrapper
      const response = await preference.create({ body: preferenceData });
      console.log('[criarCheckoutPremium] Preference created successfully:', response.id);
      console.log('[criarCheckoutPremium] Init point:', response.init_point);
      
      res.status(200).json({ init_point: response.init_point });
    } catch (error) {
      console.error('[criarCheckoutPremium] Error details:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
      res.status(500).json({ 
        error: error.message || 'Erro desconhecido ao criar checkout',
        details: error.cause ? error.cause.message : undefined
      });
    }
  }
);

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
