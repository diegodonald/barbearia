import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

interface UpdateUserRoleData {
  uid: string;
  role: string;
}

/**
 * Função callable para atualizar o custom claim "role" do usuário.
 * Adaptada para a nova assinatura do onCall (Firebase Functions V2).
 */
export const updateUserRole = functions.https.onCall(
  async (request): Promise<{ message: string }> => {
    // Converte os dados enviados para o tipo UpdateUserRoleData
    const data = request.data as UpdateUserRoleData;

    // Verifica se o usuário que chamou a função está autenticado
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "A autenticação é necessária."
      );
    }

    // Verifica se o usuário autenticado possui o custom claim "admin"
    if (!request.auth.token.admin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Apenas administradores podem alterar papéis."
      );
    }

    const { uid, role } = data;

    // Valida os dados enviados
    if (!uid || !role) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Os campos 'uid' e 'role' são obrigatórios."
      );
    }

    try {
      await admin.auth().setCustomUserClaims(uid, { role });
      return {
        message: `Custom claims atualizados para o usuário ${uid} com role: ${role}`,
      };
    } catch (error: unknown) {
      console.error("Erro ao atualizar os custom claims:", error);
      throw new functions.https.HttpsError(
        "unknown",
        "Ocorreu um erro ao atualizar os custom claims."
      );
    }
  }
);
