# 📋 Como Ver Logs do Firebase Functions

## 🔍 Comandos Corretos

### Ver todos os logs recentes:
```bash
firebase functions:log
```

### Ver logs de uma função específica:
```bash
firebase functions:log --only webhookMercadoPago
```

ou

```bash
firebase functions:log --only criarCheckoutPremium
```

### Ver logs de múltiplas funções:
```bash
firebase functions:log --only criarCheckoutPremium,webhookMercadoPago
```

### Filtrar logs com grep (se necessário):
```bash
firebase functions:log | grep webhookMercadoPago
```

---

## 📝 O Que Procurar nos Logs

### Após criar checkout:
- `[criarCheckoutPremium] ✅ Instância do Mercado Pago criada com sucesso`
- `[criarCheckoutPremium] Preference created successfully`
- `[getMercadoPago] ✅ Usando credenciais de TESTE`

### Após pagamento (webhook):
- `[webhookMercadoPago] Webhook received`
- `[webhookMercadoPago] Payment info`
- `[webhookMercadoPago] User [userId] premium status updated to authorized`

---

## ⚠️ Nota

O comando `firebase functions:log` **não aceita** a opção `--limit`. 
Use os comandos acima sem essa opção.




