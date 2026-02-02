# 🔷 Configuração do Stripe

## Credenciais Configuradas

### Publishable Key (Frontend)
```
Configurado via variável de ambiente: VITE_STRIPE_PUBLISHABLE_KEY
Ou definir diretamente no código frontend (pode ser pública)
```

### Secret Key (Backend)
```
Configurado via variável de ambiente: STRIPE_SECRET_KEY
NUNCA commitar chaves secretas no repositório!
```

## ✅ O que foi implementado:

1. **SDK do Stripe instalado** no `functions/package.json`
2. **Função `criarAssinaturaPremiumStripe`** criada para gerar checkout sessions
3. **Secret `STRIPE_SECRET_KEY`** configurado no Firebase
4. **Frontend atualizado** para usar Stripe em vez de Mercado Pago
5. **Webhook `webhookStripe`** criado para processar eventos de pagamento

## 📝 Próximos passos:

### 1. Fazer deploy das funções:
```bash
firebase deploy --only functions:criarAssinaturaPremiumStripe,webhookStripe
```

### 2. Configurar Webhook no Stripe Dashboard:

1. Acesse: https://dashboard.stripe.com/test/webhooks
2. Clique em **"Add endpoint"**
3. Configure:
   - **Endpoint URL**: `https://us-central1-culturalapp-fb9b0.cloudfunctions.net/webhookStripe`
   - **Events to send**: Selecione:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
4. Copie o **Signing secret** (começa com `whsec_`)
5. Configure como variável de ambiente:
   ```bash
   echo "whsec_..." | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```

### 3. Testar o fluxo:

1. Usuário clica em "Solicitar Conta Premium"
2. Sistema cria uma Checkout Session do Stripe
3. Usuário é redirecionado para o Stripe Checkout
4. Após pagamento, webhook atualiza `isPremium: true` no Firestore

## 🧪 Cartões de teste do Stripe:

- **Sucesso**: `4242 4242 4242 4242`
- **Requer autenticação**: `4000 0025 0000 3155`
- **CVV**: Qualquer 3 dígitos
- **Validade**: Qualquer data futura
- **CEP**: Qualquer 5 dígitos

## 📋 Estrutura de dados:

### Firestore - Collection `usuarios`:
```javascript
{
  isPremium: true,
  premiumStatus: 'active',
  premiumActivatedAt: Timestamp,
  stripeCustomerId: 'cus_...',
  stripeSubscriptionId: 'sub_...',
  lastPaymentDate: Timestamp
}
```

### Firestore - Collection `stripe_sessions`:
```javascript
{
  userId: '...',
  email: '...',
  status: 'pending',
  createdAt: Timestamp
}
```

## 🔄 Migração do Mercado Pago:

- A função `criarAssinaturaPremium` (Mercado Pago) ainda existe, mas não está sendo usada
- O frontend agora usa `criarAssinaturaPremiumStripe`
- Webhooks do Mercado Pago ainda funcionam para assinaturas antigas




