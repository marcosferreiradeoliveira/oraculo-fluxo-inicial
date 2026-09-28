/**
 * Cliente Gemini com interface compatível com openai.chat.completions.create
 * para migrar call sites sem reescrever cada prompt.
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");

const DEFAULT_MODEL = "gemini-3.8-flash";

function mapModel(model) {
  if (!model) return DEFAULT_MODEL;
  const m = String(model).toLowerCase();
  if (m.includes("flash-lite") || m.includes("mini") || m.endsWith("-lite")) {
    return "gemini-3.5-flash-lite";
  }
  return DEFAULT_MODEL;
}

function extractText(responseOrChunk) {
  try {
    const direct = responseOrChunk.text?.();
    if (direct) return direct;
  } catch {
    // fall through
  }
  const parts =
    responseOrChunk?.candidates?.[0]?.content?.parts ||
    responseOrChunk?.content?.parts ||
    [];
  return parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("");
}

function splitMessages(messages = []) {
  const systemParts = [];
  const contents = [];

  for (const msg of messages) {
    if (!msg) continue;
    const text =
      typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content
              .map((p) => (typeof p === "string" ? p : p?.text || ""))
              .filter(Boolean)
              .join("\n")
          : String(msg.content ?? "");

    if (msg.role === "system") {
      systemParts.push(text);
      continue;
    }

    const role = msg.role === "assistant" ? "model" : "user";
    contents.push({ role, parts: [{ text }] });
  }

  // Gemini exige que o histórico comece com user
  if (contents.length && contents[0].role !== "user") {
    contents.unshift({ role: "user", parts: [{ text: "(continuar)" }] });
  }

  return {
    systemInstruction: systemParts.filter(Boolean).join("\n\n") || undefined,
    contents,
  };
}

function createGeminiClient(apiKey) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurado");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  return {
    chat: {
      completions: {
        /**
         * @param {{ model?: string, messages: any[], max_tokens?: number, temperature?: number, stream?: boolean }} opts
         */
        async create(opts = {}) {
          const {
            model,
            messages = [],
            max_tokens = 2048,
            temperature = 0.3,
            stream = false,
          } = opts;

          const { systemInstruction, contents } = splitMessages(messages);
          const generativeModel = genAI.getGenerativeModel({
            model: mapModel(model),
            ...(systemInstruction ? { systemInstruction } : {}),
            generationConfig: {
              // Modelos Gemini 3 usam tokens de "thinking"; valores baixos devolvem texto vazio
              maxOutputTokens: Math.max(Number(max_tokens) || 2048, 1024),
              temperature,
            },
          });

          if (stream) {
            const result = await generativeModel.generateContentStream({ contents });

            async function* openAIStyleStream() {
              for await (const chunk of result.stream) {
                let text = "";
                try {
                  text = extractText(chunk);
                } catch {
                  text = "";
                }
                if (!text) continue;
                yield {
                  choices: [{ delta: { content: text }, index: 0 }],
                };
              }
            }

            return openAIStyleStream();
          }

          const result = await generativeModel.generateContent({ contents });
          let text = "";
          try {
            text = extractText(result.response);
          } catch (e) {
            text = "";
            console.warn("[gemini] empty response:", e?.message || e);
          }

          return {
            choices: [
              {
                message: { role: "assistant", content: text },
                index: 0,
                finish_reason: "stop",
              },
            ],
          };
        },
      },
    },
  };
}

module.exports = {
  createGeminiClient,
  DEFAULT_MODEL,
  mapModel,
};
