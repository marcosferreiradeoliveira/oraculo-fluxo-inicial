# 🔑 Credenciais do Mercado Pago

## Credenciais Configuradas

### Public Key (Frontend - se necessário)
```
APP_USR-927d2548-b22e-4be5-9811-1e9a13bec7b9
```

### Access Token (Backend)
```
APP_USR-783906941666085-010213-a7124ca4d6ae0e9ad0fb28935a13a1b4-2448199655
```

## ⚠️ Importante

- **Public Key**: Usada apenas se você implementar checkout embutido no frontend. Para o fluxo atual (redirect via `init_point`), não é necessária.
- **Access Token**: Usado no backend (Firebase Functions) para criar assinaturas e processar webhooks.

## 📝 Configuração no Firebase

### Via Firebase Console:
1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Selecione o projeto: `culturalapp-fb9b0`
3. Vá em **Functions** > **Configurações** > **Variáveis de ambiente**
4. Adicione/atualize:
   - `MERCADO_PAGO_ACCESS_TOKEN` = `APP_USR-783906941666085-010213-a7124ca4d6ae0e9ad0fb28935a13a1b4-2448199655`
   - `MERCADO_PAGO_TEST_MODE` = `true` (para modo sandbox/teste)

### Via CLI:
```bash
firebase functions:config:set mercado_pago.access_token="APP_USR-783906941666085-010213-a7124ca4d6ae0e9ad0fb28935a13a1b4-2448199655"
firebase functions:config:set mercado_pago.test_mode="true"
```

## 🔄 Após Configurar

1. Faça deploy das funções:
```bash
firebase deploy --only functions
```

2. Verifique os logs para confirmar que as credenciais estão sendo usadas:
```bash
firebase functions:log
```

## ✅ Verificação

Os logs devem mostrar:
- `[getMercadoPago] Token obtido de: variável de ambiente` (se configurado via Firebase)
- `[getMercadoPago] ✅ Usando credenciais de TESTE (formato APP_USR- em modo sandbox)`

## 🧪 Teste

Use os cartões de teste do Mercado Pago:
- **Visa**: 4509 9535 6623 3704
- **Mastercard**: 5031 4332 1540 6351
- **CVV**: 123
- **Validade**: Qualquer data futura




