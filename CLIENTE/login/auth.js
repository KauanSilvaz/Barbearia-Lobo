import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

// 1. A tua configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAmljKXhjb9GlY1ABEA-GPJqNsftsv_hVk",
  authDomain: "ksstech-79520.firebaseapp.com",
  projectId: "ksstech-79520",
  storageBucket: "ksstech-79520.firebasestorage.app",
  messagingSenderId: "935997511388",
  appId: "1:935997511388:web:9c336727d3e588ee30c619",
  measurementId: "G-TM49C8N0T1"
};

// 2. Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 3. Configuração padrão dos Alertas (SweetAlert2)
const Toast = Swal.mixin({
    background: '#121212',
    color: '#ffffff',
    confirmButtonColor: '#ffffff',
    customClass: {
        confirmButton: 'swal2-confirm btn-custom'
    }
});

// --- LÓGICA DE LOGIN ---
const loginForm = document.getElementById('login-form');
const btnLogin = document.getElementById('btn-login');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Feedback visual de carregamento
    btnLogin.disabled = true;
    btnLogin.innerText = "A AUTENTICAR...";

    try {
        await signInWithEmailAndPassword(auth, email, password);
        
        // Sucesso: Redireciona para o painel administrativo
        window.location.href = "../home/home.html"; 
    } catch (error) {
        btnLogin.disabled = false;
        btnLogin.innerText = "ACESSAR PAINEL";

        let mensagemErro = "Ocorreu um erro ao tentar entrar.";
        
        // Tratamento de erros comuns em pt-PT
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            mensagemErro = "E-mail ou palavra-passe incorretos.";
        } else if (error.code === 'auth/too-many-requests') {
            mensagemErro = "Demasiadas tentativas. Tente mais tarde.";
        }

        Toast.fire({
            icon: 'error',
            title: 'FALHA NO ACESSO',
            text: mensagemErro
        });
    }
});

// --- LÓGICA DE RECUPERAÇÃO DE PALAVRA-PASSE ---
document.getElementById('forgot-password').addEventListener('click', async (e) => {
    e.preventDefault();

    const { value: email } = await Swal.fire({
        title: 'RECUPERAR ACESSO',
        text: 'Introduza o seu e-mail de registo para receber o link de reposição:',
        input: 'email',
        inputPlaceholder: 'geral@exemplo.com',
        background: '#121212',
        color: '#ffffff',
        showCancelButton: true,
        cancelButtonText: 'CANCELAR',
        confirmButtonText: 'ENVIAR LINK',
        customClass: {
            confirmButton: 'swal2-confirm btn-custom',
            cancelButton: 'link-text'
        }
    });

    if (email) {
        try {
            await sendPasswordResetEmail(auth, email);
            
            Toast.fire({
                icon: 'success',
                title: 'E-MAIL ENVIADO',
                text: 'Verifique a sua caixa de entrada (e a pasta de spam).'
            });
        } catch (error) {
            let erroMsg = "Não foi possível enviar o e-mail.";
            if (error.code === 'auth/user-not-found') erroMsg = "Este e-mail não está registado.";

            Toast.fire({
                icon: 'error',
                title: 'ERRO',
                text: erroMsg
            });
        }
    }
});