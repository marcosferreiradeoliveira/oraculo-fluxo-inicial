require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI } = require("openai");
const mercadopago = require("mercadopago");
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const mp = new mercadopago.MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN });
const preference = new mercadopago.Preference(mp);
const payment = new mercadopago.Payment(mp);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'culturalapp-fb9b0'
  });
}
const db = admin.firestore();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Oraculo API is running' });
});

// Analyze project endpoint
app.post('/analisarProjeto', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Você é um consultor especialista em projetos culturais, agindo como um avaliador rigoroso, porém construtivo.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1500,
      temperature: 0.2,
    });

    const analiseIA = completion.choices[0].message?.content || 'Sem resposta da IA.';
    return res.status(200).json({ analise: analiseIA });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return res.status(500).json({ error: error?.message || 'Failed to get analysis from AI.' });
  }
});

// Create premium subscription endpoint
app.post('/criarAssinaturaPremium', async (req, res) => {
  try {
    const { email, userId } = req.body;
    
    if (!email || !userId) {
      return res.status(400).json({ error: 'Email e userId são obrigatórios' });
    }

    // Criar o plano de assinatura
    const subscriptionData = {
      reason: 'Plano Premium Mensal - Oráculo Cultural',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        repetitions: 0, // 0 para assinatura sem fim
        billing_day: new Date().getDate(),
        billing_day_proportional: true,
        transaction_amount: 29.90,
        currency_id: 'BRL',
        start_date: new Date().toISOString()
      },
      back_url: 'https://culturalapp-fb9b0.web.app/assinatura-status',
      status: 'authorized'
    };

    // Criar o plano
    const plan = await mercadopago.preapproval_plan.create({ body: subscriptionData });
    
    // Criar a assinatura
    const subscription = await mercadopago.preapproval.create({
      body: {
        preapproval_plan_id: plan.id,
        payer_email: email,
        external_reference: userId, // Referência para identificar o usuário
        back_url: 'https://culturalapp-fb9b0.web.app/assinatura-status',
        status: 'authorized'
      }
    });

    // Salvar informações da assinatura no Firestore
    await db.collection('subscriptions').doc(subscription.id).set({
      userId: userId,
      status: 'pending',
      planId: plan.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Próximo mês
    });

    // Retornar URL de aprovação
    res.json({ 
      init_point: subscription.init_point,
      subscriptionId: subscription.id
    });
  } catch (error) {
    console.error('Error creating checkout:', error);
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

// Webhook endpoint for Mercado Pago subscription and payment notifications
app.post('/webhook', async (req, res) => {
  try {
    const { type, action, data } = req.body;
    console.log('Webhook received:', { type, action, data });
    
    // Handle subscription status changes
    if (type === 'subscription_preapproval') {
      await handleSubscriptionUpdate(data.id);
    } 
    // Handle subscription payments
    else if (type === 'payment' && data?.id) {
      await handleSubscriptionPayment(data.id);
    }
    
    async function handleSubscriptionUpdate(subscriptionId) {
      try {
        // Get subscription details
        const subscription = await mercadopago.preapproval.get({ id: subscriptionId });
        console.log('Subscription info:', { 
          id: subscriptionId, 
          status: subscription.status,
          payer_email: subscription.payer_email,
          external_reference: subscription.external_reference
        });
        
        // Update subscription in Firestore
        const subscriptionRef = db.collection('subscriptions').doc(subscriptionId);
        const subscriptionData = (await subscriptionRef.get()).data() || {};
        
        const updateData = {
          status: subscription.status,
          lastModified: admin.firestore.FieldValue.serverTimestamp(),
          payerEmail: subscription.payer_email || subscriptionData.payerEmail,
          ...(subscription.status === 'authorized' && {
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next month
          })
        };
        
        await subscriptionRef.set(updateData, { merge: true });
        
        // Update user status based on subscription
        const userId = subscription.external_reference || subscriptionData.userId;
        if (userId) {
          await updateUserPremiumStatus(userId, subscription.status, subscriptionId);
        }
        
      } catch (error) {
        console.error('Error handling subscription update:', error);
      }
    }
    
    async function handleSubscriptionPayment(paymentId) {
      try {
        // Get payment details
        const paymentInfo = await payment.get({ id: paymentId });
        console.log('Payment info:', { 
          id: paymentId, 
          status: paymentInfo.status,
          subscriptionId: paymentInfo.metadata?.subscription_id,
          payer: paymentInfo.payer
        });
        
        if (paymentInfo.status === 'approved') {
          // Save payment record
          const paymentRef = db.collection('subscription_payments').doc(paymentId.toString());
          await paymentRef.set({
            paymentId,
            subscriptionId: paymentInfo.metadata?.subscription_id,
            amount: paymentInfo.transaction_amount,
            status: paymentInfo.status,
            payerEmail: paymentInfo.payer?.email,
            paymentDate: admin.firestore.FieldValue.serverTimestamp(),
            metadata: paymentInfo.metadata || {}
          });
          
          // Update subscription's next billing date
          if (paymentInfo.metadata?.subscription_id) {
            const subscriptionRef = db.collection('subscriptions').doc(paymentInfo.metadata.subscription_id);
            await subscriptionRef.update({
              lastPayment: paymentId,
              lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
              nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next month
              status: 'authorized'
            });
            
            // Get subscription to update user status
            const subscription = await subscriptionRef.get();
            const subscriptionData = subscription.data();
            if (subscriptionData?.userId) {
              await updateUserPremiumStatus(subscriptionData.userId, 'authorized', paymentInfo.metadata.subscription_id);
            }
          }
        }
      } catch (error) {
        console.error('Error handling subscription payment:', error);
      }
    }
    
    async function updateUserPremiumStatus(userId, status, subscriptionId) {
      try {
        const userRef = db.collection('usuarios').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data() || {};
        
        const userUpdate = {
          premiumStatus: status,
          subscriptionId: subscriptionId,
          lastSubscriptionUpdate: admin.firestore.FieldValue.serverTimestamp()
        };

        const now = new Date();
        
        switch (status) {
          case 'authorized':
            // For new authorizations or re-activations
            userUpdate.isPremium = true;
            userUpdate.premiumActivatedAt = userData.premiumActivatedAt || admin.firestore.FieldValue.serverTimestamp();
            userUpdate.premiumExpiresAt = null; // Clear any expiration
            userUpdate.lastPaymentDate = admin.firestore.FieldValue.serverTimestamp();
            userUpdate.nextBillingDate = new Date(now.setMonth(now.getMonth() + 1)); // Next month
            break;
            
          case 'cancelled':
          case 'paused':
            // User cancelled or payment failed - keep premium until period ends
            userUpdate.isPremium = true; // Keep premium active until period ends
            userUpdate.premiumExpiresAt = userData.nextBillingDate || new Date(now.setMonth(now.getMonth() + 1));
            break;
            
          case 'pending':
          case 'in_mediation':
            // Payment issues - give grace period
            userUpdate.isPremium = true;
            userUpdate.premiumExpiresAt = new Date(now.setDate(now.getDate() + 7)); // 7-day grace period
            break;
            
          case 'rejected':
          case 'cancelled':
          case 'expired':
            // Subscription ended - revoke premium immediately
            userUpdate.isPremium = false;
            userUpdate.premiumExpiresAt = admin.firestore.FieldValue.serverTimestamp();
            break;
        }
        
        await userRef.update(userUpdate);
        console.log(`User ${userId} subscription status updated to ${status}`);
        
        // Log this status change for auditing
        await db.collection('subscription_logs').add({
          userId,
          subscriptionId,
          status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          previousStatus: userData.premiumStatus,
          action: 'status_update'
        });
        
      } catch (error) {
        console.error('Error updating user premium status:', error);
        throw error; // Re-throw to be caught by the main webhook handler
      }
    }
    
    // Sempre responder com 200 para o Mercado Pago
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).json({ received: true }); // Ainda responder 200 para evitar reenvios
  }
});

// Scheduled function to check and update expired subscriptions
const checkExpiredSubscriptions = async () => {
  try {
    const now = new Date();
    console.log('Checking for expired subscriptions...');
    
    // Find users whose premium access has expired
    const expiredUsers = await db.collection('usuarios')
      .where('isPremium', '==', true)
      .where('premiumExpiresAt', '<=', now)
      .get();

    const batch = db.batch();
    const updatePromises = [];

    expiredUsers.docs.forEach(doc => {
      const userRef = db.collection('usuarios').doc(doc.id);
      batch.update(userRef, {
        isPremium: false,
        premiumStatus: 'expired',
        lastSubscriptionUpdate: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Log the expiration
      updatePromises.push(
        db.collection('subscription_logs').add({
          userId: doc.id,
          subscriptionId: doc.data().subscriptionId,
          status: 'expired',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          previousStatus: doc.data().premiumStatus,
          action: 'auto_expire'
        })
      );
    });

    if (expiredUsers.size > 0) {
      await batch.commit();
      await Promise.all(updatePromises);
      console.log(`Updated ${expiredUsers.size} expired subscriptions`);
    }
    
    return { processed: expiredUsers.size };
  } catch (error) {
    console.error('Error checking expired subscriptions:', error);
    throw error;
  }
};

// Run the check every 24 hours
setInterval(checkExpiredSubscriptions, 24 * 60 * 60 * 1000);

// Gerar texto com IA (streaming)
app.post('/gerar-texto', async (req, res) => {
  try {
    const { projetoId, tipo, dadosProjeto, prompt } = req.body;
    
    if (!projetoId || !tipo || !dadosProjeto) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    // Verificar se o usuário tem acesso ao projeto
    const projetoRef = db.collection('projetos').doc(projetoId);
    const projetoDoc = await projetoRef.get();
    
    if (!projetoDoc.exists) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    // Construir o prompt específico para o tipo de texto
    let promptEspecifico = '';
    const tituloProjeto = dadosProjeto.nome || 'o projeto';
    
    switch(tipo) {
      case 'justificativa':
        promptEspecifico = `Crie uma justificativa para o projeto "${tituloProjeto}" que demonstre a importância e relevância cultural do projeto. `;
        break;
      case 'objetivos':
        promptEspecifico = `Descreva os objetivos do projeto "${tituloProjeto}" de forma clara e mensurável. `;
        break;
      case 'metodologia':
        promptEspecifico = `Descreva a metodologia que será utilizada no projeto "${tituloProjeto}", detalhando as etapas e processos. `;
        break;
      case 'resultados_esperados':
        promptEspecifico = `Liste os resultados esperados para o projeto "${tituloProjeto}", incluindo indicadores de sucesso. `;
        break;
      case 'cronograma':
        promptEspecifico = `Crie um cronograma detalhado para o projeto "${tituloProjeto}" com as principais atividades e prazos. `;
        break;
      default:
        return res.status(400).json({ error: 'Tipo de texto inválido' });
    }

    // Adicionar informações específicas do projeto ao prompt
    promptEspecifico += `\n\nInformações do projeto:\n`;
    
    // Adicionar campos relevantes do projeto ao prompt
    if (dadosProjeto.descricao) {
      promptEspecifico += `Descrição: ${dadosProjeto.descricao}\n`;
    }
    if (dadosProjeto.objetivos) {
      promptEspecifico += `Objetivos: ${dadosProjeto.objetivos}\n`;
    }
    if (dadosProjeto.metodologia) {
      promptEspecifico += `Metodologia: ${dadosProjeto.metodologia}\n`;
    }

    // Configurar headers para streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Função para enviar mensagem de streaming
    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      // @ts-ignore
      if (res.flush) res.flush();
    };

    // Chamar a API da OpenAI com streaming
    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { 
          role: 'system', 
          content: 'Você é um especialista em redação de projetos culturais para leis de incentivo. Gere textos claros, objetivos e bem estruturados.' 
        },
        { 
          role: 'user', 
          content: promptEspecifico 
        },
      ],
      stream: true,
      max_tokens: 1500,
      temperature: 0.7,
    });

    let fullText = '';
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullText += content;
        sendEvent({
          type: 'chunk',
          content: content,
          done: false
        });
      }
    }

    // Enviar evento de conclusão
    sendEvent({
      type: 'complete',
      content: '',
      done: true,
      fullText: fullText,
      tipo,
      projetoId,
      timestamp: new Date().toISOString()
    });

    // Fechar a conexão
    res.end();

  } catch (error) {
    console.error('Erro ao gerar texto:', error);
    
    // Se a resposta ainda não foi enviada, enviar erro
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Erro ao processar a solicitação',
        details: error.message 
      });
    } else {
      // Se já começamos a stream, enviar mensagem de erro
      res.write(`event: error\ndata: ${JSON.stringify({
        error: 'Erro ao gerar texto',
        details: error.message
      })}\n\n`);
      res.end();
    }
  }
});

// Endpoint para ativar premium manualmente (caso o webhook não encontre o usuário)
app.post('/activate-premium', async (req, res) => {
  try {
    const { userId, paymentId } = req.body;
    
    if (!userId || !paymentId) {
      return res.status(400).json({ error: 'userId and paymentId are required' });
    }
    
    // Verificar se o pagamento existe e foi aprovado
    const paymentDoc = await db.collection('pending_payments').doc(paymentId.toString()).get();
    
    if (!paymentDoc.exists) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const paymentData = paymentDoc.data();
    if (paymentData.status !== 'approved') {
      return res.status(400).json({ error: 'Payment not approved' });
    }
    
    if (paymentData.processed) {
      return res.status(400).json({ error: 'Payment already processed' });
    }
    
    // Atualizar usuário para premium
    await db.collection('usuarios').doc(userId).update({
      isPremium: true,
      premiumActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentId: paymentId
    });
    
    // Marcar pagamento como processado
    await paymentDoc.ref.update({
      processed: true,
      userId: userId
    });
    
    console.log(`User ${userId} manually upgraded to premium with payment ${paymentId}`);
    res.json({ success: true, message: 'Premium activated successfully' });
    
  } catch (error) {
    console.error('Activate premium error:', error);
    res.status(500).json({ error: 'Failed to activate premium' });
  }
});



// Export the Express app as a Cloud Function
exports.analisarProjeto = app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}
