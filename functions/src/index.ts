import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as cors from 'cors';

// Especificar a região como uma constante para evitar erros de digitação
const REGION = 'southamerica-east1';

admin.initializeApp();

const corsHandler = cors({
  origin: true,
});

// Função para excluir usuário - versão callable
export const deleteUser = functions
  .region(REGION) // Usar a constante
  .runWith({
    enforceAppCheck: false,
    minInstances: 0,
  })
  .https.onCall(async (data, context) => {
    try {
      const uid = data.uid;

      if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'O UID do usuário é obrigatório');
      }

      console.log(`Tentativa de exclusão do usuário ${uid}`);

      // Log do contexto de autenticação para debugging
      console.log(
        'Context auth:',
        context.auth
          ? {
              uid: context.auth.uid,
              email: context.auth.token.email,
              admin: context.auth.token.admin,
            }
          : 'Sem contexto de autenticação'
      );

      // Excluir usando admin SDK
      await admin.auth().deleteUser(uid);
      console.log(`Usuário ${uid} excluído com sucesso`);

      return { success: true, message: `Usuário ${uid} excluído com sucesso` };
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);

      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'auth/user-not-found'
      ) {
        return {
          success: true,
          message: 'Usuário já removido ou não encontrado no Authentication',
        };
      }

      throw new functions.https.HttpsError(
        'internal',
        `Erro interno ao excluir usuário: ${error instanceof Error ? error.message : 'desconhecido'}`,
        error
      );
    }
  });

// Versão HTTP da função
export const deleteUserHttp = functions
  .region(REGION) // Usar a mesma constante
  .runWith({
    enforceAppCheck: false,
    minInstances: 0,
  })
  .https.onRequest((request, response) => {
    // Aplicar CORS
    corsHandler(request, response, async () => {
      try {
        // Verificar método
        if (request.method !== 'POST') {
          return response.status(405).send('Method Not Allowed');
        }

        const uid = request.body.uid;
        if (!uid) {
          return response.status(400).send('UID é obrigatório');
        }

        console.log(`Tentativa de exclusão do usuário ${uid} via HTTP`);

        // Verificar token de ID (autenticação)
        const idToken = request.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
          return response.status(401).send('Não autorizado');
        }

        try {
          const decodedToken = await admin.auth().verifyIdToken(idToken);
          console.log('Token verificado para:', decodedToken.uid);
        } catch (authError) {
          console.error('Erro ao verificar token:', authError);
          return response.status(401).send('Token inválido');
        }

        // Excluir usuário
        try {
          await admin.auth().deleteUser(uid);
          console.log(`Usuário ${uid} excluído com sucesso`);
          return response.status(200).json({
            success: true,
            message: `Usuário ${uid} excluído com sucesso`,
          });
        } catch (authError) {
          console.error('Erro ao excluir usuário:', authError);

          if (
            authError &&
            typeof authError === 'object' &&
            'code' in authError &&
            authError.code === 'auth/user-not-found'
          ) {
            return response.status(200).json({
              success: true,
              message: 'Usuário já removido ou não encontrado',
            });
          }

          return response.status(500).json({
            success: false,
            message: `Erro ao excluir usuário: ${authError instanceof Error ? authError.message : String(authError)}`,
          });
        }
      } catch (error) {
        console.error('Erro geral:', error);
        return response
          .status(500)
          .send(`Erro interno: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  });
