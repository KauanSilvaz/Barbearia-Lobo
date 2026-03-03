// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAmljKXhjb9GlY1ABEA-GPJqNsftsv_hVk",
  authDomain: "ksstech-79520.firebaseapp.com",
  projectId: "ksstech-79520",
  storageBucket: "ksstech-79520.firebasestorage.app",
  messagingSenderId: "935997511388",
  appId: "1:935997511388:web:9c336727d3e588ee30c619",
  measurementId: "G-TM49C8N0T1"
};

// Inicialização do Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();
const functions = firebase.functions();

// --- ESTADO DA APLICAÇÃO ---
let employees = [];
let gallery = [];
let categories = []; 
const daysOfWeek = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// --- APP CONTROLLER ---
const app = {
    init: () => {
        const galleryForm = document.getElementById('gallery-form');
        if(galleryForm) galleryForm.onsubmit = app.handleGallerySubmit;

        app.listenToTeam();
        app.listenToGallery();
        app.listenToCategories(); 
        app.loadCompany();
        app.loadSchedule();
        app.renderDays();
        app.renderEmpDays(); // Nova função para os dias do barbeiro
        lucide.createIcons();
        
        const form = document.getElementById('employee-form');
        if(form) form.onsubmit = app.saveEmployee;
    },

    // --- NAVEGAÇÃO ---
    switchTab: (tabId) => {
        const tabs = ['team', 'schedule', 'company', 'gallery'];
        tabs.forEach(id => {
            const btn = document.getElementById(`tab-${id}`);
            const section = document.getElementById(`section-${id}`);
            if (id === tabId) {
                section.classList.remove('hidden');
                btn.classList.add('bg-zinc-800', 'text-white', 'shadow-md', 'border-zinc-700');
                btn.classList.remove('text-zinc-400', 'hover:bg-zinc-900', 'border-transparent');
                const icon = btn.querySelector('i');
                if (icon) icon.classList.add('text-amber-500');
            } else {
                section.classList.add('hidden');
                btn.classList.remove('bg-zinc-800', 'text-white', 'shadow-md', 'border-zinc-700');
                btn.classList.add('text-zinc-400', 'hover:bg-zinc-900', 'border-transparent');
                const icon = btn.querySelector('i');
                if (icon) icon.classList.remove('text-amber-500');
            }
        });
    },

    // --- GESTÃO DE EQUIPE (FIRESTORE) ---
    listenToTeam: () => {
        db.collection("employees").onSnapshot((snapshot) => {
            employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            app.renderTeam();
        });
    },

    renderTeam: () => {
        const grid = document.getElementById('team-grid');
        if(!grid) return;
        grid.innerHTML = '';
        employees.forEach(emp => {
            const card = document.createElement('div');
            
            // Lógica de visual para usuário bloqueado
            const blockedStyle = emp.isBlocked ? 'opacity-75 border-red-900/50' : 'border-zinc-800 hover:border-zinc-700';
            card.className = `bg-zinc-900 border p-4 rounded-xl flex items-center justify-between group transition-colors ${blockedStyle}`;
            
            const photoUrl = emp.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${emp.name || 'default'}`;
            const badge = emp.isBlocked ? `<span class="bg-red-500/20 text-red-500 text-[9px] px-2 py-0.5 rounded-full font-bold ml-2 border border-red-500/20 uppercase">Bloqueado</span>` : '';
            
            card.innerHTML = `
                <div class="flex items-center gap-4">
                    <img src="${photoUrl}" alt="${emp.name}" class="w-12 h-12 rounded-full object-cover border-2 border-zinc-700 bg-zinc-800 flex-shrink-0">
                    <div>
                        <h3 class="font-bold text-white text-sm flex items-center">${emp.name} ${badge}</h3>
                        <p class="text-xs text-zinc-500">${emp.role} • ${emp.spec || 'Geral'}</p>
                    </div>
                </div>
                <button onclick="app.editEmployee('${emp.id}')" class="p-2 text-zinc-500 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
                    <i data-lucide="edit-2" class="w-4 h-4"></i>
                </button>`;
            grid.appendChild(card);
        });
        lucide.createIcons();
    },

    openEmployeeModal: () => {
        document.getElementById('employee-form').reset();
        document.getElementById('emp-id').value = '';
        document.getElementById('modal-title').innerText = 'Novo Funcionário';
        document.getElementById('btn-delete-emp').classList.add('hidden');
        
        // Resetando os novos campos
        if(document.getElementById('emp-blocked')) document.getElementById('emp-blocked').checked = false;
        if(document.getElementById('emp-work-start')) document.getElementById('emp-work-start').value = '09:00';
        if(document.getElementById('emp-work-end')) document.getElementById('emp-work-end').value = '20:00';
        if(document.getElementById('emp-lunch-start')) document.getElementById('emp-lunch-start').value = '12:00';
        if(document.getElementById('emp-lunch-end')) document.getElementById('emp-lunch-end').value = '13:00';
        app.renderEmpDays(); // Reseta os dias para o padrão
        
        if (app.updateEmployeePhotoPreview) {
            app.updateEmployeePhotoPreview('');
        }
        
        document.getElementById('employee-modal').classList.remove('hidden');
    },

    closeEmployeeModal: () => {
        document.getElementById('employee-modal').classList.add('hidden');
    },

    editEmployee: (id) => {
        const emp = employees.find(e => e.id === id);
        if(emp) {
            document.getElementById('emp-id').value = emp.id;
            document.getElementById('emp-name').value = emp.name;
            document.getElementById('emp-role').value = emp.role;
            document.getElementById('emp-spec').value = emp.spec || '';
            document.getElementById('emp-email').value = emp.email;
            document.getElementById('emp-pass').value = emp.password || '';
            
            // Popula os novos campos de horário e bloqueio
            if(document.getElementById('emp-blocked')) document.getElementById('emp-blocked').checked = emp.isBlocked || false;
            
            if(emp.schedule) {
                document.getElementById('emp-work-start').value = emp.schedule.workStart || '09:00';
                document.getElementById('emp-work-end').value = emp.schedule.workEnd || '20:00';
                document.getElementById('emp-lunch-start').value = emp.schedule.lunchStart || '12:00';
                document.getElementById('emp-lunch-end').value = emp.schedule.lunchEnd || '13:00';
                
                // Marca os dias específicos desse funcionário
                const checkboxes = document.querySelectorAll('#emp-days-container input');
                checkboxes.forEach(input => {
                    const isDayActive = emp.schedule.days ? emp.schedule.days.includes(input.value) : (input.value !== 'Dom');
                    input.checked = isDayActive;
                    const label = input.parentElement;
                    if (isDayActive) {
                        label.className = "cursor-pointer border rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all select-none flex items-center gap-1 bg-amber-500/10 border-amber-500/50 text-amber-500";
                    } else {
                        label.className = "cursor-pointer border rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all select-none flex items-center gap-1 bg-zinc-900 border-zinc-800 text-zinc-500";
                    }
                });
            } else {
                app.renderEmpDays(); // Se for um usuário antigo que não tem agenda salva, reseta para o padrão
            }
            
            const photoInput = document.getElementById('emp-photo-url');
            if(photoInput) {
                photoInput.value = emp.photoUrl || '';
            }
            if (app.updateEmployeePhotoPreview) {
                app.updateEmployeePhotoPreview(emp.photoUrl || '');
            }

            document.getElementById('modal-title').innerText = 'Editar Funcionário';
            document.getElementById('btn-delete-emp').classList.remove('hidden');
            document.getElementById('btn-delete-emp').onclick = () => app.deleteEmployee(id);
            document.getElementById('employee-modal').classList.remove('hidden');
        }
    },

    updateEmployeePhotoPreview: (url) => {
        const img = document.getElementById('emp-img-preview');
        const placeholder = document.getElementById('emp-img-placeholder');
        const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=perfil`;

        if (!img || !placeholder) return;

        if (url && url.startsWith('http')) {
            img.src = url;
            img.classList.remove('hidden');
            placeholder.classList.add('hidden');
            
            img.onerror = () => {
                img.src = defaultAvatar;
            };
        } else {
            img.src = defaultAvatar;
            img.classList.remove('hidden');
            placeholder.classList.add('hidden');
        }
    },

    saveEmployee: async (e) => {
        e.preventDefault();
        const id = document.getElementById('emp-id').value;
        const btn = e.submitter;
        
        const photoInput = document.getElementById('emp-photo-url');
        const photoUrl = photoInput ? photoInput.value : '';
        const passInput = document.getElementById('emp-pass');
        const password = passInput ? passInput.value : '';

        // Pega os dias selecionados no modal
        const activeEmpDays = Array.from(document.querySelectorAll('#emp-days-container input:checked')).map(i => i.value);

        const employeeData = {
            name: document.getElementById('emp-name').value,
            role: document.getElementById('emp-role').value,
            spec: document.getElementById('emp-spec').value,
            email: document.getElementById('emp-email').value,
            photoUrl: photoUrl,
            isBlocked: document.getElementById('emp-blocked') ? document.getElementById('emp-blocked').checked : false,
            schedule: {
                days: activeEmpDays,
                workStart: document.getElementById('emp-work-start').value,
                workEnd: document.getElementById('emp-work-end').value,
                lunchStart: document.getElementById('emp-lunch-start').value,
                lunchEnd: document.getElementById('emp-lunch-end').value,
            },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (password) {
            employeeData.password = password; 
        }

        btn.disabled = true;
        const originalText = btn.innerText;
        btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Salvando...';
        if (window.lucide) lucide.createIcons();

        try {
            if (id) {
                await db.collection("employees").doc(id).update(employeeData);
            } else {
                 if (!password || password.length < 6) {
                    alert("A senha é obrigatória para novos usuários e deve ter no mínimo 6 caracteres.");
                    throw new Error("Senha inválida");
                }
                employeeData.needsAuthCreation = true;
                employeeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection("employees").add(employeeData);
            }
            
            if(passInput) passInput.value = '';
            app.closeEmployeeModal();
            
        } catch (error) {
            console.error("Erro ao salvar no Firestore:", error);
            alert(error.message || "Erro ao salvar dados.");
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
            if (window.lucide) lucide.createIcons();
        }
    },

    deleteEmployee: async (id) => {
        if(confirm('Remover este funcionário?')) {
            try {
                await db.collection("employees").doc(id).delete();
                app.closeEmployeeModal();
            } catch (error) {
                alert("Erro ao excluir.");
            }
        }
    },

    // --- GESTÃO DE HORÁRIOS ---
    renderDays: () => {
        const container = document.getElementById('days-container');
        if(!container) return;
        container.innerHTML = '';
        daysOfWeek.forEach(day => {
            const label = document.createElement('label');
            const isDefaultActive = day !== 'Dom';
            
            label.className = `cursor-pointer border rounded-lg px-3 py-2 text-sm font-bold transition-all select-none flex items-center gap-2 ${isDefaultActive ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`;
            label.innerHTML = `<input type="checkbox" class="hidden" value="${day}" ${isDefaultActive ? 'checked' : ''}>${day}`;
            
            label.addEventListener('change', function() {
                const chk = this.querySelector('input');
                if (chk.checked) {
                    this.className = "cursor-pointer border rounded-lg px-3 py-2 text-sm font-bold transition-all select-none flex items-center gap-2 bg-amber-500/10 border-amber-500/50 text-amber-500";
                } else {
                    this.className = "cursor-pointer border rounded-lg px-3 py-2 text-sm font-bold transition-all select-none flex items-center gap-2 bg-zinc-900 border-zinc-800 text-zinc-500";
                }
            });
            container.appendChild(label);
        });
    },

    renderEmpDays: () => {
        const container = document.getElementById('emp-days-container');
        if(!container) return;
        container.innerHTML = '';
        daysOfWeek.forEach(day => {
            const label = document.createElement('label');
            const isDefaultActive = day !== 'Dom'; // Padrão
            
            label.className = `cursor-pointer border rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all select-none flex items-center gap-1 ${isDefaultActive ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`;
            label.innerHTML = `<input type="checkbox" class="hidden" value="${day}" ${isDefaultActive ? 'checked' : ''}>${day}`;
            
            label.addEventListener('change', function() {
                const chk = this.querySelector('input');
                if (chk.checked) {
                    this.className = "cursor-pointer border rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all select-none flex items-center gap-1 bg-amber-500/10 border-amber-500/50 text-amber-500";
                } else {
                    this.className = "cursor-pointer border rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all select-none flex items-center gap-1 bg-zinc-900 border-zinc-800 text-zinc-500";
                }
            });
            container.appendChild(label);
        });
    },

    loadSchedule: async () => {
        try {
            const doc = await db.collection("settings").doc("schedule").get();
            if (doc.exists) {
                const data = doc.data();
                
                if(document.getElementById('sched-open')) document.getElementById('sched-open').value = data.open || "09:00";
                if(document.getElementById('sched-close')) document.getElementById('sched-close').value = data.close || "20:00";

                if (data.days) {
                    const checkboxes = document.querySelectorAll('#days-container input');
                    checkboxes.forEach(input => {
                        const isDayActive = data.days.includes(input.value);
                        input.checked = isDayActive;
                        
                        const label = input.parentElement;
                        if (isDayActive) {
                            label.className = "cursor-pointer border rounded-lg px-3 py-2 text-sm font-bold transition-all select-none flex items-center gap-2 bg-amber-500/10 border-amber-500/50 text-amber-500";
                        } else {
                            label.className = "cursor-pointer border rounded-lg px-3 py-2 text-sm font-bold transition-all select-none flex items-center gap-2 bg-zinc-900 border-zinc-800 text-zinc-500";
                        }
                    });
                }
            }
        } catch (error) {
            console.error("Erro ao carregar horários:", error);
        }
    },

    saveSchedule: async () => {
        const activeDays = Array.from(document.querySelectorAll('#days-container input:checked')).map(i => i.value);
        const schedule = {
            days: activeDays,
            open: document.getElementById('sched-open').value,
            close: document.getElementById('sched-close').value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection("settings").doc("schedule").set(schedule);
            alert("Horários atualizados com sucesso!");
        } catch (error) {
            alert("Erro ao salvar horários.");
        }
    },

    // --- GESTÃO DA EMPRESA ---
    
    // NOVO: Função para o preview da logo
    updateCompanyLogoPreview: (url) => {
        const img = document.getElementById('comp-logo-preview');
        const placeholder = document.getElementById('comp-logo-placeholder');
        const defaultLogo = `https://ui-avatars.com/api/?name=Logo&background=27272a&color=f4f4f5`;

        if (!img || !placeholder) return;

        if (url && url.startsWith('http')) {
            img.src = url;
            img.classList.remove('hidden');
            placeholder.classList.add('hidden');
            
            img.onerror = () => {
                img.src = defaultLogo;
            };
        } else {
            img.src = defaultLogo;
            img.classList.remove('hidden');
            placeholder.classList.add('hidden');
        }
    },

    saveCompany: async () => {
        const companyData = {
            logoUrl: document.getElementById('comp-logo').value, // NOVO
            mapsUrl: document.getElementById('comp-maps').value, // NOVO
            about: document.getElementById('comp-about').value,
            phone: document.getElementById('comp-phone').value,
            email: document.getElementById('comp-email').value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection("settings").doc("company").set(companyData);
            alert("Dados da empresa salvos!");
        } catch (error) {
            alert("Erro ao salvar dados.");
        }
    },
    
    loadCompany: async () => {
        try {
            const doc = await db.collection("settings").doc("company").get();
            if (doc.exists) {
                const data = doc.data();
                if(document.getElementById('comp-logo')) document.getElementById('comp-logo').value = data.logoUrl || ""; // NOVO
                if(document.getElementById('comp-maps')) document.getElementById('comp-maps').value = data.mapsUrl || ""; // NOVO
                if(document.getElementById('comp-about')) document.getElementById('comp-about').value = data.about || "";
                if(document.getElementById('comp-phone')) document.getElementById('comp-phone').value = data.phone || "";
                if(document.getElementById('comp-email')) document.getElementById('comp-email').value = data.email || "";

                // NOVO: Atualiza a imagem de preview assim que os dados carregam
                if (app.updateCompanyLogoPreview) {
                    app.updateCompanyLogoPreview(data.logoUrl || "");
                }
            }
        } catch (error) {
            console.error("Erro ao carregar dados da empresa:", error);
        }
    },

    // --- GESTÃO DE CATEGORIAS ---
    listenToCategories: () => {
        db.collection("categories").orderBy("name").onSnapshot((snapshot) => {
            categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            app.renderCategoryOptions();
        });
    },

    renderCategoryOptions: () => {
        const select = document.getElementById('photo-category');
        if (!select) return;

        if (categories.length === 0) {
            select.innerHTML = '<option value="" disabled selected>Crie uma categoria primeiro</option>';
            return;
        }

        select.innerHTML = categories.map(cat => 
            `<option value="${cat.name}">${cat.name}</option>`
        ).join('');
    },

    addCategory: async () => {
        const input = document.getElementById('new-category-name');
        if (!input) return;
        const name = input.value.trim();

        if (!name) return;

        try {
            const exists = await db.collection("categories").where("name", "==", name).get();
            if (!exists.empty) {
                alert("Esta categoria já existe.");
                return;
            }

            await db.collection("categories").add({
                name: name,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            input.value = '';
        } catch (error) {
            console.error("Erro ao adicionar categoria:", error);
            alert("Erro ao salvar categoria.");
        }
    },

    // --- GESTÃO DE GALERIA ---
    listenToGallery: () => {
        db.collection("gallery").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
            gallery = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            app.renderGallery();
        });
    },

    renderGallery: () => {
        const grid = document.getElementById('gallery-grid');
        if(!grid) return;
        grid.innerHTML = '';
        gallery.forEach((item) => {
            const div = document.createElement('div');
            div.className = "aspect-square rounded-xl bg-zinc-800 overflow-hidden relative group border border-zinc-800";
            div.innerHTML = `
                <img src="${item.url}" class="w-full h-full object-cover transition-transform group-hover:scale-110">
                <div class="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-bold text-zinc-300 border border-white/10 uppercase tracking-wider">
                    ${item.category || 'Geral'}
                </div>
                <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                     <button class="p-2 bg-red-500/80 rounded-full hover:bg-red-500 text-white" onclick="app.deletePhoto('${item.id}')">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                     </button>
                </div>`;
            grid.appendChild(div);
        });
        
        const addBtn = document.createElement('div');
        addBtn.className = "aspect-square rounded-xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center text-zinc-600 hover:text-amber-500 hover:border-amber-500/50 cursor-pointer transition-all";
        addBtn.innerHTML = `<i data-lucide="plus" class="w-8 h-8"></i><span class="text-[10px] font-bold">ADD</span>`;
        addBtn.onclick = () => app.uploadPhoto();
        grid.appendChild(addBtn);
        lucide.createIcons();
    },

    uploadPhoto: () => {
        document.getElementById('gallery-modal').classList.remove('hidden');
        lucide.createIcons();
    },

    closeGalleryModal: () => {
        document.getElementById('gallery-modal').classList.add('hidden');
        document.getElementById('gallery-form').reset();
        document.getElementById('img-preview').classList.add('hidden');
        document.getElementById('preview-placeholder').classList.remove('hidden');
    },

    updatePhotoPreview: (url) => {
        const img = document.getElementById('img-preview');
        const placeholder = document.getElementById('preview-placeholder');
        
        if (url && url.startsWith('http')) {
            img.src = url;
            img.classList.remove('hidden');
            placeholder.classList.add('hidden');
        } else {
            img.classList.add('hidden');
            placeholder.classList.remove('hidden');
        }
    },

    handleGallerySubmit: async (e) => {
        e.preventDefault();
        const url = document.getElementById('photo-url').value;
        const category = document.getElementById('photo-category').value;
        const btn = e.target.querySelector('button[type="submit"]');

        if(!category) {
            alert("Por favor, selecione uma categoria.");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Publicando...';
        lucide.createIcons();

        try {
            await db.collection("gallery").add({
                url: url,
                category: category,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            app.closeGalleryModal();
        } catch (error) {
            console.error("Erro ao salvar foto:", error);
            alert("Erro ao salvar foto na galeria.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="upload-cloud" class="w-5 h-5"></i> Publicar na Galeria';
            lucide.createIcons();
        }
    },

    deletePhoto: async (id) => {
        if(confirm('Remover foto da galeria?')) {
            try {
                await db.collection("gallery").doc(id).delete();
            } catch (error) {
                alert("Erro ao excluir.");
            }
        }
    }
};

// Iniciar app
document.addEventListener('DOMContentLoaded', app.init);