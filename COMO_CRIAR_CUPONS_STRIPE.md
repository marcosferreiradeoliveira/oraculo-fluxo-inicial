# Como Criar e Usar Cupons de Desconto no Stripe

## ✅ Cupons Habilitados

Os cupons de desconto já estão habilitados nos checkouts do Stripe. Os usuários podem inserir códigos promocionais diretamente na página de checkout.

## 📝 Como Criar um Cupom no Stripe Dashboard

### 1. Acesse o Stripe Dashboard
- Vá para: https://dashboard.stripe.com/products
- No menu lateral, clique em **"Products"** > **"Coupons"**
- Ou acesse diretamente: https://dashboard.stripe.com/coupons

### 2. Criar Novo Cupom
- Clique em **"Create coupon"**
- Preencha os campos:

#### Informações Básicas:
- **Name**: Nome do cupom (ex: "Desconto 20%", "Black Friday 2024")
- **ID**: Código único do cupom (ex: `DESCONTO20`, `BLACKFRIDAY2024`)
  - Use apenas letras maiúsculas, números e underscore
  - Este será o código que os usuários digitarão no checkout

#### Tipo de Desconto:
- **Amount off**: Desconto em valor fixo (ex: R$ 10,00)
- **Percentage off**: Desconto em percentual (ex: 20%)

#### Duração:
- **Once**: Aplicado apenas uma vez
- **Forever**: Aplicado em todas as cobranças recorrentes
- **Repeating**: Aplicado por X meses (ex: 3 meses)

#### Outras Configurações:
- **Duration in months**: Se escolher "Repeating", quantos meses o desconto será aplicado
- **Redeem by**: Data de expiração (opcional)
- **Max redemptions**: Número máximo de vezes que o cupom pode ser usado (opcional)
- **Applies to**: 
  - **All products**: Aplica a todos os produtos
  - **Specific products**: Aplica apenas a produtos específicos

### 3. Exemplo de Cupom

**Cupom de 20% de desconto para novos usuários:**
- **Name**: Desconto 20% Novos Usuários
- **ID**: `NOVOS20`
- **Type**: Percentage off
- **Amount**: 20
- **Duration**: Once
- **Redeem by**: 31/12/2025
- **Max redemptions**: 100

**Cupom de R$ 50,00 de desconto:**
- **Name**: Desconto R$ 50
- **ID**: `DESCONTO50`
- **Type**: Amount off
- **Amount**: 50.00
- **Currency**: BRL
- **Duration**: Once

## 🎯 Como os Usuários Usam o Cupom

1. O usuário seleciona um plano e clica em "Escolher Plano"
2. É redirecionado para o checkout do Stripe
3. Na página de checkout, há um campo **"Add promotion code"** ou **"Código promocional"**
4. O usuário digita o código do cupom (ex: `NOVOS20`)
5. O desconto é aplicado automaticamente
6. O valor final é atualizado com o desconto

## 📊 Verificar Uso dos Cupons

### No Stripe Dashboard:
1. Vá para **"Products"** > **"Coupons"**
2. Clique no cupom desejado
3. Veja estatísticas:
   - Total de vezes usado
   - Valor total descontado
   - Usuários que usaram o cupom

### Via API:
```javascript
// Buscar cupom
const coupon = await stripe.coupons.retrieve('NOVOS20');

// Listar todos os cupons
const coupons = await stripe.coupons.list({ limit: 100 });
```

## 🔧 Aplicar Cupom Programaticamente (Opcional)

Se quiser aplicar cupons automaticamente sem o usuário digitar, você pode passar o `discounts` na criação da sessão:

```javascript
const session = await stripeInstance.checkout.sessions.create({
  // ... outros parâmetros
  discounts: [{
    coupon: 'NOVOS20' // ID do cupom
  }]
});
```

## ⚠️ Importante

- **Cupons para assinaturas**: Se usar `Duration: Forever` ou `Repeating`, o desconto será aplicado em todas as cobranças recorrentes
- **Cupons para pagamentos únicos**: Use `Duration: Once` para guias especiais
- **Validação**: O Stripe valida automaticamente se o cupom está válido, expirado ou já foi usado o máximo de vezes
- **Testes**: Crie cupons de teste no modo de teste do Stripe para validar antes de usar em produção

## 📚 Documentação Oficial

- Criar cupons: https://stripe.com/docs/api/coupons/create
- Aplicar cupons no checkout: https://stripe.com/docs/payments/checkout/discounts
- Gerenciar cupons: https://dashboard.stripe.com/coupons
