const crypto = require("crypto");
const axios = require("axios");

const DEFAULT_PIXEL_ID = "642831091634391";
const META_GRAPH_VERSION = "v21.0";

const ALLOWED_EVENTS = new Set([
  "PageView",
  "Lead",
  "CompleteRegistration",
  "ViewContent",
]);

function hashSha256(value) {
  if (!value || typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * @param {object} opts
 * @param {string} opts.accessToken
 * @param {string} [opts.pixelId]
 * @param {string} opts.eventName
 * @param {string} opts.eventId
 * @param {string} [opts.eventSourceUrl]
 * @param {string} [opts.email]
 * @param {string} [opts.fbp]
 * @param {string} [opts.fbc]
 * @param {Record<string, unknown>} [opts.customData]
 */
async function sendMetaConversionEvent(opts) {
  const {
    accessToken,
    pixelId = DEFAULT_PIXEL_ID,
    eventName,
    eventId,
    eventSourceUrl,
    email,
    fbp,
    fbc,
    customData,
  } = opts;

  if (!accessToken) {
    throw new Error("META_CONVERSIONS_ACCESS_TOKEN não configurado");
  }
  if (!ALLOWED_EVENTS.has(eventName)) {
    throw new Error(`Evento Meta não permitido: ${eventName}`);
  }
  if (!eventId || typeof eventId !== "string") {
    throw new Error("eventId é obrigatório");
  }

  const eventTime = Math.floor(Date.now() / 1000);
  const userData = {};
  const emHash = hashSha256(email);
  if (emHash) userData.em = [emHash];
  if (fbp && typeof fbp === "string") userData.fbp = fbp;
  if (fbc && typeof fbc === "string") userData.fbc = fbc;

  const eventPayload = {
    event_name: eventName,
    event_time: eventTime,
    event_id: eventId,
    action_source: "website",
    user_data: userData,
  };

  if (eventSourceUrl && typeof eventSourceUrl === "string") {
    eventPayload.event_source_url = eventSourceUrl.slice(0, 2000);
  }
  if (customData && typeof customData === "object" && !Array.isArray(customData)) {
    eventPayload.custom_data = customData;
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events`;
  const body = {
    data: [eventPayload],
    access_token: accessToken,
  };

  const response = await axios.post(url, body, {
    timeout: 15000,
    headers: { "Content-Type": "application/json" },
  });

  return response.data;
}

module.exports = {
  ALLOWED_EVENTS,
  DEFAULT_PIXEL_ID,
  sendMetaConversionEvent,
};
