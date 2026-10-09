const axios = require("axios");

function getBrevoApiKey(explicitKey) {
  if (explicitKey && String(explicitKey).trim()) return String(explicitKey).trim();
  return process.env.BREVO_API_KEY || "";
}

function getSendGridApiKey() {
  return process.env.SENDGRID_API_KEY || "";
}

function senderConfig() {
  const fromEmail = (process.env.CONVITE_EMAIL_FROM || "mobcontent.mda@gmail.com").trim();
  const fromName = (process.env.CONVITE_EMAIL_FROM_NAME || "Instituto dos Sonhos").trim();
  return { email: fromEmail, name: fromName };
}

function buildHtml({ empresaNome, inviterEmail, link, authCreated, roleLabel }) {
  const titulo = authCreated ? "Defina sua senha e entre" : "Aceite o convite";
  const passo = authCreated
    ? "Clique no botão abaixo para criar sua senha e acessar a empresa no Oráculo."
    : "Use o link para entrar com sua senha atual e aceitar o convite.";
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#071F4E;max-width:560px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;margin:0 0 12px">${titulo}</h1>
  <p style="margin:0 0 8px">Você foi convidado${inviterEmail ? ` por <strong>${inviterEmail}</strong>` : ""} para a empresa <strong>${empresaNome || "no Oráculo"}</strong> como <strong>${roleLabel}</strong>.</p>
  <p style="margin:0 0 20px">${passo}</p>
  <p style="margin:0 0 24px">
    <a href="${link}" style="display:inline-block;background:linear-gradient(90deg,#0088CB,#1B4C41);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Abrir convite</a>
  </p>
  <p style="font-size:12px;color:#666;margin:0">Se o botão não funcionar, copie e cole no navegador:<br><span style="word-break:break-all">${link}</span></p>
  <p style="font-size:11px;color:#999;margin-top:24px">Link válido por 7 dias. Instituto dos Sonhos · Oráculo Criação</p>
</body>
</html>`;
}

function brevoErrorMessage(err) {
  const data = err?.response?.data;
  if (data && typeof data.message === "string") return data.message;
  if (data && typeof data.error === "string") return data.error;
  return err?.message || "Erro ao enviar via Brevo.";
}

async function enviarViaBrevo(payload, apiKey) {
  await axios.post("https://api.brevo.com/v3/smtp/email", payload, {
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    timeout: 15000,
  });
}

async function enviarViaSendGrid({ to, from, subject, htmlContent, textContent }) {
  const key = getSendGridApiKey();
  if (!key) {
    const err = new Error("SENDGRID_API_KEY não configurado.");
    err.code = "email-not-configured";
    throw err;
  }
  const sgMail = require("@sendgrid/mail");
  sgMail.setApiKey(key);
  await sgMail.send({
    to,
    from,
    subject,
    html: htmlContent,
    text: textContent,
  });
}

/**
 * @returns {{ provider: 'brevo' | 'sendgrid' }}
 */
async function enviarConviteEmpresaEmail(params, brevoApiKey) {
  const { to, empresaNome, inviterEmail, link, authCreated, roleLabel } = params;
  const sender = senderConfig();
  const subject = `Convite — ${empresaNome || "empresa"} no Oráculo Criação`;
  const htmlContent = buildHtml({ empresaNome, inviterEmail, link, authCreated, roleLabel });
  const textContent = [
    `Convite para ${empresaNome || "empresa"} (${roleLabel}).`,
    authCreated ? "Crie sua senha:" : "Aceite o convite:",
    link,
  ].join("\n\n");

  const payload = {
    sender,
    to: [{ email: to }],
    subject,
    htmlContent,
    textContent,
  };

  const brevoKey = getBrevoApiKey(brevoApiKey);
  if (brevoKey) {
    try {
      await enviarViaBrevo(payload, brevoKey);
      return { provider: "brevo" };
    } catch (err) {
      const sgKey = getSendGridApiKey();
      if (!sgKey) {
        const e = new Error(brevoErrorMessage(err));
        e.code = "email-send-failed";
        throw e;
      }
      await enviarViaSendGrid({
        to,
        from: sender,
        subject,
        htmlContent,
        textContent,
      });
      return { provider: "sendgrid" };
    }
  }

  if (getSendGridApiKey()) {
    await enviarViaSendGrid({
      to,
      from: sender,
      subject,
      htmlContent,
      textContent,
    });
    return { provider: "sendgrid" };
  }

  const err = new Error(
    "E-mail não configurado: defina o secret BREVO_API_KEY (ou SENDGRID_API_KEY) nas Cloud Functions."
  );
  err.code = "email-not-configured";
  throw err;
}

module.exports = { enviarConviteEmpresaEmail, senderConfig };
