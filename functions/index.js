const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const functions = require("firebase-functions");
const { OpenAI } = require("openai");
const mercadopago = require("mercadopago");
const stripe = require("stripe");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const axios = require("axios");
const { getStorage } = require("firebase-admin/storage");
const pdfParseLib = require("pdf-parse");
const { createWorker } = require("tesseract.js");
const { fromPath } = require("pdf2pic");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Definir secret para Access Token do Mercado Pago
const mercadoPagoAccessToken = defineSecret("MERCADO_PAGO_ACCESS_TOKEN");

// Definir secrets para Stripe
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// Definir secret para Brevo
const brevoApiKey = defineSecret("BREVO_API_KEY");

// Definir secret para OpenAI
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Lazy initialization helpers
let openaiInstance = null;
let mpInstance = null;
let preferenceInstance = null;
let preapprovalInstance = null;
let preapprovalPlanInstance = null;

function getOpenAI() {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({ 
      apiKey: openaiApiKey.value() || "" 
    });
  }
  return openaiInstance;
}

function getMercadoPago() {
  if (!mpInstance) {
    // NOTA: O Mercado Pago pode ter credenciais de teste que começam com APP_USR-
    // O contexto da aplicação (sandbox/teste) é que determina se são de teste
    // Firebase Functions v2: secrets são injetados como variáveis de ambiente após deploy
    // Tentar obter do secret (via value() se disponível), depois variável de ambiente, depois fallback
    let accessToken;
    try {
      // Tentar obter do secret definido (funciona em runtime)
      accessToken = mercadoPagoAccessToken.value();
    } catch (e) {
      // Se não disponível, tentar variável de ambiente (após deploy com secrets)
      accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    }
    // Fallback para desenvolvimento local
    accessToken = accessToken || "APP_USR-783906941666085-010213-a7124ca4d6ae0e9ad0fb28935a13a1b4-2448199655";
    
    // Limpar o token: remover espaços, quebras de linha e prefixo "Bearer " se presente
    if (accessToken) {
      const originalToken = accessToken.toString();
      accessToken = originalToken.trim();
      // Remover prefixo "Bearer " se presente
      if (accessToken.startsWith('Bearer ')) {
        accessToken = accessToken.substring(7).trim();
      }
      // Remover qualquer caractere de nova linha ou espaço extra
      accessToken = accessToken.replace(/\s+/g, '').trim();
      
      // Log para debug (sem expor o token completo)
      console.log('[getMercadoPago] Token original length:', originalToken.length);
      console.log('[getMercadoPago] Token limpo length:', accessToken.length);
      console.log('[getMercadoPago] Token começa com:', accessToken.substring(0, 10));
    }
    
    // Flag para indicar modo de teste (pode ser configurado via variável de ambiente)
    const isTestMode = process.env.MERCADO_PAGO_TEST_MODE === 'true' || true; // Default para true em desenvolvimento
    
    // Debug: mostrar origem do token (sem expor o token completo)
    let tokenSource = 'fallback (hardcoded)';
    try {
      if (mercadoPagoAccessToken.value()) {
        tokenSource = 'secret (defineSecret)';
      }
    } catch (e) {
      if (process.env.MERCADO_PAGO_ACCESS_TOKEN) {
        tokenSource = 'variável de ambiente';
      }
    }
    
    if (!accessToken) {
      const errorMsg = `MERCADO_PAGO_ACCESS_TOKEN não configurado. 
        Configure via variável de ambiente:
        - No Firebase Console: Functions > Configurações > Variáveis de ambiente
        - Ou via CLI: firebase functions:secrets:set MERCADO_PAGO_ACCESS_TOKEN
        - Ou no código: process.env.MERCADO_PAGO_ACCESS_TOKEN`;
      console.error('[getMercadoPago]', errorMsg);
      throw new Error(errorMsg);
    }
    
    // Validar formato básico do token
    const isTestToken = accessToken.startsWith('TEST-');
    const isAppUsrToken = accessToken.startsWith('APP_USR-');
    
    // Mostrar primeiros caracteres do token para debug (sem expor completo)
    const tokenPreview = accessToken.substring(0, 15) + '...' + accessToken.substring(accessToken.length - 4);
    
    console.log('[getMercadoPago] Token obtido de:', tokenSource);
    console.log('[getMercadoPago] Token preview:', tokenPreview);
    console.log('[getMercadoPago] Modo de teste:', isTestMode ? 'SIM' : 'NÃO');
    
    if (!isTestToken && !isAppUsrToken) {
      console.error('[getMercadoPago] ❌ Token não reconhecido! Deve começar com TEST- ou APP_USR-');
      console.error('[getMercadoPago] Token atual começa com:', accessToken.substring(0, 10));
      throw new Error('Token do Mercado Pago inválido. Deve começar com TEST- ou APP_USR-');
    }
    
    if (isTestToken) {
      console.log('[getMercadoPago] ✅ Usando credenciais de TESTE (formato TEST-)');
    } else if (isAppUsrToken) {
      if (isTestMode) {
        console.log('[getMercadoPago] ✅ Usando credenciais de TESTE (formato APP_USR- em modo sandbox)');
      } else {
        console.log('[getMercadoPago] ⚠️ Usando credenciais de PRODUÇÃO (formato APP_USR-)');
      }
    }
    
    mpInstance = new mercadopago.MercadoPagoConfig({ 
      accessToken: accessToken
    });
    preferenceInstance = new mercadopago.Preference(mpInstance);
    preapprovalInstance = new mercadopago.PreApproval(mpInstance);
    preapprovalPlanInstance = new mercadopago.PreApprovalPlan(mpInstance);
  }
  return { 
    mp: mpInstance, 
    preference: preferenceInstance,
    preapproval: preapprovalInstance,
    preapprovalPlan: preapprovalPlanInstance
  };
}

exports.avaliarProjetoIA = onRequest(
  {
    secrets: [openaiApiKey],
  },
  async (req, res) => {
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
      userId,
      stream: useStream = false
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
Sua tarefa é avaliar rigorosamente o projeto apresentado contra os critérios específicos do edital.

PRIORIDADE PRINCIPAL: A avaliação deve ser baseada PRIMARIAMENTE no TEXTO DO PROJETO abaixo. Os demais dados (portfolio, equipe) são apenas contexto adicional para entender melhor a capacidade de execução.

${nomeProjeto ? `**PROJETO:** ${nomeProjeto}` : ''}

**TEXTO DO PROJETO PARA AVALIAÇÃO (PRIORIDADE PRINCIPAL):**
${textoProjeto}

**EDITAL:** ${nomeEdital || 'Não especificado'}

**CRITÉRIOS DO EDITAL QUE DEVEM SER AVALIADOS:**
Os critérios abaixo são os critérios de avaliação reais do edital, obtidos diretamente do campo "criterios" do documento do edital na collection "editais". Você deve usar APENAS e EXCLUSIVAMENTE estes critérios para avaliar o projeto:
${criteriosEdital}

IMPORTANTE: 
- Os critérios de avaliação estão listados acima. Estes são os ÚNICOS critérios que devem ser considerados na avaliação.
- A seção "1. ADEQUAÇÃO AOS CRITÉRIOS DO EDITAL" na sua resposta é apenas um título da análise, não é um critério em si.
- Avalie o projeto usando APENAS os critérios listados acima no campo "CRITÉRIOS DO EDITAL QUE DEVEM SER AVALIADOS".
- Não invente ou assuma critérios que não estejam explicitamente listados acima.

${textoEdital ? `**TEXTO COMPLETO DO EDITAL (para contexto adicional):**\n${textoEdital}` : ''}

${projetosSelecionados ? `**PROJETOS JÁ SELECIONADOS NESTE EDITAL (para referência comparativa):**\n${projetosSelecionados.slice(0, 2000)}\n\nUse como referência de qualidade e adequação esperada.` : ''}

${equipeBio ? `**EQUIPE E BIOGRAFIA DO PROPONENTE (contexto adicional):**\n${equipeBio}\n\nUse apenas para entender a capacidade de execução, mas a avaliação deve focar no texto do projeto.` : ''}

${userPortfolio ? `**PORTFOLIO E EXPERIÊNCIAS DO PROPONENTE (contexto adicional):**\n${userPortfolio}\n\nUse apenas como contexto para avaliar capacidade de execução, mas a análise deve focar no texto do projeto apresentado.` : ''}

**INSTRUÇÕES DE AVALIAÇÃO:**

1. **ADEQUAÇÃO AOS CRITÉRIOS DO EDITAL**: Analise item por item como o projeto atende (ou não atende) CADA critério específico listado na seção "CRITÉRIOS DO EDITAL QUE DEVEM SER AVALIADOS" acima. Use APENAS os critérios fornecidos nessa seção - não use critérios genéricos ou inventados. Baseie-se PRINCIPALMENTE no TEXTO DO PROJETO. Cite exatamente os critérios daquela seção e avalie cada um. IMPORTANTE: "ADEQUAÇÃO AOS CRITÉRIOS DO EDITAL" é apenas um título desta seção da resposta - os critérios reais estão na seção acima.

2. **PONTOS FORTES DO PROJETO**: Destaque 3-4 pontos fortes bem fundamentados e específicos baseados no TEXTO DO PROJETO, relacionados aos critérios do edital.

3. **PONTOS FRACOS E GAPS**: Identifique claramente o que falta no projeto ou o que precisa ser melhorado, baseando-se nos CRITÉRIOS DO EDITAL e no TEXTO DO PROJETO.

4. **SUGESTÕES DE MELHORIA**: Forneça 4-5 sugestões práticas e específicas para aumentar a chance de aprovação. Cada sugestão deve:
   - Começar com "Sugestão: "
   - Ser acionável e implementável
   - Relacionar-se diretamente com os CRITÉRIOS ESPECÍFICOS DO EDITAL fornecidos acima e o TEXTO DO PROJETO
   - O portfolio pode ser considerado apenas como contexto adicional para sugestões sobre capacidade de execução

5. **NOTA ESTIMADA (0-100)**: Atribua uma nota justificada considerando PRINCIPALMENTE o TEXTO DO PROJETO e os CRITÉRIOS ESPECÍFICOS DO EDITAL fornecidos acima. 
   - Use APENAS os critérios e pontuações especificados na seção "CRITÉRIOS DO EDITAL QUE DEVEM SER AVALIADOS"
   - Se os critérios especificarem pontuações individuais, respeite essas pontuações
   - Se os critérios não especificarem pesos, distribua a pontuação de forma proporcional entre os critérios listados
   - NÃO use critérios genéricos como "Viabilidade e capacidade de execução", "Qualidade técnica e inovação", "Impacto cultural e relevância" - use APENAS os critérios fornecidos acima

Seja objetivo, específico e construtivo. Baseie sua análise PRINCIPALMENTE no TEXTO DO PROJETO e APENAS nos critérios específicos do edital fornecidos na seção "CRITÉRIOS DO EDITAL QUE DEVEM SER AVALIADOS" acima.`;

    const openai = getOpenAI();
    
    // Se streaming está habilitado, usar Server-Sent Events
    if (useStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      const stream = await openai.chat.completions.create({
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
        stream: true,
      });
      
      let fullContent = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          // Enviar chunk via SSE
          res.write(`data: ${JSON.stringify({ content, done: false })}\n\n`);
        }
      }
      
      // Enviar sinal de conclusão
      res.write(`data: ${JSON.stringify({ content: '', done: true, fullContent })}\n\n`);
      res.end();
      return;
    }
    
    // Modo não-streaming (comportamento original)
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

exports.gerarTexto = onRequest(
  {
    secrets: [openaiApiKey],
  },
  async (req, res) => {
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
    
    // Buscar dados do usuário (equipeBio, portfolio e dadosCadastrais) se userId fornecido
    let equipeBio = dadosProjeto.equipeBio || '';
    let userPortfolio = dadosProjeto.portfolio || '';
    let dadosCadastrais = dadosProjeto.dadosCadastrais || '';
    
    if (userId) {
      try {
        const userDoc = await db.collection('usuarios').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          // Se não foi enviado no dadosProjeto, buscar do usuário
          if (!equipeBio) {
            equipeBio = userData.equipeBio || '';
          }
          if (!userPortfolio) {
            userPortfolio = userData.portfolio || '';
          }
          if (!dadosCadastrais) {
            dadosCadastrais = userData.dadosCadastrais || '';
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
    
    // Adicionar equipeBio, portfolio e dadosCadastrais ao prompt se disponíveis
    let contextInfo = '';
    if (equipeBio && equipeBio.trim()) {
      contextInfo += `\n\nEQUIPE E BIOGRAFIA DO PROPONENTE (APENAS PARA REFERÊNCIA, NÃO INCLUIR LITERALMENTE):\n${equipeBio}\n\nIMPORTANTE: Use apenas como contexto adicional para entender capacidade de execução. NÃO inclua o texto do equipeBio literalmente no texto gerado. Se necessário mencionar experiência da equipe, faça de forma sutil e integrada, sem copiar trechos.`;
    }
    if (userPortfolio && userPortfolio.trim()) {
      contextInfo += `\n\nPORTFOLIO E EXPERIÊNCIAS DO PROPONENTE (APENAS PARA REFERÊNCIA, NÃO INCLUIR LITERALMENTE):\n${userPortfolio}\n\nIMPORTANTE: O portfolio é apenas contexto de referência sobre histórico e experiência. NÃO inclua o portfolio literalmente no texto gerado. Use-o apenas quando a geração exigir menção a experiência/capacidade, mas faça isso de forma SUTIL e INTEGRADA, sem copiar trechos do portfolio. O texto gerado deve focar nos dados do projeto.`;
    }
    if (dadosCadastrais && dadosCadastrais.trim()) {
      contextInfo += `\n\nDADOS CADASTRAIS DO PROPONENTE (APENAS PARA REFERÊNCIA, NÃO INCLUIR LITERALMENTE):\n${dadosCadastrais}\n\nIMPORTANTE: Use apenas como contexto adicional. NÃO inclua os dados cadastrais literalmente no texto gerado. O texto gerado deve focar nos dados do projeto.`;
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

exports.alterarTextoComIA = onRequest(
  {
    secrets: [openaiApiKey],
  },
  async (req, res) => {
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
    const { textoAtual, sugestao, portfolio, userId } = req.body;
    
    if (!textoAtual || !sugestao) {
      return res.status(400).json({ error: 'textoAtual e sugestao são obrigatórios' });
    }
    
    // Validar que os campos não estão vazios
    if (typeof textoAtual !== 'string' || textoAtual.trim().length === 0) {
      return res.status(400).json({ error: 'textoAtual não pode estar vazio' });
    }
    
    if (typeof sugestao !== 'string' || sugestao.trim().length === 0) {
      return res.status(400).json({ error: 'sugestao não pode estar vazia' });
    }
    
    // Buscar portfolio do usuário se userId fornecido e portfolio não foi enviado
    let userPortfolio = portfolio || '';
    if (userId && !userPortfolio) {
      try {
        const userDoc = await db.collection('usuarios').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userPortfolio = userData.portfolio || '';
        }
      } catch (error) {
        console.error('Error fetching user portfolio:', error);
        // Continuar sem portfolio em caso de erro
      }
    }
    
    let portfolioContext = '';
    if (userPortfolio && userPortfolio.trim()) {
      portfolioContext = `\n\nCONTEXTO ADICIONAL - PORTFOLIO DO PROPONENTE (APENAS PARA REFERÊNCIA, NÃO INCLUIR NO TEXTO):\n${userPortfolio}\n\nIMPORTANTE: O portfolio acima é apenas contexto de referência sobre o histórico e experiência do proponente. NÃO inclua o portfolio literalmente no texto reescrito. Use-o apenas para entender melhor o contexto quando a sugestão exigir menção a experiência/capacidade, mas faça isso de forma sutil e integrada ao projeto, sem copiar trechos do portfolio.`;
    }
    
    const prompt = `Com base na sugestão abaixo, reescreva APENAS o texto específico fornecido, incorporando a sugestão.

IMPORTANTE: Você está reescrevendo APENAS um texto específico (como justificativa, objetivos, metodologia, etc.), NÃO o projeto completo.

SUGESTÃO:
${sugestao}

TEXTO ATUAL (APENAS ESTE TEXTO DEVE SER REESCRITO):
${textoAtual}${portfolioContext}

INSTRUÇÕES CRÍTICAS:
- Reescreva APENAS o texto fornecido acima, incorporando a sugestão de forma natural
- A sugestão deve estar integrada ao texto, não apenas mencionada
- Mantenha a estrutura, tom e estilo do texto original
- O resultado deve ser uma versão melhorada deste texto específico que incorpora a sugestão
- NÃO reescreva o projeto completo, apenas este texto específico
- NÃO inclua o portfolio literalmente no texto reescrito
- Se a sugestão exigir menção a experiência/capacidade, use o contexto do portfolio apenas para dar credibilidade, mas de forma SUTIL e INTEGRADA, sem copiar trechos
- O texto gerado deve ter o mesmo foco e escopo do texto original fornecido

TEXTO REESCRITO:`;

    const openai = getOpenAI();
    
    // Configurar streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'Você é um especialista em projetos culturais. Quando receber uma sugestão e um texto específico (como justificativa, objetivos, metodologia, etc.), reescreva APENAS esse texto específico incorporando a sugestão de forma natural e integrada. NÃO reescreva o projeto completo, apenas o texto fornecido. Não apenas mencione a sugestão, mas incorpore-a ao texto de forma natural.' 
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.3,
      stream: true,
    });
    
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
    
  } catch (error) {
    console.error('Error altering text with AI:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to alter text with AI' 
    });
  }
});

exports.gerarTextosProjeto = onRequest(
  {
    secrets: [openaiApiKey],
  },
  async (req, res) => {
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
    
    // Buscar dados do usuário (equipeBio, portfolio e dadosCadastrais) se userId fornecido
    let equipeBio = dadosProjeto.equipeBio || '';
    let userPortfolio = dadosProjeto.portfolio || '';
    let dadosCadastrais = dadosProjeto.dadosCadastrais || '';
    
    if (userId) {
      try {
        const userDoc = await db.collection('usuarios').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          // Se não foi enviado no dadosProjeto, buscar do usuário
          if (!equipeBio) {
            equipeBio = userData.equipeBio || '';
          }
          if (!userPortfolio) {
            userPortfolio = userData.portfolio || '';
          }
          if (!dadosCadastrais) {
            dadosCadastrais = userData.dadosCadastrais || '';
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
    
    // IMPORTANTE: Extrair os dados do projeto - especialmente a descrição que pode ter sido atualizada
    const descricaoProjeto = dadosProjeto.descricao || '';
    const nomeProjeto = dadosProjeto.nome || 'Não informado';
    const resumoProjeto = dadosProjeto.resumo || '';
    
    console.log('[gerarTextosProjeto] Dados do projeto recebidos:', {
      nome: nomeProjeto,
      hasDescricao: !!descricaoProjeto,
      descricaoLength: descricaoProjeto.length,
      tipo: tipo
    });
    
    // Criar prompt específico com dados do projeto
    // IMPORTANTE: Sempre incluir a descrição completa do projeto para basear a geração
    let promptEspecifico = '';
    
    // Instruções de formatação (sem asteriscos/markdown)
    const instrucoesFormatacao = `
REGRA CRÍTICA DE FORMATAÇÃO: 
- NÃO use asteriscos (**texto**) para negrito
- NÃO use markdown (##, ###, *, _, etc)
- NÃO use símbolos de formatação
- Use texto simples e claro
- Use quebras de linha para separar parágrafos
- Use listas numeradas (1., 2., 3.) se necessário, mas sem asteriscos ou símbolos
- O texto deve estar em formato de texto puro, sem qualquer marcação especial
`;

    if (tipo === 'orcamento') {
      // Buscar teto do orçamento dos dados do projeto ou do prompt
      let tetoMaximo = dadosProjeto.teto || 0;
      
      // Tentar extrair do prompt se não estiver nos dados do projeto
      if (!tetoMaximo || tetoMaximo === 0) {
        if (prompt) {
          // Tentar múltiplos padrões para encontrar o teto no prompt
          const padrao1 = prompt.match(/teto.*?R\$\s*([\d.,]+)/i);
          const padrao2 = prompt.match(/R\$\s*([\d.,]+)/i);
          const padraoTeto = padrao1 || padrao2;
          
          if (padraoTeto) {
            const valorStr = padraoTeto[1].replace(/\./g, '').replace(',', '.');
            tetoMaximo = parseFloat(valorStr) || 0;
          }
        }
      }
      
      console.log('[gerarTextosProjeto] Teto máximo detectado para orçamento:', tetoMaximo);
      
      const tetoFormatado = tetoMaximo > 0 ? tetoMaximo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
      
      promptEspecifico = `Você é um especialista em elaboração de orçamentos para projetos culturais. 
Crie um orçamento COMPLETO, DETALHADO E ABRANGENTE para o projeto cultural descrito abaixo.

CRÍTICO - NÃO CRIE JUSTIFICATIVAS:
- NÃO crie linhas de texto explicando o orçamento
- NÃO crie justificativas ou explicações sobre as rubricas
- NÃO crie texto introdutório ou conclusivo
- Apenas liste as rubricas com nome e valor
- Cada linha deve ser UMA rubrica: "Nome da Rubrica: R$ valor"
- NÃO inclua textos como "Justificativa:", "Observação:", "Nota:", etc.

IMPORTANTE: Gere um orçamento COMPLETO desde o início, incluindo TODAS as rubricas necessárias:
- Produção (coordenação, produção executiva, supervisão)
- Recursos Humanos (mão de obra, profissionais, equipe técnica, artistas, diretores, produtores)
- Materiais e Equipamentos (materiais gráficos, equipamentos técnicos, insumos)
- Locação (equipamentos, espaços, veículos)
- Transporte e Deslocamento (combustível, passagens, hospedagem)
- Divulgação e Marketing (publicidade, assessoria de imprensa, redes sociais, material promocional)
- Infraestrutura e Montagem (cenografia, iluminação, sonorização, palco)
- Outros custos (taxas, impostos, seguros, etc.)

Seja ESPECÍFICO e DETALHADO. Não seja genérico. Liste todas as rubricas importantes que um projeto cultural precisa.
Cada rubrica deve ter um valor realista e proporcional ao projeto descrito.

IMPORTANTE SOBRE UNIDADES - USE DIVERSIDADE DE UNIDADES:
Para cada rubrica, SEMPRE indique a unidade apropriada. VARIE as unidades de acordo com o tipo de rubrica:
- "mês" ou "meses" para locação/aluguel de equipamentos, espaços, veículos
- "dia" ou "dias" para diárias, hospedagem, trabalho por dia, alimentação diária
- "pessoa" ou "pessoas" para mão de obra, profissionais, equipe técnica, artistas, diretores, produtores
- "km" para transporte, deslocamento, combustível, passagens, viagens
- "serviço" para serviços diversos, divulgação, publicidade, assessoria, marketing
- "hora" ou "horas" para serviços por hora, profissionais técnicos que cobram por hora
- "unidade" para materiais físicos, equipamentos, insumos, itens concretos
- "verba" para verbas gerais de produção, coordenação, administração
- "semana" ou "semanas" para serviços ou locações semanais
- "achê" quando apropriado

NÃO use sempre "unidade" ou "serviço". Varie as unidades de acordo com a natureza real de cada rubrica!

FORMATO DE CADA RUBRICA (use um por linha):
Nome da Rubrica: R$ valor
ou
Nome da Rubrica - R$ valor
ou
Nome da Rubrica (unidade: tipo) - R$ valor

IMPORTANTE SOBRE VALORES - USE VALORES BEM REDONDOS:
- NUNCA use centavos. Todos os valores devem ser múltiplos inteiros.
- Valores >= R$ 10.000: use múltiplos de 1.000. Exemplos: R$ 10.000,00, R$ 15.000,00, R$ 20.000,00.
- Valores entre R$ 1.000 e R$ 9.999: use múltiplos de 100. Exemplos: R$ 1.200,00, R$ 2.500,00, R$ 5.000,00, R$ 8.400,00.
- Valores entre R$ 100 e R$ 999: use múltiplos de 50. Exemplos: R$ 150,00, R$ 250,00, R$ 500,00, R$ 750,00.
- Valores entre R$ 10 e R$ 99: use múltiplos de 10. Exemplos: R$ 20,00, R$ 40,00, R$ 60,00, R$ 90,00.
- Valores < R$ 10: use múltiplos de 5. Exemplos: R$ 5,00.
- PROIBIDO usar valores como R$ 1.234,56, R$ 857,89, R$ 123,45. Use R$ 1.200,00, R$ 800,00, R$ 100,00.

Exemplos de valores redondos:
- Locação de equipamento de som: R$ 2.500,00 (unidade: mês)
- Material gráfico: R$ 1.200,00 (unidade: unidade)
- Transporte: R$ 800,00 (unidade: km)
- Mão de obra técnica: R$ 5.000,00 (unidade: pessoa)
- Divulgação: R$ 3.000,00 (unidade: serviço)
- Produção executiva: R$ 8.000,00 (unidade: verba)

${instrucoesFormatacao}

${tetoMaximo > 0 ? `TETO MÁXIMO DO ORÇAMENTO (OBRIGATÓRIO): R$ ${tetoFormatado}

REGRA CRÍTICA: A soma total de TODAS as rubricas DEVE ser IGUAL ou MENOR que R$ ${tetoFormatado}. 
IMPORTANTE: 
- Distribua o valor total entre as rubricas de forma coerente e realista com as necessidades do projeto
- NÃO ultrapasse o teto máximo sob nenhuma circunstância
- Calcule cuidadosamente para que o total não exceda R$ ${tetoFormatado}
- Se necessário, ajuste os valores das rubricas para respeitar o limite máximo\n\n` : ''}

DADOS DO PROJETO (USE ESTES DADOS PARA CRIAR O ORÇAMENTO):
Nome: ${nomeProjeto}
${resumoProjeto ? `Resumo: ${resumoProjeto}\n` : ''}
${descricaoProjeto ? `Descrição completa do projeto:\n${descricaoProjeto}\n` : ''}

Com base EXCLUSIVAMENTE no projeto descrito acima, gere um orçamento COMPLETO, DETALHADO E PROFISSIONAL que reflita TODAS as necessidades e atividades descritas no projeto.

IMPORTANTE: 
- Liste TODAS as rubricas necessárias. Não seja econômico na quantidade de rubricas.
- Seja ABRANGENTE e DETALHADO. Inclua desde itens grandes (produção, mão de obra) até itens menores mas importantes (materiais, transporte, divulgação).
- O orçamento deve ser REALISTA e COMPLETO, como se fosse ser apresentado em um edital real.
- Cada rubrica deve ter um valor específico e justificado pela necessidade do projeto.
- NÃO crie justificativas, explicações ou observações. Apenas liste as rubricas com nome e valor.
- NÃO inclua texto explicativo entre as rubricas. Apenas as rubricas, uma por linha.

${tetoMaximo > 0 ? `O orçamento DEVE respeitar rigorosamente o teto máximo de R$ ${tetoFormatado}. A soma de todas as rubricas não pode ultrapassar este valor. Distribua o valor total de forma coerente entre TODAS as rubricas necessárias.` : ''}

Lembre-se: texto puro, sem asteriscos, sem markdown, sem símbolos de formatação.
Formate cada rubrica como: "Nome da Rubrica: R$ X.XXX,XX" ou "Nome da Rubrica - R$ X.XXX,XX" ou "Nome da Rubrica (unidade: tipo) - R$ X.XXX,XX".
Liste UMA rubrica por linha.

Gere o orçamento COMPLETO agora:`;
    } else {
      // Para todos os outros tipos de texto, incluir a descrição completa do projeto
      const tipoTextoFormatado = tipo.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      
      promptEspecifico = `Você é um especialista em elaboração de projetos culturais para leis de incentivo. 
Gere um texto claro, objetivo e bem estruturado para o seguinte item do projeto: ${tipoTextoFormatado}.

${instrucoesFormatacao}

REGRA FUNDAMENTAL: O texto gerado DEVE ser baseado EXCLUSIVAMENTE na descrição completa do projeto fornecida abaixo. 
NÃO invente novos projetos. NÃO use apenas o portfolio. Use APENAS os dados do projeto descrito abaixo como base.

DADOS DO PROJETO (BASE PARA GERAÇÃO DO TEXTO):
Nome: ${nomeProjeto}
${resumoProjeto ? `Resumo: ${resumoProjeto}\n` : ''}
${descricaoProjeto ? `Descrição completa do projeto:\n${descricaoProjeto}\n` : ''}

Com base EXCLUSIVAMENTE na descrição do projeto acima, gere o texto para "${tipoTextoFormatado}" que seja:
- Baseado nos dados, informações e objetivos do projeto descrito
- Coerente com o projeto apresentado (nome, resumo, descrição)
- Claro, objetivo e bem estruturado
- Alinhado com a natureza e objetivo do projeto cultural descrito
- Formato de texto puro, SEM asteriscos, SEM markdown, SEM símbolos de formatação

CRÍTICO: O texto deve refletir o projeto descrito acima. NÃO invente novos projetos ou use apenas o portfolio como base.`;
    }
    
    // Adicionar equipeBio, portfolio e dadosCadastrais ao prompt se disponíveis
    let contextInfo = '';
    if (equipeBio && equipeBio.trim()) {
      contextInfo += `\n\nEQUIPE E BIOGRAFIA DO PROPONENTE (APENAS PARA REFERÊNCIA, NÃO INCLUIR LITERALMENTE):\n${equipeBio}\n\nIMPORTANTE: Use apenas como contexto adicional para entender capacidade de execução. NÃO inclua o texto do equipeBio literalmente no texto gerado. Se necessário mencionar experiência da equipe, faça de forma sutil e integrada, sem copiar trechos.`;
    }
    if (userPortfolio && userPortfolio.trim()) {
      contextInfo += `\n\nPORTFOLIO E EXPERIÊNCIAS DO PROPONENTE (APENAS PARA REFERÊNCIA, NÃO INCLUIR LITERALMENTE):\n${userPortfolio}\n\nIMPORTANTE: O portfolio é apenas contexto de referência sobre histórico e experiência. NÃO inclua o portfolio literalmente no texto gerado. Use-o apenas quando a geração exigir menção a experiência/capacidade, mas faça isso de forma SUTIL e INTEGRADA, sem copiar trechos do portfolio. O texto gerado deve focar nos dados do projeto.`;
    }
    if (dadosCadastrais && dadosCadastrais.trim()) {
      contextInfo += `\n\nDADOS CADASTRAIS DO PROPONENTE (APENAS PARA REFERÊNCIA, NÃO INCLUIR LITERALMENTE):\n${dadosCadastrais}\n\nIMPORTANTE: Use apenas como contexto adicional. NÃO inclua os dados cadastrais literalmente no texto gerado. O texto gerado deve focar nos dados do projeto.`;
    }
    const promptFinal = promptEspecifico + contextInfo;
    
    const openai = getOpenAI();
    
    // Configurar streaming para exibir texto em tempo real
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: tipo === 'orcamento' 
            ? 'Você é um especialista em orçamentos para projetos culturais. Crie orçamentos detalhados, realistas e bem estruturados baseados EXCLUSIVAMENTE nos dados do projeto fornecido. CRÍTICO: O texto gerado deve estar em FORMATO DE TEXTO PURO. NÃO use asteriscos (**), NÃO use markdown (##, ###, *), NÃO use símbolos de formatação. Use apenas texto simples, quebras de linha e listas numeradas simples (1., 2., 3.) se necessário. NÃO invente novos projetos - use apenas o projeto descrito.'
            : 'Você é um especialista em elaboração de projetos culturais para leis de incentivo. Gere textos claros, objetivos e bem estruturados baseados EXCLUSIVAMENTE na descrição do projeto fornecida. CRÍTICO: O texto gerado deve estar em FORMATO DE TEXTO PURO. NÃO use asteriscos (**), NÃO use markdown (##, ###, *), NÃO use símbolos de formatação. Use apenas texto simples, quebras de linha e listas numeradas simples (1., 2., 3.) se necessário. NÃO invente novos projetos - use apenas o projeto descrito. NÃO use apenas o portfolio como base.'
        },
        { role: 'user', content: promptFinal },
      ],
      max_tokens: 2000,
      temperature: 0.3,
      stream: true,
    });
    
    // IMPORTANTE: Preservar TODOS os espaços - não limpar em cada chunk, apenas no final
    let textoCompleto = '';
    
    try {
      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          // Acumular o texto sem limpar - preservar espaços
          textoCompleto += content;
          // Enviar o conteúdo original para preservar espaços
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: content })}\n\n`);
        }
      }
      
      // Apenas limpar formatação no texto completo final, preservando espaços
      if (textoCompleto && typeof textoCompleto === 'string') {
        textoCompleto = textoCompleto
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **texto** (negrito)
          .replace(/\*(.*?)\*/g, '$1') // Remove *texto* (itálico) 
          .replace(/__(.*?)__/g, '$1') // Remove __texto__ (negrito)
          .replace(/_(.*?)_/g, '$1') // Remove _texto_ (itálico)
          .replace(/##/g, '') // Remove ## apenas, preserva espaços ao redor
          .replace(/###/g, '') // Remove ### apenas, preserva espaços
          .replace(/####/g, '') // Remove #### apenas, preserva espaços
          .replace(/`(.*?)`/g, '$1') // Remove `código`
          .replace(/~~(.*?)~~/g, '$1') // Remove ~~texto~~
          .replace(/^\s*[-*+]\s+/gm, ''); // Remove marcadores de lista mas preserva resto
      }
      
      // Garantir que textoCompleto seja string
      const finalText = textoCompleto || '';
      
      res.write(`data: ${JSON.stringify({ type: 'complete', fullText: finalText })}\n\n`);
      res.end();
    } catch (streamError) {
      console.error('Erro durante streaming:', streamError);
      if (!res.headersSent) {
        throw streamError;
      }
      // Se já começamos streaming, enviar erro via stream
      res.write(`data: ${JSON.stringify({ type: 'error', message: streamError.message || 'Erro ao gerar texto' })}\n\n`);
      res.end();
    }
    
  } catch (error) {
    console.error('Error generating text:', error);
    
    // Se ainda não enviamos headers de streaming, retornar JSON
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: error.message || 'Failed to generate text' 
      });
    }
    
    // Se já começamos streaming, enviar erro via stream
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message || 'Failed to generate text' })}\n\n`);
    res.end();
  }
});

// Gera cronograma (etapas com início e fim) com base no orçamento, textos do projeto e edital
exports.gerarCronogramaIA = onRequest(
  {
    secrets: [openaiApiKey],
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      const { projetoId } = req.body;
      if (!projetoId) {
        return res.status(400).json({ error: 'projetoId é obrigatório' });
      }

      const projetoRef = db.collection('projetos').doc(projetoId);
      const projetoSnap = await projetoRef.get();
      if (!projetoSnap.exists) {
        return res.status(404).json({ error: 'Projeto não encontrado' });
      }

      const projeto = projetoSnap.data();
      const nomeProjeto = projeto.nome || 'Projeto';
      const descricaoProjeto = projeto.descricao || projeto.resumo || '';
      const orcamento = projeto.orcamento || {};
      const rubricas = orcamento.rubricas || [];
      const tetoOrcamento = orcamento.teto || 0;
      const textosGerados = projeto.textos_gerados || {};

      let dataEncerramentoEdital = null;
      let nomeEdital = '';
      if (projeto.edital_id) {
        try {
          const editalSnap = await db.collection('editais').doc(projeto.edital_id).get();
          if (editalSnap.exists) {
            const edital = editalSnap.data();
            nomeEdital = edital.nome || '';
            const raw = edital.data_encerramento || edital.dataEncerramento || edital.deadline;
            if (raw) {
              if (raw.toDate) dataEncerramentoEdital = raw.toDate();
              else if (raw.seconds) dataEncerramentoEdital = new Date(raw.seconds * 1000);
              else if (typeof raw === 'string') dataEncerramentoEdital = new Date(raw);
            }
          }
        } catch (e) {
          console.warn('[gerarCronogramaIA] Erro ao buscar edital:', e.message);
        }
      }

      const hoje = new Date();
      const fimMaximo = dataEncerramentoEdital && !isNaN(dataEncerramentoEdital.getTime())
        ? dataEncerramentoEdital
        : new Date(hoje.getFullYear() + 1, hoje.getMonth(), hoje.getDate());
      const dataInicioMin = hoje.toISOString().slice(0, 10);
      const dataFimMax = fimMaximo.toISOString().slice(0, 10);

      const rubricasTexto = rubricas.length > 0
        ? rubricas.map((r) => `- ${r.nome || r.rubrica || 'Rubrica'}: R$ ${Number(r.total || r.valor || 0).toLocaleString('pt-BR')}`).join('\n')
        : 'Orçamento não informado ou vazio.';

      const textosResumo = Object.keys(textosGerados).length > 0
        ? Object.entries(textosGerados)
          .filter(([, v]) => v && typeof v === 'string')
          .map(([k, v]) => `[${k}]:\n${String(v).slice(0, 1500)}`)
          .join('\n\n')
        : 'Textos do projeto não informados.';

      const prompt = `Você é um especialista em planejamento de projetos culturais para editais.

Com base EXCLUSIVAMENTE nos dados abaixo do projeto, orçamento e textos já elaborados, gere um CRONOGRAMA de etapas em JSON.

REGRAS OBRIGATÓRIAS:
- Retorne APENAS um array JSON válido, sem texto antes ou depois. Nenhuma explicação, apenas o JSON.
- Cada item do array deve ter exatamente: "etapa" (nome curto da etapa), "inicio" (data YYYY-MM-DD), "fim" (data YYYY-MM-DD).
- As datas devem estar entre ${dataInicioMin} (hoje) e ${dataFimMax} (prazo máximo do edital/projeto).
- As etapas devem refletir as fases naturais do projeto: planejamento, pré-produção, produção, divulgação, execução, prestação de contas, etc., conforme o orçamento e os textos.
- Use as rubricas do orçamento e os textos (metodologia, objetivos, justificativa) para definir etapas coerentes e realistas.
- Cada etapa deve ter duração razoável (semanas ou meses). Não crie etapas de um único dia, exceto marcos específicos se fizer sentido.
- As etapas devem ser sequenciais ou parcialmente sobrepostas quando fizer sentido (ex.: divulgação durante produção).

DADOS DO PROJETO:
Nome: ${nomeProjeto}
${descricaoProjeto ? `Descrição/Resumo:\n${descricaoProjeto.slice(0, 2000)}\n` : ''}

ORÇAMENTO (rubricas):
${rubricasTexto}
${tetoOrcamento ? `Teto total: R$ ${tetoOrcamento.toLocaleString('pt-BR')}` : ''}

TEXTOS DO PROJETO (trechos):
${textosResumo}

${nomeEdital ? `Edital: ${nomeEdital}. Data limite de encerramento: ${dataFimMax}.` : ''}

Retorne somente o array JSON, por exemplo:
[{"etapa":"Planejamento e pré-produção","inicio":"2025-02-01","fim":"2025-03-15"},{"etapa":"Produção","inicio":"2025-03-16","fim":"2025-06-30"}]`;

      const openai = getOpenAI();
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Você gera apenas um array JSON de etapas de cronograma. Cada objeto tem "etapa" (string), "inicio" (YYYY-MM-DD), "fim" (YYYY-MM-DD). Nenhum texto extra, apenas o JSON.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      });

      const content = completion.choices?.[0]?.message?.content?.trim() || '';
      let etapas = [];
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          etapas = JSON.parse(jsonMatch[0]);
          if (!Array.isArray(etapas)) etapas = [];
          etapas = etapas
            .filter((e) => e && typeof e.etapa === 'string' && e.inicio && e.fim)
            .map((e) => ({
              etapa: String(e.etapa).trim(),
              inicio: String(e.inicio).slice(0, 10),
              fim: String(e.fim).slice(0, 10),
            }));
        } catch (parseErr) {
          console.error('[gerarCronogramaIA] Erro ao parsear JSON:', parseErr);
        }
      }

      return res.status(200).json({ etapas });
    } catch (error) {
      console.error('[gerarCronogramaIA]', error);
      return res.status(500).json({
        error: error.message || 'Erro ao gerar cronograma com IA',
      });
    }
  }
);

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
      console.log('[criarCheckoutPremium] Getting MercadoPago instance...');
      let preference;
      try {
        const mpInstance = getMercadoPago();
        preference = mpInstance.preference;
        console.log('[criarCheckoutPremium] ✅ Instância do Mercado Pago criada com sucesso');
      } catch (mpError) {
        console.error('[criarCheckoutPremium] ❌ Erro ao criar instância do Mercado Pago:', mpError.message);
        return res.status(500).json({ 
          error: 'Erro de configuração do Mercado Pago',
          message: mpError.message,
          hint: 'Verifique se as credenciais estão configuradas corretamente. Para teste, use token que começa com TEST-'
        });
      }
      
      // Validar userId obrigatório
      const userId = req.body.userId;
      if (!userId) {
        return res.status(400).json({ error: 'userId é obrigatório' });
      }
      
      // Buscar dados do usuário no Firestore para obter nome completo
      let firstName = '';
      let lastName = '';
      
      try {
        const userDoc = await db.collection('usuarios').doc(userId).get();
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const nomeCompleto = userData.nome_completo || '';
          
          // Dividir nome completo em primeiro e último nome
          if (nomeCompleto) {
            const nomeParts = nomeCompleto.trim().split(/\s+/);
            firstName = nomeParts[0] || '';
            lastName = nomeParts.length > 1 ? nomeParts.slice(1).join(' ') : '';
          }
          
          console.log('[criarCheckoutPremium] Nome do usuário:', { nomeCompleto, firstName, lastName });
        }
      } catch (error) {
        console.error('[criarCheckoutPremium] Erro ao buscar dados do usuário:', error);
        // Continua sem nome se houver erro
      }
      
      // Definir o preço do plano premium (R$ 99,00/mês)
      const unitPrice = 99.00;
      console.log('[criarCheckoutPremium] Unit price definido como:', unitPrice);
      
      // Construir objeto payer com nome completo
      const payerData = {
        email: req.body.userEmail || "email@example.com"
      };
      
      // Adicionar first_name e last_name se disponíveis
      if (firstName) {
        payerData.first_name = firstName;
      }
      if (lastName) {
        payerData.last_name = lastName;
      }
      
      const preferenceData = {
        items: [
          {
            id: "premium-plan",
            title: "Assinatura Oráculo Premium",
            description: "Plano Premium do Oráculo Cultural",
            category_id: "services",
            quantity: 1,
            currency_id: "BRL",
            unit_price: unitPrice
          },
        ],
        payer: payerData,
        back_urls: {
          success: process.env.MP_SUCCESS_URL || "https://oraculocultural.com.br/cadastro-premium?status=success",
          failure: process.env.MP_FAILURE_URL || "https://oraculocultural.com.br/cadastro-premium?status=failure",
          pending: process.env.MP_PENDING_URL || "https://oraculocultural.com.br/cadastro-premium?status=pending",
        },
        auto_return: "approved",
        notification_url: process.env.WEBHOOK_URL || "https://us-central1-culturalapp-fb9b0.cloudfunctions.net/webhookMercadoPago",
        statement_descriptor: "ORACULO PREMIUM",
        external_reference: userId,
        binary_mode: false, // Permite pagamentos pendentes
        payment_methods: {
          excluded_payment_types: [],
          excluded_payment_methods: [],
          installments: 1
        },
        // Configurações para facilitar testes
        metadata: {
          test_mode: true // Indica que está em modo de teste
        }
      };
      
      console.log('[criarCheckoutPremium] Creating preference with data:', JSON.stringify(preferenceData));
      
      // Use the correct SDK v2 method with body wrapper
      const response = await preference.create({ body: preferenceData });
      console.log('[criarCheckoutPremium] Preference created successfully:', response.id);
      console.log('[criarCheckoutPremium] Init point:', response.init_point);
      console.log('[criarCheckoutPremium] Sandbox init point:', response.sandbox_init_point);
      
      // Em modo de teste, usar sandbox_init_point se disponível (não requer autenticação)
      // Em produção, usar init_point
      const checkoutUrl = response.sandbox_init_point || response.init_point;
      
      // Salvar preferência no Firestore para rastreamento
      try {
        await db.collection('preferences').doc(response.id).set({
          userId: userId,
          preferenceId: response.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'pending'
        });
        console.log(`[criarCheckoutPremium] Preference ${response.id} saved to Firestore`);
      } catch (error) {
        console.error('[criarCheckoutPremium] Error saving preference to Firestore:', error);
        // Não falhar se não conseguir salvar
      }
      
      res.status(200).json({ 
        init_point: checkoutUrl,
        preference_id: response.id,
        sandbox_mode: !!response.sandbox_init_point
      });
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

// Create premium subscription endpoint (recurring monthly subscription)
exports.criarAssinaturaPremium = onRequest(
  { 
    cors: true,
    maxInstances: 10,
    invoker: 'public',
    secrets: [mercadoPagoAccessToken]
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
    
    console.log('[criarAssinaturaPremium] Request received:', req.method);
    console.log('[criarAssinaturaPremium] Request body:', req.body);
    
    try {
      const { email, userId } = req.body;
      
      if (!email || !userId) {
        return res.status(400).json({ error: 'Email e userId são obrigatórios' });
      }

      // Buscar dados do usuário no Firestore para obter nome completo
      let firstName = '';
      let lastName = '';
      
      try {
        const userDoc = await db.collection('usuarios').doc(userId).get();
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const nomeCompleto = userData.nome_completo || '';
          
          // Dividir nome completo em primeiro e último nome
          if (nomeCompleto) {
            const nomeParts = nomeCompleto.trim().split(/\s+/);
            firstName = nomeParts[0] || '';
            lastName = nomeParts.length > 1 ? nomeParts.slice(1).join(' ') : '';
          }
          
          console.log('[criarAssinaturaPremium] Nome do usuário:', { nomeCompleto, firstName, lastName });
        }
      } catch (error) {
        console.error('[criarAssinaturaPremium] Erro ao buscar dados do usuário:', error);
        // Continua sem nome se houver erro
      }

      const { preapproval } = getMercadoPago();
      
      // Verificar se estamos em modo sandbox/teste
      let accessToken;
      try {
        accessToken = mercadoPagoAccessToken.value();
      } catch (e) {
        accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
      }
      accessToken = accessToken || "APP_USR-783906941666085-010213-a7124ca4d6ae0e9ad0fb28935a13a1b4-2448199655";
      
      // Limpar o token
      if (accessToken) {
        accessToken = accessToken.toString().trim();
        if (accessToken.startsWith('Bearer ')) {
          accessToken = accessToken.substring(7).trim();
        }
        accessToken = accessToken.replace(/\s+/g, '').trim();
      }
      
      const isTestToken = accessToken.startsWith('TEST-');
      // Para tokens APP_USR-, assumir que são de teste se não houver indicação contrária
      // O Mercado Pago pode ter credenciais APP_USR- em modo sandbox
      const isTestMode = isTestToken || process.env.MERCADO_PAGO_TEST_MODE === 'true' || true; // Default para true
      
      console.log('[criarAssinaturaPremium] 🔍 Verificando ambiente:', {
        tokenStartsWith: accessToken.substring(0, 10),
        isTestToken: isTestToken,
        isTestMode: isTestMode,
        originalEmail: email,
        MERCADO_PAGO_TEST_MODE: process.env.MERCADO_PAGO_TEST_MODE
      });
      
      // Em modo sandbox, SEMPRE usar email de teste do Mercado Pago
      // O Mercado Pago requer que payer e collector sejam ambos usuários de teste
      // Como estamos usando credenciais de teste (APP_USR-), sempre usar email de teste
      // O formato correto é test_user_@testuser.com ou test@testuser.com
      let payerEmail = 'test_user_' + Date.now() + '@testuser.com';
      
      console.log('[criarAssinaturaPremium] ⚠️ Usando email de teste para sandbox:', payerEmail);
      console.log('[criarAssinaturaPremium] ⚠️ Email original do usuário:', email);
      console.log('[criarAssinaturaPremium] ⚠️ O usuário poderá alterar o email no checkout do Mercado Pago');
      
      // Construir objeto payer com nome completo
      const payerData = {
        email: payerEmail
      };
      
      // Adicionar first_name e last_name se disponíveis
      if (firstName) {
        payerData.first_name = firstName;
      }
      if (lastName) {
        payerData.last_name = lastName;
      }
      
      // Criar a assinatura recorrente diretamente (sem plano associado)
      // Isso permite criar uma assinatura sem card_token_id, gerando um init_point para aprovação
      // start_date deve ser uma data futura (pelo menos 1 minuto à frente)
      const now = new Date();
      const startDate = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutos no futuro para evitar problemas de sincronização
      
      const subscriptionData = {
        reason: 'Plano Premium Mensal - Oráculo Cultural',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          billing_day: startDate.getDate(),
          billing_day_proportional: true,
          transaction_amount: 99.00,
          currency_id: 'BRL',
          start_date: startDate.toISOString()
        },
        payer_email: payerEmail,
        payer: payerData,
        external_reference: userId,
        back_url: process.env.MP_SUCCESS_URL || 'https://oraculocultural.com.br/cadastro-premium?status=success',
        notification_url: process.env.WEBHOOK_URL || 'https://us-central1-culturalapp-fb9b0.cloudfunctions.net/webhookMercadoPago'
      };
      
      // Em modo sandbox, adicionar metadata para facilitar identificação
      if (isTestToken || process.env.MERCADO_PAGO_TEST_MODE === 'true') {
        subscriptionData.metadata = {
          test_mode: true,
          environment: 'sandbox'
        };
        console.log('[criarAssinaturaPremium] ✅ Criando assinatura em modo SANDBOX');
      }
      
      console.log('[criarAssinaturaPremium] Creating subscription directly (without plan)...');
      console.log('[criarAssinaturaPremium] Subscription data:', JSON.stringify(subscriptionData, null, 2));
      
      const subscription = await preapproval.create({
        body: subscriptionData
      });

      console.log('[criarAssinaturaPremium] Subscription created:', subscription.id);
      console.log('[criarAssinaturaPremium] Subscription response:', JSON.stringify({
        id: subscription.id,
        status: subscription.status,
        init_point: subscription.init_point,
        sandbox_init_point: subscription.sandbox_init_point,
        // Verificar se há indicação de sandbox na resposta
        has_sandbox_url: !!subscription.sandbox_init_point
      }, null, 2));

      // Salvar informações da assinatura no Firestore
      await db.collection('subscriptions').doc(subscription.id).set({
        userId: userId,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Próximo mês
      });

      // Retornar URL de aprovação
      // Em modo sandbox, usar sandbox_init_point se disponível
      const checkoutUrl = subscription.sandbox_init_point || subscription.init_point;
      
      console.log('[criarAssinaturaPremium] ✅ Modo SANDBOX:', !!subscription.sandbox_init_point ? 'SIM (usando sandbox_init_point)' : 'NÃO (usando init_point padrão)');
      
      res.status(200).json({ 
        init_point: checkoutUrl,
        subscriptionId: subscription.id,
        sandbox_mode: !!subscription.sandbox_init_point
      });
    } catch (error) {
      console.error('[criarAssinaturaPremium] Error details:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
      res.status(500).json({ 
        error: error.message || 'Erro ao criar assinatura',
        details: error.cause ? error.cause.message : undefined
      });
    }
  }
);

// Create premium subscription endpoint using Stripe (recurring monthly subscription)
exports.criarAssinaturaPremiumStripe = onRequest(
  { 
    cors: true,
    maxInstances: 10,
    invoker: 'public',
    secrets: [stripeSecretKey]
  },
  async (req, res) => {
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
    
      console.log('[criarAssinaturaPremiumStripe] Request received:', req.method);
      console.log('[criarAssinaturaPremiumStripe] Request body:', req.body);
      
      try {
        const { email, userId, planType, isAnnual } = req.body;
        
        if (!email || !userId) {
          return res.status(400).json({ error: 'Email e userId são obrigatórios' });
        }

        // Normalizar planType (remover acentos e converter para lowercase)
        const normalizedPlanType = planType ? planType.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : 'basico';
        const isAnnualPlan = isAnnual === true || isAnnual === 'true';
        
        console.log('[criarAssinaturaPremiumStripe] PlanType recebido:', planType);
        console.log('[criarAssinaturaPremiumStripe] PlanType normalizado:', normalizedPlanType);
        console.log('[criarAssinaturaPremiumStripe] isAnnual:', isAnnualPlan);
        
        // Validar e definir preço baseado no plano
        let unitAmount;
        let planName;
        let planDescription;
        let stripePriceId = null; // Price ID do Stripe (se configurado)
        let stripeProductId = null; // Product ID do Stripe (para buscar preços)
        
        if (normalizedPlanType === 'essencial') {
          if (isAnnualPlan) {
            // Plano anual: R$ 3.476,04 / 12 = R$ 289,67 por mês (12 parcelas)
            unitAmount = 28967; // R$ 289,67 em centavos
            planName = 'Plano Essencial Anual - Oráculo Cultural (12x)';
            planDescription = 'Assinatura anual do Plano Essencial parcelada em 12x de R$ 289,67 - Oráculo Cultural';
            // Price ID do Essencial Anual
            stripePriceId = process.env.STRIPE_PRICE_ID_ESSENCIAL_ANUAL || 'price_1SwRNW0mRGa1jLimGbkMTvn8';
          } else {
            unitAmount = 34900; // R$ 349,00 em centavos
            planName = 'Plano Essencial Mensal - Oráculo Cultural';
            planDescription = 'Assinatura mensal recorrente do Plano Essencial - Oráculo Cultural';
            // Price ID do Essencial Mensal
            stripePriceId = process.env.STRIPE_PRICE_ID_ESSENCIAL || 'price_1SlFRL0mRGa1jLimzgQ0hNmU';
          }
          // Product ID do Essencial (para referência)
          stripeProductId = process.env.STRIPE_PRODUCT_ID_ESSENCIAL || 'prod_TigoFGd2m1X3rx';
        } else if (normalizedPlanType === 'premium') {
          unitAmount = 100; // R$ 1,00 em centavos
          planName = 'Plano Premium Enterprise Mensal - Oráculo Cultural';
          planDescription = 'Assinatura mensal recorrente do Plano Premium Enterprise - Oráculo Cultural';
          // Price ID do Premium (configurado diretamente ou via env)
          stripePriceId = process.env.STRIPE_PRICE_ID_PREMIUM || 'price_1SlFzC0mRGa1jLimlPql975q';
          // Product ID do Premium (para referência, se disponível)
          stripeProductId = process.env.STRIPE_PRODUCT_ID_PREMIUM || null;
        } else if (normalizedPlanType === 'basico' || !planType) {
          // Default para básico se não especificado
          if (isAnnualPlan) {
            // Plano anual: R$ 990,00 / 12 = R$ 82,50 por mês (12 parcelas)
            unitAmount = 8250; // R$ 82,50 em centavos
            planName = 'Plano Básico Anual - Oráculo Cultural (12x)';
            planDescription = 'Assinatura anual do Plano Básico parcelada em 12x de R$ 82,50 - Oráculo Cultural';
            // Price ID do Básico Anual
            stripePriceId = process.env.STRIPE_PRICE_ID_BASICO_ANUAL || 'price_1SwRMW0mRGa1jLim0TtxsCXE';
          } else {
            unitAmount = 9900; // R$ 99,00 em centavos
            planName = 'Plano Básico Mensal - Oráculo Cultural';
            planDescription = 'Assinatura mensal recorrente do Plano Básico - Oráculo Cultural';
            // Price ID do Básico Mensal
            stripePriceId = process.env.STRIPE_PRICE_ID_BASICO || 'price_1SlFPv0mRGa1jLimP7s0ry11';
          }
          // Product ID do Básico (para referência)
          stripeProductId = process.env.STRIPE_PRODUCT_ID_BASICO || 'prod_TignB0SK0S1EUo';
        } else {
          return res.status(400).json({ error: 'Tipo de plano inválido. Use "basico", "essencial" ou "premium"' });
        }
        
        console.log('[criarAssinaturaPremiumStripe] Preço definido:', unitAmount, 'centavos');
        console.log('[criarAssinaturaPremiumStripe] Stripe Product ID:', stripeProductId);
        console.log('[criarAssinaturaPremiumStripe] Stripe Price ID:', stripePriceId);

        // Obter secret key do Stripe
      let stripeKey;
      try {
        stripeKey = stripeSecretKey.value();
      } catch (e) {
        stripeKey = process.env.STRIPE_SECRET_KEY;
      }
      // Em produção, sempre usar secrets do Firebase (não usar fallback)
      if (!stripeKey) {
        throw new Error('STRIPE_SECRET_KEY não configurado. Configure via secret do Firebase.');
      }
      
      // Limpar a chave
      if (stripeKey) {
        stripeKey = stripeKey.toString().trim();
      }
      
      const stripeInstance = stripe(stripeKey);
      
      console.log('[criarAssinaturaPremiumStripe] Stripe inicializado com chave:', stripeKey.substring(0, 20) + '...');
      
      // Validar se o Price ID existe no Stripe (opcional, para debug)
      if (stripePriceId && stripePriceId.startsWith('price_')) {
        try {
          const price = await stripeInstance.prices.retrieve(stripePriceId);
          console.log('[criarAssinaturaPremiumStripe] ✅ Price ID validado:', stripePriceId);
          console.log('[criarAssinaturaPremiumStripe] Valor do preço no Stripe:', price.unit_amount, price.currency);
          console.log('[criarAssinaturaPremiumStripe] Intervalo:', price.recurring?.interval);
        } catch (error) {
          console.error('[criarAssinaturaPremiumStripe] ⚠️ Erro ao validar Price ID:', error.message);
          console.log('[criarAssinaturaPremiumStripe] Continuando mesmo assim...');
        }
      }
      
      // Buscar dados do usuário no Firestore para obter nome completo
      let customerName = '';
      try {
        const userDoc = await db.collection('usuarios').doc(userId).get();
        if (userDoc.exists()) {
          const userData = userDoc.data();
          customerName = userData.nome_completo || '';
          console.log('[criarAssinaturaPremiumStripe] Nome do usuário:', customerName);
        }
      } catch (error) {
        console.error('[criarAssinaturaPremiumStripe] Erro ao buscar dados do usuário:', error);
      }

      // Criar Checkout Session do Stripe para assinatura recorrente
      // Se temos Price ID configurado, usar ele. Caso contrário, criar preço dinamicamente
      const lineItems = stripePriceId 
        ? [
            {
              price: stripePriceId, // Usar Price ID do Stripe
              quantity: 1,
            },
          ]
        : [
            {
              price_data: {
                currency: 'brl',
                product_data: {
                  name: planName,
                  description: planDescription,
                },
                unit_amount: unitAmount,
                recurring: {
                  interval: 'month',
                },
              },
              quantity: 1,
            },
          ];
      
      // Configurar período de teste de 7 dias para plano básico mensal
      const subscriptionDataConfig = {
        metadata: {
          userId: userId,
          userEmail: email,
          planType: normalizedPlanType, // Salvar também nos metadados da assinatura
          isAnnual: isAnnualPlan ? 'true' : 'false', // Salvar se é anual
        },
      };
      
      // Adicionar trial period de 7 dias apenas para plano básico mensal
      if (normalizedPlanType === 'basico' && !isAnnualPlan) {
        subscriptionDataConfig.trial_period_days = 7;
        console.log('[criarAssinaturaPremiumStripe] ✅ Período de teste de 7 dias aplicado ao plano básico');
      }
      
      const session = await stripeInstance.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: email,
        line_items: lineItems,
        allow_promotion_codes: true, // Habilita campo de cupom de desconto no checkout
        success_url: process.env.STRIPE_SUCCESS_URL || 'https://oraculocultural.com.br/cadastro-premium?status=success&session_id={CHECKOUT_SESSION_ID}',
        cancel_url: process.env.STRIPE_CANCEL_URL || 'https://oraculocultural.com.br/conta?status=cancelled',
        metadata: {
          userId: userId,
          userEmail: email,
          userName: customerName,
          planType: normalizedPlanType, // Salvar o tipo de plano normalizado nos metadados
          isAnnual: isAnnualPlan ? 'true' : 'false', // Salvar se é anual
        },
        subscription_data: subscriptionDataConfig,
      });

      console.log('[criarAssinaturaPremiumStripe] Stripe Checkout Session criada:', session.id);
      console.log('[criarAssinaturaPremiumStripe] URL do checkout:', session.url);

      // Salvar informações da sessão no Firestore
      await db.collection('stripe_sessions').doc(session.id).set({
        userId: userId,
        email: email,
        planType: planType || 'basico',
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Retornar URL do checkout
      res.status(200).json({ 
        checkout_url: session.url,
        session_id: session.id
      });
    } catch (error) {
      console.error('[criarAssinaturaPremiumStripe] Error details:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
      res.status(500).json({ 
        error: 'Erro ao criar assinatura', 
        details: error.message 
      });
    }
  }
);

const BASE_URL = process.env.BASE_URL || 'https://oraculocultural.com.br';

/**
 * Checkout Stripe one-time para guia especial (ex.: guia prestação de contas).
 * Cria sessão de pagamento único e redireciona para o Stripe.
 */
exports.criarCheckoutGuiaStripe = onRequest(
  {
    cors: true,
    maxInstances: 10,
    invoker: 'public',
    secrets: [stripeSecretKey]
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      const { guiaId, userId, email } = req.body || {};

      if (!guiaId) {
        return res.status(400).json({ error: 'guiaId é obrigatório' });
      }

      const isGuest = !userId || !email;
      const effectiveUserId = userId || 'guest';
      const effectiveEmail = email || null;

      const guiaRef = db.collection('guias').doc(guiaId);
      const guiaSnap = await guiaRef.get();
      if (!guiaSnap.exists) {
        return res.status(404).json({ error: 'Guia não encontrado' });
      }

      const guia = guiaSnap.data();
      const titulo = guia.titulo || 'Guia para prestação de contas';
      const valorPromocional = guia.valorPromocional != null ? Number(guia.valorPromocional) : null;
      const stripeProductId = guia.stripeProductId || null;

      if (valorPromocional == null || valorPromocional <= 0) {
        return res.status(400).json({ error: 'Guia sem valor promocional configurado' });
      }

      const unitAmount = Math.round(valorPromocional * 100);

      let stripeKey;
      try {
        stripeKey = stripeSecretKey.value();
      } catch (e) {
        stripeKey = process.env.STRIPE_SECRET_KEY;
      }
      if (!stripeKey) {
        throw new Error('STRIPE_SECRET_KEY não configurado.');
      }
      stripeKey = stripeKey.toString().trim();
      const stripeInstance = stripe(stripeKey);

      let customerName = '';
      if (!isGuest) {
        try {
          const userDoc = await db.collection('usuarios').doc(userId).get();
          if (userDoc.exists() && userDoc.data().nome_completo) {
            customerName = userDoc.data().nome_completo;
          }
        } catch (e) { /* ignore */ }
      }

      // Se tiver Product ID, buscar o Price ID associado ou criar um novo
      let lineItems;
      if (stripeProductId) {
        try {
          // Buscar preços existentes do produto
          const prices = await stripeInstance.prices.list({
            product: stripeProductId,
            active: true,
            limit: 1,
          });
          
          if (prices.data.length > 0) {
            // Usar o primeiro preço ativo encontrado
            const priceId = prices.data[0].id;
            console.log(`[criarCheckoutGuiaStripe] Usando Price ID existente: ${priceId} para Product ID: ${stripeProductId}`);
            lineItems = [{
              price: priceId,
              quantity: 1,
            }];
          } else {
            // Criar um novo preço para o produto
            const newPrice = await stripeInstance.prices.create({
              product: stripeProductId,
              unit_amount: unitAmount,
              currency: 'brl',
            });
            console.log(`[criarCheckoutGuiaStripe] Criado novo Price ID: ${newPrice.id} para Product ID: ${stripeProductId}`);
            lineItems = [{
              price: newPrice.id,
              quantity: 1,
            }];
          }
        } catch (error) {
          console.error(`[criarCheckoutGuiaStripe] Erro ao usar Product ID ${stripeProductId}:`, error);
          // Fallback para criação dinâmica
          lineItems = [{
            price_data: {
              currency: 'brl',
              product: stripeProductId, // Usar o Product ID mesmo assim
              unit_amount: unitAmount,
            },
            quantity: 1,
          }];
        }
      } else {
        // Criar dinamicamente sem Product ID
        lineItems = [{
          price_data: {
            currency: 'brl',
            product_data: {
              name: titulo,
              description: 'Guia para prestação de contas - Oráculo Cultural',
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        }];
      }

      const sessionParams = {
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: lineItems,
        allow_promotion_codes: true, // Habilita campo de cupom de desconto no checkout
        success_url: `${BASE_URL}/guia-especial/${guiaId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${BASE_URL}/guia-especial/${guiaId}`,
        metadata: {
          userId: effectiveUserId,
          userEmail: effectiveEmail || '',
          userName: customerName,
          guiaId,
          tipo: 'guia',
        },
      };
      if (effectiveEmail) {
        sessionParams.customer_email = effectiveEmail;
      }

      const session = await stripeInstance.checkout.sessions.create(sessionParams);

      await db.collection('stripe_sessions').doc(session.id).set({
        userId: effectiveUserId,
        email: effectiveEmail,
        guiaId,
        tipo: 'guia',
        planType: null,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({ checkout_url: session.url, session_id: session.id });
    } catch (error) {
      console.error('[criarCheckoutGuiaStripe] Error:', error.message);
      res.status(500).json({ error: 'Erro ao criar checkout do guia', details: error.message });
    }
  }
);

exports.preencherAnexoPDF = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [openaiApiKey],
  },
  async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    
    try {
      const { pdfUrl, dadosCadastrais, nomeProjeto, userId, projetoId } = req.body;
      
      if (!pdfUrl || !dadosCadastrais || !nomeProjeto) {
        return res.status(400).json({ 
          error: 'pdfUrl, dadosCadastrais e nomeProjeto são obrigatórios' 
        });
      }
      
      console.log('[preencherAnexoPDF] Iniciando processamento do PDF');
      console.log('[preencherAnexoPDF] PDF URL:', pdfUrl);
      console.log('[preencherAnexoPDF] Nome do projeto:', nomeProjeto);
      
      // Baixar o PDF
      const pdfResponse = await axios.get(pdfUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000 
      });
      const pdfBytes = Buffer.from(pdfResponse.data);
      
      console.log('[preencherAnexoPDF] PDF baixado, tamanho:', pdfBytes.length);
      
      // Carregar o PDF
      let pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Verificar se o PDF tem formulário
      let form;
      let fieldNames = [];
      let hasFormFields = false;
      
      try {
        form = pdfDoc.getForm();
        fieldNames = form.getFields().map(field => field.getName());
        hasFormFields = fieldNames.length > 0;
        console.log('[preencherAnexoPDF] Campos de formulário encontrados:', fieldNames);
      } catch (error) {
        console.log('[preencherAnexoPDF] PDF não possui campos de formulário, usando método de texto sobreposto');
        hasFormFields = false;
      }
      
      // Usar IA para identificar campos e preencher
      const openai = getOpenAI();
      
      let camposParaPreencher = [];
      
      if (hasFormFields) {
        // PDF com campos de formulário - usar método normal
        const prompt = `Você é um assistente especializado em preencher formulários PDF de projetos culturais.

DADOS DISPONÍVEIS:
- Nome do Projeto: ${nomeProjeto}
- Dados Cadastrais da Empresa:
${dadosCadastrais}

CAMPOS DO FORMULÁRIO PDF ENCONTRADOS:
${fieldNames.map((name, idx) => `${idx + 1}. ${name}`).join('\n')}

TAREFA:
Para cada campo do formulário, identifique qual informação dos dados cadastrais ou do projeto deve ser preenchida.
Retorne um JSON com o seguinte formato:
{
  "campos": [
    {
      "nome": "nome_do_campo",
      "valor": "valor_a_preencher"
    }
  ]
}

IMPORTANTE:
- Use apenas os dados fornecidos
- Se um campo não corresponder a nenhum dado disponível, deixe vazio ou use "N/A"
- Para campos de CNPJ, use apenas números
- Para campos de data, use formato DD/MM/AAAA
- Seja preciso e use exatamente os dados fornecidos`;

        console.log('[preencherAnexoPDF] Chamando IA para identificar campos de formulário...');
        
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Você é um assistente especializado em preencher formulários PDF de projetos culturais. Sempre retorne JSON válido." },
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 2000
        });
        
        const aiResponse = completion.choices[0]?.message?.content || '{}';
        console.log('[preencherAnexoPDF] Resposta da IA:', aiResponse);
        
        try {
          const parsed = JSON.parse(aiResponse);
          camposParaPreencher = parsed.campos || [];
        } catch (error) {
          console.error('[preencherAnexoPDF] Erro ao parsear resposta da IA:', error);
          camposParaPreencher = fieldNames.map(name => ({
            nome: name,
            valor: dadosCadastrais.includes(name.toLowerCase()) ? dadosCadastrais : nomeProjeto
          }));
        }
        
        // Preencher campos do formulário
        console.log('[preencherAnexoPDF] Preenchendo campos de formulário...');
        for (const campo of camposParaPreencher) {
          try {
            const field = form.getTextField(campo.nome);
            if (field) {
              field.setText(campo.valor || '');
              console.log(`[preencherAnexoPDF] Campo ${campo.nome} preenchido com: ${campo.valor}`);
            }
          } catch (error) {
            try {
              const field = form.getCheckBox(campo.nome);
              if (field && campo.valor === 'true') {
                field.check();
              }
            } catch (e) {
              console.warn(`[preencherAnexoPDF] Campo ${campo.nome} não encontrado`);
            }
          }
        }
      } else {
        // PDF sem campos de formulário - extrair texto, preencher e gerar novo PDF
        console.log('[preencherAnexoPDF] Extraindo texto do PDF...');
        
        let pdfText = '';
        let textoExtraidoComOCR = false;
        
        // Tentar extrair texto diretamente primeiro
        let textoExtraidoDiretamente = '';
        try {
          const pdfTextData = await pdfParseLib(pdfBytes);
          textoExtraidoDiretamente = pdfTextData.text || '';
          console.log('[preencherAnexoPDF] Texto extraído diretamente, tamanho:', textoExtraidoDiretamente.length);
        } catch (parseError) {
          console.warn('[preencherAnexoPDF] Erro ao extrair texto diretamente:', parseError.message);
        }
        
        // Se o texto extraído diretamente for suficiente, usar ele
        if (textoExtraidoDiretamente && textoExtraidoDiretamente.trim().length >= 50) {
          pdfText = textoExtraidoDiretamente;
          textoExtraidoComOCR = false;
          console.log('[preencherAnexoPDF] Usando texto extraído diretamente');
        } else {
          // Tentar OCR se o texto direto não foi suficiente
          console.log('[preencherAnexoPDF] Texto direto insuficiente, tentando OCR...');
          
          let textoOCR = '';
          try {
            // Salvar PDF temporariamente para converter em imagens
            const tempDir = os.tmpdir();
            const tempPdfPath = path.join(tempDir, `pdf_${Date.now()}.pdf`);
            fs.writeFileSync(tempPdfPath, pdfBytes);
            
            console.log('[preencherAnexoPDF] PDF salvo temporariamente, convertendo para imagens...');
            
            // Converter PDF para imagens usando pdf2pic
            const convert = fromPath(tempPdfPath, {
              density: 300,
              saveFilename: "page",
              savePath: tempDir,
              format: "png",
              width: 2000,
              height: 2000
            });
            
            const worker = await createWorker('por'); // Português
            console.log('[preencherAnexoPDF] Worker OCR criado, processando páginas...');
            
            const textosPorPagina = [];
            const maxPages = Math.min(pdfDoc.getPageCount(), 5); // Limitar a 5 páginas
            
            for (let i = 1; i <= maxPages; i++) {
              try {
                console.log(`[preencherAnexoPDF] Processando página ${i}/${maxPages} com OCR...`);
                const imagePath = await convert(i, { responseType: "image" });
                
                if (imagePath && imagePath.path) {
                  const { data: { text } } = await worker.recognize(imagePath.path);
                  if (text && text.trim().length > 0) {
                    textosPorPagina.push(text);
                    console.log(`[preencherAnexoPDF] Texto extraído da página ${i}: ${text.length} caracteres`);
                  }
                  
                  // Limpar imagem temporária
                  try {
                    if (fs.existsSync(imagePath.path)) {
                      fs.unlinkSync(imagePath.path);
                    }
                  } catch (cleanupError) {
                    console.warn(`[preencherAnexoPDF] Erro ao limpar imagem temporária:`, cleanupError.message);
                  }
                }
              } catch (pageError) {
                console.warn(`[preencherAnexoPDF] Erro ao processar página ${i}:`, pageError.message);
              }
            }
            
            // Limpar PDF temporário
            try {
              if (fs.existsSync(tempPdfPath)) {
                fs.unlinkSync(tempPdfPath);
              }
            } catch (cleanupError) {
              console.warn(`[preencherAnexoPDF] Erro ao limpar PDF temporário:`, cleanupError.message);
            }
            
            await worker.terminate();
            
            // Combinar textos de todas as páginas
            textoOCR = textosPorPagina.join('\n\n');
            console.log(`[preencherAnexoPDF] OCR concluído. Total de páginas processadas: ${textosPorPagina.length}, texto total: ${textoOCR.length} caracteres`);
            
            if (textoOCR && textoOCR.trim().length >= 10) {
              pdfText = textoOCR;
              textoExtraidoComOCR = true;
            }
          } catch (ocrError) {
            console.error('[preencherAnexoPDF] Erro ao usar OCR:', ocrError.message);
            console.log('[preencherAnexoPDF] OCR falhou, usando texto extraído diretamente (mesmo que seja pouco)');
          }
          
          // Se OCR falhou mas temos texto direto (mesmo que pouco), usar ele
          if (!pdfText && textoExtraidoDiretamente && textoExtraidoDiretamente.trim().length > 0) {
            pdfText = textoExtraidoDiretamente;
            textoExtraidoComOCR = false;
            console.log('[preencherAnexoPDF] Usando texto extraído diretamente como fallback');
          }
        }
        
        // Se ainda não temos texto, tentar uma última vez com pdf-parse usando opções diferentes
        if (!pdfText || pdfText.trim().length < 10) {
          console.log('[preencherAnexoPDF] Tentando extrair texto com método alternativo...');
          try {
            const pdfTextDataRetry = await pdfParseLib(pdfBytes, {
              max: 0, // Processar todas as páginas
            });
            const textoRetry = pdfTextDataRetry.text || '';
            if (textoRetry && textoRetry.trim().length >= 10) {
              pdfText = textoRetry;
              console.log('[preencherAnexoPDF] Texto extraído com método alternativo, tamanho:', pdfText.length);
            }
          } catch (retryError) {
            console.warn('[preencherAnexoPDF] Método alternativo também falhou:', retryError.message);
          }
        }
        
        // Se ainda não temos texto suficiente
        if (!pdfText || pdfText.trim().length < 10) {
          console.warn('[preencherAnexoPDF] Não foi possível extrair texto do PDF');
          
          // Para PDFs sem campos de formulário, precisamos do texto para processar
          // Se não conseguimos extrair texto e não tem campos de formulário, criar texto básico dos dados
          if (!hasFormFields) {
            // Criar um texto básico baseado nos dados para poder processar
            const textoBasico = `PROJETO CULTURAL: ${nomeProjeto}\n\nDADOS DO PROPONENTE:\n${dadosCadastrais}`;
            if (textoBasico.trim().length >= 10) {
              pdfText = textoBasico;
              console.log('[preencherAnexoPDF] Criando texto básico a partir dos dados para processar');
            } else {
              // Se nem isso funcionou, então realmente não temos dados suficientes
              throw new Error('Não foi possível extrair texto do PDF e não há dados suficientes para processar. O PDF pode estar corrompido, ser uma imagem escaneada sem OCR disponível, ou não conter texto selecionável. Por favor, verifique se o PDF tem texto selecionável ou campos de formulário editáveis.');
            }
          } else {
            // Se tem campos de formulário, podemos continuar sem texto extraído
            console.log('[preencherAnexoPDF] PDF tem campos de formulário, continuando sem texto extraído');
            pdfText = '';
          }
        }
        
        console.log('[preencherAnexoPDF] Texto final extraído, tamanho:', pdfText.length);
        
        // Extrair informações dos dados cadastrais usando IA
        console.log('[preencherAnexoPDF] Extraindo informações dos dados cadastrais...');
        
        const promptExtracao = `Extraia as seguintes informações dos dados cadastrais fornecidos:

DADOS CADASTRAIS:
${dadosCadastrais}

Extraia e retorne em JSON:
{
  "cnpj": "apenas números do CNPJ (14 dígitos)",
  "razaoSocial": "razão social completa da empresa",
  "nomeFantasia": "nome fantasia se houver",
  "representante": "nome do representante legal ou sócio responsável",
  "cpfRepresentante": "CPF do representante se houver (apenas números)"
}

IMPORTANTE:
- Para CNPJ: extraia apenas os 14 dígitos numéricos
- Para CPF: extraia apenas os 11 dígitos numéricos
- Se não encontrar alguma informação, deixe vazio ("")
- Seja preciso e extraia exatamente como aparece nos dados`;

        let dadosExtraidos = {
          cnpj: '',
          razaoSocial: '',
          nomeFantasia: '',
          representante: '',
          cpfRepresentante: ''
        };

        try {
          const completionExtracao = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "Você é um assistente especializado em extrair dados cadastrais. Sempre retorne JSON válido." },
              { role: "user", content: promptExtracao }
            ],
            temperature: 0.1,
            max_tokens: 500
          });
          
          const respostaExtracao = completionExtracao.choices[0]?.message?.content || '{}';
          console.log('[preencherAnexoPDF] Resposta da IA para extração:', respostaExtracao);
          
          const parsedExtracao = JSON.parse(respostaExtracao);
          dadosExtraidos = {
            cnpj: parsedExtracao.cnpj || '',
            razaoSocial: parsedExtracao.razaoSocial || '',
            nomeFantasia: parsedExtracao.nomeFantasia || '',
            representante: parsedExtracao.representante || '',
            cpfRepresentante: parsedExtracao.cpfRepresentante || ''
          };
          
          console.log('[preencherAnexoPDF] Dados extraídos:', dadosExtraidos);
        } catch (error) {
          console.error('[preencherAnexoPDF] Erro ao extrair dados com IA, usando método manual:', error);
          // Fallback manual
          const cnpjMatch = dadosCadastrais.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
          dadosExtraidos.cnpj = cnpjMatch ? cnpjMatch[1].replace(/\D/g, '') : '';
          
          const linhas = dadosCadastrais.split('\n');
          for (const linha of linhas) {
            const linhaLower = linha.toLowerCase();
            if (linhaLower.includes('razão social') || linhaLower.includes('razao social')) {
              const match = linha.match(/raz[ãa]o\s+social[:\-]?\s*(.+)/i);
              if (match) dadosExtraidos.razaoSocial = match[1].trim();
            }
            if (linhaLower.includes('nome fantasia')) {
              const match = linha.match(/nome\s+fantasia[:\-]?\s*(.+)/i);
              if (match) dadosExtraidos.nomeFantasia = match[1].trim();
            }
            if (linhaLower.includes('representante') || linhaLower.includes('sócio') || linhaLower.includes('socio')) {
              const match = linha.match(/(representante|s[óo]cio)[:\-]?\s*(.+)/i);
              if (match) dadosExtraidos.representante = match[2].trim();
            }
          }
        }
        
        const cnpj = dadosExtraidos.cnpj;
        const nomeEmpresa = dadosExtraidos.razaoSocial || dadosExtraidos.nomeFantasia || nomeProjeto;
        const representante = dadosExtraidos.representante || '';
        const cpfRepresentante = dadosExtraidos.cpfRepresentante || '';
        
        // Usar IA para preencher o texto do PDF
        console.log('[preencherAnexoPDF] Preenchendo texto do PDF com IA...');
        
        const promptPreenchimento = `Você é um assistente especializado em preencher documentos de projetos culturais.

TEXTO ORIGINAL EXTRAÍDO DO PDF:
${pdfText}

DADOS PARA PREENCHIMENTO:
- Razão Social/Nome da Empresa: ${nomeEmpresa}
- CNPJ: ${cnpj}
- Nome do Projeto: ${nomeProjeto}
- Representante Legal: ${representante}
- CPF do Representante: ${cpfRepresentante}

TAREFA:
Analise o texto extraído do PDF e identifique todos os campos vazios, marcadores, espaços em branco ou padrões que precisam ser preenchidos. Substitua pelos valores corretos dos dados fornecidos.

Procure por padrões como:
- Campos vazios após "CPF/CNPJ nº" ou "CNPJ nº"
- Campos vazios após "projeto cultural"
- Campos vazios após "Eu," ou "Declaro que"
- Qualquer espaço em branco que claramente precisa ser preenchido
- Marcadores como [RAZÃO_SOCIAL], [CNPJ], [NOME_PROJETO], etc.

IMPORTANTE:
- Mantenha a estrutura e formatação original do documento
- Preencha APENAS os campos vazios/marcadores, não altere o resto do texto
- Use os dados fornecidos exatamente como estão
- Para CNPJ, use apenas números (sem pontos, barras ou hífens)
- Mantenha a formatação de títulos, parágrafos e estrutura do documento

Retorne APENAS o texto completo preenchido, mantendo a estrutura original do documento.`;
        
        const completionPreenchimento = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Você é um assistente especializado em preencher documentos mantendo a estrutura original. Retorne apenas o texto preenchido, preservando títulos, parágrafos e formatação." },
            { role: "user", content: promptPreenchimento }
          ],
          temperature: 0.2,
          max_tokens: 4000
        });
        
        const textoPreenchido = completionPreenchimento.choices[0]?.message?.content || pdfText;
        console.log('[preencherAnexoPDF] Texto preenchido gerado, tamanho:', textoPreenchido.length);
        
        // Criar novo PDF com o texto preenchido e formatado
        console.log('[preencherAnexoPDF] Criando novo PDF formatado com texto preenchido...');
        const novoPdfDoc = await PDFDocument.create();
        const fontNormal = await novoPdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await novoPdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontSizeNormal = 11;
        const fontSizeTitulo = 14;
        const pageWidth = 612; // A4 width em pontos
        const pageHeight = 792; // A4 height em pontos
        const margin = 72; // 1 inch margin
        const lineHeightNormal = fontSizeNormal * 1.5;
        const lineHeightTitulo = fontSizeTitulo * 1.5;
        
        let page = novoPdfDoc.addPage([pageWidth, pageHeight]);
        let yPosition = pageHeight - margin;
        const maxWidth = pageWidth - (margin * 2);
        
        // Função auxiliar para quebrar texto em linhas que cabem na página
        const quebrarTexto = (texto, tamanhoFonte, larguraMax) => {
          const palavras = texto.split(' ');
          const linhas = [];
          let linhaAtual = '';
          
          for (const palavra of palavras) {
            const testeLinha = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;
            // Estimar largura do texto (aproximação: 0.6 * tamanhoFonte por caractere)
            const larguraEstimada = testeLinha.length * (tamanhoFonte * 0.6);
            
            if (larguraEstimada > larguraMax && linhaAtual) {
              linhas.push(linhaAtual);
              linhaAtual = palavra;
            } else {
              linhaAtual = testeLinha;
            }
          }
          
          if (linhaAtual) {
            linhas.push(linhaAtual);
          }
          
          return linhas;
        };
        
        // Função auxiliar para adicionar texto ao PDF
        const adicionarTexto = (texto, tamanhoFonte, fonte, isBold = false) => {
          const linhas = quebrarTexto(texto, tamanhoFonte, maxWidth);
          
          for (const linha of linhas) {
            if (yPosition < margin + 50) {
              page = novoPdfDoc.addPage([pageWidth, pageHeight]);
              yPosition = pageHeight - margin;
            }
            
            page.drawText(linha, {
              x: margin,
              y: yPosition,
              size: tamanhoFonte,
              font: isBold ? fontBold : fonte,
              color: rgb(0, 0, 0),
              maxWidth: maxWidth,
            });
            
            yPosition -= (isBold ? lineHeightTitulo : lineHeightNormal);
          }
        };
        
        // Dividir texto em linhas e processar
        const linhas = textoPreenchido.split('\n');
        
        for (let i = 0; i < linhas.length; i++) {
          const linha = linhas[i].trim();
          
          if (!linha) {
            // Linha vazia - adicionar espaço
            yPosition -= lineHeightNormal * 0.5;
            continue;
          }
          
          // Detectar títulos (linhas em maiúsculas, curtas, ou que começam com números)
          const isTitulo = (
            (linha.length < 100 && linha === linha.toUpperCase() && linha.length > 3) ||
            /^(ANEXO|DECLARAÇÃO|TERMO|DOCUMENTO|ARTIGO|CAPÍTULO|SEÇÃO)/i.test(linha) ||
            /^\d+\.\s+[A-Z]/.test(linha)
          );
          
          if (isTitulo) {
            // Adicionar espaço antes do título (exceto no início)
            if (i > 0 && linhas[i - 1].trim()) {
              yPosition -= lineHeightNormal * 0.5;
            }
            adicionarTexto(linha, fontSizeTitulo, fontBold, true);
            // Adicionar espaço após o título
            yPosition -= lineHeightNormal * 0.3;
          } else {
            // Texto normal
            adicionarTexto(linha, fontSizeNormal, fontNormal, false);
          }
        }
        
        // Substituir o PDF original pelo novo
        pdfDoc = novoPdfDoc;
        console.log('[preencherAnexoPDF] Novo PDF criado com texto preenchido');
      }
      
      // Salvar o PDF preenchido
      const filledPdfBytes = await pdfDoc.save();
      console.log('[preencherAnexoPDF] PDF preenchido gerado, tamanho:', filledPdfBytes.length);
      
      // Fazer upload para Firebase Storage
      let publicUrl;
      try {
        const storage = getStorage();
        // Usar o bucket padrão do projeto Firebase (sem especificar nome, usa o padrão)
        const bucket = storage.bucket();
        
        console.log('[preencherAnexoPDF] Usando bucket padrão:', bucket.name);
        
        const fileName = `anexos_preenchidos/${userId}/${projetoId}/${Date.now()}_preenchido.pdf`;
        const file = bucket.file(fileName);
        
        console.log('[preencherAnexoPDF] Salvando arquivo:', fileName);
        
        // Usar save() que é mais simples e direto
        await file.save(Buffer.from(filledPdfBytes), {
          metadata: {
            contentType: 'application/pdf',
            metadata: {
              projetoId: projetoId,
              userId: userId,
              nomeProjeto: nomeProjeto
            }
          }
        });
        
        console.log('[preencherAnexoPDF] Arquivo salvo no Storage');
        
        // Tornar o arquivo público
        await file.makePublic();
        console.log('[preencherAnexoPDF] Arquivo tornado público');
        
        // Obter URL pública usando getSignedUrl ou URL pública direta
        publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        console.log('[preencherAnexoPDF] URL pública gerada:', publicUrl);
      } catch (storageError) {
        console.error('[preencherAnexoPDF] Erro completo ao salvar no Storage:', {
          message: storageError.message,
          stack: storageError.stack,
          code: storageError.code,
          details: JSON.stringify(storageError)
        });
        throw new Error(`Erro ao salvar PDF no Storage: ${JSON.stringify(storageError)}`);
      }
      
      console.log('[preencherAnexoPDF] PDF preenchido salvo:', publicUrl);
      
      res.status(200).json({
        success: true,
        pdfPreenchidoUrl: publicUrl,
        camposPreenchidos: camposParaPreencher.length
      });
      
    } catch (error) {
      console.error('[preencherAnexoPDF] Erro completo:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Retornar erro mais detalhado para debug
      res.status(500).json({
        error: 'Erro ao processar PDF',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

// Função para enviar email de boas-vindas
exports.enviarEmailBoasVindas = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [brevoApiKey],
  },
  async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método não permitido' });
      return;
    }

    try {
      const { nome, email } = req.body;

      if (!nome || !email) {
        res.status(400).json({ error: 'Nome e email são obrigatórios' });
        return;
      }

      const emailText = `
Olá ${nome},

A equipe da mobCONTENT e o Oráculo Cultural estão entusiasmados em recebê-lo(a)! 

Você acaba de adquirir um sistema abrangente impulsionado por Inteligência Artificial (IA), desenhado para otimizar e gerenciar seus projetos culturais, desde a concepção até a prestação de contas. 

Com o Oráculo Cultural, você tem um verdadeiro guia que maximiza suas chances de sucesso na captação de recursos e garante a conformidade na execução, utilizando IA em todas as etapas críticas. 

O que você pode começar a fazer agora:

O sistema é dividido em dois módulos principais:

1. Módulo Criação: A ferramenta essencial para a pré-produção e captação, funcionando como um polo de conhecimento. 

Comece aqui: Use a funcionalidade central de importação automática de editais, e deixe que a IA faça uma avaliação inteligente do seu projeto com base nos critérios e nos perfis de projetos selecionados. 

Aproveite: Acesse os e-books instrutivos e podcasts explicativos para se capacitar sobre o panorama cultural e os principais editais em vigor. 

2. Módulo Execução: Assume o controle assim que seu projeto for aprovado. 

Organize-se: Transforme seu orçamento em um banco de dados de rubricas e comece o controle rigoroso do uso de recursos. 

Garanta a Conformidade: Faça a importação de notas fiscais para que a IA avalie se elas atendem a todos os requisitos do edital. 

Estamos aqui para garantir que você tenha maior eficiência e conformidade, provendo o conhecimento necessário para o sucesso. 

Se precisar de qualquer suporte ou tiver dúvidas sobre como navegar na plataforma, nossa equipe está à disposição.

Bons projetos!

Atenciosamente,

A Equipe mobCONTENT e Oráculo Cultural
      `;

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Bem-vindo(a) ao Oráculo Cultural!</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-top: 0;">Olá <strong>${nome}</strong>,</p>
    
    <p>A equipe da <strong>mobCONTENT</strong> e o <strong>Oráculo Cultural</strong> estão entusiasmados em recebê-lo(a)!</p>
    
    <p>Você acaba de adquirir um sistema abrangente impulsionado por <strong>Inteligência Artificial (IA)</strong>, desenhado para otimizar e gerenciar seus projetos culturais, desde a concepção até a prestação de contas.</p>
    
    <p>Com o Oráculo Cultural, você tem um verdadeiro guia que maximiza suas chances de sucesso na captação de recursos e garante a conformidade na execução, utilizando IA em todas as etapas críticas.</p>
    
    <h2 style="color: #667eea; margin-top: 30px; margin-bottom: 15px;">O que você pode começar a fazer agora:</h2>
    
    <p>O sistema é dividido em dois módulos principais:</p>
    
    <div style="background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; border-radius: 5px;">
      <h3 style="color: #667eea; margin-top: 0;">1. Módulo Criação</h3>
      <p style="margin-bottom: 10px;">A ferramenta essencial para a pré-produção e captação, funcionando como um polo de conhecimento.</p>
      <p style="margin-bottom: 5px;"><strong>Comece aqui:</strong> Use a funcionalidade central de importação automática de editais, e deixe que a IA faça uma avaliação inteligente do seu projeto com base nos critérios e nos perfis de projetos selecionados.</p>
      <p><strong>Aproveite:</strong> Acesse os e-books instrutivos e podcasts explicativos para se capacitar sobre o panorama cultural e os principais editais em vigor.</p>
    </div>
    
    <div style="background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #764ba2; border-radius: 5px;">
      <h3 style="color: #764ba2; margin-top: 0;">2. Módulo Execução</h3>
      <p style="margin-bottom: 10px;">Assume o controle assim que seu projeto for aprovado.</p>
      <p style="margin-bottom: 5px;"><strong>Organize-se:</strong> Transforme seu orçamento em um banco de dados de rubricas e comece o controle rigoroso do uso de recursos.</p>
      <p><strong>Garanta a Conformidade:</strong> Faça a importação de notas fiscais para que a IA avalie se elas atendem a todos os requisitos do edital.</p>
    </div>
    
    <p>Estamos aqui para garantir que você tenha maior eficiência e conformidade, provendo o conhecimento necessário para o sucesso.</p>
    
    <p>Se precisar de qualquer suporte ou tiver dúvidas sobre como navegar na plataforma, nossa equipe está à disposição.</p>
    
    <p style="margin-top: 30px;"><strong>Bons projetos!</strong></p>
    
    <p style="margin-top: 30px;">Atenciosamente,<br>
    <strong>A Equipe mobCONTENT e Oráculo Cultural</strong></p>
  </div>
</body>
</html>
      `;

      // Enviar email via Brevo
      await enviarEmailBrevo(
        email,
        '🎉 Bem-vindo(a) à Plataforma Oráculo Cultural! Seu Guia Inteligente para Projetos Culturais.',
        emailHtml,
        emailText
      );
      
      console.log('[enviarEmailBoasVindas] Email enviado com sucesso para:', email);
      
      res.status(200).json({ success: true, message: 'Email enviado com sucesso' });
    } catch (error) {
      console.error('[enviarEmailBoasVindas] Erro ao enviar email:', error);
      res.status(500).json({ 
        error: 'Erro ao enviar email', 
        message: error.message 
      });
    }
  }
);

// Função para enviar email de solicitação de conta premium
exports.solicitarContaPremium = onRequest(
  {
    cors: [
      'http://localhost:8080',
      'http://localhost:5173',
      'https://oraculocultural.com.br',
      'https://www.oraculocultural.com.br'
    ],
    invoker: 'public',
    secrets: [brevoApiKey],
  },
  async (req, res) => {
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Max-Age', '3600');
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método não permitido' });
      return;
    }

    try {
      const { nome, email, userId, empresa } = req.body;

      if (!nome || !email || !userId) {
        res.status(400).json({ error: 'Nome, email e userId são obrigatórios' });
        return;
      }

      const emailText = `
Nova solicitação de conta Premium - Oráculo Cultural

Dados do solicitante:
- Nome: ${nome}
- Email: ${email}
- Empresa: ${empresa || 'Não informado'}
- User ID: ${userId}
- Data da solicitação: ${new Date().toLocaleString('pt-BR')}

Por favor, entre em contato com o usuário para ativar a conta premium.
      `;

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🔔 Nova Solicitação de Conta Premium</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-top: 0;">Uma nova solicitação de conta premium foi recebida:</p>
    
    <div style="background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; border-radius: 5px;">
      <p style="margin: 5px 0;"><strong>Nome:</strong> ${nome}</p>
      <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 5px 0;"><strong>Empresa:</strong> ${empresa || 'Não informado'}</p>
      <p style="margin: 5px 0;"><strong>User ID:</strong> ${userId}</p>
      <p style="margin: 5px 0;"><strong>Data da solicitação:</strong> ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    
    <p style="margin-top: 30px;">Por favor, entre em contato com o usuário para ativar a conta premium.</p>
    
    <p style="margin-top: 30px;">Atenciosamente,<br>
    <strong>Sistema Oráculo Cultural</strong></p>
  </div>
</body>
</html>
      `;

      // Enviar email via Brevo
      await enviarEmailBrevo(
        'marcosferreira@mobcontent.com.br',
        `🔔 Nova Solicitação de Conta Premium - ${nome}`,
        emailHtml,
        emailText
      );
      
      console.log('[solicitarContaPremium] Email enviado com sucesso para marcosferreira@mobcontent.com.br');
      
      // Garantir que os headers CORS estão definidos antes de enviar a resposta
      res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.status(200).json({ success: true, message: 'Solicitação enviada com sucesso' });
    } catch (error) {
      console.error('[solicitarContaPremium] Erro ao enviar email:', error);
      // Garantir que os headers CORS estão definidos mesmo em caso de erro
      res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.status(500).json({ 
        error: 'Erro ao enviar solicitação', 
        message: error.message 
      });
    }
  }
);

// Função para enviar formulário de contato Premium
exports.enviarContatoPremium = onRequest(
  {
    cors: [
      'http://localhost:8080',
      'http://localhost:5173',
      'https://oraculocultural.com.br',
      'https://www.oraculocultural.com.br'
    ],
    invoker: 'public',
    secrets: [brevoApiKey],
  },
  async (req, res) => {
    // Set CORS headers BEFORE any checks
    res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    
    try {
      const { nome, email, empresa, telefone } = req.body;
      
      if (!nome || !email || !empresa || !telefone) {
        res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        return;
      }
      
      const emailText = `
Nova solicitação de contato - Plano Premium Enterprise - Oráculo Cultural

Dados do solicitante:
- Nome: ${nome}
- Email: ${email}
- Empresa: ${empresa}
- Telefone: ${telefone}
- Data da solicitação: ${new Date().toLocaleString('pt-BR')}

Por favor, entre em contato com o solicitante para apresentar o plano Premium Enterprise.
      `;
      
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🔔 Nova Solicitação - Plano Premium Enterprise</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-top: 0;">Uma nova solicitação de contato para o plano Premium Enterprise foi recebida:</p>
    
    <div style="background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; border-radius: 5px;">
      <p style="margin: 5px 0;"><strong>Nome:</strong> ${nome}</p>
      <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 5px 0;"><strong>Empresa:</strong> ${empresa}</p>
      <p style="margin: 5px 0;"><strong>Telefone:</strong> ${telefone}</p>
      <p style="margin: 5px 0;"><strong>Data da solicitação:</strong> ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    
    <p style="margin-top: 30px;">Por favor, entre em contato com o solicitante para apresentar o plano Premium Enterprise.</p>
    
    <p style="margin-top: 30px;">Atenciosamente,<br>
    <strong>Sistema Oráculo Cultural</strong></p>
  </div>
</body>
</html>
      `;
      
      // Enviar email via Brevo
      await enviarEmailBrevo(
        'marcosferreira@mobcontent.com.br',
        `🔔 Nova Solicitação Premium Enterprise - ${nome} (${empresa})`,
        emailHtml,
        emailText
      );
      
      console.log('[enviarContatoPremium] Email enviado com sucesso para marcosferreira@mobcontent.com.br');
      
      // Garantir que os headers CORS estão definidos antes de enviar a resposta
      res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.status(200).json({ success: true, message: 'Solicitação enviada com sucesso' });
    } catch (error) {
      console.error('[enviarContatoPremium] Erro ao enviar email:', error);
      // Garantir que os headers CORS estão definidos mesmo em caso de erro
      res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.status(500).json({ 
        error: 'Erro ao enviar solicitação', 
        message: error.message 
      });
    }
  }
);

// Função para adicionar contato ao Brevo
exports.adicionarContatoBrevo = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [brevoApiKey],
  },
  async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método não permitido' });
      return;
    }

    try {
      const { email, nome, listId: listIdParam } = req.body;
      
      console.log('[adicionarContatoBrevo] Recebida requisição:', { email, nome, listId: listIdParam });

      if (!email) {
        console.error('[adicionarContatoBrevo] Email não fornecido');
        res.status(400).json({ error: 'Email é obrigatório' });
        return;
      }

      // Chave API do Brevo | listId 12 = padrão (ex.: sync usuários), listId 15 = newsletter "Receba em seu email os últimos editais"
      const BREVO_API_KEY = brevoApiKey.value();
      const BREVO_LIST_ID = listIdParam != null ? Number(listIdParam) : 12;
      const BREVO_API_URL = 'https://api.brevo.com/v3/contacts';
      
      console.log('[adicionarContatoBrevo] API Key configurada:', BREVO_API_KEY ? 'SIM' : 'NÃO');
      console.log('[adicionarContatoBrevo] Lista ID:', BREVO_LIST_ID);

      // Dados que serão enviados para a API Brevo
      const contactData = {
        email: email,
        listIds: [BREVO_LIST_ID],
        attributes: {
          NOME: nome || 'Novo Usuário',
          PRIMEIRO_NOME: nome ? nome.split(' ')[0] : 'Usuário',
        },
        emailBlacklisted: false,
        smsBlacklisted: false,
        updateEnabled: true, // Atualiza se o contato já existir
      };
      
      console.log('[adicionarContatoBrevo] Dados a serem enviados:', JSON.stringify(contactData));

      // Faz a chamada POST para a API de Contatos do Brevo
      const response = await axios.post(BREVO_API_URL, contactData, {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      console.log(`[adicionarContatoBrevo] Usuário ${email} adicionado com sucesso ao Brevo. Status: ${response.status}`);
      console.log('[adicionarContatoBrevo] Resposta do Brevo:', JSON.stringify(response.data));
      
      res.status(200).json({ 
        success: true, 
        message: 'Contato adicionado ao Brevo com sucesso',
        status: response.status,
        data: response.data
      });
    } catch (error) {
      console.error('[adicionarContatoBrevo] Erro capturado:', error.message);
      console.error('[adicionarContatoBrevo] Erro completo:', error);
      if (error.response) {
        console.error('[adicionarContatoBrevo] Erro response status:', error.response.status);
        console.error('[adicionarContatoBrevo] Erro response data:', JSON.stringify(error.response.data));
      }
      
      // Se o erro for porque o contato já existe (400 ou 409), ainda retornamos sucesso
      if (error.response && (error.response.status === 400 || error.response.status === 409)) {
        const errorData = error.response.data;
        
        // Se for erro 409 (duplicado), retornar sucesso diretamente
        if (error.response.status === 409) {
          console.log(`[adicionarContatoBrevo] Contato ${req.body.email} já existe no Brevo (409)`);
          res.status(200).json({ 
            success: true, 
            message: 'Contato já existe no Brevo',
            status: 409 
          });
          return;
        }
        
        // Se for erro 400 com código duplicate_parameter, tentar atualizar
        if (errorData.code === 'duplicate_parameter') {
          console.log(`[adicionarContatoBrevo] Contato ${req.body.email} já existe no Brevo, tentando atualizar...`);
          
          const listIdUpdate = req.body.listId != null ? Number(req.body.listId) : 12;
          try {
            const BREVO_API_KEY = brevoApiKey.value();
            const BREVO_API_URL = `https://api.brevo.com/v3/contacts/${encodeURIComponent(req.body.email)}`;
            
            const updateData = {
              listIds: [listIdUpdate],
              attributes: {
                NOME: req.body.nome || 'Novo Usuário',
                PRIMEIRO_NOME: req.body.nome ? req.body.nome.split(' ')[0] : 'Usuário',
              },
            };
            
            const updateResponse = await axios.put(BREVO_API_URL, updateData, {
              headers: {
                'api-key': BREVO_API_KEY,
                'Content-Type': 'application/json',
              },
            });
            
            console.log(`[adicionarContatoBrevo] Contato ${req.body.email} atualizado no Brevo`);
            res.status(200).json({ 
              success: true, 
              message: 'Contato atualizado no Brevo',
              status: updateResponse.status 
            });
            return;
          } catch (updateError) {
            console.error('[adicionarContatoBrevo] Erro ao atualizar contato:', updateError.response?.data || updateError.message);
            // Se a atualização falhar, ainda retornar sucesso se o contato já existe
            res.status(200).json({ 
              success: true, 
              message: 'Contato já existe no Brevo (atualização não necessária)',
            });
            return;
          }
        }
      }
      
      res.status(500).json({ 
        error: 'Erro ao adicionar contato ao Brevo', 
        message: error.response?.data?.message || error.message 
      });
    }
  }
);

// Webhook endpoint for MercadoPago notifications
exports.webhookMercadoPago = onRequest(
  { 
    cors: true,
    maxInstances: 10,
    invoker: 'public'
  },
  async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    
    try {
      // Firebase Functions v2 pode não parsear automaticamente o body
      // Precisamos parsear manualmente se necessário
      let bodyData = req.body;
      
      // Se o body for uma string, tentar parsear como JSON
      if (typeof req.body === 'string') {
        try {
          bodyData = JSON.parse(req.body);
        } catch (e) {
          console.log('[webhookMercadoPago] Body não é JSON válido, usando como string');
        }
      }
      
      // Se body estiver vazio ou undefined, tentar ler do raw body
      if (!bodyData || (typeof bodyData === 'object' && Object.keys(bodyData).length === 0)) {
        // Em Firebase Functions v2, pode precisar ler do buffer
        if (req.rawBody) {
          try {
            bodyData = JSON.parse(req.rawBody.toString());
          } catch (e) {
            console.log('[webhookMercadoPago] Não foi possível parsear rawBody');
          }
        }
      }
      
      // Log completo para debug
      console.log('[webhookMercadoPago] Raw body:', JSON.stringify(bodyData));
      console.log('[webhookMercadoPago] Body type:', typeof bodyData);
      console.log('[webhookMercadoPago] Body keys:', Object.keys(bodyData || {}));
      console.log('[webhookMercadoPago] Content-Type:', req.headers['content-type']);
      console.log('[webhookMercadoPago] Query params:', req.query);
      
      // Mercado Pago pode enviar dados em diferentes formatos
      // Formato 1: { type, action, data: { id } }
      // Formato 2: { type, data_id }
      // Formato 3: query parameters (type, data.id)
      let type, action, data;
      
      if (bodyData && typeof bodyData === 'object') {
        type = bodyData.type;
        action = bodyData.action;
        data = bodyData.data;
        
        // Se não tiver data separado, pode estar como data_id
        if (!data && bodyData.data_id) {
          data = { id: bodyData.data_id };
        }
        
        // Se não tiver data separado, pode estar no body direto
        if (!data && bodyData.id) {
          data = { id: bodyData.id };
        }
      }
      
      // Verificar query parameters também (Mercado Pago pode enviar assim)
      if (!type && req.query.type) {
        type = req.query.type;
        if (req.query['data.id']) {
          data = { id: req.query['data.id'] };
        } else if (req.query.data_id) {
          data = { id: req.query.data_id };
        }
      }
      
      console.log('[webhookMercadoPago] Parsed:', { type, action, data });
      
      const { mp, preapproval } = getMercadoPago();
      
      // Handle subscription status changes (recurring subscriptions)
      if (type === 'subscription_preapproval' && data?.id) {
        try {
          const subscription = await preapproval.get({ id: data.id });
          console.log('[webhookMercadoPago] Subscription info:', {
            id: data.id,
            status: subscription.status,
            payer_email: subscription.payer_email,
            external_reference: subscription.external_reference
          });
          
          // Update subscription in Firestore
          const subscriptionRef = db.collection('subscriptions').doc(data.id);
          const subscriptionData = (await subscriptionRef.get()).data() || {};
          
          const updateData = {
            status: subscription.status,
            lastModified: admin.firestore.FieldValue.serverTimestamp(),
            payerEmail: subscription.payer_email || subscriptionData.payerEmail,
            ...(subscription.status === 'authorized' && {
              nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next month
            })
          };
          
          await subscriptionRef.set(updateData, { merge: true });
          
          // Update user status based on subscription
          const userId = subscription.external_reference || subscriptionData.userId;
          if (userId) {
            const userRef = db.collection('usuarios').doc(userId);
            const userDoc = await userRef.get();
            
            if (userDoc.exists()) {
              const userData = userDoc.data() || {};
              const userUpdate = {
                premiumStatus: subscription.status,
                subscriptionId: data.id,
                lastSubscriptionUpdate: admin.firestore.FieldValue.serverTimestamp()
              };
              
              const now = new Date();
              
              // Status válidos do Mercado Pago: active, inactive, cancelled
              if (subscription.status === 'active' || subscription.status === 'authorized') {
                userUpdate.isPremium = true;
                userUpdate.premiumActivatedAt = userData.premiumActivatedAt || admin.firestore.FieldValue.serverTimestamp();
                userUpdate.premiumExpiresAt = null;
                userUpdate.lastPaymentDate = admin.firestore.FieldValue.serverTimestamp();
                userUpdate.nextBillingDate = new Date(now.setMonth(now.getMonth() + 1));
              } else if (subscription.status === 'cancelled' || subscription.status === 'paused' || subscription.status === 'inactive') {
                userUpdate.isPremium = true; // Keep premium until period ends
                userUpdate.premiumExpiresAt = userData.nextBillingDate || new Date(now.setMonth(now.getMonth() + 1));
              } else if (subscription.status === 'rejected' || subscription.status === 'expired') {
                userUpdate.isPremium = false;
                userUpdate.premiumExpiresAt = admin.firestore.FieldValue.serverTimestamp();
              }
              
              await userRef.update(userUpdate);
              console.log(`[webhookMercadoPago] User ${userId} subscription status updated to ${subscription.status}`);
            }
          }
        } catch (error) {
          console.error('[webhookMercadoPago] Error handling subscription:', error);
        }
      }
      // Handle payment notifications (for subscription payments and single payments)
      else if (type === 'payment' && data?.id) {
        try {
          const paymentId = data.id.toString();
          console.log(`[webhookMercadoPago] Processing payment notification for ID: ${paymentId}`);
          
          const payment = new mercadopago.Payment(mp);
          
          // Tentar buscar o pagamento com retry (pode demorar alguns segundos para estar disponível)
          let paymentInfo = null;
          let retries = 3;
          let delay = 2000; // 2 segundos
          
          while (retries > 0 && !paymentInfo) {
            try {
              paymentInfo = await payment.get({ id: paymentId });
              console.log(`[webhookMercadoPago] Payment found on attempt ${4 - retries}`);
              break;
            } catch (error) {
              if (error.status === 404 && retries > 1) {
                console.log(`[webhookMercadoPago] Payment not found yet, waiting ${delay}ms before retry... (${retries - 1} retries left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Aumentar delay a cada tentativa
                retries--;
              } else {
                throw error;
              }
            }
          }
          
          if (!paymentInfo) {
            console.error(`[webhookMercadoPago] ❌ Could not fetch payment ${paymentId} after retries`);
            // Salvar para processar depois
            await db.collection('pending_payments').doc(paymentId).set({
              paymentId: paymentId,
              receivedAt: admin.firestore.FieldValue.serverTimestamp(),
              type: type,
              action: action
            });
            return res.status(200).json({ received: true, message: 'Payment queued for later processing' });
          }
          
          console.log('[webhookMercadoPago] Payment info:', {
            id: paymentInfo.id,
            status: paymentInfo.status,
            external_reference: paymentInfo.external_reference,
            payer: paymentInfo.payer?.email,
            payment_type_id: paymentInfo.payment_type_id,
            date_approved: paymentInfo.date_approved
          });
          
          // If payment is approved, update user premium status
          if (paymentInfo.status === 'approved' && paymentInfo.external_reference) {
            const userId = paymentInfo.external_reference;
            console.log(`[webhookMercadoPago] Processing approved payment for user: ${userId}`);
            
            const userRef = db.collection('usuarios').doc(userId);
            const userDoc = await userRef.get();
            
            if (userDoc.exists()) {
              const updateData = {
                isPremium: true,
                premiumStatus: 'authorized',
                premiumActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
                paymentId: paymentId
              };
              
              console.log(`[webhookMercadoPago] Updating user ${userId} with:`, updateData);
              
              await userRef.update(updateData);
              
              console.log(`[webhookMercadoPago] ✅ User ${userId} premium status updated to authorized`);
            } else {
              console.error(`[webhookMercadoPago] ❌ User ${userId} not found in Firestore`);
            }
          } else {
            console.log(`[webhookMercadoPago] Payment not approved or missing external_reference. Status: ${paymentInfo.status}, external_reference: ${paymentInfo.external_reference}`);
          }
        } catch (error) {
          console.error('[webhookMercadoPago] Error handling payment:', {
            message: error.message,
            status: error.status,
            error: error.error,
            cause: error.cause
          });
          console.error('[webhookMercadoPago] Error stack:', error.stack);
        }
      }
      // Se não tiver type ou data, tentar processar como pagamento direto
      else if (!type && bodyData) {
        console.log('[webhookMercadoPago] No type found, trying to process as direct payment notification');
        
        // Tentar buscar payment_id de diferentes lugares
        const paymentId = bodyData.id || bodyData.payment_id || bodyData.data?.id || req.query.id || req.query['data.id'];
        
        if (paymentId) {
          try {
            console.log(`[webhookMercadoPago] Attempting to fetch payment with ID: ${paymentId}`);
            const payment = new mercadopago.Payment(mp);
            const paymentInfo = await payment.get({ id: paymentId });
            
            console.log('[webhookMercadoPago] Payment info (no type):', {
              id: paymentId,
              status: paymentInfo.status,
              external_reference: paymentInfo.external_reference
            });
            
            if (paymentInfo.status === 'approved' && paymentInfo.external_reference) {
              const userId = paymentInfo.external_reference;
              console.log(`[webhookMercadoPago] Processing approved payment for user: ${userId}`);
              
              const userRef = db.collection('usuarios').doc(userId);
              const userDoc = await userRef.get();
              
              if (userDoc.exists()) {
                await userRef.update({
                  isPremium: true,
                  premiumStatus: 'authorized',
                  premiumActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
                  paymentId: paymentId.toString()
                });
                
                console.log(`[webhookMercadoPago] ✅ User ${userId} premium status updated to authorized (no type)`);
              }
            }
          } catch (error) {
            console.error('[webhookMercadoPago] Error handling payment (no type):', error);
          }
        }
      }
      
      // Always respond with 200 to MercadoPago
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('[webhookMercadoPago] Webhook error:', error);
      res.status(200).json({ received: true }); // Still respond 200 to avoid retries
    }
  }
);

// Stripe Webhook endpoint for processing subscription events
exports.webhookStripe = onRequest(
  { 
    cors: true,
    maxInstances: 10,
    invoker: 'public',
    secrets: [stripeSecretKey, stripeWebhookSecret]
  },
  async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    
    try {
      // Obter secret key do Stripe
      let stripeKey;
      try {
        stripeKey = stripeSecretKey.value();
      } catch (e) {
        stripeKey = process.env.STRIPE_SECRET_KEY;
      }
      // Em produção, sempre usar secrets do Firebase (não usar fallback)
      if (!stripeKey) {
        throw new Error('STRIPE_SECRET_KEY não configurado. Configure via secret do Firebase.');
      }
      
      if (stripeKey) {
        stripeKey = stripeKey.toString().trim();
      }
      
      const stripeInstance = stripe(stripeKey);
      
      // Obter webhook secret
      let webhookSecret;
      try {
        webhookSecret = stripeWebhookSecret.value();
      } catch (e) {
        webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      }
      // Fallback apenas para desenvolvimento local (remover em produção)
      // Em produção, sempre usar secrets do Firebase
      webhookSecret = webhookSecret || (process.env.NODE_ENV === 'production' ? null : "whsec_D1K2azX5XruwE26ImWkR0f4CswE7rVVO");
      
      if (webhookSecret) {
        webhookSecret = webhookSecret.toString().trim();
      }
      
      // Obter o signature do header para verificar a autenticidade
      const sig = req.headers['stripe-signature'];
      
      let event;
      
      try {
        // Verificar o webhook signature (importante para produção)
        if (sig && webhookSecret) {
          // Tentar obter rawBody de diferentes formas (Firebase Functions v2)
          let rawBody = req.rawBody;
          if (!rawBody && typeof req.body === 'string') {
            rawBody = Buffer.from(req.body);
          } else if (!rawBody) {
            rawBody = Buffer.from(JSON.stringify(req.body));
          }
          
          event = stripeInstance.webhooks.constructEvent(
            rawBody,
            sig,
            webhookSecret
          );
          console.log('[webhookStripe] ✅ Webhook signature verificada com sucesso');
        } else {
          // Em desenvolvimento/teste, parsear diretamente
          event = req.body;
          console.log('[webhookStripe] ⚠️ Webhook sem signature - modo desenvolvimento');
        }
      } catch (err) {
        console.error('[webhookStripe] Erro ao verificar signature:', err.message);
        // Em desenvolvimento, continuar mesmo sem signature válida
        event = req.body;
      }
      
      console.log('[webhookStripe] Evento recebido:', event.type, event.id);
      
      // Processar diferentes tipos de eventos
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        
        if (userId && session.mode === 'subscription') {
          console.log('[webhookStripe] Checkout completado para usuário:', userId);
          console.log('[webhookStripe] Payment status:', session.payment_status);
          console.log('[webhookStripe] Session metadata:', session.metadata);
          
          // Obter planType dos metadados da sessão
          let planType = session.metadata?.planType;
          
          // Se não encontrou nos metadados da sessão, tentar buscar da assinatura
          if (!planType && session.subscription) {
            try {
              const subscription = await stripeInstance.subscriptions.retrieve(session.subscription);
              planType = subscription.metadata?.planType;
              console.log('[webhookStripe] PlanType da assinatura:', planType);
            } catch (error) {
              console.error('[webhookStripe] Erro ao buscar assinatura:', error);
            }
          }
          
          // Fallback para 'basico' se não encontrou
          if (!planType) {
            planType = 'basico';
            console.log('[webhookStripe] ⚠️ PlanType não encontrado, usando padrão: basico');
          }
          
          // Verificar status da assinatura para detectar trial period
          let subscriptionStatus = 'pending';
          let isInTrial = false;
          if (session.subscription) {
            try {
              const subscription = await stripeInstance.subscriptions.retrieve(session.subscription);
              subscriptionStatus = subscription.status;
              isInTrial = subscription.status === 'trialing';
              console.log('[webhookStripe] Status da assinatura:', subscriptionStatus, 'Em trial:', isInTrial);
            } catch (error) {
              console.error('[webhookStripe] Erro ao buscar status da assinatura:', error);
            }
          }
          
          // Só atualizar para active se o pagamento foi bem-sucedido OU se está em trial
          const updateData = {
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            planType: planType, // Sempre salvar o tipo de plano
            lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
          };
          
          // Ativar premium se pagamento foi pago OU se está em período de teste
          if (session.payment_status === 'paid' || isInTrial) {
            updateData.isPremium = true;
            updateData.premiumStatus = isInTrial ? 'trialing' : 'active';
            updateData.premiumActivatedAt = admin.firestore.FieldValue.serverTimestamp();
            if (isInTrial) {
              console.log('[webhookStripe] ✅ Usuário ativado em período de teste de 7 dias');
            }
          } else {
            // Pagamento ainda não processado
            updateData.premiumStatus = session.payment_status || 'pending';
          }
          
          // Atualizar status do usuário no Firestore
          const userRef = db.collection('usuarios').doc(userId);
          await userRef.update(updateData);
          
          console.log('[webhookStripe] ✅ Usuário', userId, 'atualizado com plano:', planType, 'status:', updateData.premiumStatus);
        }
      } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;
        
        if (userId) {
          const userRef = db.collection('usuarios').doc(userId);
          // Obter planType dos metadados da assinatura ou buscar do documento existente
          let planType = subscription.metadata?.planType;
          
          // Se não encontrou nos metadados, buscar do documento existente
          if (!planType) {
            try {
              const userDoc = await userRef.get();
              if (userDoc.exists()) {
                planType = userDoc.data()?.planType || 'basico';
              } else {
                planType = 'basico';
              }
            } catch (error) {
              console.error('[webhookStripe] Erro ao buscar planType:', error);
              planType = 'basico';
            }
          }
          
          const updateData = {
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: subscription.customer,
            planType: planType, // Sempre salvar o tipo de plano
            cancelAtPeriodEnd: subscription.cancel_at_period_end || false, // Salvar se está marcado para cancelar
            lastSubscriptionUpdate: admin.firestore.FieldValue.serverTimestamp(),
          };
          
          // Se está marcado para cancelar no final do período, ainda está ativa mas será cancelada
          if (subscription.cancel_at_period_end && subscription.status === 'active') {
            updateData.premiumStatus = 'active';
            updateData.isPremium = true; // Ainda tem acesso até o final do período
            console.log('[webhookStripe] Assinatura marcada para cancelamento no final do período');
          }
          // Só atualizar premiumStatus e isPremium se a assinatura estiver ativa
          else if (subscription.status === 'active' || subscription.status === 'trialing') {
            updateData.premiumStatus = 'active';
            updateData.isPremium = true;
            updateData.premiumActivatedAt = admin.firestore.FieldValue.serverTimestamp();
            updateData.lastPaymentDate = admin.firestore.FieldValue.serverTimestamp();
          } else if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') {
            // Manter o status atual se ainda estiver incompleto (não atualizar para false ainda)
            updateData.premiumStatus = subscription.status;
            // Não alterar isPremium ainda
          } else if (subscription.status === 'canceled' || subscription.status === 'unpaid' || subscription.status === 'past_due') {
            updateData.premiumStatus = subscription.status;
            updateData.isPremium = false;
            updateData.cancelAtPeriodEnd = false; // Já foi cancelada
          } else {
            // Outros status (active_period, etc)
            updateData.premiumStatus = subscription.status;
          }
          
          await userRef.update(updateData);
          console.log('[webhookStripe] ✅ Assinatura', subscription.id, 'atualizada para usuário', userId, 'com plano:', planType, 'status:', subscription.status);
        }
      } else if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;
        
        if (userId) {
          const userRef = db.collection('usuarios').doc(userId);
          await userRef.update({
            isPremium: false,
            premiumStatus: 'canceled',
            stripeSubscriptionId: null,
          });
          
          console.log('[webhookStripe] ✅ Assinatura cancelada para usuário', userId);
        }
      } else if (event.type === 'invoice.payment_succeeded') {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        
        if (subscriptionId) {
          // Buscar usuário pela subscription ID
          const usersSnapshot = await db.collection('usuarios')
            .where('stripeSubscriptionId', '==', subscriptionId)
            .limit(1)
            .get();
          
          if (!usersSnapshot.empty) {
            const userDoc = usersSnapshot.docs[0];
            const userId = userDoc.id;
            
            // Buscar planType da assinatura se não estiver salvo
            let planType = userDoc.data()?.planType;
            if (!planType) {
              try {
                const subscription = await stripeInstance.subscriptions.retrieve(subscriptionId);
                planType = subscription.metadata?.planType || 'basico';
                console.log('[webhookStripe] PlanType encontrado na assinatura:', planType);
              } catch (error) {
                console.error('[webhookStripe] Erro ao buscar assinatura:', error);
                planType = 'basico';
              }
            }
            
            await userDoc.ref.update({
              lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
              isPremium: true,
              premiumStatus: 'active',
              planType: planType, // Garantir que planType está salvo
            });
            
            console.log('[webhookStripe] ✅ Pagamento processado para usuário', userId, 'com plano:', planType);
          }
        }
      }
      
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('[webhookStripe] Erro ao processar webhook:', {
        message: error.message,
        stack: error.stack
      });
      res.status(400).json({ error: `Webhook Error: ${error.message}` });
    }
  }
);

// Função para buscar planType de uma assinatura do Stripe
exports.buscarPlanTypeStripe = onRequest(
  { 
    cors: true,
    maxInstances: 10,
    invoker: 'public',
    secrets: [stripeSecretKey]
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    
    try {
      const { subscriptionId } = req.body;
      
      if (!subscriptionId) {
        return res.status(400).json({ error: 'subscriptionId é obrigatório' });
      }
      
      // Obter secret key do Stripe
      let stripeKey;
      try {
        stripeKey = stripeSecretKey.value();
      } catch (e) {
        stripeKey = process.env.STRIPE_SECRET_KEY;
      }
      
      if (!stripeKey) {
        throw new Error('STRIPE_SECRET_KEY não configurado.');
      }
      
      stripeKey = stripeKey.toString().trim();
      const stripeInstance = stripe(stripeKey);
      
      // Buscar assinatura no Stripe
      const subscription = await stripeInstance.subscriptions.retrieve(subscriptionId);
      
      // Obter planType dos metadados
      const planType = subscription.metadata?.planType || 'basico';
      
      console.log('[buscarPlanTypeStripe] PlanType encontrado:', planType, 'para subscription:', subscriptionId);
      
      res.status(200).json({ 
        planType: planType,
        subscriptionStatus: subscription.status
      });
    } catch (error) {
      console.error('[buscarPlanTypeStripe] Erro:', error);
      res.status(500).json({ 
        error: 'Erro ao buscar planType',
        details: error.message
      });
    }
  }
);

// Função para buscar detalhes completos de uma assinatura
exports.buscarDetalhesAssinatura = onRequest(
  { 
    cors: true,
    maxInstances: 10,
    invoker: 'public',
    secrets: [stripeSecretKey]
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    
    try {
      const { subscriptionId } = req.body;
      
      if (!subscriptionId) {
        return res.status(400).json({ error: 'subscriptionId é obrigatório' });
      }
      
      // Obter secret key do Stripe
      let stripeKey;
      try {
        stripeKey = stripeSecretKey.value();
      } catch (e) {
        stripeKey = process.env.STRIPE_SECRET_KEY;
      }
      
      if (!stripeKey) {
        throw new Error('STRIPE_SECRET_KEY não configurado.');
      }
      
      stripeKey = stripeKey.toString().trim();
      const stripeInstance = stripe(stripeKey);
      
      // Buscar assinatura no Stripe
      const subscription = await stripeInstance.subscriptions.retrieve(subscriptionId);
      
      // Buscar o preço/item da assinatura
      const priceId = subscription.items.data[0]?.price?.id;
      const amount = subscription.items.data[0]?.price?.unit_amount || 0;
      const currency = subscription.items.data[0]?.price?.currency || 'brl';
      const interval = subscription.items.data[0]?.price?.recurring?.interval || 'month';
      
      res.status(200).json({ 
        planType: subscription.metadata?.planType || 'basico',
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        currentPeriodStart: subscription.current_period_start,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at,
        amount: amount,
        currency: currency,
        interval: interval,
      });
    } catch (error) {
      console.error('[buscarDetalhesAssinatura] Erro:', error);
      res.status(500).json({ 
        error: 'Erro ao buscar detalhes da assinatura',
        details: error.message
      });
    }
  }
);

// Função para listar pagamentos de uma assinatura
exports.listarPagamentosAssinatura = onRequest(
  { 
    cors: true,
    maxInstances: 10,
    invoker: 'public',
    secrets: [stripeSecretKey]
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    
    try {
      const { subscriptionId } = req.body;
      
      if (!subscriptionId) {
        return res.status(400).json({ error: 'subscriptionId é obrigatório' });
      }
      
      // Obter secret key do Stripe
      let stripeKey;
      try {
        stripeKey = stripeSecretKey.value();
      } catch (e) {
        stripeKey = process.env.STRIPE_SECRET_KEY;
      }
      
      if (!stripeKey) {
        throw new Error('STRIPE_SECRET_KEY não configurado.');
      }
      
      stripeKey = stripeKey.toString().trim();
      const stripeInstance = stripe(stripeKey);
      
      // Buscar invoices da assinatura
      const invoices = await stripeInstance.invoices.list({
        subscription: subscriptionId,
        limit: 12, // Últimos 12 pagamentos
      });
      
      const payments = invoices.data.map(invoice => ({
        id: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        date: invoice.created,
        status: invoice.status === 'paid' ? 'paid' : invoice.status === 'open' ? 'pending' : 'failed',
        description: invoice.description || `Pagamento - ${new Date(invoice.created * 1000).toLocaleDateString('pt-BR')}`,
      }));
      
      res.status(200).json({ 
        payments: payments
      });
    } catch (error) {
      console.error('[listarPagamentosAssinatura] Erro:', error);
      res.status(500).json({ 
        error: 'Erro ao listar pagamentos',
        details: error.message
      });
    }
  }
);

// Função para cancelar uma assinatura
// Função para sincronizar assinatura do usuário com o Stripe
exports.sincronizarAssinaturaUsuario = onRequest(
  { 
    cors: true,
    maxInstances: 10,
    invoker: 'public',
    secrets: [stripeSecretKey]
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'userId é obrigatório' });
      }
      
      // Obter secret key do Stripe
      let stripeKey;
      try {
        stripeKey = stripeSecretKey.value();
      } catch (e) {
        stripeKey = process.env.STRIPE_SECRET_KEY;
      }
      
      if (!stripeKey) {
        throw new Error('STRIPE_SECRET_KEY não configurado.');
      }
      
      stripeKey = stripeKey.toString().trim();
      const stripeInstance = stripe(stripeKey);
      
      // Buscar dados do usuário no Firestore
      const userRef = db.collection('usuarios').doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists()) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      
      const userData = userDoc.data();
      let customerId = userData.stripeCustomerId;
      
      if (!customerId) {
        // Tentar buscar customer pelo email
        const email = userData.email;
        if (email) {
          const customers = await stripeInstance.customers.list({
            email: email,
            limit: 1
          });
          
          if (customers.data.length > 0) {
            const customer = customers.data[0];
            await userRef.update({ stripeCustomerId: customer.id });
            customerId = customer.id;
          }
        }
        
        if (!customerId) {
          return res.status(404).json({ error: 'Customer ID não encontrado. Faça uma assinatura primeiro.' });
        }
      }
      
      // Buscar assinaturas ativas do Stripe para este customer
      const subscriptions = await stripeInstance.subscriptions.list({
        customer: customerId,
        status: 'all', // Buscar todas para encontrar a mais recente
        limit: 10
      });
      
      // Encontrar a assinatura mais recente que está ativa ou em trial
      const activeSubscription = subscriptions.data.find(
        sub => sub.status === 'active' || sub.status === 'trialing'
      ) || subscriptions.data[0]; // Se não encontrar ativa, pegar a mais recente
      
      if (!activeSubscription) {
        return res.status(404).json({ error: 'Nenhuma assinatura encontrada no Stripe' });
      }
      
      // Obter planType dos metadados da assinatura
      let planType = activeSubscription.metadata?.planType || userData.planType || 'basico';
      
      // Atualizar Firestore com os dados da assinatura
      const updateData = {
        stripeCustomerId: customerId,
        stripeSubscriptionId: activeSubscription.id,
        planType: planType,
        isPremium: activeSubscription.status === 'active' || activeSubscription.status === 'trialing',
        premiumStatus: activeSubscription.status === 'active' || activeSubscription.status === 'trialing' ? 'active' : activeSubscription.status,
        cancelAtPeriodEnd: activeSubscription.cancel_at_period_end || false,
        lastSubscriptionUpdate: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      if (activeSubscription.status === 'active' || activeSubscription.status === 'trialing') {
        updateData.premiumActivatedAt = admin.firestore.FieldValue.serverTimestamp();
        updateData.lastPaymentDate = admin.firestore.FieldValue.serverTimestamp();
      }
      
      await userRef.update(updateData);
      
      console.log('[sincronizarAssinaturaUsuario] ✅ Assinatura sincronizada:', {
        userId,
        subscriptionId: activeSubscription.id,
        planType,
        status: activeSubscription.status
      });
      
      res.status(200).json({ 
        success: true,
        subscriptionId: activeSubscription.id,
        planType: planType,
        status: activeSubscription.status
      });
    } catch (error) {
      console.error('[sincronizarAssinaturaUsuario] Erro:', error);
      res.status(500).json({ 
        error: 'Erro ao sincronizar assinatura',
        details: error.message
      });
    }
  }
);

exports.cancelarAssinatura = onRequest(
  { 
    cors: true,
    maxInstances: 10,
    invoker: 'public',
    secrets: [stripeSecretKey]
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    
    try {
      const { subscriptionId } = req.body;
      
      if (!subscriptionId) {
        return res.status(400).json({ error: 'subscriptionId é obrigatório' });
      }
      
      // Obter secret key do Stripe
      let stripeKey;
      try {
        stripeKey = stripeSecretKey.value();
      } catch (e) {
        stripeKey = process.env.STRIPE_SECRET_KEY;
      }
      
      if (!stripeKey) {
        throw new Error('STRIPE_SECRET_KEY não configurado.');
      }
      
      stripeKey = stripeKey.toString().trim();
      const stripeInstance = stripe(stripeKey);
      
      // Cancelar assinatura no final do período (não imediatamente)
      const subscription = await stripeInstance.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      
      console.log('[cancelarAssinatura] Assinatura', subscriptionId, 'marcada para cancelamento no final do período');
      
      // Buscar userId da assinatura para atualizar o Firestore
      const userId = subscription.metadata?.userId;
      if (userId) {
        try {
          const userRef = db.collection('usuarios').doc(userId);
          await userRef.update({
            cancelAtPeriodEnd: true,
            premiumStatus: 'active', // Ainda está ativa até o final do período
            lastSubscriptionUpdate: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log('[cancelarAssinatura] ✅ Firestore atualizado para usuário', userId);
        } catch (error) {
          console.error('[cancelarAssinatura] Erro ao atualizar Firestore:', error);
          // Continuar mesmo se falhar a atualização do Firestore
        }
      }
      
      res.status(200).json({ 
        success: true,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: subscription.current_period_end,
        message: 'Assinatura será cancelada no final do período pago. Você continuará tendo acesso até então.',
      });
    } catch (error) {
      console.error('[cancelarAssinatura] Erro:', error);
      res.status(500).json({ 
        error: 'Erro ao cancelar assinatura',
        details: error.message
      });
    }
  }
);

// ==========================================
// AUTOMAÇÃO BREVO - Sincronização de Usuários e Envio de Emails
// ==========================================

/**
 * Função auxiliar para enviar email transacional via Brevo
 */
async function enviarEmailBrevo(to, subject, htmlContent, textContent, senderEmail = 'contato@oraculocultural.com.br', senderName = 'Oráculo Cultural') {
  const BREVO_API_KEY = brevoApiKey.value();
  const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
  
  const emailData = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [
      {
        email: to,
      },
    ],
    subject: subject,
    htmlContent: htmlContent,
    textContent: textContent,
  };
  
  try {
    const response = await axios.post(BREVO_API_URL, emailData, {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`[Brevo Email] Email enviado com sucesso para ${to}. Message ID: ${response.data.messageId}`);
    return { success: true, messageId: response.data.messageId };
  } catch (error) {
    console.error(`[Brevo Email] Erro ao enviar email para ${to}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Função auxiliar para adicionar/atualizar contato no Brevo
 */
async function adicionarContatoBrevo(email, nome, empresa = null) {
  const BREVO_API_KEY = brevoApiKey.value();
  const BREVO_LIST_ID = 12;
  const BREVO_API_URL = 'https://api.brevo.com/v3/contacts';
  
  if (!email) {
    throw new Error('Email é obrigatório');
  }

  const contactData = {
    email: email,
    listIds: [BREVO_LIST_ID],
    attributes: {
      NOME: nome || 'Novo Usuário',
      PRIMEIRO_NOME: nome ? nome.split(' ')[0] : 'Usuário',
    },
    emailBlacklisted: false,
    smsBlacklisted: false,
    updateEnabled: true,
  };

  // Adicionar empresa se fornecida
  if (empresa) {
    contactData.attributes.EMPRESA = empresa;
  }

  try {
    // Tentar criar o contato
    const response = await axios.post(BREVO_API_URL, contactData, {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`[Brevo] Contato ${email} criado com sucesso. Status: ${response.status}`);
    return { success: true, created: true, email };
  } catch (error) {
    // Se o contato já existe (409), verificar se está na lista
    if (error.response && (error.response.status === 400 || error.response.status === 409)) {
      console.log(`[Brevo] Contato ${email} já existe. Verificando se está na lista...`);
      
      try {
        // Verificar se o contato existe e está na lista correta
        const checkUrl = `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`;
        const checkResponse = await axios.get(checkUrl, {
          headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
          },
        });
        
        const contact = checkResponse.data;
        const isInList = contact.listIds && contact.listIds.includes(BREVO_LIST_ID);
        
        if (isInList) {
          console.log(`[Brevo] Contato ${email} já existe e está na lista ${BREVO_LIST_ID}`);
          return { success: true, created: false, email, exists: true };
        } else {
          // Adicionar à lista sem criar novo contato
          const updateData = {
            listIds: [...(contact.listIds || []), BREVO_LIST_ID],
          };
          
          // Atualizar atributos se necessário
          if (nome && (!contact.attributes || !contact.attributes.NOME || contact.attributes.NOME === 'Novo Usuário')) {
            updateData.attributes = {
              NOME: nome,
              PRIMEIRO_NOME: nome ? nome.split(' ')[0] : 'Usuário',
            };
            if (empresa) {
              updateData.attributes.EMPRESA = empresa;
            }
          }
          
          await axios.put(checkUrl, updateData, {
            headers: {
              'api-key': BREVO_API_KEY,
              'Content-Type': 'application/json',
            },
          });
          
          console.log(`[Brevo] Contato ${email} adicionado à lista ${BREVO_LIST_ID}`);
          return { success: true, created: false, email, addedToList: true };
        }
      } catch (checkError) {
        console.error(`[Brevo] Erro ao verificar contato ${email}:`, checkError.message);
        // Se não conseguir verificar, considerar como sucesso (já existe)
        return { success: true, created: false, email, exists: true };
      }
    }
    
    // Outro tipo de erro
    console.error(`[Brevo] Erro ao adicionar contato ${email}:`, error.message);
    throw error;
  }
}

/**
 * Cloud Function que detecta criação de usuários e sincroniza com Brevo
 */
exports.sincronizarUsuarioBrevo = onDocumentCreated(
  {
    document: "usuarios/{userId}",
    secrets: [brevoApiKey],
  },
  async (event) => {
    try {
      const snapshot = event.data;
      if (!snapshot.exists) {
        console.log('[sincronizarUsuarioBrevo] Documento não existe, ignorando...');
        return;
      }

      const userData = snapshot.data();
      const userId = event.params.userId;
      
      console.log(`[sincronizarUsuarioBrevo] Novo usuário criado: ${userId}`);
      console.log('[sincronizarUsuarioBrevo] Dados do usuário:', { 
        email: userData.email, 
        nome: userData.nome_completo,
        empresa: userData.empresa 
      });

      if (!userData.email) {
        console.warn(`[sincronizarUsuarioBrevo] Usuário ${userId} não tem email, ignorando...`);
        return;
      }

      const email = userData.email;
      const nome = userData.nome_completo || userData.nome || 'Novo Usuário';
      const empresa = userData.empresa || null;

      const result = await adicionarContatoBrevo(email, nome, empresa);
      
      console.log(`[sincronizarUsuarioBrevo] ✅ Usuário ${email} sincronizado com Brevo:`, result);
      
      return result;
    } catch (error) {
      console.error('[sincronizarUsuarioBrevo] ❌ Erro ao sincronizar usuário:', error);
      // Não relançar o erro para não quebrar o processo de criação do usuário
      return null;
    }
  }
);

/**
 * Função HTTP para sincronizar todos os usuários existentes do Firestore para o Brevo
 * Use esta função uma vez para migrar usuários existentes
 */
exports.sincronizarTodosUsuariosBrevo = onRequest(
  {
    cors: true,
    secrets: [brevoApiKey],
  },
  async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      console.log('[sincronizarTodosUsuariosBrevo] Iniciando sincronização de todos os usuários...');

      // Buscar todos os usuários do Firestore
      const usuariosRef = db.collection('usuarios');
      const snapshot = await usuariosRef.get();

      if (snapshot.empty) {
        console.log('[sincronizarTodosUsuariosBrevo] Nenhum usuário encontrado no Firestore');
        res.status(200).json({
          success: true,
          message: 'Nenhum usuário encontrado',
          total: 0,
          criados: 0,
          existentes: 0,
          erros: 0,
        });
        return;
      }

      let criados = 0;
      let existentes = 0;
      let erros = 0;
      const resultados = [];

      console.log(`[sincronizarTodosUsuariosBrevo] Processando ${snapshot.size} usuários...`);

      // Processar cada usuário
      for (const doc of snapshot.docs) {
        const userData = doc.data();
        const userId = doc.id;

        if (!userData.email) {
          console.warn(`[sincronizarTodosUsuariosBrevo] Usuário ${userId} não tem email, pulando...`);
          continue;
        }

        try {
          const email = userData.email;
          const nome = userData.nome_completo || userData.nome || 'Novo Usuário';
          const empresa = userData.empresa || null;

          const result = await adicionarContatoBrevo(email, nome, empresa);
          
          if (result.created) {
            criados++;
          } else {
            existentes++;
          }

          resultados.push({
            userId,
            email,
            status: result.created ? 'criado' : (result.exists ? 'já existia' : 'adicionado à lista'),
          });

          // Pequeno delay para não sobrecarregar a API do Brevo
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          erros++;
          console.error(`[sincronizarTodosUsuariosBrevo] Erro ao processar usuário ${userId}:`, error.message);
          resultados.push({
            userId,
            email: userData.email || 'N/A',
            status: 'erro',
            error: error.message,
          });
        }
      }

      console.log(`[sincronizarTodosUsuariosBrevo] ✅ Sincronização concluída!`);
      console.log(`[sincronizarTodosUsuariosBrevo] Criados: ${criados}, Existentes: ${existentes}, Erros: ${erros}`);

      res.status(200).json({
        success: true,
        message: 'Sincronização concluída',
        total: snapshot.size,
        criados,
        existentes,
        erros,
        resultados,
      });
    } catch (error) {
      console.error('[sincronizarTodosUsuariosBrevo] ❌ Erro na sincronização:', error);
      res.status(500).json({
        error: 'Erro ao sincronizar usuários',
        message: error.message,
      });
    }
  }
);

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
