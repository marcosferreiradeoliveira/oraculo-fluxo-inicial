require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI } = require("openai");
const mercadopago = require("mercadopago");

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const mp = new mercadopago.MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN });
const preference = new mercadopago.Preference(mp);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
          unit_price: 29.90,
          currency_id: "BRL"
        }
      ],
      back_urls: {
        success: `${req.protocol}://${req.get('host')}/success`,
        failure: `${req.protocol}://${req.get('host')}/failure`,
        pending: `${req.protocol}://${req.get('host')}/pending`
      },
      auto_return: "approved",
      notification_url: `${req.protocol}://${req.get('host')}/webhook`
    };

    const result = await preference.create({ body: preferenceData });
    res.json({ 
      checkoutUrl: result.init_point,
      preferenceId: result.id 
    });
  } catch (error) {
    console.error('Error creating checkout:', error);
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
