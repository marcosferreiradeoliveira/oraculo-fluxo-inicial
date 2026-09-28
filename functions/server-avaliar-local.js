/**
 * Servidor local só para avaliação IA (Gemini). Usa apenas .env (sem emulador, sem Secrets).
 * Rode: cd functions && node server-avaliar-local.js
 * No .env do frontend: VITE_FUNCTIONS_BASE_URL=http://127.0.0.1:5001
 */
require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });
require("dotenv").config({ path: require("path").resolve(__dirname, ".secret.local"), override: true });
const express = require("express");
const { createGeminiClient } = require("./geminiClient");

const PORT = process.env.AVALIAR_LOCAL_PORT || 5001;
const app = express();
app.use(express.json({ limit: "10mb" }));

function getGeminiKey() {
  return (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "").trim();
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
  const userPortfolio = portfolio || "";

  return `Você é um avaliador experiente de projetos culturais para leis de incentivo fiscal.
Sua tarefa é avaliar rigorosamente o projeto apresentado contra os critérios específicos do edital.

PRIORIDADE PRINCIPAL: A avaliação deve ser baseada PRIMARIAMENTE no TEXTO DO PROJETO abaixo. Os demais dados (portfolio, equipe) são apenas contexto adicional para entender melhor a capacidade de execução.

NOME DO PROJETO: ${nomeProjeto || "Não informado"}
EDITAL: ${nomeEdital || "Não informado"}

TEXTO DO PROJETO:
${textoProjeto}

CRITÉRIOS DO EDITAL QUE DEVEM SER AVALIADOS:
${criteriosEdital}

${textoEdital ? `TEXTO DO EDITAL (contexto):\n${String(textoEdital).slice(0, 3000)}\n` : ""}
${userPortfolio ? `PORTFOLIO (contexto):\n${String(userPortfolio).slice(0, 2000)}\n` : ""}
${projetosSelecionados ? `PROJETOS SELECIONADOS (contexto):\n${projetosSelecionados}\n` : ""}

Forneça uma análise estruturada, objetiva e construtiva.`;
}

app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }
  next();
});

async function handleAvaliar(req, res) {
  try {
    const apiKey = getGeminiKey();
    if (!apiKey) {
      return res.status(500).json({
        error: "Chave Gemini não definida. No functions/.env use GEMINI_API_KEY=sua-chave"
      });
    }
    const { textoProjeto, criteriosEdital, stream: useStream = false } = req.body;
    if (!textoProjeto || !criteriosEdital) {
      return res.status(400).json({ error: "Texto do projeto e critérios do edital são obrigatórios" });
    }

    const openai = createGeminiClient(apiKey);
    const prompt = buildPrompt(req.body);

    if (useStream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const stream = await openai.chat.completions.create({
        model: "gemini-3.8-flash",
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
      model: "gemini-3.8-flash",
      messages: [
        {
          role: "system",
          content: "Você é um avaliador oficial de projetos culturais. Seja rigoroso mas construtivo."
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
    const isInvalidKey = /401|403|API_KEY|api key|invalid/i.test(raw);
    const msg = isInvalidKey
      ? "Chave Gemini rejeitada. Gere uma nova em https://aistudio.google.com/apikey e atualize functions/.env (GEMINI_API_KEY)."
      : raw || "Erro ao chamar Gemini. Verifique a chave no functions/.env";
    res.status(500).json({ error: msg });
  }
}

app.post("/avaliarProjetoIA", handleAvaliar);
app.post("/oraculo-is/us-central1/avaliarProjetoIA", handleAvaliar);

app.listen(PORT, () => {
  const key = getGeminiKey();
  console.log(`[avaliar-local] Servidor em http://127.0.0.1:${PORT}`);
  console.log(`[avaliar-local] Chave Gemini: ${key ? "OK" : "FALTANDO"}`);
});
