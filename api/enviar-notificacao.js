// api/enviar-notificacao.js
// Você precisará rodar `npm install firebase-admin` na raiz da pasta que vai pra Vercel
const admin = require("firebase-admin");

// ATENÇÃO: Nunca suba esse JSON para o GitHub! Pegue as credenciais no:
// Firebase Console > Project Settings > Service Accounts > Generate new private key
// E salve como Variáveis de Ambiente na Vercel. Aqui deixo um exemplo estrutural:
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}

export default async function handler(req, res) {
    // Configura o CORS caso seu frontend e backend fiquem em domínios diferentes
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: "Método não permitido." });
    }

    const { tipo, nomeCliente, nomeBarbeiro, data, hora, tokenFCM } = req.body;

    let titulo, corpo;

    if (tipo === "agendamento") {
        titulo = "Novo Agendamento! ✂️";
        corpo = `${nomeCliente} marcou com ${nomeBarbeiro} dia ${data} às ${hora}.`;
    } else if (tipo === "atualizacao") {
        titulo = "Agendamento Atualizado 🔄";
        corpo = `O horário de ${nomeCliente} com ${nomeBarbeiro} foi atualizado para dia ${data} às ${hora}.`;
    } else if (tipo === "cancelamento") {
        titulo = "Agendamento Cancelado ❌";
        corpo = `${nomeCliente} cancelou o horário com ${nomeBarbeiro} do dia ${data} às ${hora}.`;
    } else {
        return res.status(400).json({ message: "Tipo de notificação inválido." });
    }

    const mensagem = {
        // Se você não tiver o token específico, pode usar um "tópico" no Firebase para enviar para todos os administradores inscritos
        topic: "admin_notifications", // Usaremos tópico para ficar mais fácil no começo
        notification: {
            title: titulo,
            body: corpo,
        },
        android: {
            notification: {
                sound: "default",
            }
        },
        webpush: {
            notification: {
                icon: "/icone-192.png",
                vibrate: [200, 100, 200],
            }
        }
    };

    try {
        const response = await admin.messaging().send(mensagem);
        res.status(200).json({ success: true, message: "Notificação enviada com sucesso!", response });
    } catch (error) {
        console.error("Erro ao enviar notificação pelo admin:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}