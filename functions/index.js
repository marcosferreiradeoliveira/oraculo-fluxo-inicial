// Local: carregar .env e .secret.local (GEMINI_API_KEY não pode ir no .env no deploy —
// conflita com defineSecret). Em produção o Secret Manager injeta a chave.
require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });
require("dotenv").config({ path: require("path").resolve(__dirname, ".secret.local"), override: true });

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const functions = require("firebase-functions");
const { createGeminiClient } = require("./geminiClient");
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

// Definir secret para Gemini. Em produção: Secret Manager.
// Local: functions/.secret.local (NÃO use GEMINI_API_KEY no .env — overlap no deploy).
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Lazy initialization helpers
let geminiInstance = null;

// Produção: Secret Manager. Local: .secret.local / process.env
function getGeminiApiKey() {
  try {
    const fromSecret = geminiApiKey.value();
    if (fromSecret && typeof fromSecret === "string" && fromSecret.trim()) return fromSecret.trim();
  } catch (e) {
    // Emulador / local sem secret injetado
  }
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
}

function getAI() {
  if (!geminiInstance) {
    const key = getGeminiApiKey();
    if (!key) {
      throw new Error("GEMINI_API_KEY não configurado. Produção: Secret Manager. Local: functions/.secret.local");
    }
    geminiInstance = createGeminiClient(key);
  }
  return geminiInstance;
}

/** @deprecated use getAI() */
function getOpenAI() {
  return getAI();
}

exports.avaliarProjetoIA = onRequest(
  {
    cors: true,
    secrets: [geminiApiKey],
  },
  async (req, res) => {
  // CORS já tratado por cors: true; manter headers para compatibilidade
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
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
      projetoId,
      textoProjeto,
      nomeProjeto,
      nomeEdital,
      criteriosEdital,
      textoEdital,
      portfolio: portfolioBody,
      equipeBio: equipeBioBody,
      projetosSelecionados,
      userId,
      stream: useStream = false
    } = req.body;

    if (!textoProjeto || !criteriosEdital) {
      return res.status(400).json({ error: 'Texto do projeto e critérios do edital são obrigatórios' });
    }

    // Trava: evitar loop / uso excessivo — 1 análise por projeto a cada 60s
    const ANALISE_COOLDOWN_MS = 60 * 1000;
    const lockId = `analise_${projetoId || userId || 'anon'}`;
    const lockRef = db.collection('locks').doc(lockId);
    const lockSnap = await lockRef.get();
    const now = Date.now();
    if (lockSnap.exists) {
      const lockedUntil = lockSnap.data().lockedUntil;
      if (lockedUntil && lockedUntil > now) {
        const secLeft = Math.ceil((lockedUntil - now) / 1000);
        return res.status(429).json({
          error: 'Aguarde antes de nova análise',
          retryAfterSeconds: secLeft,
          message: `Aguarde ${secLeft} segundos antes de solicitar uma nova análise para este projeto.`
        });
      }
    }
    await lockRef.set({ lockedUntil: now + ANALISE_COOLDOWN_MS });

    // Em produção: Secret Manager; local: .env (emulador não injeta secrets)
    const key = getGeminiApiKey();
    if (!key) {
      return res.status(500).json({
        error: "GEMINI_API_KEY não configurado. Produção: Firebase Secrets. Local: functions/.secret.local"
      });
    }
    
    // Usar portfolio e equipeBio do body quando enviados; só buscar no Firestore se faltar
    let equipeBio = equipeBioBody || '';
    let userPortfolio = portfolioBody || '';
    
    if (userId && !userPortfolio) {
      try {
        const userDoc = await db.collection('usuarios').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          equipeBio = equipeBio || (userData.equipeBio || '');
          userPortfolio = userData.portfolio || '';
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    }
    
    // Limitar tamanho dos textos para reduzir tempo até a primeira resposta (TTFT)
    const MAX_TEXTO_EDITAL = 6000;
    const textoEditalTrim = (typeof textoEdital === 'string' && textoEdital.length > MAX_TEXTO_EDITAL)
      ? textoEdital.slice(0, MAX_TEXTO_EDITAL) + '\n\n[... texto do edital truncado para análise ...]'
      : (textoEdital || '');

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

${textoEditalTrim ? `**TEXTO COMPLETO DO EDITAL (para contexto adicional):**\n${textoEditalTrim}` : ''}

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

    const openai = getAI();
    
    // Se streaming está habilitado, usar Server-Sent Events
    if (useStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Desabilita buffer em proxies (nginx)
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      const flushWrite = (data) => {
        return new Promise((resolve, reject) => {
          res.write(data, (err) => {
            if (err) reject(err);
            else setImmediate(resolve);
          });
        });
      };

      await flushWrite(': stream started\n\n');

      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um avaliador oficial de projetos culturais com décadas de experiência em leis de incentivo fiscal. Seu papel é ser rigoroso mas construtivo, sempre buscando melhorar a qualidade dos projetos apresentados.' 
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4000, // Aumentado para garantir análise completa com todas as sugestões
        temperature: 0.3,
        stream: true,
      });
      
      let fullContent = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          await flushWrite(`data: ${JSON.stringify({ content, done: false })}\n\n`);
        }
      }
      
      await flushWrite(`data: ${JSON.stringify({ content: '', done: true, fullContent })}\n\n`);
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
    console.error('Error calling Gemini API:', error);
    return res.status(500).json({ 
      error: error && error.message ? error.message : 'Failed to get analysis from AI.' 
    });
  }
});

exports.gerarTexto = onRequest(
  {
    secrets: [geminiApiKey],
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
    
    const openai = getAI();
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
    secrets: [geminiApiKey],
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
      portfolioContext = `

[CONTEXTO INTERNO - NÃO FAZER PARTE DA SUA RESPOSTA]
Abaixo está o portfolio do proponente apenas para você usar como referência ao aplicar a sugestão. Sua resposta deve ser SOMENTE o texto do projeto revisado. Não inclua esta linha nem o conteúdo do portfolio na sua resposta.
---
${userPortfolio}
---
[FIM DO CONTEXTO - SUA RESPOSTA DEVE SER APENAS O TEXTO DO PROJETO REVISADO]`;
    }
    
    const prompt = `Você recebe o TEXTO COMPLETO do projeto (textoAtual) e uma SUGESTÃO de melhoria. Sua tarefa é devolver SOMENTE o TEXTO COMPLETO do projeto com LEVES ALTERAÇÕES que incorporem a sugestão.

REGRA OBRIGATÓRIA: Sua resposta deve conter EXCLUSIVAMENTE o texto do projeto revisado, do primeiro ao último caractere. NUNCA inclua títulos, cabeçalhos, "CONTEXTO ADICIONAL", "PORTFOLIO" ou qualquer texto que não seja o próprio texto do projeto. NUNCA devolva só a sugestão ou um trecho.

SUGESTÃO (incorporar ao texto com alterações leves):
${sugestao}

TEXTO COMPLETO DO PROJETO (devolver este texto inteiro com leves alterações; sua resposta = só este texto, nada mais):
${textoAtual}${portfolioContext}

INSTRUÇÕES:
- Sua resposta = EXATAMENTE o texto do projeto, do início ao fim, com apenas as alterações necessárias para a sugestão
- Não inclua na resposta: "CONTEXTO ADICIONAL", "PORTFOLIO", "REFERÊNCIA" ou qualquer cabeçalho. Apenas o texto do projeto.
- Mantenha estrutura, parágrafos e tom. Altere só o que a sugestão pedir.

Comece sua resposta diretamente com o primeiro caractere do texto do projeto:`;

    const openai = getAI();
    
    // Configurar streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'Você é um especialista em projetos culturais. Você recebe o texto COMPLETO do projeto e uma sugestão. Sua resposta deve ser SEMPRE o texto COMPLETO do projeto, do início ao fim, com apenas leves alterações que incorporem a sugestão. NUNCA devolva só a sugestão ou um trecho. Mantenha todo o texto original e altere apenas o necessário para integrar a sugestão.' 
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4096,
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
    secrets: [geminiApiKey],
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

    // Trava: evitar loop / uso excessivo — 1 geração por (user, projeto, tipo) a cada 30s
    const TEXTO_COOLDOWN_MS = 30 * 1000;
    const textoLockId = `texto_${userId || 'anon'}_${projetoId}_${String(tipo).slice(0, 50)}`;
    const textoLockRef = db.collection('locks').doc(textoLockId);
    const textoLockSnap = await textoLockRef.get();
    const textoNow = Date.now();
    if (textoLockSnap.exists) {
      const lockedUntil = textoLockSnap.data().lockedUntil;
      if (lockedUntil && lockedUntil > textoNow) {
        const secLeft = Math.ceil((lockedUntil - textoNow) / 1000);
        return res.status(429).json({
          error: 'Aguarde antes de gerar novamente',
          retryAfterSeconds: secLeft,
          message: `Aguarde ${secLeft} segundos antes de gerar este texto novamente.`
        });
      }
    }
    await textoLockRef.set({ lockedUntil: textoNow + TEXTO_COOLDOWN_MS });
    
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
    let orcamentoAtualEnviado = '';
    let promptAlteracoesEnviado = '';
    
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
      
      orcamentoAtualEnviado = dadosProjeto.orcamentoAtual && String(dadosProjeto.orcamentoAtual).trim();
      promptAlteracoesEnviado = prompt && String(prompt).trim();
      // Pedido de ALTERAÇÕES: usar o prompt do frontend (já contém ORÇAMENTO ATUAL + SUGESTÕES) — alterar em cima do estado salvo
      if (orcamentoAtualEnviado && promptAlteracoesEnviado) {
        promptEspecifico = promptAlteracoesEnviado;
        console.log('[gerarTextosProjeto] Modo alterações: usando prompt do frontend (orçamento atual + sugestões)');
      } else {
        // Geração do ZERO: criar orçamento completo desde o início
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

BOAS PRÁTICAS – ORÇAMENTO EFICIENTE E REALISTA:

1) Detalhamento técnico e especificação:
Evite rubricas genéricas. Descreva o "quê", o "quanto" e o "porquê". Em vez de apenas "Cenografia", especifique materiais, metragens e tempo de uso quando fizer sentido. Esse nível de detalhe justifica o valor perante órgãos de controle e evita questionamentos por falta de clareza sobre preço de mercado.

2) Pesquisa de mercado e margens de segurança:
A base do orçamento deve refletir preços de mercado realistas. Projetos culturais podem sofrer com inflação (materiais, eletrônicos, passagens). Inclua margem de segurança nas rubricas críticas para absorver flutuações entre o planejamento e o pagamento. Use valores coerentes com a média de mercado do setor cultural.

3) Encargos e impostos:
Ao orçar contratações, considere a carga tributária. Para Pessoa Física (PF) é obrigatório prever encargos como INSS patronal (cerca de 20%) e IRRF quando aplicável. Para PJ, certifique-se de que os valores contemplam impostos incidentes sobre a nota fiscal. Evite suborçar por ignorar tributos.

4) Itens operacionais, logísticos e administrativos:
- Logística e infraestrutura: inclua quando fizer sentido geradores, brigadistas, seguranças, limpeza, taxas de licenciamento (ECAD, alvarás municipais).
- Acessibilidade: inclua rubricas específicas para intérpretes de Libras, audiodescrição e adaptações físicas, exigidas em muitos editais.
- Custos administrativos: respeite os limites da legislação (geralmente entre 15% e 20% do total) para contabilidade, advocacia e materiais de escritório.

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
      }
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
    
    const openai = getAI();
    
    // Configurar streaming para exibir texto em tempo real
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const orcamentoAlteracoes = tipo === 'orcamento' && orcamentoAtualEnviado && promptAlteracoesEnviado;
    const systemOrcamento = orcamentoAlteracoes
      ? 'Você é um especialista em orçamentos para projetos culturais. O usuário enviou um ORÇAMENTO ATUAL e SUGESTÕES DE ALTERAÇÕES. Sua tarefa é devolver SOMENTE o orçamento atualizado: aplique as alterações pedidas EM CIMA do orçamento atual. NÃO gere um orçamento do zero. Mantenha rubricas que não forem citadas nas sugestões; altere, remova ou adicione apenas o que as sugestões pedirem. Respeite o teto máximo. Formato: texto puro, uma rubrica por linha (Nome: R$ valor ou Nome - R$ valor), sem markdown.'
      : (tipo === 'orcamento'
        ? 'Você é um especialista em orçamentos para projetos culturais. Crie orçamentos detalhados, realistas e bem estruturados baseados EXCLUSIVAMENTE nos dados do projeto fornecido. CRÍTICO: O texto gerado deve estar em FORMATO DE TEXTO PURO. NÃO use asteriscos (**), NÃO use markdown (##, ###, *), NÃO use símbolos de formatação. Use apenas texto simples, quebras de linha e listas numeradas simples (1., 2., 3.) se necessário. NÃO invente novos projetos - use apenas o projeto descrito.'
        : 'Você é um especialista em elaboração de projetos culturais para leis de incentivo. Gere textos claros, objetivos e bem estruturados baseados EXCLUSIVAMENTE na descrição do projeto fornecida. CRÍTICO: O texto gerado deve estar em FORMATO DE TEXTO PURO. NÃO use asteriscos (**), NÃO use markdown (##, ###, *), NÃO use símbolos de formatação. Use apenas texto simples, quebras de linha e listas numeradas simples (1., 2., 3.) se necessário. NÃO invente novos projetos - use apenas o projeto descrito. NÃO use apenas o portfolio como base.');
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemOrcamento },
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
    cors: true,
    secrets: [geminiApiKey],
    memory: '512MiB',
    timeoutSeconds: 120,
    cpu: 1,
  },
  async (req, res) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Body JSON inválido' }); }
      }
      if (!body || typeof body !== 'object') body = {};
      const { projetoId, sugestoes, etapasAtuais, duracaoMeses: duracaoMesesBody } = body;
      if (!projetoId) {
        return res.status(400).json({ error: 'projetoId é obrigatório' });
      }
      const duracaoMesesUsuario = typeof duracaoMesesBody === 'number' && duracaoMesesBody >= 1
        ? Math.min(120, Math.floor(duracaoMesesBody))
        : null;

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
      // Início do cronograma: daqui a 6 meses (não na data de geração)
      const inicioCronograma = new Date(hoje);
      inicioCronograma.setMonth(inicioCronograma.getMonth() + 6);
      const dataInicioMin = inicioCronograma.toISOString().slice(0, 10);

      // Duração total: usuário informou OU conforme orçamento (até 300k = 6 meses, acima escala até máx 12 meses)
      let duracaoMeses = (duracaoMesesUsuario && duracaoMesesUsuario >= 1) ? duracaoMesesUsuario : 6;
      const totalOrcamento = tetoOrcamento > 0 ? tetoOrcamento : rubricas.reduce((s, r) => s + Number(r.total || r.valor || 0), 0);
      if (!duracaoMesesUsuario || duracaoMesesUsuario < 1) {
        if (totalOrcamento <= 300000) {
          duracaoMeses = 6;
        } else if (totalOrcamento >= 600000) {
          duracaoMeses = 12;
        } else {
          duracaoMeses = Math.round(6 + (6 * (totalOrcamento - 300000) / 300000));
        }
      }
      const fimPorDuracao = new Date(inicioCronograma);
      fimPorDuracao.setMonth(fimPorDuracao.getMonth() + duracaoMeses);
      let fimMaximo = dataEncerramentoEdital && !isNaN(dataEncerramentoEdital.getTime())
        ? dataEncerramentoEdital
        : fimPorDuracao;
      if (fimPorDuracao.getTime() < fimMaximo.getTime()) fimMaximo = fimPorDuracao;
      const dataFimMax = fimMaximo.toISOString().slice(0, 10);

      const sugestoesTrim = typeof sugestoes === 'string' ? sugestoes.trim() : '';
      const isAlteracoes = sugestoesTrim.length > 0 && Array.isArray(etapasAtuais) && etapasAtuais.length > 0;
      const nomesRubricasSet = new Set(
        (rubricas || []).map((r) => String(r.nome || r.rubrica || '').trim()).filter(Boolean)
      );

      let prompt;
      let systemContent;

      if (isAlteracoes) {
        const cronogramaAtualJson = JSON.stringify(etapasAtuais.map((e) => ({
          etapa: e.etapa || '',
          inicio: String(e.inicio || '').slice(0, 10),
          fim: String(e.fim || '').slice(0, 10),
        })), null, 2);
        prompt = `Você é um especialista em planejamento de projetos culturais.

O usuário enviou o CRONOGRAMA ATUAL (array JSON) e PEDIDOS DE ALTERAÇÃO. Sua tarefa é devolver APENAS o array JSON do cronograma ATUALIZADO, aplicando as alterações EM CIMA do cronograma atual. NÃO gere um cronograma do zero. Mantenha etapas que não forem citadas nas sugestões; altere, remova ou adicione apenas o que as sugestões pedirem.

REGRAS:
- Retorne SOMENTE um array JSON válido, sem texto antes ou depois.
- Cada item: "etapa" (string), "inicio" (YYYY-MM-DD), "fim" (YYYY-MM-DD), "macroEtapa" (exatamente: pre_producao, producao, divulgacao ou pos_producao). Mantenha ou atribua macroEtapa coerente com a natureza de cada etapa.
- Datas devem estar entre ${dataInicioMin} e ${dataFimMax}.
- Durações razoáveis (semanas ou meses).
${duracaoMesesUsuario ? `- O usuário informou duração total do projeto de ${duracaoMesesUsuario} meses; o cronograma deve caber nesse período.` : ''}

CRONOGRAMA ATUAL:
${cronogramaAtualJson}

PEDIDOS DE ALTERAÇÃO:
${sugestoesTrim}

Retorne somente o array JSON atualizado:`;
        systemContent = 'Você recebe um cronograma atual (JSON) e pedidos de alteração. Devolva APENAS o array JSON atualizado, aplicando as alterações em cima do atual. Cada objeto deve ter "etapa", "inicio", "fim" e "macroEtapa" (pre_producao, producao, divulgacao ou pos_producao), coerente com a natureza da etapa. Não inclua texto explicativo.';
        console.log('[gerarCronogramaIA] Modo alterações: aplicando sugestões em cima do cronograma atual');
      } else {
        const nomesRubricas = rubricas.map((r) => String(r.nome || r.rubrica || '').trim()).filter(Boolean);
        const rubricasTexto = rubricas.length > 0
          ? rubricas.map((r) => `- ${r.nome || r.rubrica || 'Rubrica'}: R$ ${Number(r.total || r.valor || 0).toLocaleString('pt-BR')}`).join('\n')
          : 'Orçamento não informado ou vazio.';
        const listaNomesRubricasParaPrompt = nomesRubricas.length > 0
          ? `Lista EXATA de nomes de rubricas (use estes nomes em "rubricasAssociadas"): ${JSON.stringify(nomesRubricas)}`
          : '';

        const textosResumo = Object.keys(textosGerados).length > 0
          ? Object.entries(textosGerados)
            .filter(([, v]) => v && typeof v === 'string')
            .map(([k, v]) => `[${k}]:\n${String(v).slice(0, 1500)}`)
            .join('\n\n')
          : 'Textos do projeto não informados.';

        prompt = `Você é um especialista em planejamento de projetos culturais para editais e leis de incentivo.

Com base nos dados do projeto, no ORÇAMENTO GERADO (rubricas abaixo) e nos textos, gere um CRONOGRAMA de etapas em JSON.

NÍVEL DE DETALHAMENTO – OBRIGATÓRIO:
- NÃO gere apenas 4 macro etapas (pré-produção, produção, pós-produção, prestação de contas). Isso é insuficiente.
- Gere entre 10 e 20 etapas, com nível intermediário de detalhe: cada rubrica ou grupo lógico de rubricas do orçamento deve refletir em uma ou mais etapas concretas (ex.: contratações, licenciamentos, locações, ensaios, gravação, divulgação, montagem, sessões, desmontagem, documentação, prestação de contas).
- Use os NOMES e a NATUREZA das rubricas do orçamento para batizar e definir as etapas (ex.: se há rubrica "Locação de equipamento de som", crie etapa como "Locação e instalação de som"; se há "Divulgação", crie "Campanha de divulgação" ou "Produção de material de divulgação"). Não invente rubricas; derive as etapas do orçamento e dos textos.
- Não seja excessivamente detalhado (evite dezenas de etapas de um dia); cada etapa deve ter duração razoável (semanas ou poucos meses).

BOAS PRÁTICAS (estrutura em fases, mas desdobradas em etapas concretas):
- Pré-produção: contratos, seguros, reservas, licenças (ECAD, alvarás), alinhamento com fornecedores → virem etapas específicas conforme as rubricas.
- Produção: atividades centrais (ensaios, gravações, montagens) + janelas de respiro → uma ou mais etapas por tipo de atividade relevante no orçamento.
- Pós-produção: desmontagem, devolução, documentação (clipping, acessibilidade, listas) → etapas nomeadas de forma clara.
- Prestação de contas: período de 30 a 60 dias no final, como etapa explícita.
- Sincronia físico-financeira: datas dentro do prazo; considerar prazos de fornecedores. Margem de segurança (~15%) em tarefas críticas.

REGRAS DE DATAS E DISTRIBUIÇÃO – CRÍTICO:
- O cronograma começa em ${dataInicioMin} (data inicial de execução) e termina em ${dataFimMax}. NÃO use a data de hoje; a primeira etapa deve INICIAR em ${dataInicioMin} ou logo após.
- DISTRIUA as etapas ao longo de TODO o período (${dataInicioMin} a ${dataFimMax}). É PROIBIDO concentrar todas as etapas em um único mês. Cada etapa deve ter duração realista (semanas ou meses). A primeira etapa começa em ${dataInicioMin}; a última etapa deve terminar próximo a ${dataFimMax}.
- ETAPAS CONCOMITANTES: Muitas etapas podem e devem ocorrer em paralelo (mesmas datas ou sobreposição). NÃO gere tudo em sequência rígida (uma termina e só então começa a outra). Exemplos: produção de material de divulgação e ensaios ao mesmo tempo; campanha de divulgação durante as apresentações; várias atividades de pré-produção sobrepostas (contratação e locação simultâneas). Só exija sequência quando for obrigatório (ex.: montagem antes de apresentações; desmontagem depois).
- Duração total do projeto neste cronograma: ${duracaoMeses} meses (baseada no orçamento: até ~300 mil = 6 meses; acima disso escala até no máximo 12 meses). Respeite esse arco temporal.

REGRAS DE FORMATO:
- Retorne APENAS um array JSON válido, sem texto antes ou depois.
- Cada item deve ter: "etapa" (nome curto e concreto), "inicio" (YYYY-MM-DD), "fim" (YYYY-MM-DD), "macroEtapa" (fase do cronograma) e "rubricasAssociadas" (array de strings).
- rubricasAssociadas OBRIGATÓRIO: em cada etapa, indique os NOMES EXATOS das rubricas do orçamento que se aplicam a essa etapa (custos/despesas daquela atividade). Use somente nomes da lista de rubricas do projeto. Pode ser um ou mais; se não houver rubrica específica, use a mais próxima ou deixe [].
${listaNomesRubricasParaPrompt ? `\n${listaNomesRubricasParaPrompt}\n` : ''}
- macroEtapa OBRIGATÓRIO: use exatamente um destes valores em cada etapa, conforme a natureza da atividade:
  - pre_producao: contratos, licenciamentos (ECAD, alvarás), contratação de equipe, reserva e locação de espaços/equipamentos, planejamento, mobilização.
  - producao: ensaios, gravações, montagem técnica/cenográfica, apresentações, realização do evento, atividades centrais de execução.
  - divulgacao: produção de material de divulgação, campanha de divulgação, assessoria de imprensa, marketing.
  - pos_producao: desmontagem, devolução de equipamentos, documentação pedagógica, clipping, prestação de contas (RCO e documentação).
Atribua macroEtapa de forma coerente com o tipo de cada etapa; não use "producao" para tudo.

DADOS DO PROJETO:
Nome: ${nomeProjeto}
${descricaoProjeto ? `Descrição/Resumo:\n${descricaoProjeto.slice(0, 2000)}\n` : ''}

ORÇAMENTO GERADO DO PROJETO – RUBRICAS (derive as etapas do cronograma a partir destas rubricas; crie etapas concretas que correspondam às atividades/despesas listadas):
${rubricasTexto}
${tetoOrcamento ? `Teto total: R$ ${tetoOrcamento.toLocaleString('pt-BR')}` : ''}

TEXTOS DO PROJETO (trechos):
${textosResumo}

${nomeEdital ? `Edital: ${nomeEdital}. Data limite: ${dataFimMax}.` : ''}

Retorne somente o array JSON. Exemplo (cada objeto com etapa, inicio, fim, macroEtapa e rubricasAssociadas com nomes exatos das rubricas):
[{"etapa":"Contratos e licenciamentos (ECAD, alvarás)","inicio":"2025-02-01","fim":"2025-02-28","macroEtapa":"pre_producao","rubricasAssociadas":["Licenças e direitos autorais"]},{"etapa":"Contratação de equipe técnica e artística","inicio":"2025-03-01","fim":"2025-03-15","macroEtapa":"pre_producao","rubricasAssociadas":["Equipe técnica","Equipe artística"]},{"etapa":"Reserva e locação de espaços e equipamentos","inicio":"2025-03-10","fim":"2025-03-31","macroEtapa":"pre_producao","rubricasAssociadas":["Locação de espaços","Equipamentos"]},{"etapa":"Ensaios e preparação","inicio":"2025-04-01","fim":"2025-04-30","macroEtapa":"producao","rubricasAssociadas":["Ensaios","Produção"]},{"etapa":"Produção de material de divulgação","inicio":"2025-04-15","fim":"2025-05-15","macroEtapa":"divulgacao","rubricasAssociadas":["Divulgação"]},{"etapa":"Montagem técnica e cenográfica","inicio":"2025-05-01","fim":"2025-05-20","macroEtapa":"producao","rubricasAssociadas":["Montagem","Cenografia"]},{"etapa":"Apresentações e realização do evento","inicio":"2025-05-21","fim":"2025-06-15","macroEtapa":"producao","rubricasAssociadas":["Apresentações","Produção"]},{"etapa":"Campanha de divulgação e assessoria","inicio":"2025-05-01","fim":"2025-06-30","macroEtapa":"divulgacao","rubricasAssociadas":["Divulgação","Assessoria de imprensa"]},{"etapa":"Desmontagem e devolução de equipamentos","inicio":"2025-06-16","fim":"2025-06-30","macroEtapa":"pos_producao","rubricasAssociadas":["Logística"]},{"etapa":"Documentação pedagógica e clipping","inicio":"2025-07-01","fim":"2025-07-20","macroEtapa":"pos_producao","rubricasAssociadas":["Documentação","Acessibilidade"]},{"etapa":"Prestação de contas (RCO e documentação)","inicio":"2025-07-21","fim":"2025-09-15","macroEtapa":"pos_producao","rubricasAssociadas":["Administrativo"]}]`;
        systemContent = 'Você gera um array JSON de etapas de cronograma. Cada objeto: "etapa", "inicio" (YYYY-MM-DD), "fim" (YYYY-MM-DD), "macroEtapa" (pre_producao, producao, divulgacao ou pos_producao) e "rubricasAssociadas" (array de strings com os NOMES EXATOS das rubricas do orçamento que se aplicam àquela etapa). Use apenas nomes de rubricas fornecidos na lista do projeto. IMPORTANTE: muitas etapas devem ser CONCOMITANTES (datas sobrepostas). Resposta: apenas o JSON.';
      }

      const openai = getAI();
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemContent },
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
          const macroValidos = ['pre_producao', 'producao', 'divulgacao', 'pos_producao'];
          etapas = etapas
            .filter((e) => e && typeof e.etapa === 'string' && e.inicio && e.fim)
            .map((e) => {
              const macro = e.macroEtapa && macroValidos.includes(String(e.macroEtapa)) ? String(e.macroEtapa) : 'producao';
              const rawRubricas = Array.isArray(e.rubricasAssociadas) ? e.rubricasAssociadas : [];
              const rubricasAssociadas = rawRubricas
                .filter((n) => typeof n === 'string' && nomesRubricasSet.has(String(n).trim()))
                .map((n) => String(n).trim());
              return {
                etapa: String(e.etapa).trim(),
                inicio: String(e.inicio).slice(0, 10),
                fim: String(e.fim).slice(0, 10),
                macroEtapa: macro,
                rubricasAssociadas: rubricasAssociadas.length ? rubricasAssociadas : [],
              };
            });
          if (isAlteracoes && Array.isArray(etapasAtuais) && etapasAtuais.length > 0) {
            const mapaPorEtapa = new Map(etapasAtuais.map((e) => [e.etapa || '', e]));
            etapas = etapas.map((e) => {
              const anterior = mapaPorEtapa.get(e.etapa);
              const mantidas = anterior && Array.isArray(anterior.rubricasAssociadas)
                ? anterior.rubricasAssociadas.filter((n) => nomesRubricasSet.has(String(n).trim()))
                : (e.rubricasAssociadas || []);
              return { ...e, rubricasAssociadas: mantidas.length ? mantidas : (e.rubricasAssociadas || []) };
            });
          }
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


exports.preencherAnexoPDF = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [geminiApiKey],
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
      const openai = getAI();
      
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

