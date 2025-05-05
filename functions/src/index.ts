import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
// Remova ou comente esta linha:
// import * as cors from 'cors';

admin.initializeApp();

// Remova ou comente este bloco:
// const corsOptions = {
//   origin: true, // Permite qualquer origem
//   methods: ['GET', 'POST'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true
// };

// Função para excluir usuário
export const deleteUserAuth = functions
  .runWith({ enforceAppCheck: false }) // Desabilitar AppCheck para desenvolvimento
  .https.onCall(async (data, context) => {
    try {
      const uid = data.uid;
      
      if (!uid) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'O UID do usuário é obrigatório'
        );
      }
      
      // Excluir o usuário da autenticação
      console.log(`Tentando excluir usuário com UID: ${uid}`);
      await admin.auth().deleteUser(uid);
      console.log(`Usuário ${uid} excluído com sucesso da autenticação`);
      
      return { success: true, message: `Usuário ${uid} excluído com sucesso` };
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Ocorreu um erro ao excluir o usuário',
        error
      );
    }
  });