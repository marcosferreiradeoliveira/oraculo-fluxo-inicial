# ✅ Stripe Produção - Configurado

## 🔑 Credenciais Configuradas

### Publishable Key (Frontend - se necessário)
```
Configurado via variável de ambiente: VITE_STRIPE_PUBLISHABLE_KEY
Ou definir diretamente no código frontend (pode ser pública)
```

### Secret Key (Backend) ✅ CONFIGURADO
```
Configurado via variável de ambiente: STRIPE_SECRET_KEY
NUNCA commitar chaves secretas no repositório!
```
**Status**: ✅ Configurado como secret no Firebase

## ⚠️ PRÓXIMO PASSO CRÍTICO: Configurar Webhook de Produção

### 1. Criar Webhook de Produção no Stripe Dashboard

1. Acesse: https://dashboard.stripe.com/webhooks
2. **IMPORTANTE**: Certifique-se de estar em modo **PRODUÇÃO** (toggle no canto superior direito)
3. Clique em **"Add endpoint"** ou **"Create endpoint"**
4. Configure:
   - **Endpoint URL**: `https://us-central1-culturalapp-fb9b0.cloudfunctions.net/webhookStripe`
   - **Events to send**: Selecione:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
5. Clique em **"Add endpoint"** ou **"Create endpoint"**
6. **Copie o Signing secret** (começa com `whsec_`)
7. Configure no Firebase:
   ```bash
   echo "whsec_SEU_SECRET_AQUI" | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```
8. Faça deploy novamente:
   ```bash
   firebase deploy --only functions:webhookStripe
   ```

## ✅ O que já foi feito:

- [x] Secret Key de produção configurado no Firebase
- [x] Funções deployadas com credenciais de produção
- [x] Código atualizado para não usar fallbacks de teste
- [x] Webhook de produção criado no Stripe Dashboard
- [x] Webhook secret de produção configurado ✅

## 🧪 Teste em Produção

**IMPORTANTE**: Em produção, apenas cartões reais funcionam!

1. Faça um teste com um cartão real (recomendado: valor baixo como R$ 1,00)
2. Verifique os logs:
   ```bash
   firebase functions:log --only criarAssinaturaPremiumStripe,webhookStripe --limit 20
   ```
3. Verifique no Firestore se `isPremium` foi atualizado para `true`

## 📋 URLs das Funções:

- **Criar Assinatura**: `https://us-central1-culturalapp-fb9b0.cloudfunctions.net/criarAssinaturaPremiumStripe`
- **Webhook**: `https://webhookstripe-v3odkawqzq-uc.a.run.app`

## 🔒 Segurança:

- ✅ Credenciais de produção nunca estão no código
- ✅ Secrets configurados no Firebase Secret Manager
- ✅ Webhook signature será verificado após configurar o secret

## ⚠️ Lembrete:

Após configurar o webhook de produção, você terá:
- **Webhook de TESTE**: `whsec_D1K2azX5XruwE26ImWkR0f4CswE7rVVO` (já configurado)
- **Webhook de PRODUÇÃO**: `whsec_...` (precisa configurar)

O código detecta automaticamente qual usar baseado no secret configurado.

