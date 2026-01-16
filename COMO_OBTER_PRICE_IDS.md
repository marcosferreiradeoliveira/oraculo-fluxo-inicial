# Como Obter Price IDs do Stripe

## Importante: Product ID vs Price ID

- **Product ID** (`prod_xxxxx`): Identifica o produto
- **Price ID** (`price_xxxxx`): Identifica o preço específico de um produto (necessário para assinaturas)

Para criar assinaturas recorrentes, você precisa dos **Price IDs**, não dos Product IDs.

## Passo a Passo para Obter Price IDs

### 1. Acesse o Stripe Dashboard
https://dashboard.stripe.com/products

### 2. Clique no Produto Desejado
- Clique no produto "Básico" ou "Essencial"

### 3. Encontre o Price ID
- Na página do produto, você verá uma seção "Pricing"
- Cada preço tem um ID que começa com `price_`
- Copie o Price ID do preço mensal (não anual)

### 4. Exemplo Visual
```
Produto: Plano Básico
├── Price ID: price_1234567890abcdef (Mensal - R$ 99,00)
└── Price ID: price_0987654321fedcba (Anual - R$ 990,00)
```

## Configuração no Firebase

Depois de obter os Price IDs, configure como secrets:

```bash
# Price ID do Plano Básico (mensal)
firebase functions:secrets:set STRIPE_PRICE_ID_BASICO
# Cole: price_xxxxx

# Price ID do Plano Essencial (mensal)
firebase functions:secrets:set STRIPE_PRICE_ID_ESSENCIAL
# Cole: price_yyyyy
```

## Alternativa: Criar Preços via API

Se preferir, posso criar um script para criar os preços automaticamente usando os Product IDs que você forneceu.

## Verificação

Após configurar, os logs mostrarão:
```
[criarAssinaturaPremiumStripe] Stripe Price ID: price_xxxxx
```

Se aparecer "não configurado (usando price_data)", significa que os Price IDs não foram encontrados e o sistema criará preços dinamicamente.




