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

// Create premium checkout endpoint
app.post('/criarCheckoutPremium', async (req, res) => {
  try {
    const preferenceData = {
      items: [
        {
          title: "Plano Premium - Oráculo Cultural",
          quantity: 1,
          unit_price: 1.00,
          currency_id: "BRL"
        }
      ],
      back_urls: {
        success: "https://culturalapp-fb9b0.web.app/",
        failure: "https://culturalapp-fb9b0.web.app/cadastro-premium",
        pending: "https://culturalapp-fb9b0.web.app/cadastro-premium"
      },
      auto_return: "approved",
      notification_url: "https://analisarprojeto-665760404958.us-central1.run.app/webhook"
    };

    const result = await preference.create({ body: preferenceData });
    res.json({ 
      init_point: result.init_point,
      preferenceId: result.id 
    });
  } catch (error) {
    console.error('Error creating checkout:', error);
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

// Webhook endpoint for Mercado Pago payment notifications
app.post('/webhook', async (req, res) => {
  try {
    const { type, data } = req.body;
    console.log('Webhook received:', { type, data });
    
    // Verificar se é uma notificação de pagamento
    if (type === 'payment') {
      const paymentId = data.id;
      
      // Buscar detalhes do pagamento
      const paymentInfo = await payment.get({ id: paymentId });
      console.log('Payment info:', { 
        id: paymentId, 
        status: paymentInfo.status, 
        email: paymentInfo.payer?.email 
      });
      
      // Verificar se o pagamento foi aprovado
      if (paymentInfo.status === 'approved') {
        console.log('Payment approved:', paymentId);
        
        // Salvar informações do pagamento para posterior associação
        await db.collection('pending_payments').doc(paymentId.toString()).set({
          paymentId: paymentId,
          payerEmail: paymentInfo.payer?.email,
          status: 'approved',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          processed: false
        });
        
        // Extrair informações do pagamento
        const payerEmail = paymentInfo.payer?.email;
        
        if (payerEmail) {
          // Buscar usuário no Firebase pelo email
          const usersRef = db.collection('usuarios');
          const snapshot = await usersRef.where('email', '==', payerEmail).get();
          
          if (!snapshot.empty) {
            // Atualizar perfil para premium
            const userDoc = snapshot.docs[0];
            await userDoc.ref.update({ 
              isPremium: true,
              premiumActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
              paymentId: paymentId
            });
            
            // Marcar pagamento como processado
            await db.collection('pending_payments').doc(paymentId.toString()).update({
              processed: true,
              userId: userDoc.id
            });
            
            console.log(`User ${payerEmail} upgraded to premium`);
          } else {
            console.log(`User not found for email: ${payerEmail}. Payment saved for manual processing.`);
          }
        }
      }
    }
    
    // Sempre responder com 200 para o Mercado Pago
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).json({ received: true }); // Ainda responder 200 para evitar reenvios
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



// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
