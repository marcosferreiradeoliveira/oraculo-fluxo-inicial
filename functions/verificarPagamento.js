/**
 * Script para verificar e atualizar manualmente o status premium de um usuário
 * baseado em um pagamento aprovado do Mercado Pago
 * 
 * Uso:
 *   node verificarPagamento.js <payment_id> <user_id>
 * 
 * Exemplo:
 *   node verificarPagamento.js 1234567890 abc123def456
 */

const admin = require('firebase-admin');
const mercadopago = require('mercadopago');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Access Token do Mercado Pago
const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "APP_USR-783906941666085-010213-a7124ca4d6ae0e9ad0fb28935a13a1b4-244819965";

const mp = new mercadopago.MercadoPagoConfig({ accessToken });
const payment = new mercadopago.Payment(mp);

async function verificarPagamento(paymentId, userId) {
  try {
    console.log(`Buscando pagamento ${paymentId}...`);
    
    const paymentInfo = await payment.get({ id: paymentId });
    
    console.log('Informações do pagamento:', {
      id: paymentInfo.id,
      status: paymentInfo.status,
      external_reference: paymentInfo.external_reference,
      payer: paymentInfo.payer?.email
    });
    
    if (paymentInfo.status === 'approved') {
      const targetUserId = userId || paymentInfo.external_reference;
      
      if (!targetUserId) {
        console.error('❌ Não foi possível identificar o userId');
        return;
      }
      
      console.log(`Atualizando usuário ${targetUserId}...`);
      
      const userRef = db.collection('usuarios').doc(targetUserId);
      const userDoc = await userRef.get();
      
      if (userDoc.exists()) {
        await userRef.update({
          isPremium: true,
          premiumStatus: 'authorized',
          premiumActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
          paymentId: paymentId.toString()
        });
        
        console.log(`✅ Usuário ${targetUserId} atualizado para premium!`);
      } else {
        console.error(`❌ Usuário ${targetUserId} não encontrado no Firestore`);
      }
    } else {
      console.log(`⚠️ Pagamento não está aprovado. Status: ${paymentInfo.status}`);
    }
  } catch (error) {
    console.error('Erro:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar
const paymentId = process.argv[2];
const userId = process.argv[3];

if (!paymentId) {
  console.log('Uso: node verificarPagamento.js <payment_id> [user_id]');
  process.exit(1);
}

verificarPagamento(paymentId, userId).then(() => {
  console.log('Processo concluído');
  process.exit(0);
}).catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});




