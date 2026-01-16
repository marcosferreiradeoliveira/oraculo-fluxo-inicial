# 🔍 Como Verificar e Configurar Credenciais do Mercado Pago

## ⚠️ Problema Atual

Você está recebendo o erro: **"Uma das partes com as quais você está tentando efetuar o pagamento é de teste"**

Isso significa que ainda há credenciais de **PRODUÇÃO** (`APP_USR-...`) sendo usadas em vez de credenciais de **TESTE** (`TEST-...`).

## 🔍 Passo 1: Verificar Credenciais Atuais

### Opção A: Verificar nos Logs do Firebase

1. Acesse: https://console.firebase.google.com/project/culturalapp-fb9b0/functions/logs
2. Procure por logs que começam com `[getMercadoPago]`
3. Você verá algo como:
   - `✅ Usando credenciais de TESTE (sandbox)` ← CORRETO
   - `⚠️ Usando credenciais de PRODUÇÃO` ← ERRADO (precisa trocar)

### Opção B: Verificar Configuração Atual

Execute no terminal:

```bash
firebase functions:config:get
```

Procure por `mercadopago.token`. Se começar com `APP_USR-`, está errado!

## ✅ Passo 2: Obter Credenciais de Teste

### 1. Acesse o Painel do Mercado Pago
- URL: https://www.mercadopago.com.br/developers/panel/app
- Faça login com sua conta

### 2. Crie ou Acesse uma Aplicação
- Se já tem uma aplicação, clique nela
- Se não tem, clique em **"Criar aplicação"**

### 3. Vá para "Credenciais de teste"
- No menu lateral, clique em **"Credenciais de teste"**
- Você verá:
  - **Public Key**: `TEST-...`
  - **Access Token**: `TEST-...` (clique em "Ver" para revelar)

### 4. Copie o Access Token
- O token DEVE começar com `TEST-`
- Exemplo: `TEST-1234567890-123456-abcdef1234567890abcdef1234567890-123456789`

## 🔧 Passo 3: Configurar no Firebase

### Método Recomendado: Firebase Functions Config

```bash
firebase functions:config:set mercadopago.token="TEST-seu-token-completo-aqui"
```

**⚠️ IMPORTANTE:** Substitua `TEST-seu-token-completo-aqui` pelo token REAL que você copiou do painel!

### Verificar se foi configurado corretamente:

```bash
firebase functions:config:get mercadopago.token
```

Deve mostrar algo como: `TEST-1234567890-123456-...`

## 🚀 Passo 4: Fazer Deploy

Após configurar, faça deploy:

```bash
firebase deploy --only functions:criarCheckoutPremium
```

## 🧪 Passo 5: Testar Novamente

1. Acesse sua aplicação
2. Clique em "Solicitar Conta Premium"
3. Use cartão de teste:
   - **Número**: `5031 4332 1540 6351`
   - **CVV**: `123`
   - **Validade**: `11/25`
   - **Nome**: `APRO`
   - **CPF**: `12345678909`

## 🔍 Passo 6: Verificar Logs Após Deploy

Após fazer o deploy e testar, verifique os logs novamente:

```bash
firebase functions:log --only criarCheckoutPremium
```

Procure por:
- `[getMercadoPago] ✅ Usando credenciais de TESTE (sandbox)` ← Deve aparecer isso!

## ❌ Se Ainda Der Erro

### Verifique:

1. **Token configurado corretamente?**
   ```bash
   firebase functions:config:get mercadopago.token
   ```
   Deve começar com `TEST-`

2. **Deploy foi feito?**
   ```bash
   firebase deploy --only functions:criarCheckoutPremium
   ```

3. **Está usando a função correta?**
   - Verifique se está chamando: `criarCheckoutPremium`
   - Não está usando outra função antiga?

4. **Cache do navegador?**
   - Limpe o cache ou use aba anônima

## 📝 Checklist Final

- [ ] Access Token obtido do painel do Mercado Pago
- [ ] Token começa com `TEST-` (não `APP_USR-`)
- [ ] Token configurado via `firebase functions:config:set`
- [ ] Deploy feito com sucesso
- [ ] Logs mostram "Usando credenciais de TESTE"
- [ ] Testando com cartão de teste oficial

## 🆘 Ainda com Problemas?

Se ainda estiver com erro após seguir todos os passos:

1. Copie os logs completos do Firebase Functions
2. Verifique se o token realmente começa com `TEST-`
3. Tente criar uma nova aplicação de teste no Mercado Pago
4. Use um token completamente novo




