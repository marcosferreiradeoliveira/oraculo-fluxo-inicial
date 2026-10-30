const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?oraculocultural\.com\.br$/,
  /^https:\/\/execucaofinanceira\.web\.app$/,
  /^https:\/\/culturalapp-fb9b0\.web\.app$/,
  /^https:\/\/culturalapp-fb9b0\.firebaseapp\.com$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

const CREDIT_COSTS = {
  analise_projeto: 5,
  avaliar_projeto: 5,
  gerar_texto: 1,
  alterar_texto_com_ia: 1,
  preencher_anexo_pdf: 1,
  gerar_cronograma: 3,
  gerar_orcamento: 3,
};

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin));
}

function applyCors(req, res, extraHeaders = 'Content-Type, Authorization') {
  const origin = req.get('Origin') || req.get('origin') || '';
  if (isAllowedOrigin(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', extraHeaders);
  res.set('Access-Control-Max-Age', '3600');
}

/** Prévia landing: origens do ecossistema + qualquer HTTPS (CTA cross-origin). */
function applyCorsLandingPreview(req, res) {
  const origin = req.get('Origin') || req.get('origin') || '';
  if (origin && (isAllowedOrigin(origin) || /^https:\/\//.test(origin))) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  } else {
    res.set('Access-Control-Allow-Origin', '*');
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Preview-Fingerprint');
  res.set('Access-Control-Max-Age', '3600');
}

function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}

async function verifyBearerToken(req, admin) {
  const authHeader = req.get('Authorization') || req.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, error: 'Não autenticado. Envie Authorization: Bearer <token>.' };
  }
  try {
    const decoded = await admin.auth().verifyIdToken(match[1].trim());
    return { ok: true, uid: decoded.uid, email: decoded.email || null };
  } catch {
    return { ok: false, status: 401, error: 'Token inválido ou expirado.' };
  }
}

async function isSuperAdmin(uid, db) {
  const snap = await db.collection('usuarios').doc(uid).get();
  if (!snap.exists) return false;
  return snap.data()?.role === 'super_admin';
}

async function debitCredits(db, uid, acao) {
  const cost = CREDIT_COSTS[acao];
  if (!cost) return { cost: 0 };
  const ref = db.collection('usuarios').doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      const err = new Error('USER_NOT_FOUND');
      err.code = 'USER_NOT_FOUND';
      throw err;
    }
    const data = snap.data();
    const creditos = typeof data.creditos === 'number' ? data.creditos : Number(data.creditos ?? 0);
    if (creditos < cost) {
      const err = new Error('INSUFFICIENT');
      err.code = 'INSUFFICIENT';
      throw err;
    }
    tx.update(ref, { creditos: creditos - cost });
  });
  return { cost };
}

async function refundCredits(db, uid, cost) {
  if (!cost || cost <= 0) return;
  const ref = db.collection('usuarios').doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data();
    const creditos = typeof data.creditos === 'number' ? data.creditos : Number(data.creditos ?? 0);
    tx.update(ref, { creditos: creditos + cost });
  });
}

async function assertProjectOwner(db, uid, projetoId) {
  if (!projetoId) return true;
  const snap = await db.collection('projetos').doc(String(projetoId)).get();
  if (!snap.exists) return false;
  return snap.data()?.user_id === uid;
}

/**
 * Autentica, opcionalmente valida dono do projeto e debita créditos.
 * @returns {null|{ uid: string, debitedCost: number }}
 */
async function secureIaRequest(req, res, admin, db, options = {}) {
  const { acao = null, projetoId = null, requireProject = false } = options;

  applyCors(req, res);
  if (handleOptions(req, res)) return null;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return null;
  }

  const auth = await verifyBearerToken(req, admin);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return null;
  }
  const uid = auth.uid;

  const pid = projetoId ?? req.body?.projetoId ?? null;
  if (requireProject && !pid) {
    res.status(400).json({ error: 'projetoId é obrigatório' });
    return null;
  }
  if (pid && !(await assertProjectOwner(db, uid, pid))) {
    res.status(403).json({ error: 'Sem permissão para este projeto.' });
    return null;
  }

  let debitedCost = 0;
  const skipDebit = await isSuperAdmin(uid, db);
  if (acao && !skipDebit) {
    try {
      const { cost } = await debitCredits(db, uid, acao);
      debitedCost = cost || 0;
    } catch (e) {
      if (e.code === 'INSUFFICIENT') {
        res.status(402).json({ error: 'Créditos insuficientes', message: 'Créditos insuficientes' });
        return null;
      }
      throw e;
    }
  }

  return { uid, debitedCost, skipDebit };
}

function getClientIp(req) {
  const fwd = req.get('x-forwarded-for') || req.get('X-Forwarded-For') || '';
  const parts = fwd
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length > 0) return parts[parts.length - 1];
  return req.ip || 'unknown';
}

async function checkPreviewIpLimit(db, admin, ip) {
  const day = new Date().toISOString().slice(0, 10);
  const safeIp = String(ip).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
  const docId = `preview_${safeIp}_${day}`;
  const ref = db.collection('rate_limits').doc(docId);
  const MAX = 3;
  let allowed = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? Number(snap.data().count || 0) : 0;
    if (count >= MAX) {
      allowed = false;
      return;
    }
    tx.set(
      ref,
      {
        count: count + 1,
        ip: safeIp,
        day,
        kind: 'landing_preview_ip',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    allowed = true;
  });
  return allowed;
}

function resolveGerarTextosCreditAction(body) {
  const tipo = String(body?.tipo || body?.dadosProjeto?.tipo || '').toLowerCase();
  if (tipo === 'orcamento') return 'gerar_orcamento';
  return 'gerar_texto';
}

module.exports = {
  CREDIT_COSTS,
  applyCors,
  applyCorsLandingPreview,
  handleOptions,
  verifyBearerToken,
  isSuperAdmin,
  debitCredits,
  refundCredits,
  assertProjectOwner,
  secureIaRequest,
  getClientIp,
  checkPreviewIpLimit,
  resolveGerarTextosCreditAction,
};
