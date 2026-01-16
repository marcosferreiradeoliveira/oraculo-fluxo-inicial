# 🔧 Remover Variável de Ambiente Conflitante

## ⚠️ Problema

O erro indica que há uma **variável de ambiente** (não-secret) chamada `MERCADO_PAGO_ACCESS_TOKEN` configurada no Firebase Console que está conflitando com o **secret** que acabamos de criar.

Firebase não permite que uma variável de ambiente e um secret tenham o mesmo nome.

## ✅ Solução: Remover Variável de Ambiente

### Opção 1: Via Firebase Console (Recomendado)

1. Acesse: https://console.firebase.google.com/project/culturalapp-fb9b0/functions/config
2. Procure por `MERCADO_PAGO_ACCESS_TOKEN` na seção **"Variáveis de ambiente"** (não em "Secrets")
3. Clique no ícone de **lixeira** ao lado da variável
4. Clique em **"Salvar"**
5. Aguarde alguns segundos para a atualização

### Opção 2: Via Firebase CLI

```bash
# Listar variáveis de ambiente configuradas
firebase functions:config:get

# Se encontrar mercado_pago.access_token, remova:
firebase functions:config:unset mercado_pago.access_token

# Para Firebase Functions v2, pode estar em outro lugar
# Verifique no console: Functions > Configurações > Variáveis de ambiente
```

## 🔄 Após Remover

Depois de remover a variável de ambiente conflitante, faça o deploy novamente:

```bash
firebase deploy --only functions:criarAssinaturaPremium
```

## ✅ Verificação

Após o deploy bem-sucedido, verifique os logs:

```bash
firebase functions:log --only criarAssinaturaPremium --limit 10
```

Procure por:
- `[getMercadoPago] Token obtido de: variável de ambiente` ← Confirma que está usando o secret

## 📝 Nota

- **Secrets** são mais seguros que variáveis de ambiente normais
- Secrets são criptografados e não aparecem em logs
- Use secrets para valores sensíveis como tokens de API




