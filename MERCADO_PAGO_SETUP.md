# 🔧 Configuração do Mercado Pago - Credenciais de Teste

## ⚠️ ERRO COMUM: Mistura de Ambiente

O erro **"Uma das partes com as quais você está tentando efetuar o pagamento é de teste"** acontece quando você mistura credenciais de **PRODUÇÃO** com **TESTE**.

## ✅ Credenciais Corretas

### Para TESTE (Sandbox):
- **Access Token**: DEVE começar com `TEST-`
- **Public Key**: DEVE começar com `TEST-`
- Exemplo: `TEST-1234567890-123456-abcdef1234567890abcdef1234567890-123456789`

### Para PRODUÇÃO:
- **Access Token**: Começa com `APP_USR-`
- **Public Key**: Começa com `APP_USR-`
- Exemplo: `APP_USR-1234567890-123456-abcdef1234567890abcdef1234567890-123456789`

## 📋 Como Obter Credenciais de Teste

### Passo 1: Acesse o Painel do Mercado Pago
1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Faça login com sua conta do Mercado Pago

### Passo 2: Crie uma Aplicação de Teste
1. Clique em **"Criar aplicação"**
2. Preencha os dados:
   - Nome: `Oráculo Cultural - Teste`
   - Categoria: `E-commerce`
   - Descrição: `Aplicação de teste para Oráculo Cultural`
3. Clique em **"Criar"**

### Passo 3: Obtenha as Credenciais de Teste
1. Na página da aplicação, vá para a aba **"Credenciais de teste"**
2. Você verá:
   - **Public Key**: Começa com `TEST-...`
   - **Access Token**: Começa com `TEST-...` (clique em "Ver" para revelar)

### Passo 4: Configure no Firebase Functions

#### Opção A: Variável de Ambiente (Recomendado)
```bash
firebase functions:config:set mercadopago.token="TEST-seu-token-aqui"
```

#### Opção B: Arquivo .env (Desenvolvimento Local)
Crie um arquivo `.env` na pasta `functions/`:
```
MERCADO_PAGO_ACCESS_TOKEN=TEST-seu-token-aqui
```

#### Opção C: Cloud Functions Environment Variables
No Firebase Console:
1. Vá para **Functions** > **Configurações**
2. Adicione variável:
   - Nome: `MERCADO_PAGO_ACCESS_TOKEN`
   - Valor: `TEST-seu-token-aqui`

## 🧪 Como Testar

### 1. Use Cartões de Teste Oficiais

#### Mastercard (Aprovado):
- **Número**: `5031 4332 1540 6351`
- **CVV**: `123`
- **Validade**: `11/25`
- **Nome**: `APRO` (para pagamento aprovado)
- **CPF**: `12345678909`

#### Visa (Aprovado):
- **Número**: `4509 9535 6623 3704`
- **CVV**: `123`
- **Validade**: `11/25`
- **Nome**: `APRO`
- **CPF**: `12345678909`

#### Para Testar Recusa:
- **Nome**: `OTHE` (recusado por erro geral)
- **CPF**: `12345678909`

### 2. Criar Usuário de Teste (Comprador)

Se precisar criar um usuário de teste para simular o comprador:

```bash
curl -X POST \
  'https://api.mercadopago.com/users/test_user' \
  -H 'Authorization: Bearer TEST-seu-access-token' \
  -H 'Content-Type: application/json' \
  -d '{
    "site_id": "MLB"
  }'
```

Isso retornará um usuário de teste com email e senha que você pode usar.

### 3. Verificar Credenciais no Código

O código agora valida automaticamente se você está usando credenciais de teste ou produção. Verifique os logs:

```
[getMercadoPago] Usando credenciais de TESTE (sandbox)
```

ou

```
[getMercadoPago] Usando credenciais de PRODUÇÃO
```

## 🚨 Checklist de Validação

Antes de testar, confirme:

- [ ] Access Token começa com `TEST-`
- [ ] Public Key (se usar no frontend) começa com `TEST-`
- [ ] Está usando cartões de teste oficiais
- [ ] Não está misturando credenciais de produção e teste
- [ ] Webhook está configurado para receber notificações de teste

## 📝 Notas Importantes

1. **NUNCA** misture credenciais de teste com produção
2. **SEMPRE** use credenciais de teste (`TEST-`) durante desenvolvimento
3. **SOMENTE** use credenciais de produção (`APP_USR-`) em ambiente de produção
4. O endpoint da API é o mesmo (`https://api.mercadopago.com`), o ambiente é definido pela credencial

## 🔗 Links Úteis

- [Documentação de Testes - Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/testing)
- [Cartões de Teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-test/test-cards)
- [Criar Usuário de Teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-test/test-users)




