#!/usr/bin/env node

/**
 * Script para verificar e configurar credenciais do Mercado Pago
 * 
 * Uso:
 *   node verificar-credenciais.js
 *   node verificar-credenciais.js --set TEST-seu-token-aqui
 */

const { execSync } = require('child_process');

console.log('🔍 Verificando credenciais do Mercado Pago...\n');

try {
  // Verificar configuração atual
  const configOutput = execSync('firebase functions:config:get mercadopago.token', { 
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  
  const config = JSON.parse(configOutput);
  const token = config.mercadopago?.token || config.mercadopago_token;
  
  if (!token) {
    console.log('❌ Nenhuma credencial configurada!\n');
    console.log('📝 Para configurar credenciais de TESTE:');
    console.log('   firebase functions:config:set mercadopago.token="TEST-seu-token-aqui"\n');
    console.log('📝 Para obter credenciais de teste:');
    console.log('   1. Acesse: https://www.mercadopago.com.br/developers/panel/app');
    console.log('   2. Crie uma aplicação');
    console.log('   3. Vá em "Credenciais de teste"');
    console.log('   4. Copie o Access Token que começa com TEST-\n');
    process.exit(1);
  }
  
  console.log('📋 Token atual:', token.substring(0, 15) + '...' + token.substring(token.length - 4));
  
  if (token.startsWith('TEST-')) {
    console.log('✅ CORRETO! Usando credenciais de TESTE (sandbox)');
    console.log('✅ Você pode usar cartões de teste sem problemas\n');
  } else if (token.startsWith('APP_USR-')) {
    console.log('❌ ERRO! Usando credenciais de PRODUÇÃO');
    console.log('❌ Isso causa o erro: "Uma das partes com as quais você está tentando efetuar o pagamento é de teste"\n');
    console.log('🔧 Para corrigir:');
    console.log('   1. Obtenha credenciais de TESTE em: https://www.mercadopago.com.br/developers/panel/app');
    console.log('   2. Configure: firebase functions:config:set mercadopago.token="TEST-seu-token-aqui"');
    console.log('   3. Faça deploy: firebase deploy --only functions:criarCheckoutPremium\n');
    process.exit(1);
  } else {
    console.log('⚠️  Token não reconhecido!');
    console.log('⚠️  Deve começar com TEST- (teste) ou APP_USR- (produção)\n');
    process.exit(1);
  }
  
} catch (error) {
  if (error.message.includes('Command failed')) {
    console.log('❌ Erro ao verificar configuração');
    console.log('💡 Certifique-se de estar logado no Firebase: firebase login\n');
  } else {
    console.log('❌ Erro:', error.message);
  }
  process.exit(1);
}




