# Dois projetos Firebase, um repositório

| Branch Git     | Projeto Firebase   | Arquivo Vite        | Deploy Hosting (padrão)   |
|----------------|--------------------|---------------------|---------------------------|
| `Oraculo-IS`   | `oraculo-is`       | `.env.oraculo-is`   | `firebase use oraculo-is` |
| `oraculo-roxo` | `culturalapp-fb9b0`| `.env.culturalapp`  | `firebase use culturalapp-fb9b0` |
| `main`         | `culturalapp-fb9b0`| `.env.culturalapp`  | idem                      |

## Comandos

```bash
# Dev: escolhe o mode pela branch atual
npm run dev

# Forçar um projeto (qualquer branch)
npm run dev:is
npm run dev:culturalapp

# Conferir branch × perfil
npm run env:check

# Alinhar Firebase CLI ao perfil da branch
npm run firebase:use-branch

# Build de produção (mesma lógica da branch)
npm run build
npm run build:is
npm run build:culturalapp
```

## Segredos

- **Não** use `.env` na raiz para `VITE_PROJECT_ID` / `VITE_API_KEY` — isso quebra ao trocar de branch.
- Copie `.env.local.example` → **`.env.local`** (gitignored) para Gemini, WhatsApp, etc.

## Vite

Com `--mode oraculo-is`, o Vite carrega `.env.oraculo-is` (prioridade sobre `.env` genérico).

## Cloud Functions em dev

Por padrão o front chama **produção** (`https://us-central1-<project>.cloudfunctions.net`), mesmo com `npm run dev`.

Para usar o emulador, em `.env.local`:

```bash
VITE_FUNCTIONS_USE_EMULATOR=1
VITE_FUNCTIONS_BASE_URL=http://127.0.0.1:5001/oraculo-is/us-central1
```

Depois: `firebase emulators:start --only functions`

## Catálogo de editais em outro projeto

No **Oraculo-IS**, `.env.oraculo-is` pode definir:

```bash
VITE_EDITAIS_CATALOG=culturalapp
```

O app continua autenticando em **oraculo-is**, mas **lê** a coleção `editais` do **culturalapp-fb9b0** (branch roxo), onde as rules permitem leitura pública. Projetos e usuários ficam em oraculo-is; novos editais cadastrados pelo app vão para oraculo-is (`getEditaisWriteDb`).

Para usar só editais locais: remova `VITE_EDITAIS_CATALOG` ou use `VITE_EDITAIS_CATALOG=local`.

Alternativas de longo prazo: Cloud Function de sync, ou um único Firestore compartilhado.
