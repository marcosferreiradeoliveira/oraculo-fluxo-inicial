# Chave OpenAI: local vs produção

- **Produção (deploy):** a chave vem do **Secret Manager** (Firebase/Google Cloud).
- **Local (emulador):** o emulador não injeta secrets; a chave é lida do **`.env`** na pasta `functions`.

Se você ver `401 Incorrect API key provided` **rodando local**, use a chave nova no `.env` (veja abaixo).  
Em produção, atualize o secret (passos nas opções 1 e 2).

## Opção 1: Firebase CLI

1. Gere uma nova API key em: https://platform.openai.com/account/api-keys  
2. Na pasta do projeto, defina o secret (substitua `sua-chave-nova` pela chave real):

```bash
cd functions
firebase functions:secrets:set OPENAI_API_KEY
# Quando solicitado, cole a chave (ex.: sk-proj-...)
```

3. Faça o deploy da função para que ela carregue o novo valor:

```bash
firebase deploy --only functions:avaliarProjetoIA
# ou deploy de todas: firebase deploy --only functions
```

## Opção 2: Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/) e selecione o projeto `culturalapp-fb9b0`.  
2. Menu **Security** > **Secret Manager**.  
3. Localize o secret **OPENAI_API_KEY** e clique nele.  
4. **New version** (Nova versão), cole a nova chave da OpenAI e salve.  
5. Faça o deploy das functions (para garantir que uma nova instância use o secret atualizado):

```bash
firebase deploy --only functions:avaliarProjetoIA
```

## Rodando local **sem emulador** (só .env)

Servidor mínimo que usa **apenas** `functions/.env` (não usa Firebase, não usa Secrets):

1. **`functions/.env`** – chave da OpenAI:
   ```bash
   OPENAI_API_KEY=sk-proj-sua-chave-aqui
   ```
2. **Raiz do projeto** – no `.env`, defina:
   ```bash
   VITE_FUNCTIONS_BASE_URL=http://127.0.0.1:5001
   ```
3. Em um terminal, suba o servidor local:
   ```bash
   cd functions && npm run avaliar-local
   ```
4. Em outro terminal, rode o app: `npm run dev`.

O script `server-avaliar-local.js` escuta na porta 5001 e responde no mesmo path que o frontend usa; a chave vem só do `functions/.env`.

## Rodando local com emulador (opcional)

Se preferir usar o emulador de Functions em vez do servidor acima: defina `VITE_FUNCTIONS_BASE_URL=http://127.0.0.1:5001/culturalapp-fb9b0/us-central1` e rode `cd functions && npm run serve`. O emulador também usa `functions/.env`.

Se **não** definir `VITE_FUNCTIONS_BASE_URL`, o app chama a função em **produção** (Secret Manager).

## Verificação

- **Local:** a chave vem de `functions/.env` (dotenv).  
- **Produção:** a chave vem do Secret Manager.  
- Depois de atualizar o secret e fazer deploy, a próxima chamada em produção usará a chave nova.
