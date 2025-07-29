import * as admin from 'firebase-admin';
import * as sgMail from '@sendgrid/mail';
import { onUserCreated } from 'firebase-functions/v2/identity';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import { app } from './server';

// Initialize Firebase Admin
admin.initializeApp();

// Set SendGrid API key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
if (!SENDGRID_API_KEY) {
  console.error('SendGrid API key not found. Please set SENDGRID_API_KEY in your environment variables.');
} else {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// Email configuration
const EMAIL_FROM = 'noreply@oraculocultural.com.br';
const EMAIL_TO = 'seu-email@exemplo.com';

async function sendEmail(subject: string, text: string, html: string) {
  if (!SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured. Email not sent.');
    return false;
  }

  const msg = {
    to: EMAIL_TO,
    from: EMAIL_FROM,
    subject,
    text,
    html,
  };

  try {
    await sgMail.send(msg);
    console.log('Email sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    if (error instanceof Error && 'response' in error) {
      console.error('Error response:', (error as any).response?.body);
    }
    return false;
  }
}

// 1. New User Created - Updated to v2
export const onUserCreate = onUserCreated(async (event) => {
  const user = event.data;
  if (!user) return null;
  
  const subject = 'Novo usuário cadastrado!';
  const text = `Novo usuário cadastrado:
    
    Nome: ${user.displayName || 'Não informado'}
    Email: ${user.email || 'Não informado'}
    ID: ${user.uid}
    Data: ${new Date().toLocaleString()}`;
    
  const html = `
    <h1>Novo usuário cadastrado!</h1>
    <p><strong>Nome:</strong> ${user.displayName || 'Não informado'}</p>
    <p><strong>Email:</strong> ${user.email || 'Não informado'}</p>
    <p><strong>ID:</strong> ${user.uid}</p>
    <p><strong>Data:</strong> ${new Date().toLocaleString()}</p>
  `;

  await sendEmail(subject, text, html);
  return null;
});

// 2. New Project Created - Updated to v2
export const onProjectCreate = onDocumentCreated('projetos/{projectId}', async (event) => {
  const project = event.data?.data();
  if (!project) return null;
  
  const subject = 'Novo projeto registrado!';
  
  const text = `Novo projeto registrado:
    
    Nome do Projeto: ${project.nomeProjeto || 'Não informado'}
    Criado por: ${project.userId || 'ID não disponível'}
    Data: ${new Date().toLocaleString()}
    
    Detalhes do projeto:
    ${JSON.stringify(project, null, 2)}`;
    
  const html = `
    <h1>Novo projeto registrado!</h1>
    <p><strong>Nome do Projeto:</strong> ${project.nomeProjeto || 'Não informado'}</p>
    <p><strong>Criado por:</strong> ${project.userId || 'ID não disponível'}</p>
    <p><strong>Data:</strong> ${new Date().toLocaleString()}</p>
    <h3>Detalhes do projeto:</h3>
    <pre>${JSON.stringify(project, null, 2)}</pre>
  `;

  await sendEmail(subject, text, html);
  return null;
});

// 3. Premium Button Clicked - Updated to v2
export const onPremiumClick = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'Você precisa estar logado para realizar esta ação.'
    );
  }

  const userId = request.auth.uid;
  const userEmail = request.auth.token.email || 'não informado';
  
  const subject = 'Alguém clicou no botão Premium!';
  const text = `Usuário interessado no plano Premium:
    
    ID do usuário: ${userId}
    Email: ${userEmail}
    Data: ${new Date().toLocaleString()}`;
    
  const html = `
    <h1>Alguém clicou no botão Premium!</h1>
    <p><strong>ID do usuário:</strong> ${userId}</p>
    <p><strong>Email:</strong> ${userEmail}</p>
    <p><strong>Data:</strong> ${new Date().toLocaleString()}</p>
  `;

  await sendEmail(subject, text, html);
  return { success: true };
});

// Export your Express app
export const api = onRequest(app);