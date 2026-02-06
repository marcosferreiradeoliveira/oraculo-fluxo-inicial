/**
 * Servidor local só para avaliação IA. Usa apenas .env (sem emulador, sem Secrets).
 * Rode: cd functions && node server-avaliar-local.js
 * No .env do frontend: VITE_FUNCTIONS_BASE_URL=http://127.0.0.1:5001
 */
require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });
const express = require("express");
const { OpenAI } = require("openai");

const PORT = process.env.AVALIAR_LOCAL_PORT || 5001;
const app = express();
app.use(express.json({ limit: "10mb" }));

// Chave OpenAI: preferir a que começa com sk- (OPENAI_API_KEY ou VITE_OPENAI_API_KEY)
function getOpenAIKey() {
  const a = (process.env.OPENAI_API_KEY || "").trim();
  const b = (process.env.VITE_OPENAI_API_KEY || "").trim();
  if (a.startsWith("sk-")) return a;
  if (b.startsWith("sk-")) return b;
  return a || b;
}

function buildPrompt(body) {
  const {
    textoProjeto,
    nomeProjeto,
    nomeEdital,
    criteriosEdital,
    textoEdital,
    portfolio = "",
    projetosSelecionados = ""
  } = body;
  const equipeBio = ""; // local não acessa Firestore
  const userPortfolio = portfolio || "";

  return `Você é um avaliador experiente de projetos culturais para leis de incentivo fiscal.
Sua tarefa é avaliar rigorosamente o projeto apresentado contra os critérios específicos do edital.

PRIORIDADE PRINCIPAL: A avaliação deve ser baseada PRIMARIAMENTE no TEXTO DO PROJETO abaixo. Os demais dados (portfolio, equipe) são apenas contexto adicional para entender melhor a capacidade de execução.

${nomeProjeto ? `**PROJETO:** ${nomeProjeto}` : ""}

**TEXTO DO PROJETO PARA AVALIAÇÃO (PRIORIDADE PRINCIPAL):**
${textoProjeto}

**EDITAL:** ${nomeEdital || "Não especificado"}

**CRITÉRIOS DO EDITAL QUE DEVEM SER AVALIADOS:**
Os critérios abaixo são os critérios de avaliação reais do edital. Você deve usar APENAS e EXCLUSIVAMENTE estes critérios para avaliar o projeto:
${criteriosEdital}

IMPORTANTE: Use APENAS os critérios listados acima. Não invente critérios.

${textoEdital ? `**TEXTO COMPLETO DO EDITAL (para contexto adicional):**\n${textoEdital}` : ""}

${projetosSelecionados ? `**PROJETOS JÁ SELECIONADOS (referência):**\n${String(projetosSelecionados).slice(0, 2000)}` : ""}

${equipeBio ? `**EQUIPE E BIOGRAFIA:**\n${equipeBio}` : ""}

${userPortfolio ? `**PORTFOLIO:**\n${userPortfolio}` : ""}

**INSTRUÇÕES DE AVALIAÇÃO:**

1. **ADEQUAÇÃO AOS CRITÉRIOS DO EDITAL**: Analise item por item como o projeto atende cada critério listado acima.
2. **PONTOS FORTES DO PROJETO**: Destaque 3-4 pontos fortes baseados no texto do projeto.
3. **PONTOS FRACOS E GAPS**: O que falta ou precisa ser melhorado.
4. **SUGESTÕES DE MELHORIA**: 4-5 sugestões práticas; cada uma começando com "Sugestão: ".
5. **NOTA ESTIMADA (0-100)**: Nota justificada com base nos critérios do edital.

Seja objetivo, específico e construtivo.`;
}

// CORS para o frontend em localhost
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

async function handleAvaliar(req, res) {
  try {
    const apiKey = getOpenAIKey();
    if (!apiKey) {
      return res.status(500).json({
        error: "Chave OpenAI não definida. No functions/.env use OPENAI_API_KEY ou VITE_OPENAI_API_KEY (chave deve começar com sk-)"
      });
    }
    if (!apiKey.startsWith("sk-")) {
      return res.status(500).json({
        error: "Chave OpenAI inválida: deve começar com sk- (veja https://platform.openai.com/account/api-keys). No functions/.env use OPENAI_API_KEY ou VITE_OPENAI_API_KEY com a chave correta."
      });
    }
    const { textoProjeto, criteriosEdital, stream: useStream = false } = req.body;
    if (!textoProjeto || !criteriosEdital) {
      return res.status(400).json({ error: "Texto do projeto e critérios do edital são obrigatórios" });
    }

    const openai = new OpenAI({ apiKey });
    const prompt = buildPrompt(req.body);

    if (useStream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "Você é um avaliador oficial de projetos culturais com décadas de experiência em leis de incentivo fiscal. Seja rigoroso mas construtivo."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.3,
        stream: true
      });
      let fullContent = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullContent += content;
          res.write(`data: ${JSON.stringify({ content, done: false })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ content: "", done: true, fullContent })}\n\n`);
      res.end();
      return;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Você é um avaliador oficial de projetos culturais. Seja rigoroso mas construtivo."
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });
    const analiseIA = completion.choices[0].message?.content || "";
    res.json({ analiseIA });
  } catch (e) {
    console.error("Erro avaliar local:", e);
    const raw = e.message || String(e);
    const isInvalidKey =
      e.status === 401 ||
      (e.code && String(e.code) === "invalid_api_key") ||
      /401|incorrect api key|invalid_api_key/i.test(raw);
    const msg = isInvalidKey
      ? "Chave OpenAI rejeitada (expirada ou inválida). Gere uma nova em https://platform.openai.com/account/api-keys e atualize functions/.env (VITE_OPENAI_API_KEY ou OPENAI_API_KEY)."
      : raw || "Erro ao chamar OpenAI. Verifique a chave no functions/.env";
    res.status(500).json({ error: msg });
  }
}

// Rota curta: VITE_FUNCTIONS_BASE_URL=http://127.0.0.1:5001 → /avaliarProjetoIA
app.post("/avaliarProjetoIA", handleAvaliar);
// Rota longa (compatível com URL do emulador)
app.post("/culturalapp-fb9b0/us-central1/avaliarProjetoIA", handleAvaliar);

app.listen(PORT, () => {
  const key = getOpenAIKey();
  const ok = key && key.startsWith("sk-");
  console.log(`[avaliar-local] Servidor em http://127.0.0.1:${PORT}`);
  console.log(`[avaliar-local] Chave OpenAI: ${ok ? "OK (sk-...)" : key ? "INVÁLIDA (não começa com sk-)" : "FALTANDO"}`);
});
