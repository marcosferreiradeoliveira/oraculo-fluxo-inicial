# Como Corrigir planType e premiumStatus

## Problema Identificado

O registro do usuário está faltando o campo `planType` e o `premiumStatus` está como "incomplete" ao invés de "active".

## Solução Automática (via Webhook)

O webhook foi atualizado para:
1. Sempre salvar o `planType` dos metadados
2. Buscar o `planType` da assinatura se não estiver nos metadados da sessão
3. Só definir `premiumStatus: 'active'` quando o pagamento for bem-sucedido

## Correção Manual (se necessário)

Para corrigir o registro atual do usuário, você pode:

### Opção 1: Via Firebase Console
1. Acesse o Firestore
2. Encontre o documento do usuário (`7PKDCNjg3VUQhdXerDagVjr7yqV2`)
3. Adicione o campo `planType` com valor `'premium'`
4. Altere `premiumStatus` de `'incomplete'` para `'active'`

### Opção 2: Via Script Node.js

```javascript
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

async function corrigirUsuario(userId, planType) {
  const userRef = db.collection('usuarios').doc(userId);
  
  await userRef.update({
    planType: planType,
    premiumStatus: 'active',
    isPremium: true
  });
  
  console.log(`✅ Usuário ${userId} atualizado com planType: ${planType}`);
}

// Para o usuário específico
corrigirUsuario('7PKDCNjg3VUQhdXerDagVjr7yqV2', 'premium');
```

### Opção 3: Buscar do Stripe

Se você quiser buscar automaticamente do Stripe:

```javascript
const stripe = require('stripe')('sk_live_...'); // Sua chave secreta

async function buscarPlanTypeDoStripe(subscriptionId) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return subscription.metadata?.planType || null;
}

// Para a assinatura específica
const planType = await buscarPlanTypeDoStripe('sub_1SlG2f0mRGa1jLimxu6aMrRB');
console.log('PlanType:', planType);
```

## Verificação

Após a correção, o documento deve ter:
- ✅ `planType: 'premium'` (ou 'basico'/'essencial' conforme o plano)
- ✅ `premiumStatus: 'active'`
- ✅ `isPremium: true`

## Próximos Pagamentos

Para pagamentos futuros, o webhook atualizado já vai salvar corretamente o `planType` e o `premiumStatus`.




