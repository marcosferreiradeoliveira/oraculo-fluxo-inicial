# 🚨 SOLUÇÃO RÁPIDA - Erro "Uma das partes é de teste"

## ⚠️ O Problema

Você está recebendo: **"Uma das partes com as quais você está tentando efetuar o pagamento é de teste"**

**Causa:** Você está usando credenciais de **PRODUÇÃO** (`APP_USR-...`) quando deveria usar credenciais de **TESTE** (`TEST-...`)

---

## ✅ SOLUÇÃO EM 5 MINUTOS

### Passo 1: Verificar o que está configurado AGORA

Execute no terminal:

```bash
cd functions
node verificar-credenciais.js
```

OU manualmente:

```bash
firebase functions:config:get mercadopago.token
```

**Se aparecer algo começando com `APP_USR-`, está ERRADO!**

---

### Passo 2: Obter Credenciais de TESTE

1. **Acesse:** https://www.mercadopago.com.br/developers/panel/app
2. **Faça login** com sua conta do Mercado Pago
3. **Clique em "Criar aplicação"** (ou use uma existente)
   - Nome: `Oráculo Cultural - Teste`
   - Categoria: `E-commerce`
4. **Clique na aplicação criada**
5. **No menu lateral, clique em "Credenciais de teste"**
6. **Você verá:**
   - Public Key: `TEST-...`
   - Access Token: `TEST-...` ← **CLIQUE EM "VER" PARA REVELAR**
7. **COPIE O ACCESS TOKEN COMPLETO** (deve começar com `TEST-`)

---

### Passo 3: Configurar no Firebase

Execute no terminal (substitua pelo token REAL que você copiou):

```bash
firebase functions:config:set mercadopago.token="TEST-seu-token-completo-aqui"
```

**⚠️ IMPORTANTE:** 
- Substitua `TEST-seu-token-completo-aqui` pelo token REAL
- O token deve começar com `TEST-`
- Use aspas duplas

**Exemplo:**
```bash
firebase functions:config:set mercadopago.token="TEST-1234567890-123456-abcdef1234567890abcdef1234567890-123456789"
```

---

### Passo 4: Verificar se Configurou Corretamente

```bash
firebase functions:config:get mercadopago.token
```

**Deve mostrar algo como:**
```json
{
  "mercadopago": {
    "token": "TEST-1234567890-123456-..."
  }
}
```

**✅ Se começar com `TEST-`, está CORRETO!**
**❌ Se começar com `APP_USR-`, está ERRADO!**

---

### Passo 5: Fazer Deploy

```bash
firebase deploy --only functions:criarCheckoutPremium
```

Aguarde o deploy terminar (pode levar 1-2 minutos).

---

### Passo 6: Verificar Logs

Após fazer o deploy, teste novamente e verifique os logs:

```bash
firebase functions:log --only criarCheckoutPremium --limit 20
```

**Procure por:**
- `[getMercadoPago] ✅ Usando credenciais de TESTE (sandbox)` ← DEVE aparecer isso!
- `[getMercadoPago] Token preview: TEST-...` ← DEVE começar com TEST-

---

### Passo 7: Testar Novamente

1. Acesse sua aplicação
2. Clique em "Solicitar Conta Premium"
3. Use cartão de teste:
   - **Número**: `5031 4332 1540 6351`
   - **CVV**: `123`
   - **Validade**: `11/25`
   - **Nome**: `APRO`
   - **CPF**: `12345678909`

**✅ Se funcionar, problema resolvido!**
**❌ Se ainda der erro, continue lendo...**

---

## 🔍 Verificação Adicional

Se ainda estiver com erro após seguir todos os passos:

### 1. Verificar se há múltiplas configurações

```bash
firebase functions:config:get
```

Procure por TODAS as referências a `mercadopago`. Pode haver configurações antigas.

### 2. Limpar e reconfigurar

```bash
# Remover configuração antiga (se houver)
firebase functions:config:unset mercadopago.token

# Configurar novamente com token de TESTE
firebase functions:config:set mercadopago.token="TEST-seu-token-aqui"

# Fazer deploy
firebase deploy --only functions:criarCheckoutPremium
```

### 3. Verificar variáveis de ambiente

Se você estiver usando variáveis de ambiente locais, verifique:

```bash
# No diretório functions/
cat .env | grep MERCADO_PAGO
```

Se houver uma variável `MERCADO_PAGO_ACCESS_TOKEN` com token de produção, remova ou atualize.

---

## 📋 Checklist Final

Antes de testar, confirme:

- [ ] Token obtido do painel do Mercado Pago
- [ ] Token começa com `TEST-` (não `APP_USR-`)
- [ ] Token configurado via `firebase functions:config:set`
- [ ] Verificação mostra token começando com `TEST-`
- [ ] Deploy feito com sucesso
- [ ] Logs mostram "Usando credenciais de TESTE"
- [ ] Testando com cartão de teste oficial

---

## 🆘 Ainda com Problemas?

Se NADA funcionar:

1. **Crie uma NOVA aplicação** no Mercado Pago
2. **Use um token COMPLETAMENTE NOVO** que começa com `TEST-`
3. **Limpe todas as configurações antigas:**
   ```bash
   firebase functions:config:unset mercadopago.token
   ```
4. **Configure novamente:**
   ```bash
   firebase functions:config:set mercadopago.token="TEST-novo-token-aqui"
   ```
5. **Faça deploy:**
   ```bash
   firebase deploy --only functions:criarCheckoutPremium
   ```

---

## 💡 Dica Final

O erro acontece porque o Mercado Pago detecta que você está:
- Usando credenciais de PRODUÇÃO (`APP_USR-`)
- Tentando pagar com cartão de TESTE

**A solução é simples:** Use credenciais de TESTE (`TEST-`) para testar com cartões de teste!




