const { onRequest } = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const { OpenAI } = require("openai");
const mercadopago = require("mercadopago");
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
const nodemailer = require("nodemailer");

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Lazy initialization helpers
let openaiInstance = null;
let mpInstance = null;
let preferenceInstance = null;
let preapprovalInstance = null;
let preapprovalPlanInstance = null;

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
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || functions.config().mercadopago?.token || "";
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
      const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || functions.config().mercadopago?.token;
      if (!accessToken) {
        throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
      }
      
      console.log('[criarCheckoutPremium] Getting MercadoPago instance...');
      const { preference } = getMercadoPago();
      
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
      
      // Definir o preço como 5 reais (valor mínimo do MercadoPago)
      const unitPrice = 5.00;
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
          success: "https://oraculocultural.com.br/cadastro-premium?status=success",
          failure: "https://oraculocultural.com.br/cadastro-premium?status=failure",
          pending: "https://oraculocultural.com.br/cadastro-premium?status=pending",
        },
        auto_return: "approved",
        notification_url: process.env.WEBHOOK_URL || "https://us-central1-culturalapp-fb9b0.cloudfunctions.net/webhookMercadoPago",
        statement_descriptor: "ORACULO PREMIUM",
        external_reference: userId,
        payment_methods: {
          excluded_payment_types: [],
          excluded_payment_methods: [],
          installments: 1
        }
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

// Create premium subscription endpoint (recurring monthly subscription)
exports.criarAssinaturaPremium = onRequest(
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
    
    console.log('[criarAssinaturaPremium] Request received:', req.method);
    console.log('[criarAssinaturaPremium] Request body:', req.body);
    
    try {
      // Verificar se as variáveis de ambiente estão configuradas
      const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || functions.config().mercadopago?.token;
      if (!accessToken) {
        throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
      }
      
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

      const { preapproval, preapprovalPlan } = getMercadoPago();

      // Criar o plano de assinatura recorrente mensal
      const subscriptionData = {
        reason: 'Plano Premium Mensal - Oráculo Cultural',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          repetitions: 0, // 0 para assinatura sem fim
          billing_day: new Date().getDate(),
          billing_day_proportional: true,
          transaction_amount: 5.00,
          currency_id: 'BRL',
          start_date: new Date().toISOString()
        },
        back_url: 'https://oraculocultural.com.br/cadastro-premium?status=success',
        status: 'authorized'
      };

      console.log('[criarAssinaturaPremium] Creating subscription plan...');
      // Criar o plano
      const plan = await preapprovalPlan.create({ body: subscriptionData });
      console.log('[criarAssinaturaPremium] Plan created:', plan.id);
      
      // Construir objeto payer com nome completo
      const payerData = {
        email: email
      };
      
      // Adicionar first_name e last_name se disponíveis
      if (firstName) {
        payerData.first_name = firstName;
      }
      if (lastName) {
        payerData.last_name = lastName;
      }
      
      // Criar a assinatura recorrente
      const subscription = await preapproval.create({
        body: {
          preapproval_plan_id: plan.id,
          payer_email: email,
          payer: payerData,
          external_reference: userId,
          back_url: 'https://oraculocultural.com.br/cadastro-premium?status=success',
          status: 'authorized'
        }
      });

      console.log('[criarAssinaturaPremium] Subscription created:', subscription.id);

      // Salvar informações da assinatura no Firestore
      await db.collection('subscriptions').doc(subscription.id).set({
        userId: userId,
        status: 'pending',
        planId: plan.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Próximo mês
      });

      // Retornar URL de aprovação
      res.status(200).json({ 
        init_point: subscription.init_point,
        subscriptionId: subscription.id
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

exports.preencherAnexoPDF = onRequest(
  {
    cors: true,
    invoker: 'public',
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
        
        // Se ainda não temos texto suficiente, lançar erro
        if (!pdfText || pdfText.trim().length < 10) {
          throw new Error('Não foi possível extrair texto do PDF. O PDF pode estar corrompido, ser uma imagem escaneada sem OCR disponível, ou não conter texto selecionável.');
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

      // Configurar SMTP do Gmail
      const gmailUser = process.env.GMAIL_USER || functions.config().gmail?.user;
      const gmailPassword = process.env.GMAIL_PASSWORD || functions.config().gmail?.password;
      
      if (!gmailUser || !gmailPassword) {
        console.error('[enviarEmailBoasVindas] Credenciais do Gmail não configuradas');
        res.status(500).json({ error: 'Configuração de email não disponível. Credenciais do Gmail não encontradas.' });
        return;
      }

      // Criar transporter do nodemailer
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPassword,
        },
      });

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

      const mailOptions = {
        from: `"Oráculo Cultural" <${gmailUser}>`,
        to: email,
        subject: '🎉 Bem-vindo(a) à Plataforma Oráculo Cultural! Seu Guia Inteligente para Projetos Culturais.',
        text: emailText,
        html: emailHtml,
      };

      await transporter.sendMail(mailOptions);
      
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

// Função para adicionar contato ao Brevo
exports.adicionarContatoBrevo = onRequest(
  {
    cors: true,
    invoker: 'public',
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
      const { email, nome } = req.body;

      if (!email) {
        res.status(400).json({ error: 'Email é obrigatório' });
        return;
      }

      // Recuperar a chave API do Brevo das variáveis de ambiente
      const BREVO_API_KEY = process.env.BREVO_API_KEY || functions.config().brevo?.api_key;
      const BREVO_LIST_ID = 12; // ID da lista no Brevo
      const BREVO_API_URL = 'https://api.brevo.com/v3/contacts';

      if (!BREVO_API_KEY) {
        console.error('[adicionarContatoBrevo] BREVO_API_KEY não configurada');
        res.status(500).json({ error: 'Configuração do Brevo não disponível' });
        return;
      }

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

      // Faz a chamada POST para a API de Contatos do Brevo
      const response = await axios.post(BREVO_API_URL, contactData, {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      console.log(`[adicionarContatoBrevo] Usuário ${email} adicionado com sucesso ao Brevo. Status: ${response.status}`);
      
      res.status(200).json({ 
        success: true, 
        message: 'Contato adicionado ao Brevo com sucesso',
        status: response.status 
      });
    } catch (error) {
      console.error('[adicionarContatoBrevo] Erro ao adicionar contato ao Brevo:', error.response ? error.response.data : error.message);
      
      // Se o erro for porque o contato já existe (409), ainda retornamos sucesso
      if (error.response && error.response.status === 400) {
        const errorData = error.response.data;
        if (errorData.code === 'duplicate_parameter') {
          console.log(`[adicionarContatoBrevo] Contato ${req.body.email} já existe no Brevo, tentando atualizar...`);
          
          // Tentar atualizar o contato existente
          try {
            const BREVO_API_KEY = process.env.BREVO_API_KEY || functions.config().brevo?.api_key;
            const BREVO_LIST_ID = 12;
            const BREVO_API_URL = `https://api.brevo.com/v3/contacts/${encodeURIComponent(req.body.email)}`;
            
            const updateData = {
              listIds: [BREVO_LIST_ID],
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
      const { type, action, data } = req.body;
      console.log('[webhookMercadoPago] Webhook received:', { type, action, data });
      
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
              
              if (subscription.status === 'authorized') {
                userUpdate.isPremium = true;
                userUpdate.premiumActivatedAt = userData.premiumActivatedAt || admin.firestore.FieldValue.serverTimestamp();
                userUpdate.premiumExpiresAt = null;
                userUpdate.lastPaymentDate = admin.firestore.FieldValue.serverTimestamp();
                userUpdate.nextBillingDate = new Date(now.setMonth(now.getMonth() + 1));
              } else if (subscription.status === 'cancelled' || subscription.status === 'paused') {
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
          const payment = new mercadopago.Payment(mp);
          const paymentInfo = await payment.get({ id: data.id });
          
          console.log('[webhookMercadoPago] Payment info:', {
            id: data.id,
            status: paymentInfo.status,
            external_reference: paymentInfo.external_reference,
            payer: paymentInfo.payer
          });
          
          // If payment is approved, update user premium status
          if (paymentInfo.status === 'approved' && paymentInfo.external_reference) {
            const userId = paymentInfo.external_reference;
            const userRef = db.collection('usuarios').doc(userId);
            const userDoc = await userRef.get();
            
            if (userDoc.exists()) {
              await userRef.update({
                isPremium: true,
                premiumStatus: 'authorized',
                premiumActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
                paymentId: data.id
              });
              
              console.log(`[webhookMercadoPago] User ${userId} premium status updated to authorized`);
            }
          }
        } catch (error) {
          console.error('[webhookMercadoPago] Error handling payment:', error);
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

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
