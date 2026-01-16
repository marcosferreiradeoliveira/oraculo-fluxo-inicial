# 🚀 Migrar Stripe para Produção

## 📋 Checklist de Migração

### 1. Obter Credenciais de Produção no Stripe

1. Acesse: https://dashboard.stripe.com/apikeys
2. **Certifique-se de estar em modo PRODUÇÃO** (toggle no canto superior direito)
3. Copie as credenciais:
   - **Publishable key** (começa com `pk_live_`)
   - **Secret key** (começa com `sk_live_`)

### 2. Configurar Secrets de Produção no Firebase

```bash
# Atualizar Secret Key de produção
echo "sk_live_..." | firebase functions:secrets:set STRIPE_SECRET_KEY

# O webhook secret será gerado depois (passo 4)
```

### 3. Criar Webhook de Produção no Stripe Dashboard

1. Acesse: https://dashboard.stripe.com/webhooks
2. **Certifique-se de estar em modo PRODUÇÃO**
3. Clique em **"Add endpoint"**
4. Configure:
   - **Endpoint URL**: `https://us-central1-culturalapp-fb9b0.cloudfunctions.net/webhookStripe`
   - **Events to send**: Selecione os mesmos eventos:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
5. Clique em **"Add endpoint"**
6. Copie o **Signing secret** (começa com `whsec_`)
7. Configure no Firebase:
   ```bash
   echo "whsec_..." | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```

### 4. Atualizar Frontend (se necessário)

Se você quiser usar a Publishable Key de produção no frontend (para checkout embutido), atualize:

**Arquivo**: `src/pages/Conta.tsx` ou onde você usa a Publishable Key

```typescript
// Se estiver usando Stripe.js no frontend
const stripe = Stripe('pk_live_...'); // Publishable key de produção
```

**Nota**: Para o fluxo atual (redirect via Checkout Session), a Publishable Key não é necessária no frontend, apenas no backend.

### 5. Fazer Deploy das Funções

```bash
firebase deploy --only functions:criarAssinaturaPremiumStripe,webhookStripe
```

### 6. Testar em Produção

1. Use um cartão de teste real (não funcionará em produção)
2. Ou use um cartão real com valor baixo para teste
3. Verifique os logs:
   ```bash
   firebase functions:log --only criarAssinaturaPremiumStripe,webhookStripe --limit 20
   ```

## ⚠️ Importante

### Diferenças entre Teste e Produção:

- **Teste**: Credenciais começam com `pk_test_` e `sk_test_`
- **Produção**: Credenciais começam com `pk_live_` e `sk_live_`
- **Webhooks**: Cada ambiente (test/production) tem seu próprio webhook endpoint
- **Cartões**: Em produção, apenas cartões reais funcionam

### Segurança:

- ✅ Nunca commite credenciais de produção no código
- ✅ Use sempre secrets do Firebase para valores sensíveis
- ✅ Mantenha credenciais de teste e produção separadas
- ✅ Configure webhooks diferentes para teste e produção

## 🔄 Alternativa: Ambiente Híbrido

Se você quiser manter ambos os ambientes (teste e produção) funcionando:

1. Crie variáveis de ambiente para controlar o ambiente:
   ```bash
   firebase functions:config:set stripe.environment="production"
   ```

2. Atualize o código para detectar o ambiente:
   ```javascript
   const isProduction = process.env.STRIPE_ENVIRONMENT === 'production';
   const stripeKey = isProduction 
     ? stripeSecretKeyProduction.value()
     : stripeSecretKeyTest.value();
   ```

## 📝 Verificação Final

Após migrar, verifique:

- [ ] Secrets de produção configurados no Firebase
- [ ] Webhook de produção criado no Stripe Dashboard
- [ ] Webhook secret de produção configurado
- [ ] Funções deployadas com sucesso
- [ ] Teste realizado com cartão real (valor baixo)
- [ ] Webhook recebendo eventos corretamente
- [ ] `isPremium` sendo atualizado no Firestore

## 🆘 Troubleshooting

### Webhook não está recebendo eventos:
- Verifique se o webhook está em modo PRODUÇÃO no Stripe Dashboard
- Verifique os logs: `firebase functions:log --only webhookStripe`
- Teste o webhook manualmente no Stripe Dashboard

### Erro de signature:
- Verifique se o `STRIPE_WEBHOOK_SECRET` está correto
- Certifique-se de usar o secret do webhook de PRODUÇÃO, não de teste

### Pagamentos não estão sendo processados:
- Verifique se está usando `sk_live_` (produção) e não `sk_test_` (teste)
- Verifique os logs da função `criarAssinaturaPremiumStripe`




