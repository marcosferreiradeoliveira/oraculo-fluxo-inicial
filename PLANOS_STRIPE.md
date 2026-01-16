# Configuração de Planos no Stripe

Este documento descreve os planos disponíveis e como eles são configurados no sistema.

## Planos Disponíveis

### 1. Plano Básico
- **Preço**: R$ 99,00/mês
- **Valor em centavos**: 9900
- **Tipo**: `basico`
- **Descrição**: Produtor Iniciante ou Individual
- **Características**:
  - 1 usuário
  - Até 3 projetos ativos/ano
  - Foco na Captação

### 2. Plano Essencial
- **Preço**: R$ 349,00/mês
- **Valor em centavos**: 34900
- **Tipo**: `essencial`
- **Descrição**: Produtora Pequena/Média
- **Características**:
  - 3-5 usuários
  - Até 10 projetos ativos/ano
  - Foco em Captação e Conformidade

### 3. Plano Premium Enterprise
- **Preço**: R$ 1,00/mês
- **Valor em centavos**: 100
- **Tipo**: `premium`
- **Descrição**: Agências e Produtoras Grandes
- **Características**:
  - Usuários Ilimitados
  - Projetos Ilimitados
  - Foco em Performance e Auditoria Rigorosa

## Como Funciona

### Backend (`functions/index.js`)

A função `criarAssinaturaPremiumStripe` recebe o parâmetro `planType` e cria o checkout com o preço correto:

```javascript
const { email, userId, planType } = req.body;

// Validação e definição de preço
if (planType === 'essencial') {
  unitAmount = 34900; // R$ 349,00
} else {
  unitAmount = 9900; // R$ 99,00 (padrão)
}
```

### Frontend (`src/pages/CadastroPremium.tsx`)

Quando o usuário seleciona um plano, o `planType` é enviado na requisição:

```javascript
body: JSON.stringify({
  userId: userData.userId,
  email: userData.email,
  planType: planType, // 'basico' ou 'essencial'
}),
```

### Webhook Stripe

O webhook salva o `planType` no Firestore quando a assinatura é criada ou atualizada:

```javascript
const planType = session.metadata?.planType || subscription.metadata?.planType || 'basico';

await userRef.update({
  isPremium: true,
  planType: planType, // Campo salvo no Firestore
  // ... outros campos
});
```

## Campo no Firestore

O campo `planType` é salvo na coleção `usuarios`:

- **Campo**: `planType`
- **Tipo**: `string`
- **Valores possíveis**: `'basico'` ou `'essencial'`
- **Default**: `'basico'` (se não especificado)

## Verificação do Plano

Para verificar qual plano um usuário tem:

```javascript
const userDoc = await getDoc(doc(db, 'usuarios', userId));
const userData = userDoc.data();
const planType = userData.planType || 'basico';

if (planType === 'essencial') {
  // Lógica para plano essencial
} else {
  // Lógica para plano básico
}
```

## Price IDs Configurados

Os Price IDs estão configurados diretamente no código:

- **Básico**: `price_1SlFPv0mRGa1jLimP7s0ry11` (R$ 99,00/mês)
- **Essencial**: `price_1SlFRL0mRGa1jLimzgQ0hNmU` (R$ 349,00/mês)
- **Premium**: `price_1SlFzC0mRGa1jLimlPql975q` (R$ 1,00/mês)

### Product IDs (para referência)

- **Básico**: `prod_TignB0SK0S1EUo`
- **Essencial**: `prod_TigoFGd2m1X3rx`
- **Premium**: Não configurado (Price ID usado diretamente)

### Personalização (Opcional)

Se quiser usar Price IDs diferentes via variáveis de ambiente:

```bash
# Configurar como secrets do Firebase
firebase functions:secrets:set STRIPE_PRICE_ID_BASICO
firebase functions:secrets:set STRIPE_PRICE_ID_ESSENCIAL
```

O sistema usa os Price IDs configurados diretamente no código como padrão, mas pode ser sobrescrito via variáveis de ambiente.

## Debug

O sistema adiciona logs para facilitar o debug:

```
[criarAssinaturaPremiumStripe] PlanType recebido: essencial
[criarAssinaturaPremiumStripe] PlanType normalizado: essencial
[criarAssinaturaPremiumStripe] Preço definido: 34900 centavos
[criarAssinaturaPremiumStripe] Stripe Price ID: price_xxxxx ou não configurado (usando price_data)
```

## Notas Importantes

1. **Preços podem ser definidos de duas formas**:
   - **Price IDs do Stripe**: Se configurados via `STRIPE_PRICE_ID_BASICO` e `STRIPE_PRICE_ID_ESSENCIAL`, o sistema usa os preços já criados no Stripe Dashboard
   - **Preços dinâmicos**: Se não configurados, o sistema cria preços dinamicamente usando `price_data`

2. **Normalização de planType**: O sistema normaliza o `planType` removendo acentos e convertendo para lowercase, então `'básico'`, `'basico'`, `'Básico'` são todos tratados como `'basico'`.

3. **Metadados**: O `planType` normalizado é salvo tanto nos metadados da sessão quanto nos metadados da assinatura para garantir rastreabilidade.

4. **Fallback**: Se o `planType` não for especificado, o sistema assume `'basico'` como padrão.

5. **Webhook**: O webhook sempre tenta obter o `planType` dos metadados da sessão ou da assinatura, garantindo que o campo seja salvo mesmo em eventos subsequentes.

