// Script para limpar o campo 'premium' antigo do Firestore
// Execute este script no console do Firebase ou como uma Cloud Function

const admin = require('firebase-admin');

// Inicializar Firebase Admin (se não estiver já inicializado)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function cleanupPremiumField() {
  try {
    console.log('Iniciando limpeza do campo "premium" antigo...');
    
    // Buscar todos os usuários que têm o campo 'premium'
    const usersSnapshot = await db.collection('usuarios')
      .where('premium', '!=', null)
      .get();
    
    console.log(`Encontrados ${usersSnapshot.size} usuários com campo 'premium'`);
    
    const batch = db.batch();
    let count = 0;
    
    usersSnapshot.docs.forEach(doc => {
      const userRef = db.collection('usuarios').doc(doc.id);
      batch.update(userRef, {
        premium: admin.firestore.FieldValue.delete()
      });
      count++;
      
      // Processar em lotes de 500 (limite do Firestore)
      if (count % 500 === 0) {
        console.log(`Processando lote de ${count} usuários...`);
      }
    });
    
    if (count > 0) {
      await batch.commit();
      console.log(`✅ Campo 'premium' removido de ${count} usuários`);
    } else {
      console.log('ℹ️ Nenhum usuário com campo "premium" encontrado');
    }
    
  } catch (error) {
    console.error('❌ Erro ao limpar campo "premium":', error);
  }
}

// Executar a limpeza
cleanupPremiumField();
