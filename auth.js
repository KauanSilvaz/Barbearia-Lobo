import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail,
    signOut
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
// 1. Importar as funções corretas para fazer query (pesquisa) no Firestore
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// 2. A sua configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAmljKXhjb9GlY1ABEA-GPJqNsftsv_hVk",
  authDomain: "ksstech-79520.firebaseapp.com",
  projectId: "ksstech-79520",
  storageBucket: "ksstech-79520.firebasestorage.app",
  messagingSenderId: "935997511388",
  appId: "1:935997511388:web:9c336727d3e588ee30c619",
  measurementId: "G-TM49C8N0T1"
};

// 3. Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 4. Configuração padrão dos Alertas (SweetAlert2)
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
        // 1. Faz o login no Firebase Auth
        await signInWithEmailAndPassword(auth, email, password);

        // 2. Faz uma pesquisa (query) na coleção 'employees' à procura deste e-mail
        const employeesRef = collection(db, "employees");
        const q = query(employeesRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);

        // Verifica se encontrou algum documento com este e-mail
        if (!querySnapshot.empty) {
            // Como o e-mail deve ser único, pegamos no primeiro documento retornado [0]
            const userData = querySnapshot.docs[0].data();
            
            // 3. Verifica se o funcionário está bloqueado
            if (userData.isBlocked === true) {
                await signOut(auth); // Desloga imediatamente
                throw new Error("usuario_bloqueado");
            }

            // 4. Verifica se o array 'role' existe e se inclui 'Gerente'
            // Verifica se o array 'role' existe e inclui 'Gerente' OU 'Recepcionista'
            if (userData.role && (userData.role.includes('Gerente') || userData.role.includes('Recepcionista'))) {
                // Sucesso: É gerente e não está bloqueado. Redireciona!
                window.location.href = "./CLIENTE/home/home.html"; 
            } else {
                // Falha: Não tem a permissão de gerente
                await signOut(auth);
                throw new Error("sem_permissao");
            }
        } else {
            // Falha: Não existe nenhum documento com este e-mail na coleção employees
            await signOut(auth);
            throw new Error("sem_cadastro");
        }

    } catch (error) {
        // Restaura o botão em caso de erro
        btnLogin.disabled = false;
        btnLogin.innerText = "ACESSAR PAINEL";

        let mensagemErro = "Ocorreu um erro ao tentar entrar.";
        
        // Tratamento de erros detalhado
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            mensagemErro = "E-mail ou palavra-passe incorretos.";
        } else if (error.code === 'auth/too-many-requests') {
            mensagemErro = "Demasiadas tentativas. Tente mais tarde.";
        } else if (error.message === "sem_permissao") {
            mensagemErro = "Acesso negado. Apenas gerentes podem entrar neste painel.";
        } else if (error.message === "sem_cadastro") {
            mensagemErro = "Erro: Registo de funcionário não encontrado no sistema.";
        } else if (error.message === "usuario_bloqueado") {
            mensagemErro = "Acesso negado. Esta conta encontra-se bloqueada.";
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