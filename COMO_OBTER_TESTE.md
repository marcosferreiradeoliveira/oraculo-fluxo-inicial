# 🔍 Como Obter Credenciais de TESTE do Mercado Pago

## ⚠️ Problema Identificado

Você está vendo credenciais que começam com `APP_USR-`, que são credenciais de **PRODUÇÃO**.

Para testes, você precisa de credenciais que começam com `TEST-`.

---

## 📋 Passo a Passo Detalhado

### Passo 1: Acessar o Painel do Mercado Pago

1. Abra seu navegador
2. Acesse: **https://www.mercadopago.com.br/developers/panel/app**
3. Faça login com sua conta do Mercado Pago

### Passo 2: Criar uma Aplicação (se não tiver)

1. Clique no botão **"Criar aplicação"** (geralmente no canto superior direito ou no centro da página)
2. Preencha os dados:
   - **Nome da aplicação**: `Oráculo Cultural - Teste`
   - **Categoria**: Selecione `E-commerce` ou `Marketplace`
   - **Descrição**: `Aplicação de teste para Oráculo Cultural`
3. Clique em **"Criar"**

### Passo 3: Acessar Credenciais de TESTE

1. **Clique na aplicação** que você acabou de criar (ou em uma existente)
2. No menu lateral esquerdo, procure por:
   - **"Credenciais"** ou **"Credentials"**
   - **"Credenciais de teste"** ou **"Test credentials"**
3. **Clique em "Credenciais de teste"**

### Passo 4: Identificar as Credenciais Corretas

Na página de credenciais de teste, você verá **DUAS seções**:

#### ❌ Seção 1: "Credenciais de produção" (NÃO USE PARA TESTE)
- Public Key: `APP_USR-...` ← **IGNORE ESTA**
- Access Token: `APP_USR-...` ← **IGNORE ESTA**

#### ✅ Seção 2: "Credenciais de teste" (USE ESTA)
- Public Key: `TEST-...` ← **COPIE ESTA**
- Access Token: `TEST-...` ← **COPIE ESTA** (clique em "Ver" para revelar)

---

## 🔑 O Que Você Precisa Copiar

### Para Backend (Firebase Functions):
Você precisa do **Access Token** que:
- ✅ Começa com `TEST-`
- ✅ Tem formato: `TEST-1234567890-123456-abcdef1234567890abcdef1234567890-123456789`

**Exemplo de Access Token de teste:**
```
TEST-1234567890-123456-abcdef1234567890abcdef1234567890-123456789
```

### Para Frontend (se necessário no futuro):
Você precisaria do **Public Key** que:
- ✅ Começa com `TEST-`
- ✅ Tem formato: `TEST-12345678-1234-1234-1234-123456789012`

---

## 📸 Onde Encontrar (Visual)

No painel do Mercado Pago, a estrutura geralmente é assim:

```
┌─────────────────────────────────────┐
│  Minha Aplicação                    │
├─────────────────────────────────────┤
│                                     │
│  📁 Credenciais                     │
│     ├─ Credenciais de produção     │ ← NÃO USE
│     │   Public Key: APP_USR-...     │
│     │   Access Token: APP_USR-...   │
│     │                               │
│     └─ Credenciais de teste         │ ← USE ESTA!
│         Public Key: TEST-...         │
│         Access Token: TEST-...       │ ← COPIE ESTA
│                                     │
└─────────────────────────────────────┘
```

---

## ✅ Verificação Rápida

Antes de copiar, verifique:

- [ ] Estou na aba/seção **"Credenciais de teste"**?
- [ ] O Access Token começa com **`TEST-`**?
- [ ] NÃO está começando com **`APP_USR-`**?

Se todas as respostas forem SIM, você tem as credenciais corretas!

---

## 🔧 Após Obter o Token de Teste

Depois de copiar o Access Token que começa com `TEST-`, configure:

```bash
firebase functions:config:set mercadopago.token="TEST-seu-token-completo-aqui"
```

**⚠️ IMPORTANTE:** Substitua `TEST-seu-token-completo-aqui` pelo token REAL que você copiou!

---

## 🆘 Se Não Encontrar "Credenciais de teste"

Se você não ver a seção "Credenciais de teste":

1. **Verifique se está logado** na conta correta
2. **Verifique se criou uma aplicação** (não apenas uma conta)
3. **Tente criar uma nova aplicação** especificamente para testes
4. **Procure por "Sandbox"** ou "Ambiente de teste" no menu

---

## 📞 Ainda com Dúvidas?

Se você não conseguir encontrar as credenciais de teste:

1. Tire um print da tela do painel do Mercado Pago
2. Verifique se há um menu ou aba chamado:
   - "Test credentials"
   - "Credenciais de teste"
   - "Sandbox"
   - "Ambiente de desenvolvimento"

---

## 💡 Dica Final

**Lembre-se:**
- `APP_USR-` = PRODUÇÃO (não use para testes)
- `TEST-` = TESTE (use para testes)

Se você só vê credenciais começando com `APP_USR-`, você está olhando para as credenciais de PRODUÇÃO. Procure pela seção específica de "Credenciais de teste" ou "Test credentials".




