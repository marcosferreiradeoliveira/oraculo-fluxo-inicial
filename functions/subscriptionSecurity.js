const iaSecurity = require('./iaSecurity');

/**
 * Autentica requisição de assinatura/checkout e carrega usuarios/{uid}.
 * @returns {null|{ uid, email, userData, userRef, superAdmin }}
 */
async function secureSubscriptionRequest(req, res, admin, db) {
  iaSecurity.applyCors(req, res);
  if (iaSecurity.handleOptions(req, res)) return null;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return null;
  }

  const auth = await iaSecurity.verifyBearerToken(req, admin);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return null;
  }

  const uid = auth.uid;
  const userRef = db.collection('usuarios').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return null;
  }

  const userData = userSnap.data();
  const superAdmin = userData?.role === 'super_admin';
  const email =
    auth.email ||
    userData.email ||
    null;

  return { uid, email, userData, userRef, superAdmin };
}

/**
 * Usa stripeSubscriptionId do doc; super_admin pode informar outro no body.
 * Body com id diferente do doc → 403.
 */
function resolveStripeSubscriptionId(req, ctx) {
  const stored = ctx.userData?.stripeSubscriptionId || null;
  const requested = req.body?.subscriptionId ? String(req.body.subscriptionId).trim() : null;

  if (ctx.superAdmin && requested) {
    return { subscriptionId: requested };
  }
  if (requested && stored && requested !== stored) {
    return { forbidden: true };
  }
  return { subscriptionId: stored };
}

function resolveStripeCustomerId(req, ctx) {
  const stored = ctx.userData?.stripeCustomerId || null;
  const requested = req.body?.customerId ? String(req.body.customerId).trim() : null;

  if (ctx.superAdmin && requested) {
    return { customerId: requested };
  }
  if (requested && stored && requested !== stored) {
    return { forbidden: true };
  }
  return { customerId: stored };
}

function forbidden(res) {
  res.status(403).json({
    error: 'Sem permissão para esta assinatura.',
    message: 'Sem permissão para esta assinatura.',
  });
}

module.exports = {
  secureSubscriptionRequest,
  resolveStripeSubscriptionId,
  resolveStripeCustomerId,
  forbidden,
};
