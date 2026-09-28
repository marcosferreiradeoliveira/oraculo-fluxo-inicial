# Configurar secret Gemini (produção)

```bash
firebase use oraculo-is
firebase functions:secrets:set GEMINI_API_KEY
```

## Local

**Não** coloque `GEMINI_API_KEY` em `functions/.env` — no deploy o Firebase publica `.env` como variável comum e isso conflita com o Secret (`defineSecret`).

Use:

```
# functions/.secret.local
GEMINI_API_KEY=sua-chave
```

## Deploy só das functions de IA (não apaga as outras)

```bash
firebase deploy --only \
functions:avaliarProjetoIA,\
functions:gerarTexto,\
functions:alterarTextoComIA,\
functions:gerarTextosProjeto,\
functions:gerarCronogramaIA,\
functions:preencherAnexoPDF
```

Se aparecer a pergunta de deletar functions antigas (Omie/Stripe/etc.), responda **No**.
