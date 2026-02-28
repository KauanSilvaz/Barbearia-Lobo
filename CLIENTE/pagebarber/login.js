import { db, auth } from './firebase-config.js';
import { collection, query, where, getDocs, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const form = document.getElementById('login-form');
const errorMsg = document.getElementById('error-msg');
const btnLogin = document.getElementById('btn-login');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    
    btnLogin.disabled = true;
    btnLogin.innerHTML = '<span class="animate-pulse">Autenticando...</span>';
    errorMsg.classList.add('hidden');

    try {
        console.log("1. Verificando se é um barbeiro cadastrado...");
        const q = query(collection(db, "employees"), where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("Usuário não encontrado no sistema da barbearia.");
        }

        const docSnap = querySnapshot.docs[0];
        const userData = docSnap.data();
        const userId = docSnap.id;

        console.log("2. Tentando login no Firebase Auth...");
        try {
            // Tenta o login normal
            await signInWithEmailAndPassword(auth, email, password);
            console.log("Login Auth bem-sucedido!");
            
        } catch (authError) {
            // Se der erro de credencial, verificamos se é o primeiro acesso (Mágica do Plano B)
            if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/user-not-found') {
                
                if (userData.needsAuthCreation && userData.password === password) {
                    console.log("3. Primeiro acesso detectado. Criando conta no Auth...");
                    
                    // Cria o usuário no Auth
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    
                    console.log("4. Conta criada! Limpando senha do Firestore por segurança...");
                    // Atualiza o documento: Remove a senha em texto puro e a flag de primeiro acesso
                    await updateDoc(docSnap.ref, {
                        password: deleteField(),
                        needsAuthCreation: false,
                        authUid: userCredential.user.uid // Vincula o ID oficial
                    });
                } else {
                    throw new Error("Senha incorreta.");
                }
            } else {
                throw authError; // Repassa outros erros (ex: internet caiu)
            }
        }

        console.log("5. Sucesso! Salvando sessão e redirecionando...");
        sessionStorage.setItem('loggedBarberId', userId);
        sessionStorage.setItem('loggedBarberName', userData.name);
        sessionStorage.setItem('loggedBarberPhoto', userData.photoUrl || '');

        window.location.replace('pagebarber.html'); 

    } catch (error) {
        console.error("Erro detalhado no login:", error);
        errorMsg.textContent = "Email ou senha incorretos.";
        errorMsg.classList.remove('hidden');
        
        btnLogin.disabled = false;
        btnLogin.innerHTML = 'Entrar <i data-lucide="arrow-right" class="w-4 h-4"></i>';
        if (window.lucide) lucide.createIcons();
    }
});