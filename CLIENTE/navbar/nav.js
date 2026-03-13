// nav.js

// 1. Garante que o Firebase Global está inicializado para o nav.js funcionar em todas as páginas
const firebaseConfigGlobal = {
    apiKey: "AIzaSyAmljKXhjb9GlY1ABEA-GPJqNsftsv_hVk",
    authDomain: "ksstech-79520.firebaseapp.com",
    projectId: "ksstech-79520",
    storageBucket: "ksstech-79520.firebasestorage.app",
    messagingSenderId: "935997511388",
    appId: "1:935997511388:web:9c336727d3e588ee30c619"
};

// Se o script do Firebase existir no HTML mas ainda não tiver sido inicializado, inicializa agora:
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfigGlobal);
}

document.addEventListener('DOMContentLoaded', () => {
    // 2. Funcionalidade do Menu Mobile
    const btnMobileMenu = document.getElementById('btn-mobile-menu');
    const mainNav = document.getElementById('main-nav');

    if (btnMobileMenu && mainNav) {
        btnMobileMenu.addEventListener('click', () => {
            mainNav.classList.toggle('hidden');
            mainNav.classList.toggle('flex');
        });
    }

    // 3. Destaque Automático da Página Atual (Highlight)
    const currentPath = window.location.pathname.toLowerCase();
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href').replace(/\.\.\//g, '').toLowerCase();
        
        if (currentPath.includes(linkPath) && linkPath !== '') {
            link.classList.remove('text-zinc-400', 'hover:text-zinc-100', 'hover:bg-zinc-800/50');
            link.classList.add('text-amber-500', 'bg-amber-500/10', 'md:bg-zinc-800/50');
        } else {
            link.classList.remove('text-amber-500', 'bg-amber-500/10', 'md:bg-zinc-800/50');
            link.classList.add('text-zinc-400', 'hover:text-zinc-100', 'hover:bg-zinc-800/50');
        }
    });

    // 4. Inicializa o Controle de Acesso
    verificarPermissoes();
});

// Função responsável por verificar quem está logado e o que pode acessar
function verificarPermissoes() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (!user) {
                console.log("Usuário não logado. Redirecionando para login...");
                window.location.replace('../index.html'); 
                return;
            }

            try {
                const db = firebase.firestore();
                const employeeDoc = await db.collection('employees').doc(user.uid).get();

                if (!employeeDoc.exists) {
                    console.error("Usuário não encontrado.");
                    return;
                }

                const employeeData = employeeDoc.data();
                const roles = Array.isArray(employeeData.role) ? employeeData.role : [employeeData.role];
                
                const isGerente = roles.includes('Gerente');
                aplicarRestricoes(isGerente);

            } catch (error) {
                console.error("Erro ao verificar permissões:", error);
            }
        });
    } else {
        console.warn("Firebase não detectado no nav.js");
    }
}

// Função que esconde menus e bloqueia a página
function aplicarRestricoes(isGerente) {
    const currentPath = window.location.pathname.toLowerCase();
    
    const isRestrictedPage = currentPath.includes('config') || 
                             currentPath.includes('financeiro') || 
                             currentPath.includes('servicos');

    if (!isGerente) {
        // 1. Esconde os links da Navbar (mesmo que ele esteja na Home, ele não vai ver os links)
        const restrictedLinks = document.querySelectorAll(
            'a[href*="config"], a[href*="financeiro"], a[href*="servicos"]'
        );
        
        restrictedLinks.forEach(link => {
            link.style.display = 'none'; 
        });

        // 2. Chuta da página se tentar acessar direto pelo link
        if (isRestrictedPage) {
            window.location.replace('../home/home.html');
        }
    }
}