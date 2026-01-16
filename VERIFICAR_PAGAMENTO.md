# 🔍 Como Verificar e Corrigir Status Premium

## ⚠️ Problema

O pagamento foi aprovado, mas `isPremium` não foi atualizado para `true`.

## 🔍 Passo 1: Verificar Logs do Webhook

Execute:
```bash
firebase functions:log --only webhookMercadoPago
```

Procure por:
- `[webhookMercadoPago] Payment info:` - Informações do pagamento
- `[webhookMercadoPago] ✅ User [userId] premium status updated` - Confirmação de atualização
- `[webhookMercadoPago] Parsed:` - Dados parseados do webhook

## 🔧 Passo 2: Verificar Pagamento Manualmente

Se o webhook não processou, você pode verificar e atualizar manualmente:

### Opção A: Usar Script Node

1. Obtenha o **Payment ID** do pagamento aprovado (pode estar nos logs ou no painel do Mercado Pago)
2. Execute:
```bash
cd functions
node verificarPagamento.js <payment_id> <user_id>
```

Exemplo:
```bash
node verificarPagamento.js 1234567890 abc123def456
```

### Opção B: Verificar no Painel do Mercado Pago

1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Vá em "Notificações" ou "Webhooks"
3. Encontre o pagamento aprovado
4. Anote o **Payment ID** e o **external_reference** (que é o userId)

## 🔧 Passo 3: Atualizar Manualmente no Firestore

Se necessário, você pode atualizar manualmente:

1. Acesse: https://console.firebase.google.com/project/culturalapp-fb9b0/firestore
2. Vá para a coleção `usuarios`
3. Encontre o documento do usuário (pelo userId)
4. Edite e adicione/atualize:
   - `isPremium: true`
   - `premiumStatus: "authorized"`
   - `lastPaymentDate: [timestamp atual]`
   - `paymentId: [id do pagamento]`

## 🔍 Passo 4: Verificar External Reference

O `external_reference` na preferência deve ser o `userId`. Verifique:

1. Nos logs de `criarCheckoutPremium`, procure por:
   - `external_reference: userId`
2. No webhook, procure por:
   - `external_reference: [deve ser o userId]`

Se não corresponder, o webhook não consegue identificar qual usuário atualizar.

## 🚀 Solução Rápida

Se você souber o **Payment ID** do pagamento aprovado:

1. Execute o script:
```bash
cd functions
node verificarPagamento.js <payment_id>
```

O script vai:
- Buscar informações do pagamento
- Verificar se está aprovado
- Atualizar o usuário automaticamente

## 📋 Checklist

- [ ] Verificou logs do webhook
- [ ] Verificou se o webhook foi chamado
- [ ] Verificou se `external_reference` está correto
- [ ] Tentou atualizar manualmente com o script
- [ ] Verificou se o pagamento está realmente aprovado no Mercado Pago




