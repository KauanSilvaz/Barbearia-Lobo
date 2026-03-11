import { db, auth } from './firebase-config.js';
import { collection, query, where, getDocs, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// AUTO-LOGIN: Se já houver dados no localStorage, entra direto
if (localStorage.getItem('loggedBarberId')) {
    window.location.replace('pagebarber.html');
}

const form = document.getElementById('login-form');
const errorMsg = document.getElementById('error-msg');
const btnLogin = document.getElementById('btn-login');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const rememberMe = document.getElementById('remember-me').checked;
    
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
            await signInWithEmailAndPassword(auth, email, password);
            console.log("Login Auth bem-sucedido!");
            
        } catch (authError) {
            if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/user-not-found') {
                
                if (userData.needsAuthCreation && userData.password === password) {
                    console.log("3. Primeiro acesso detectado. Criando conta no Auth...");
                    
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    
                    console.log("4. Conta criada! Limpando senha do Firestore por segurança...");
                    await updateDoc(docSnap.ref, {
                        password: deleteField(),
                        needsAuthCreation: false,
                        authUid: userCredential.user.uid
                    });
                } else {
                    throw new Error("Senha incorreta.");
                }
            } else {
                throw authError; 
            }
        }

        console.log("5. Sucesso! Salvando sessão e redirecionando...");
        
        // Se pediu para lembrar, salva no localStorage. Senão, no sessionStorage.
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('loggedBarberId', userId);
        storage.setItem('loggedBarberName', userData.name);
        storage.setItem('loggedBarberPhoto', userData.photoUrl || '');

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