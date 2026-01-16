# Instruções de Deploy

## Configuração de Variáveis de Ambiente no GitHub

Para que o deploy funcione corretamente em produção, é necessário configurar os seguintes secrets no GitHub:

### Como configurar os secrets:

1. Acesse o repositório no GitHub
2. Vá em **Settings** > **Secrets and variables** > **Actions**
3. Clique em **New repository secret**
4. Adicione cada uma das seguintes variáveis:

### Secrets necessários:

- `VITE_API_KEY` - Firebase API Key
- `VITE_AUTH_DOMAIN` - Firebase Auth Domain (ex: `culturalapp-fb9b0.firebaseapp.com`)
- `VITE_PROJECT_ID` - Firebase Project ID (ex: `culturalapp-fb9b0`)
- `VITE_STORAGE_BUCKET` - Firebase Storage Bucket (ex: `culturalapp-fb9b0.appspot.com`)
- `VITE_MESSAGING_SENDER_ID` - Firebase Messaging Sender ID
- `VITE_APP_ID` - Firebase App ID

### Onde encontrar essas informações:

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Selecione o projeto `culturalapp-fb9b0`
3. Vá em **Project Settings** (ícone de engrenagem)
4. Role até a seção **Your apps**
5. Selecione o app web ou crie um novo
6. As informações estarão no objeto `firebaseConfig`

### Exemplo de configuração:

```javascript
const firebaseConfig = {
  apiKey: "AIza...", // VITE_API_KEY
  authDomain: "culturalapp-fb9b0.firebaseapp.com", // VITE_AUTH_DOMAIN
  projectId: "culturalapp-fb9b0", // VITE_PROJECT_ID
  storageBucket: "culturalapp-fb9b0.appspot.com", // VITE_STORAGE_BUCKET
  messagingSenderId: "123456789", // VITE_MESSAGING_SENDER_ID
  appId: "1:123456789:web:abc123" // VITE_APP_ID
};
```

### Importante:

- Essas variáveis são necessárias durante o **build** da aplicação
- Elas são embutidas no código JavaScript gerado pelo Vite
- Após configurar os secrets, faça um novo push para a branch `main` para acionar o deploy











