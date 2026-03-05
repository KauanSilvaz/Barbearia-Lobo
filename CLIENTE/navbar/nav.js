document.addEventListener('DOMContentLoaded', () => {
    // 1. Funcionalidade do Menu Mobile
    const btnMobileMenu = document.getElementById('btn-mobile-menu');
    const mainNav = document.getElementById('main-nav');

    if (btnMobileMenu && mainNav) {
        btnMobileMenu.addEventListener('click', () => {
            mainNav.classList.toggle('hidden');
            mainNav.classList.toggle('flex');
        });
    }

    // 2. Destaque Automático da Página Atual (Highlight)
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');

    // Estilos para botão ativo vs inativo
    const activeClasses = ['text-zinc-100', 'bg-zinc-800', 'border', 'border-zinc-700/50', 'shadow-sm'];
    const inactiveClasses = ['text-zinc-400', 'hover:text-zinc-100', 'hover:bg-zinc-800/50'];

    navLinks.forEach(link => {
        // Limpa o caminho relativo (../) para comparar apenas o nome do arquivo/pasta
        const linkPath = link.getAttribute('href').replace(/\.\.\//g, '');
        
        // Verifica se a URL atual contém o caminho do link
        if (currentPath.includes(linkPath)) {
            link.classList.remove(...inactiveClasses);
            link.classList.add(...activeClasses);
        } else {
            link.classList.remove(...activeClasses);
            link.classList.add(...inactiveClasses);
        }
    });
});