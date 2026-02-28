const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Função para criar funcionário com cargo (Role)
exports.addEmployee = functions.https.onCall(async (data, context) => {
    // SEGURANÇA: Só um admin logado pode criar outros funcionários
    if (!context.auth || context.auth.token.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Acesso restrito a administradores.');
    }

    const { email, password, name, role, spec } = data;

    try {
        // 1. Cria o usuário no Firebase Auth
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name
        });

        // 2. Define o cargo (Custom Claim) - Imutável pelo Front-end
        await admin.auth().setCustomUserClaims(userRecord.uid, { 
            role: role.toLowerCase(),
            tenantId: "barbearia_portugal_01" 
        });

        // 3. Salva dados complementares no Firestore
        await admin.firestore().collection('employees').doc(userRecord.uid).set({
            name,
            role,
            spec,
            email,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true, uid: userRecord.uid };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});