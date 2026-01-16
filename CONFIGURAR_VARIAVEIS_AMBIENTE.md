# 🔧 Configurar Variáveis de Ambiente - Firebase Functions v2

## ⚠️ Importante

Firebase Functions v2 **NÃO usa mais** `functions.config()`. Agora usa apenas variáveis de ambiente (`process.env`).

---

## 📋 Configurar Access Token do Mercado Pago

### Opção 1: Via Firebase Console (Recomendado)

1. Acesse: https://console.firebase.google.com/project/culturalapp-fb9b0/functions/config
2. Clique em **"Adicionar variável"**
3. Configure:
   - **Nome**: `MERCADO_PAGO_ACCESS_TOKEN`
   - **Valor**: `APP_USR-783906941666085-010213-a7124ca4d6ae0e9ad0fb28935a13a1b4-2448199655`
4. Clique em **"Salvar"**
5. Faça deploy: `firebase deploy --only functions:criarCheckoutPremium`

### Opção 2: Via Firebase CLI (Secrets)

Para valores sensíveis, use secrets:

```bash
# Definir secret
echo "APP_USR-783906941666085-010213-a7124ca4d6ae0e9ad0fb28935a13a1b4-2448199655" | firebase functions:secrets:set MERCADO_PAGO_ACCESS_TOKEN

# Fazer deploy (secrets são injetados automaticamente)
firebase deploy --only functions:criarCheckoutPremium
```

### Opção 3: Variável de Ambiente Local (Desenvolvimento)

Crie arquivo `.env` na pasta `functions/`:

```
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-783906941666085-010213-a7124ca4d6ae0e9ad0fb28935a13a1b4-2448199655
```

**Nota:** Adicione `.env` ao `.gitignore` para não commitar credenciais!

---

## ✅ Verificar Configuração

Após configurar, verifique os logs após fazer uma requisição:

```bash
firebase functions:log --only criarCheckoutPremium --limit 10
```

Procure por:
- `[getMercadoPago] Token obtido de: variável de ambiente` ← CORRETO
- `[getMercadoPago] Token obtido de: fallback (hardcoded)` ← Funciona, mas não é ideal

---

## 🔄 Outras Variáveis de Ambiente (se necessário)

Se você usar outras funcionalidades, configure também:

- `GMAIL_USER` - Email do Gmail para envio de emails
- `GMAIL_PASSWORD` - Senha do Gmail
- `BREVO_API_KEY` - Chave API do Brevo
- `OPENAI_API_KEY` - Chave API da OpenAI

---

## 📝 Notas

- Firebase Functions v2 usa apenas `process.env`
- Não use mais `firebase functions:config:set` (v1)
- Use Firebase Console ou secrets para valores sensíveis
- O código já tem fallback hardcoded para desenvolvimento local

