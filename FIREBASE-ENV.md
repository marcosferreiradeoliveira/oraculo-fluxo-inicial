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
