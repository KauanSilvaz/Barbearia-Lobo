/* clientes.js - Versão Completa com Marca d'água e Sincronização de Logo */

const app = {
    clientsData: [],
    currentClientId: null,

    init: async () => {
        // Inicia a sincronização da logo para marca d'água e header
        app.syncCompanyLogo();

        await app.fetchClients();
        
        // Listener para o formulário de cadastro
        const form = document.getElementById('new-client-form');
        if(form) {
            form.addEventListener('submit', app.handleNewClientSubmit);
        }

        // Listener para o formulário de edição
        const editForm = document.getElementById('edit-client-form');
        if(editForm) {
            editForm.addEventListener('submit', app.handleEditClientSubmit);
        }

        // Listener de Busca
        const searchInput = document.getElementById('search-input');
        if(searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = app.clientsData.filter(c => 
                    c.name.toLowerCase().includes(term) || 
                    c.email.toLowerCase().includes(term) ||
                    c.phone.includes(term)
                );
                app.renderList(filtered);
            });
        }
        
        lucide.createIcons();
    },

    syncCompanyLogo: () => {
        const { db, dbMethods } = window;
        const watermarkImg = document.getElementById('watermark-img');
        const headerLogo = document.getElementById('header-logo');

        if (!db || !dbMethods) return;

        // Escuta mudanças na logo nos dados da empresa (SAMI)
        dbMethods.onSnapshot(dbMethods.doc(db, "settings", "company"), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.logoUrl) {
                    if (watermarkImg) watermarkImg.src = data.logoUrl;
                    if (headerLogo) headerLogo.src = data.logoUrl;
                }
            }
        });
    },

    fetchClients: async () => {
        const { db, dbMethods } = window;
        if (!db) return;

        try {
            const querySnapshot = await dbMethods.getDocs(dbMethods.collection(db, "users"));
            app.clientsData = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                app.clientsData.push({
                    id: doc.id,
                    name: data.name || 'Sem nome',
                    phone: data.phone || 'Sem contato',
                    email: data.email || 'Sem email',
                    since: data.membersSince || new Date().getFullYear().toString(),
                    history: data.history || [],
                    isBlocked: data.isBlocked || false
                });
            });

            document.getElementById('total-clients-badge').innerText = app.clientsData.length;
            app.renderList(app.clientsData);
        } catch (error) {
            console.error("Erro ao buscar clientes:", error);
        }
    },

    getInitials: (name) => {
        if (!name) return "--";
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    },

    renderList: (data) => {
        const list = document.getElementById('clients-list');
        if(!list) return;
        list.innerHTML = '';
        document.getElementById('showing-text').innerText = `Mostrando ${data.length} de ${app.clientsData.length}`;

        if (data.length === 0) {
            list.innerHTML = `<div class="p-8 text-center text-zinc-500">Nenhum cliente encontrado.</div>`;
            return;
        }

        data.forEach(client => {
            const row = document.createElement('div');
            row.className = "grid grid-cols-12 gap-4 px-4 py-3 items-center rounded-xl hover:bg-zinc-800/50 transition-colors cursor-pointer border border-transparent hover:border-zinc-700/50 group animate-fadeIn";
            row.onclick = () => app.openClientDetails(client.id);

            const blockedBadge = client.isBlocked 
                ? `<span class="bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded text-[10px] font-bold border border-red-500/20 ml-2">Bloqueado</span>`
                : '';

            row.innerHTML = `
                <div class="col-span-4 sm:col-span-3 flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full bg-zinc-800 text-zinc-400 font-bold text-xs flex items-center justify-center border border-zinc-700 shrink-0">${app.getInitials(client.name)}</div>
                    <div class="flex items-center min-w-0">
                        <h3 class="text-sm font-bold text-zinc-200 truncate">${client.name}</h3>
                        ${blockedBadge}
                    </div>
                </div>
                <div class="col-span-5 sm:col-span-3 text-xs text-zinc-400">
                    <p>${client.phone}</p>
                    <p class="opacity-50 truncate">${client.email}</p>
                </div>
                <div class="col-span-3 sm:col-span-2 hidden sm:block text-xs text-zinc-500">${client.since}</div>
                <div class="col-span-3 hidden sm:block text-xs text-zinc-400">${client.history.length > 0 ? client.history[0].date : 'Novo'}</div>
                <div class="col-span-3 sm:col-span-1 flex justify-end">
                    <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-600 group-hover:text-amber-500 transition-colors"></i>
                </div>
            `;
            list.appendChild(row);
        });
        lucide.createIcons();
    },

    openNewClientModal: () => {
        document.getElementById('new-client-modal').classList.remove('hidden');
        lucide.createIcons();
    },

    closeNewClientModal: () => {
        document.getElementById('new-client-modal').classList.add('hidden');
        document.getElementById('new-client-form').reset();
    },

    handleNewClientSubmit: async (e) => {
        e.preventDefault();
        const { db, dbMethods } = window;

        const name = document.getElementById('new-name').value;
        const phone = document.getElementById('new-phone').value;
        const email = document.getElementById('new-email').value;

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Salvando...';
        lucide.createIcons();

        try {
            await dbMethods.addDoc(dbMethods.collection(db, "users"), {
                name,
                phone,
                email,
                membersSince: new Date().getFullYear().toString(),
                avatar: null,
                history: [],
                isBlocked: false
            });

            app.closeNewClientModal();
            await app.fetchClients();
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar no banco de dados.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i data-lucide="check" class="w-5 h-5"></i> Salvar Cliente';
            lucide.createIcons();
        }
    },

    openClientDetails: async (id) => {
        const client = app.clientsData.find(c => c.id === id);
        if (!client) return;

        app.currentClientId = id;

        document.getElementById('detail-initials').innerText = app.getInitials(client.name);
        document.getElementById('detail-name').innerText = client.name;
        document.getElementById('detail-since').innerText = `Cliente desde ${client.since}`;
        document.getElementById('detail-phone').innerText = client.phone;
        document.getElementById('detail-email').innerText = client.email;

        const statusBadge = document.getElementById('detail-status');
        const btnBlock = document.getElementById('btn-block-client');
        
        if (client.isBlocked) {
            statusBadge.className = 'mb-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20';
            statusBadge.innerText = 'Bloqueado';
            btnBlock.innerHTML = '<i data-lucide="unlock" class="w-4 h-4"></i> Desbloquear Cliente';
            btnBlock.className = 'w-full bg-emerald-900/20 text-emerald-500 hover:bg-emerald-900/40 py-2.5 rounded-xl text-sm font-bold transition-colors border border-emerald-900/50 flex items-center justify-center gap-2';
        } else {
            statusBadge.className = 'mb-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
            statusBadge.innerText = 'Ativo';
            btnBlock.innerHTML = '<i data-lucide="ban" class="w-4 h-4"></i> Bloquear Cliente';
            btnBlock.className = 'w-full bg-amber-900/20 text-amber-500 hover:bg-amber-900/40 py-2.5 rounded-xl text-sm font-bold transition-colors border border-amber-900/50 flex items-center justify-center gap-2';
        }

        const histList = document.getElementById('history-list');
        histList.innerHTML = '<div class="text-xs text-zinc-500 animate-pulse">Carregando histórico...</div>';
        
        document.getElementById('client-modal').classList.remove('hidden');
        lucide.createIcons();

        const { db, dbMethods } = window;
        try {
            const q = dbMethods.query(
                dbMethods.collection(db, "bookings"), 
                dbMethods.where("userId", "==", id)
            );
            
            const querySnapshot = await dbMethods.getDocs(q);
            histList.innerHTML = '';

            if (querySnapshot.empty) {
                histList.innerHTML = `<div class="text-xs text-zinc-500 italic">Nenhum serviço registrado para este cliente.</div>`;
            } else {
                const bookings = [];
                querySnapshot.forEach(doc => bookings.push(doc.data()));

                bookings.forEach(booking => {
                    const div = document.createElement('div');
                    div.className = "flex justify-between items-center bg-zinc-950 p-3 rounded-lg border border-zinc-800 animate-fadeIn";
                    
                    div.innerHTML = `
                        <div class="space-y-1">
                            <p class="text-sm font-bold text-zinc-200">${booking.serviceName || booking.service || 'Serviço'}</p>
                            <div class="flex flex-col gap-0.5">
                               <span class="text-[10px] text-zinc-500 flex items-center gap-1">
                                   <i data-lucide="calendar" class="w-3 h-3"></i> ${booking.date || 'Data não informada'}
                               </span>
                               <span class="text-[10px] text-zinc-500 flex items-center gap-1">
                                   <i data-lucide="scissors" class="w-3 h-3"></i> Profissional: ${booking.barberName || 'Não informado'}
                               </span>
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="text-sm font-medium text-amber-500">€ ${booking.price || '0,00'}</span>
                        </div>
                    `;
                    histList.appendChild(div);
                });
                lucide.createIcons();
            }
        } catch (error) {
            console.error("Erro ao buscar histórico:", error);
            histList.innerHTML = `<div class="text-xs text-red-400">Erro ao carregar histórico.</div>`;
        }
    },

    closeModal: () => {
        document.getElementById('client-modal').classList.add('hidden');
    },

    openEditClientModal: () => {
        const client = app.clientsData.find(c => c.id === app.currentClientId);
        if(!client) return;
        
        document.getElementById('edit-name').value = client.name;
        document.getElementById('edit-phone').value = client.phone;
        document.getElementById('edit-email').value = client.email;
        
        document.getElementById('edit-client-modal').classList.remove('hidden');
        lucide.createIcons();
    },

    closeEditClientModal: () => {
        document.getElementById('edit-client-modal').classList.add('hidden');
    },

    handleEditClientSubmit: async (e) => {
        e.preventDefault();
        const { db, dbMethods } = window;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Salvando...';

        const updatedData = {
            name: document.getElementById('edit-name').value,
            phone: document.getElementById('edit-phone').value,
            email: document.getElementById('edit-email').value,
        };

        try {
            const docRef = dbMethods.doc(db, "users", app.currentClientId);
            await dbMethods.updateDoc(docRef, updatedData);
            
            app.closeEditClientModal();
            await app.fetchClients();
            app.openClientDetails(app.currentClientId);
        } catch (error) {
            console.error("Erro ao atualizar:", error);
            alert("Erro ao atualizar cliente.");
        } finally {
            submitBtn.innerHTML = '<i data-lucide="save" class="w-5 h-5"></i> Salvar Alterações';
            lucide.createIcons();
        }
    },

    deleteClient: async () => {
        if(!confirm("Atenção: Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita e pode afetar o histórico financeiro.")) return;
        
        const { db, dbMethods } = window;
        try {
            const docRef = dbMethods.doc(db, "users", app.currentClientId);
            await dbMethods.deleteDoc(docRef);
            
            app.closeModal();
            await app.fetchClients();
        } catch(error) {
            console.error("Erro ao excluir:", error);
            alert("Erro ao tentar excluir o cliente.");
        }
    },

    toggleBlockClient: async () => {
        const client = app.clientsData.find(c => c.id === app.currentClientId);
        if(!client) return;

        const { db, dbMethods } = window;
        const newStatus = !client.isBlocked;

        if (newStatus) {
            if(!confirm("Bloquear este cliente impedirá novos agendamentos e suspenderá os agendamentos ativos. Confirmar bloqueio?")) return;
            
            try {
                const q = dbMethods.query(dbMethods.collection(db, "bookings"), dbMethods.where("userId", "==", app.currentClientId));
                const snap = await dbMethods.getDocs(q);
                
                snap.forEach(async (bookingDoc) => {
                    const bRef = dbMethods.doc(db, "bookings", bookingDoc.id);
                    await dbMethods.updateDoc(bRef, { status: 'suspenso' }); 
                });
            } catch (err) {
                console.error("Erro ao suspender agendamentos:", err);
            }
        } else {
            if(!confirm("Deseja desbloquear este cliente?")) return;
        }

        try {
            const docRef = dbMethods.doc(db, "users", app.currentClientId);
            await dbMethods.updateDoc(docRef, { isBlocked: newStatus });
            
            await app.fetchClients();
            app.openClientDetails(app.currentClientId);
        } catch (error) {
            console.error("Erro ao bloquear/desbloquear:", error);
            alert("Erro ao processar a ação.");
        }
    }
};

document.addEventListener('DOMContentLoaded', app.init);