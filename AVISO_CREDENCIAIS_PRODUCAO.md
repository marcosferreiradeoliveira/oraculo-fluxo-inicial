# ⚠️ AVISO: Usando Credenciais de PRODUÇÃO

## 🔴 Situação Atual

Você está usando credenciais de **PRODUÇÃO** (`APP_USR-...`) em vez de credenciais de **TESTE** (`TEST-...`).

**Credenciais configuradas:**
- Public Key: `APP_USR-927d2548-b22e-4be5-9811-1e9a13bec7b9`
- Access Token: `APP_USR-783906941666085-010213-a7124ca4d6ae0e9ad0fb28935a13a1b4-244819965`

---

## ⚠️ Limitações Importantes

### ❌ O Que NÃO Funciona com Credenciais de Produção:

1. **Cartões de teste não funcionam**
   - Você NÃO pode usar cartões como `5031 4332 1540 6351`
   - Esses cartões só funcionam com credenciais `TEST-`

2. **Erro esperado:**
   ```
   "Uma das partes com as quais você está tentando efetuar o pagamento é de teste"
   ```

3. **Pagamentos reais serão processados**
   - Qualquer pagamento será REAL e cobrado de verdade
   - Cuidado ao testar!

---

## ✅ O Que Funciona com Credenciais de Produção:

### Opção 1: Usar Cartões Reais (NÃO RECOMENDADO PARA TESTES)

Você pode usar cartões reais, mas:
- ⚠️ Serão cobrados de verdade
- ⚠️ Dinheiro real será movimentado
- ⚠️ Não é ideal para desenvolvimento

### Opção 2: Criar Usuários de Teste via API

Você pode criar usuários de teste mesmo com credenciais de produção:

```bash
curl -X POST \
  'https://api.mercadopago.com/users/test_user' \
  -H 'Authorization: Bearer APP_USR-783906941666085-010213-a7124ca4d6ae0e9ad0fb28935a13a1b4-244819965' \
  -H 'Content-Type: application/json' \
  -d '{
    "site_id": "MLB"
  }'
```

Isso retornará um usuário de teste que você pode usar.

---

## 🎯 Recomendação

**O ideal é obter credenciais de TESTE (`TEST-...`)** para desenvolvimento.

Mas se você realmente não conseguir, pode:

1. **Configurar essas credenciais de produção** (já feito)
2. **Usar cartões reais** para testes (com cuidado!)
3. **Ou criar usuários de teste** via API

---

## 📋 Próximos Passos

### Para Configurar no Firebase:

```bash
firebase functions:config:set mercadopago.token="APP_USR-783906941666085-010213-a7124ca4d6ae0e9ad0fb28935a13a1b4-244819965"
```

### Para Fazer Deploy:

```bash
firebase deploy --only functions:criarCheckoutPremium
```

---

## ⚠️ ATENÇÃO

- **NÃO use cartões de teste** com essas credenciais
- **Qualquer pagamento será REAL**
- **Teste com cuidado** ou use valores muito baixos
- **Idealmente, obtenha credenciais de TESTE** quando possível

---

## 🔄 Como Mudar para Credenciais de Teste no Futuro

Quando conseguir credenciais de teste (`TEST-...`):

```bash
firebase functions:config:set mercadopago.token="TEST-seu-token-de-teste-aqui"
firebase deploy --only functions:criarCheckoutPremium
```




