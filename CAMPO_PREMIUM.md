# 📋 Campo Premium na Collection `usuarios`

## 🔑 Campo Principal

**Campo**: `isPremium`  
**Tipo**: `boolean`  
**Valores**: 
- `true` = Usuário é premium
- `false` = Usuário não é premium
- `undefined` ou não existe = Tratado como `false`

## 📝 Estrutura do Documento

```javascript
{
  // ... outros campos ...
  isPremium: true,  // ← Campo principal para verificar status premium
  premiumStatus: 'active',  // Status detalhado (opcional)
  premiumActivatedAt: Timestamp,  // Data de ativação (opcional)
  stripeCustomerId: 'cus_...',  // ID do cliente no Stripe (opcional)
  stripeSubscriptionId: 'sub_...',  // ID da assinatura no Stripe (opcional)
  lastPaymentDate: Timestamp  // Última data de pagamento (opcional)
}
```

## 🔍 Como é Verificado no Código

### Frontend (React/TypeScript):

```typescript
// Exemplo 1: DashboardHeader.tsx
const userDoc = await getDoc(userDocRef);
const userData = userDoc.data();
setIsPremium(userData.isPremium === true);  // Verificação estrita

// Exemplo 2: Conta.tsx
{userData?.isPremium ? 'Plano Premium' : 'Plano Gratuito'}

// Exemplo 3: Projeto.tsx
if (!isPremium) {
  navigate('/cadastro-premium');
}
```

### Backend (Firebase Functions):

```javascript
// Webhook Stripe atualiza o campo
await userRef.update({
  isPremium: true,
  premiumStatus: 'active',
  premiumActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
  stripeCustomerId: session.customer,
  stripeSubscriptionId: session.subscription,
  lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
});
```

## ✅ Verificação Recomendada

Sempre use verificação estrita (`=== true`) para evitar problemas com valores `undefined` ou `null`:

```typescript
// ✅ CORRETO
if (userData.isPremium === true) {
  // Usuário é premium
}

// ❌ EVITAR (pode dar falso positivo)
if (userData.isPremium) {
  // Pode ser true, mas também pode ser undefined/null
}
```

## 🔄 Campos Relacionados (Opcionais)

- `premiumStatus`: Status detalhado (`'active'`, `'canceled'`, `'pending'`)
- `premiumActivatedAt`: Timestamp de quando foi ativado
- `stripeCustomerId`: ID do cliente no Stripe
- `stripeSubscriptionId`: ID da assinatura no Stripe
- `lastPaymentDate`: Data do último pagamento

## 📍 Onde é Atualizado

1. **Webhook Stripe** (`webhookStripe`):
   - `checkout.session.completed` → `isPremium: true`
   - `customer.subscription.created` → `isPremium: true`
   - `customer.subscription.updated` → Atualiza conforme status
   - `customer.subscription.deleted` → `isPremium: false`

2. **Cadastro inicial** (`Cadastro.tsx`):
   - `isPremium: false` (novos usuários começam como não-premium)

## 🎯 Resumo

**Campo principal**: `isPremium` (boolean)  
**Verificação**: `userData.isPremium === true`  
**Valor padrão**: `false` (para novos usuários)




