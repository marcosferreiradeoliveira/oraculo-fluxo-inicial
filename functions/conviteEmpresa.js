const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { enviarConviteEmpresaEmail } = require("./enviarConviteEmail");
const { brevoApiKey } = require("./conviteEmpresaSecrets");

const db = admin.firestore();
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_COLLECTION = "primeiro_acesso_tokens";

function getBrevoKey() {
  try {
    const v = brevoApiKey.value();
    if (v && String(v).trim()) return String(v).trim();
  } catch {
    // local
  }
  return process.env.BREVO_API_KEY || "";
}

function resolveAppBase(appOrigin) {
  const fromEnv = String(process.env.PUBLIC_APP_URL || "")
    .trim()
    .replace(/\/$/, "");
  const fromClient = String(appOrigin || "")
    .trim()
    .replace(/\/$/, "");
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(fromClient);
  if (fromClient && !isLocal) return fromClient;
  if (fromEnv) return fromEnv;
  return "https://criador-is.web.app";
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function randomPassword() {
  return crypto.randomBytes(24).toString("base64url");
}

function setupToken() {
  return crypto.randomBytes(32).toString("hex");
}

function roleLabel(role) {
  return role === "gestor_financeiro" ? "Gestor" : "Membro";
}

function normalizeProjectIds(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((x) => String(x || "").trim()).filter(Boolean))].slice(0, 40);
}

async function validateAssignedProjectIds(empresaId, ownerUid, role, rawIds) {
  if (role !== "membro") return [];
  const ids = normalizeProjectIds(rawIds);
  if (ids.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "Selecione ao menos um projeto para convidar como membro."
    );
  }
  for (const pid of ids) {
    const ref = db.doc(`projetos/${pid}`);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("invalid-argument", `Projeto não encontrado: ${pid}`);
    }
    const d = snap.data();
    const ok = d.user_id === ownerUid || d.empresaId === empresaId;
    if (!ok) {
      throw new HttpsError("permission-denied", "Projeto não pertence a esta empresa.");
    }
    if (!d.empresaId) {
      await ref.update({ empresaId });
    }
  }
  return ids;
}

async function assertCanManageEmpresa(uid, empresaId) {
  const empSnap = await db.doc(`empresas/${empresaId}`).get();
  if (!empSnap.exists) {
    throw new HttpsError("not-found", "Empresa não encontrada.");
  }
  if (empSnap.data().ownerUid === uid) return empSnap;

  const membroSnap = await db.doc(`empresas/${empresaId}/membros/${uid}`).get();
  if (!membroSnap.exists || membroSnap.data().status !== "active") {
    throw new HttpsError("permission-denied", "Sem permissão para convidar nesta empresa.");
  }
  const role = membroSnap.data().role;
  if (role !== "super_admin" && role !== "gestor_financeiro") {
    throw new HttpsError("permission-denied", "Sem permissão para convidar nesta empresa.");
  }
  return empSnap;
}

async function ensureAuthUser(email) {
  try {
    const existing = await admin.auth().getUserByEmail(email);
    return { uid: existing.uid, created: false };
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    const created = await admin.auth().createUser({
      email,
      emailVerified: false,
      password: randomPassword(),
      disabled: false,
    });
    return { uid: created.uid, created: true };
  }
}

async function ensureUsuarioDoc(uid, email, { primeiroAcesso }) {
  const ref = db.doc(`usuarios/${uid}`);
  const snap = await ref.get();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const base = {
    uid,
    email,
    updatedAt: now,
    mustSetPassword: primeiroAcesso,
    primeiroAcesso: primeiroAcesso,
  };

  if (!snap.exists) {
    await ref.set({
      ...base,
      nome_completo: email.split("@")[0] || "Usuário",
      createdAt: now,
      data_cadastro: now,
      lastLoginAt: null,
      origem: "convite_empresa",
      projetos_criados_count: 0,
      role: "membro",
      empresa: "",
      portfolio: "",
      equipeBio: "",
      dadosCadastrais: "",
      dadosCadastraisEmpresa: {},
      dadosCadastraisPessoa: {},
    });
    return;
  }

  await ref.set(base, { merge: true });
}

async function needsPasswordSetup(uid, authJustCreated) {
  if (authJustCreated) return true;
  const snap = await db.doc(`usuarios/${uid}`).get();
  if (!snap.exists) return true;
  const d = snap.data();
  return d.mustSetPassword === true || d.primeiroAcesso === true;
}

async function aceitarConviteAdmin(uid, email, empresaId, conviteId, role, assignedProjectIdsParam) {
  const conviteRef = db.doc(`empresas/${empresaId}/convites/${conviteId}`);
  const conviteSnap = await conviteRef.get();
  let assignedProjectIds = normalizeProjectIds(assignedProjectIdsParam);
  if (role === "membro" && conviteSnap.exists) {
    const fromConvite = normalizeProjectIds(conviteSnap.data().assignedProjectIds);
    if (fromConvite.length > 0) assignedProjectIds = fromConvite;
  }

  const userRef = db.doc(`usuarios/${uid}`);
  const userSnap = await userRef.get();
  const defaultEmpresaId =
    userSnap.exists && typeof userSnap.data().defaultEmpresaId === "string"
      ? userSnap.data().defaultEmpresaId
      : "";

  const patchUser = {
    empresaIds: admin.firestore.FieldValue.arrayUnion(empresaId),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    mustSetPassword: false,
    primeiroAcesso: false,
  };
  if (!defaultEmpresaId) patchUser.defaultEmpresaId = empresaId;

  await userRef.set(patchUser, { merge: true });

  const membroPayload = {
    uid,
    email,
    role: role === "gestor_financeiro" ? "gestor_financeiro" : "membro",
    status: "active",
    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (role === "membro") {
    membroPayload.assignedProjects = assignedProjectIds;
    membroPayload.revokedAt = admin.firestore.FieldValue.delete();
    membroPayload.revokedByUid = admin.firestore.FieldValue.delete();
  }
  await db.doc(`empresas/${empresaId}/membros/${uid}`).set(membroPayload, { merge: true });

  await conviteRef.update({
    status: "accepted",
    acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    acceptedByUid: uid,
  });
}

async function loadValidToken(token) {
  const tokenRef = db.doc(`${TOKEN_COLLECTION}/${token}`);
  const tokenSnap = await tokenRef.get();
  if (!tokenSnap.exists) return null;
  const t = tokenSnap.data();
  if (t.used) return null;
  if (t.expiresAt?.toMillis() < Date.now()) return null;
  return { tokenRef, t };
}

async function findActiveTokenForConvite(empresaId, conviteId) {
  const snap = await db
    .collection(TOKEN_COLLECTION)
    .where("empresaId", "==", empresaId)
    .where("conviteId", "==", conviteId)
    .where("used", "==", false)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const t = doc.data();
  if (t.expiresAt?.toMillis() < Date.now()) return null;
  return { tokenId: doc.id, t };
}

async function invalidateTokensForConvite(empresaId, conviteId) {
  const snap = await db
    .collection(TOKEN_COLLECTION)
    .where("empresaId", "==", empresaId)
    .where("conviteId", "==", conviteId)
    .where("used", "==", false)
    .get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => {
    batch.update(d.ref, {
      used: true,
      supersededAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
}

async function emitirTokenEnviarEmail({
  empresaId,
  conviteId,
  uid,
  email,
  role,
  authCreated,
  empresaNome,
  inviterEmail,
  appOrigin,
  conviteRef,
}) {
  const token = setupToken();
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + TOKEN_TTL_MS);

  await db.doc(`${TOKEN_COLLECTION}/${token}`).set({
    empresaId,
    conviteId,
    uid,
    email,
    role,
    authCreated,
    expiresAt,
    used: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const base = resolveAppBase(appOrigin);
  const link = `${base}/primeiro-acesso?token=${encodeURIComponent(token)}`;

  let emailSent = false;
  let emailError = null;
  let emailProvider = null;
  try {
    const send = await enviarConviteEmpresaEmail(
      {
        to: email,
        empresaNome,
        inviterEmail,
        link,
        authCreated,
        roleLabel: roleLabel(role),
      },
      getBrevoKey()
    );
    emailSent = true;
    emailProvider = send.provider;
    logger.info("Convite e-mail enviado", { to: email, conviteId, provider: emailProvider });
    await conviteRef.update({
      emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      emailSendError: admin.firestore.FieldValue.delete(),
      emailProvider,
    });
  } catch (err) {
    emailError = err.message || "Falha ao enviar e-mail.";
    logger.error("Convite e-mail falhou", { to: email, conviteId, error: emailError, code: err.code });
    await conviteRef.update({ emailSendError: String(emailError) });
  }

  return { conviteId, link, authCreated, email, emailSent, emailError, emailProvider };
}

const conviteCallOpts = { cors: true, secrets: [brevoApiKey] };

exports.provisionarConviteEmpresa = onCall(conviteCallOpts, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Faça login para enviar convites.");
  }

  const empresaId = String(request.data?.empresaId || "").trim();
  const email = normalizeEmail(request.data?.email);
  const roleRaw = request.data?.role;
  const role = roleRaw === "gestor_financeiro" ? "gestor_financeiro" : "membro";
  const appOrigin = String(request.data?.appOrigin || "").trim().replace(/\/$/, "");

  if (!empresaId) throw new HttpsError("invalid-argument", "empresaId obrigatório.");
  if (!email || !email.includes("@")) throw new HttpsError("invalid-argument", "E-mail inválido.");

  const empSnap = await assertCanManageEmpresa(request.auth.uid, empresaId);
  const empresaNome = typeof empSnap.data().nome === "string" ? empSnap.data().nome : "";
  const ownerUid = empSnap.data().ownerUid;
  const assignedProjectIds = await validateAssignedProjectIds(
    empresaId,
    ownerUid,
    role,
    request.data?.assignedProjectIds
  );

  const membrosSnap = await db.collection(`empresas/${empresaId}/membros`).get();
  const jaMembro = membrosSnap.docs.some(
    (d) => (d.data().email || "").toLowerCase() === email && d.data().status === "active"
  );
  if (jaMembro) {
    throw new HttpsError("already-exists", "Este e-mail já faz parte da equipe.");
  }

  const inviterEmail = normalizeEmail(request.auth.token?.email || "");

  const pendentes = await db
    .collection(`empresas/${empresaId}/convites`)
    .where("email", "==", email)
    .where("status", "==", "pending")
    .get();

  if (!pendentes.empty) {
    const conviteDoc = pendentes.docs[0];
    const conviteRef = conviteDoc.ref;
    const conviteId = conviteDoc.id;
    const prev = conviteDoc.data();
    let uid = typeof prev.invitedUid === "string" ? prev.invitedUid : "";
    if (!uid) {
      const ensured = await ensureAuthUser(email);
      uid = ensured.uid;
    }
    const authCreated = await needsPasswordSetup(uid, false);
    await ensureUsuarioDoc(uid, email, { primeiroAcesso: authCreated });
    const reenvioPatch = {
      role,
      invitedByUid: request.auth.uid,
      invitedByEmail: inviterEmail,
      empresaNome,
      invitedUid: uid,
      provisionedAuth: true,
      reenviadoAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (role === "membro") {
      reenvioPatch.assignedProjectIds = assignedProjectIds;
    } else {
      reenvioPatch.assignedProjectIds = admin.firestore.FieldValue.delete();
    }
    await conviteRef.update(reenvioPatch);
    await invalidateTokensForConvite(empresaId, conviteId);
    const out = await emitirTokenEnviarEmail({
      empresaId,
      conviteId,
      uid,
      email,
      role,
      authCreated,
      empresaNome,
      inviterEmail,
      appOrigin,
      conviteRef,
    });
    return { ...out, resent: true };
  }

  const { uid, created: authJustCreated } = await ensureAuthUser(email);
  const authCreated = await needsPasswordSetup(uid, authJustCreated);
  await ensureUsuarioDoc(uid, email, { primeiroAcesso: authCreated });

  const conviteRef = db.collection(`empresas/${empresaId}/convites`).doc();

  const convitePayload = {
    email,
    status: "pending",
    role,
    invitedByUid: request.auth.uid,
    invitedByEmail: inviterEmail,
    empresaNome,
    invitedUid: uid,
    provisionedAuth: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (role === "membro") {
    convitePayload.assignedProjectIds = assignedProjectIds;
  }
  await conviteRef.set(convitePayload);

  const out = await emitirTokenEnviarEmail({
    empresaId,
    conviteId: conviteRef.id,
    uid,
    email,
    role,
    authCreated,
    empresaNome,
    inviterEmail,
    appOrigin,
    conviteRef,
  });
  return { ...out, resent: false };
});

exports.consultarTokenPrimeiroAcesso = onCall({ cors: true }, async (request) => {
  const token = String(request.data?.token || "").trim();
  if (!token) throw new HttpsError("invalid-argument", "Token inválido.");

  const loaded = await loadValidToken(token);
  if (!loaded) throw new HttpsError("not-found", "Link inválido ou expirado.");

  const { t } = loaded;
  const conviteSnap = await db.doc(`empresas/${t.empresaId}/convites/${t.conviteId}`).get();
  const empresaNome =
    (conviteSnap.exists && conviteSnap.data().empresaNome) ||
    (await db.doc(`empresas/${t.empresaId}`).get()).data()?.nome ||
    "Empresa";

  return {
    email: t.email,
    authCreated: Boolean(t.authCreated),
    empresaNome: typeof empresaNome === "string" ? empresaNome : "Empresa",
    role: t.role,
  };
});

exports.resolverEntradaConvite = onCall({ cors: true }, async (request) => {
  const raw = String(request.data?.convite || "").trim();
  const parts = raw.split(":");
  if (parts.length !== 2) {
    throw new HttpsError("invalid-argument", "Convite inválido.");
  }
  const [empresaId, conviteId] = parts;
  const found = await findActiveTokenForConvite(empresaId, conviteId);
  if (!found) {
    throw new HttpsError("not-found", "Convite expirado ou inválido. Peça um novo convite.");
  }
  const base = resolveAppBase(request.data?.appOrigin);
  return {
    url: `${base}/primeiro-acesso?token=${encodeURIComponent(found.tokenId)}`,
  };
});

exports.concluirPrimeiroAcessoConvite = onCall({ cors: true }, async (request) => {
  const token = String(request.data?.token || "").trim();
  const password = String(request.data?.password || "");

  if (!token) throw new HttpsError("invalid-argument", "Token inválido.");

  const loaded = await loadValidToken(token);
  if (!loaded) throw new HttpsError("not-found", "Link inválido ou expirado.");

  const { tokenRef, t } = loaded;
  if (t.authCreated) {
    if (password.length < 8) {
      throw new HttpsError("invalid-argument", "Use uma senha com pelo menos 8 caracteres.");
    }
    await admin.auth().updateUser(t.uid, { password });
  } else {
    throw new HttpsError("failed-precondition", "Use sua senha atual na tela de convite.");
  }

  const conviteSnap = await db.doc(`empresas/${t.empresaId}/convites/${t.conviteId}`).get();
  if (!conviteSnap.exists || conviteSnap.data().status !== "pending") {
    throw new HttpsError("failed-precondition", "Convite não está mais disponível.");
  }

  const assignedProjectIds = normalizeProjectIds(conviteSnap.data().assignedProjectIds);
  await aceitarConviteAdmin(
    t.uid,
    t.email,
    t.empresaId,
    t.conviteId,
    t.role,
    assignedProjectIds
  );

  await tokenRef.update({
    used: true,
    usedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { email: t.email, empresaId: t.empresaId, authCreated: true };
});

exports.aceitarConviteAutenticado = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Faça login para aceitar o convite.");
  }

  const token = String(request.data?.token || "").trim();
  if (!token) throw new HttpsError("invalid-argument", "Token inválido.");

  const loaded = await loadValidToken(token);
  if (!loaded) throw new HttpsError("not-found", "Link inválido ou expirado.");

  const { tokenRef, t } = loaded;
  const authEmail = normalizeEmail(request.auth.token?.email || "");
  if (authEmail !== normalizeEmail(t.email)) {
    throw new HttpsError("permission-denied", "Entre com o e-mail que recebeu o convite.");
  }
  if (request.auth.uid !== t.uid) {
    throw new HttpsError("permission-denied", "Conta não corresponde ao convite.");
  }

  const conviteSnap = await db.doc(`empresas/${t.empresaId}/convites/${t.conviteId}`).get();
  if (!conviteSnap.exists || conviteSnap.data().status !== "pending") {
    throw new HttpsError("failed-precondition", "Convite não está mais disponível.");
  }

  const assignedProjectIds = normalizeProjectIds(conviteSnap.data().assignedProjectIds);
  await aceitarConviteAdmin(
    t.uid,
    t.email,
    t.empresaId,
    t.conviteId,
    t.role,
    assignedProjectIds
  );

  await tokenRef.update({
    used: true,
    usedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { email: t.email, empresaId: t.empresaId };
});

exports.revogarAcessoMembroEmpresa = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Faça login para gerenciar a equipe.");
  }

  const empresaId = String(request.data?.empresaId || "").trim();
  const targetUid = String(request.data?.membroUid || request.data?.targetUid || "").trim();

  if (!empresaId) throw new HttpsError("invalid-argument", "empresaId obrigatório.");
  if (!targetUid) throw new HttpsError("invalid-argument", "membroUid obrigatório.");

  const empSnap = await assertCanManageEmpresa(request.auth.uid, empresaId);
  const ownerUid = empSnap.data().ownerUid;

  if (targetUid === ownerUid) {
    throw new HttpsError("failed-precondition", "O titular da empresa não pode ter o acesso revogado.");
  }
  if (targetUid === request.auth.uid) {
    throw new HttpsError("failed-precondition", "Peça a outro gestor para remover seu acesso.");
  }

  const membroRef = db.doc(`empresas/${empresaId}/membros/${targetUid}`);
  const membroSnap = await membroRef.get();
  if (!membroSnap.exists) {
    throw new HttpsError("not-found", "Membro não encontrado nesta empresa.");
  }
  const membro = membroSnap.data();
  if (membro.status !== "active") {
    throw new HttpsError("failed-precondition", "Este usuário já não tem acesso ativo.");
  }
  if (membro.role === "super_admin") {
    throw new HttpsError("failed-precondition", "Não é possível revogar um administrador da empresa.");
  }

  const actorIsOwner = ownerUid === request.auth.uid;
  if (membro.role === "gestor_financeiro" && !actorIsOwner) {
    throw new HttpsError(
      "permission-denied",
      "Apenas o titular da empresa pode remover um gestor."
    );
  }

  const email = normalizeEmail(membro.email || "");
  const batch = db.batch();

  batch.update(membroRef, {
    status: "inactive",
    revokedAt: admin.firestore.FieldValue.serverTimestamp(),
    revokedByUid: request.auth.uid,
  });

  const userRef = db.doc(`usuarios/${targetUid}`);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    const u = userSnap.data();
    const ids = Array.isArray(u.empresaIds)
      ? u.empresaIds.filter((x) => typeof x === "string" && x !== empresaId)
      : [];
    const patch = {
      empresaIds: ids,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (u.defaultEmpresaId === empresaId) {
      patch.defaultEmpresaId = ids[0] || admin.firestore.FieldValue.delete();
    }
    batch.set(userRef, patch, { merge: true });
  }

  if (email) {
    const pendentes = await db
      .collection(`empresas/${empresaId}/convites`)
      .where("email", "==", email)
      .where("status", "==", "pending")
      .get();
    for (const docSnap of pendentes.docs) {
      batch.update(docSnap.ref, {
        status: "cancelled",
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancelledReason: "acesso_revogado",
      });
    }
  }

  await batch.commit();

  if (email) {
    const tokens = await db
      .collection(TOKEN_COLLECTION)
      .where("empresaId", "==", empresaId)
      .where("email", "==", email)
      .where("used", "==", false)
      .get();
    if (!tokens.empty) {
      const tb = db.batch();
      for (const t of tokens.docs) {
        tb.update(t.ref, { used: true, revokedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      await tb.commit();
    }
  }

  logger.info("Acesso revogado", { empresaId, targetUid, by: request.auth.uid });
  return { ok: true, membroUid: targetUid, email };
});
