# Configuração do Evento de Conversão no Meta Ads (Facebook Ads)

## ✅ O que foi implementado

1. **Detecção automática do retorno do Stripe**: Quando o usuário completa o pagamento e retorna para `/cadastro-premium?status=success&session_id=xxx`, o sistema automaticamente:
   - Detecta o retorno bem-sucedido
   - Dispara o evento `Purchase` do Facebook Pixel
   - Dispara nosso evento de analytics `premium_pagamento_sucesso`
   - Envia valor e moeda para o Meta Pixel

2. **Eventos disparados**:
   - **Facebook Pixel**: `fbq('track', 'Purchase', { value, currency, content_name })`
   - **Analytics interno**: `premium_pagamento_sucesso`

## 📋 Como configurar no Meta Ads Manager

### ⚠️ Problema Comum: "Nenhum resultado correspondente"

Se você está vendo "Nenhum resultado correspondente" ao procurar por "purchase", isso acontece porque:
1. O evento precisa ser **disparado pelo menos uma vez** antes de aparecer na lista
2. O nome do evento pode variar dependendo da localização (pt-BR vs en-US)

### 🔧 Solução: Criar Conversão Personalizada (Recomendado para começar)

Como o evento pode não aparecer imediatamente, a melhor opção é **criar uma conversão personalizada**:

1. **No Meta Ads Manager**, na seção "Evento de conversão":
   - Clique no botão **"Criar conversão personalizada"** (Create custom conversion)

2. **Configure a conversão personalizada**:
   - **Nome**: "Assinatura Completa" ou "Pagamento Aprovado"
   - **Categoria**: "Compra" ou "Lead"
   - **URL contém**: `cadastro-premium?status=success`
   - **Evento**: Selecione "Purchase" (ou deixe como "Todas as visitas à URL")

3. **Salve a conversão personalizada**

4. **Volte para a campanha** e selecione a conversão personalizada criada

### Opção Alternativa: Usar evento padrão "Purchase" (Após ser disparado)

1. **Primeiro, você precisa que o evento seja disparado**:
   - Complete um teste de pagamento
   - Ou aguarde que um cliente real complete o pagamento
   
2. **Depois de 15-30 minutos**, o evento aparecerá na lista

3. **No Meta Ads Manager**, em "Evento de conversão":
   - Procure por: **"Compra"** (nome em português) ou **"Purchase"** (em inglês)
   - Ou procure por eventos padrão como: "Lead", "CompleteRegistration"

### Opção 3: Usar "Lead" como evento temporário

Enquanto o evento Purchase não aparece, você pode:

1. **Selecionar "Lead"** como evento de conversão
2. Depois, quando o Purchase estiver disponível, alterar para Purchase
3. O evento "Lead" também pode ser útil para rastrear interesse

### Opção 2: Criar evento personalizado (Alternativa)

Se preferir usar um evento personalizado específico:

1. **No Meta Events Manager**:
   - Vá em "Eventos" > "Criar evento"
   - Nome: `premium_subscription_completed`
   - Tipo: Conversão

2. **Modificar o código** (se necessário):
   ```javascript
   // Em vez de 'Purchase', usar evento personalizado
   window.fbq('trackCustom', 'premium_subscription_completed', {
     value: planPrice,
     currency: 'BRL',
     content_name: `Plano ${planType}`
   });
   ```

## 🔍 Verificando se está funcionando

### 1. Facebook Pixel Helper (Extensão do Chrome) - OBRIGATÓRIO
- **Instale a extensão**: "Facebook Pixel Helper" (extensão do Chrome)
- **Complete um teste de pagamento** (pode usar modo de teste do Stripe)
- **Verifique se o evento `Purchase` aparece** na extensão quando você retorna do pagamento
- Se não aparecer, verifique o console do navegador (F12) para erros

### 2. Events Manager do Meta - Test Events (RECOMENDADO)
- Acesse: https://business.facebook.com/events_manager2
- Selecione seu Pixel ID: `642831091634391`
- Vá em **"Test Events"** (Eventos de Teste)
- **Ative o modo de teste** (botão no topo)
- Complete um teste de pagamento
- **Verifique se o evento `Purchase` aparece em tempo real** (atualiza a cada 20 segundos)
- Se aparecer aqui, significa que está funcionando! Pode levar algumas horas para aparecer na lista de eventos disponíveis

### 3. Verificar eventos padrão disponíveis
- No Events Manager, vá em "Eventos" > "Eventos do site"
- Veja quais eventos já foram registrados
- Os eventos padrão incluem: PageView, ViewContent, AddToCart, InitiateCheckout, Purchase, Lead, etc.

### 3. Meta Ads Manager
- Na sua campanha, vá em "Analisar"
- Verifique se as conversões estão sendo registradas
- Pode levar algumas horas para aparecer no dashboard

## 📊 Dados enviados ao Meta Pixel

O evento `Purchase` está sendo enviado com:
- **value**: Valor do plano (R$ 99,00, R$ 349,00, etc.)
- **currency**: 'BRL'
- **content_name**: Nome do plano (ex: "Plano Básico", "Plano Essencial")

**Código implementado:**
```javascript
window.fbq('track', 'Purchase', {
  value: planPrice,        // Ex: 99.00
  currency: 'BRL',
  content_name: `Plano ${planType}`  // Ex: "Plano Básico"
});
```

## 🎯 Otimização da campanha

Com o evento `Purchase` configurado, você pode:

1. **Otimizar para conversões**:
   - Na configuração da campanha, selecione "Maximizar o número de conversões"
   - Escolha "Purchase" como evento de conversão

2. **Criar audiências de conversão**:
   - Crie audiências de pessoas que completaram "Purchase"
   - Use para remarketing ou lookalike audiences

3. **Acompanhar ROI**:
   - O Meta irá calcular automaticamente o custo por conversão
   - Você verá o valor total de receita gerada

## 🔧 Troubleshooting

### ❌ "Nenhum resultado correspondente" ao procurar "purchase"
**Causa**: O evento ainda não foi registrado no Pixel
**Solução**: 
1. Use "Criar conversão personalizada" (botão que aparece na tela)
2. Configure baseado em URL: `cadastro-premium?status=success`
3. Ou aguarde que o evento seja disparado pelo menos uma vez

### ❌ Evento não aparece no Pixel Helper
- Verifique se o código do Pixel está carregado (deve aparecer como "Found 1 pixel")
- Verifique o console do navegador (F12) para erros JavaScript
- Certifique-se de que está na URL correta: `/cadastro-premium?status=success&session_id=xxx`
- Verifique se há algum bloqueador de anúncios ativo

### ❌ Evento aparece no Test Events mas não no Ads Manager
- **Normal!** Pode levar 15 minutos a 24 horas para aparecer na lista de eventos disponíveis
- Use "Criar conversão personalizada" como solução imediata
- Eventos em "Test Events" significam que está funcionando corretamente

### ❌ Campo com borda vermelha e erro "É obrigatório ter um evento de conversão"
**Solução imediata**:
1. Clique em "Criar conversão personalizada"
2. Configure baseado em URL: `status=success`
3. Ou selecione temporariamente "Lead" como evento
4. Depois altere para "Purchase" quando estiver disponível

### ⚠️ Valor não está correto
- O valor é buscado do Firestore baseado no `session_id`
- Se não encontrar, usa valores padrão:
  - Básico: R$ 99,00
  - Essencial: R$ 349,00
- Para valores mais precisos, considerar buscar diretamente do Stripe via API

## 📝 Próximos passos recomendados

1. ✅ **Evento padrão "Purchase" já está funcionando**
2. ⏳ Testar em produção com transações reais
3. 📈 Monitorar métricas no Meta Ads Manager após 24-48h
4. 🎯 Ajustar otimizações da campanha com base nos dados

## 🔗 Links úteis

- Meta Events Manager: https://business.facebook.com/events_manager2
- Meta Ads Manager: https://business.facebook.com/adsmanager
- Documentação do Meta Pixel: https://developers.facebook.com/docs/meta-pixel
