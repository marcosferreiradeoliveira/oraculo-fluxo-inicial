# ✅ Configurar Credenciais de Teste do Mercado Pago

## 📋 Credenciais Configuradas

Você informou que o Mercado Pago confirma que estas são credenciais de **TESTE**:

- **Public Key**: `APP_USR-927d2548-b22e-4be5-9811-1e9a13bec7b9`
- **Access Token**: `APP_USR-783906941666085-010213-a7124ca4d6ae0e9ad0fb28935a13a1b4-244819965`

---

## 🔧 Configurar no Firebase

### Passo 1: Configurar o Access Token

Execute no terminal:

```bash
firebase functions:config:set mercadopago.token="APP_USR-783906941666085-010213-a7124ca4d6ae0e9ad0fb28935a13a1b4-244819965"
```

### Passo 2: Verificar se Configurou Corretamente

```bash
firebase functions:config:get mercadopago.token
```

Deve mostrar o token completo.

### Passo 3: Fazer Deploy

```bash
firebase deploy --only functions:criarCheckoutPremium
```

---

## 🧪 Como Testar

### Cartões de Teste que Funcionam:

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

---

## ✅ Verificação

Após fazer o deploy e testar, verifique os logs:

```bash
firebase functions:log --only criarCheckoutPremium --limit 20
```

Procure por:
- `[getMercadoPago] ✅ Usando credenciais de TESTE (formato APP_USR- em modo sandbox)`
- `[criarCheckoutPremium] ✅ Instância do Mercado Pago criada com sucesso`

---

## 🎯 Próximos Passos

1. ✅ Configure o token no Firebase (Passo 1)
2. ✅ Verifique a configuração (Passo 2)
3. ✅ Faça o deploy (Passo 3)
4. ✅ Teste com cartões de teste (seção acima)
5. ✅ Verifique os logs (seção Verificação)

---

## 📝 Notas

- O código foi ajustado para aceitar credenciais de teste que começam com `APP_USR-`
- O Mercado Pago determina se são de teste pelo contexto da aplicação (sandbox)
- Cartões de teste devem funcionar normalmente agora




