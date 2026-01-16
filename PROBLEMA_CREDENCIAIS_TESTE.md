# 🚨 Problema: Credenciais de Teste Não Aparecem

## ⚠️ Situação Atual

Você está vendo:
- ✅ Aba "Teste" selecionada
- ❌ Mas credenciais mostram `APP_USR-` (PRODUÇÃO)

Isso significa que **a aplicação não tem credenciais de teste configuradas** ou há um problema na conta.

---

## ✅ Soluções (Tente nesta ordem)

### Solução 1: Criar Nova Aplicação de Teste

1. **No painel do Mercado Pago**, clique em **"Criar aplicação"** (não use a aplicação atual)
2. **Preencha:**
   - Nome: `Oráculo Cultural - Teste Sandbox`
   - Categoria: `E-commerce`
   - Descrição: `Aplicação exclusiva para testes`
3. **Clique em "Criar"**
4. **Acesse a nova aplicação**
5. **Vá em "Credenciais"**
6. **Selecione aba "Teste"**
7. **Agora deve mostrar credenciais começando com `TEST-`**

---

### Solução 2: Verificar Tipo de Conta

Algumas contas do Mercado Pago podem ter limitações. Verifique:

1. **Acesse:** https://www.mercadopago.com.br/developers/panel
2. **Verifique se sua conta está verificada**
3. **Veja se há alguma mensagem sobre "Sandbox" ou "Ambiente de teste"**

---

### Solução 3: Usar Conta de Teste Separada

Se nada funcionar, você pode:

1. **Criar uma conta de teste separada** no Mercado Pago
2. **Usar essa conta apenas para desenvolvimento**
3. **Obter credenciais de teste dessa conta**

---

### Solução 4: Contatar Suporte do Mercado Pago

Se nenhuma solução funcionar:

1. **Acesse:** https://www.mercadopago.com.br/developers/support
2. **Explique:** "Não consigo ver credenciais de teste (TEST-), apenas vejo credenciais de produção (APP_USR-) mesmo com aba Teste selecionada"
3. **Peça ajuda** para habilitar credenciais de teste na sua aplicação

---

## 🔍 Verificação Alternativa

### Tentar Gerar Credenciais de Teste via API

Se o painel não mostrar, você pode tentar gerar via API (requer credenciais de produção primeiro):

```bash
# Isso requer que você tenha credenciais de produção funcionando
# E que sua conta tenha permissão para criar credenciais de teste
```

**Nota:** Isso geralmente não é necessário, mas pode ser uma alternativa.

---

## 💡 O Que Deve Aparecer

Quando funcionar corretamente, na aba **"Teste"** você deve ver:

```
Public Key: TEST-12345678-1234-1234-1234-123456789012
Access Token: TEST-1234567890-123456-abcdef1234567890abcdef1234567890-123456789
```

**Ambos devem começar com `TEST-`**, não `APP_USR-`.

---

## 🎯 Próximos Passos Recomendados

1. **Tente criar uma NOVA aplicação** (Solução 1)
2. **Se não funcionar**, verifique o tipo de conta (Solução 2)
3. **Se ainda não funcionar**, contate suporte (Solução 4)

---

## ⚠️ Importante

**NÃO use credenciais que começam com `APP_USR-` para testes!**

Mesmo que apareçam na aba "Teste", se começam com `APP_USR-`, são credenciais de produção e causarão o erro que você está vendo.

---

## 📞 Precisa de Ajuda?

Se após tentar todas as soluções você ainda não conseguir ver credenciais começando com `TEST-`, pode ser necessário:

1. Verificar se sua conta do Mercado Pago tem permissões de desenvolvedor completas
2. Verificar se há alguma restrição na conta
3. Contatar suporte do Mercado Pago para habilitar ambiente de teste




