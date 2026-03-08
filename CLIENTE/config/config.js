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
        app.syncCompanyLogo();

        const galleryForm = document.getElementById('gallery-form');
        if(galleryForm) galleryForm.onsubmit = app.handleGallerySubmit;

        // Lógica de estilo dos checkboxes de função
        document.querySelectorAll('.role-checkbox').forEach(chk => {
            chk.addEventListener('change', function() {
                if (this.checked) {
                    this.parentElement.className = "cursor-pointer border rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all select-none flex items-center gap-1 bg-amber-500/10 border-amber-500/50 text-amber-500";
                } else {
                    this.parentElement.className = "cursor-pointer border rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all select-none flex items-center gap-1 bg-zinc-900 border-zinc-800 text-zinc-500";
                }
            });
        });

        app.listenToTeam();
        app.listenToGallery();
        app.listenToCategories(); 
        app.loadCompany();
        app.loadSchedule();
        app.renderDays();
        app.renderEmpDays(); 
        lucide.createIcons();
        
        const form = document.getElementById('employee-form');
        if(form) form.onsubmit = app.saveEmployee;
    },

    syncCompanyLogo: () => {
        const watermarkImg = document.getElementById('watermark-img');
        const headerLogo = document.getElementById('header-logo');

        if (!watermarkImg && !headerLogo) return;

        db.collection("settings").doc("company").onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                if (data.logoUrl) {
                    if (watermarkImg) watermarkImg.src = data.logoUrl;
                    if (headerLogo) headerLogo.src = data.logoUrl;
                }
            }
        });
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
            card.className = `bg-zinc-900 border p-4 rounded-xl flex flex-row items-center justify-between group transition-colors ${blockedStyle}`;
            
            const photoUrl = emp.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${emp.name || 'default'}`;
            const badge = emp.isBlocked ? `<span class="bg-red-500/20 text-red-500 text-[9px] px-2 py-0.5 rounded-full font-bold ml-2 border border-red-500/20 uppercase">Bloqueado</span>` : '';
            
            const rolesDisplay = Array.isArray(emp.role) ? emp.role.join(', ') : (emp.role || 'Não definida');

            card.innerHTML = `
                <div class="flex items-center gap-3 sm:gap-4 overflow-hidden">
                    <img src="${photoUrl}" alt="${emp.name}" class="w-12 h-12 rounded-full object-cover border-2 border-zinc-700 bg-zinc-800 flex-shrink-0">
                    <div class="truncate pr-2">
                        <h3 class="font-bold text-white text-sm flex items-center flex-wrap gap-1">${emp.name} ${badge}</h3>
                        <p class="text-xs text-zinc-500 truncate">${rolesDisplay} • ${emp.spec || 'Geral'}</p>
                    </div>
                </div>
                <button onclick="app.editEmployee('${emp.id}')" class="p-2.5 text-zinc-500 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors flex-shrink-0">
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
        
        // Resetando os checkboxes de funções
        document.querySelectorAll('.role-checkbox').forEach(chk => {
            chk.checked = false;
            chk.parentElement.className = "cursor-pointer border rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all select-none flex items-center gap-1 bg-zinc-900 border-zinc-800 text-zinc-500";
        });

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
            document.getElementById('emp-spec').value = emp.spec || '';
            document.getElementById('emp-email').value = emp.email;
            document.getElementById('emp-pass').value = emp.password || '';
            
            // Lógica para marcar as funções corretas
            const selectedRoles = Array.isArray(emp.role) ? emp.role : [emp.role]; // Fallback para dados antigos
            document.querySelectorAll('.role-checkbox').forEach(chk => {
                if (selectedRoles.includes(chk.value)) {
                    chk.checked = true;
                    chk.parentElement.className = "cursor-pointer border rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all select-none flex items-center gap-1 bg-amber-500/10 border-amber-500/50 text-amber-500";
                } else {
                    chk.checked = false;
                    chk.parentElement.className = "cursor-pointer border rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all select-none flex items-center gap-1 bg-zinc-900 border-zinc-800 text-zinc-500";
                }
            });

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
        
        // Pega os cargos selecionados primeiro para validar
        const selectedRoles = Array.from(document.querySelectorAll('.role-checkbox:checked')).map(chk => chk.value);
        
        if(selectedRoles.length === 0) {
            alert("Por favor, selecione pelo menos uma Função.");
            return;
        }

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
            role: selectedRoles,
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
        const originalText = btn.innerHTML;
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
            btn.innerHTML = originalText;
            btn.disabled = false;
            if (window.lucide) lucide.createIcons();
        }
    },

    deleteEmployee: async (id) => {
        if(confirm('Tem a certeza de que pretende remover este funcionário?')) {
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
        const container = document.getElementById('daily-schedules-container');
        if(!container) return;
        container.innerHTML = '';
        
        daysOfWeek.forEach(day => {
            const dayId = day.toLowerCase(); // seg, ter, qua...
            const isDefaultActive = day !== 'Dom';
            
            const dayRow = document.createElement('div');
            // Estilo da linha adaptável: colunas no telemóvel, linha no pc
            dayRow.className = "flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 transition-all";
            
            dayRow.innerHTML = `
                <div class="w-full sm:w-32 flex-shrink-0">
                    <label class="cursor-pointer flex items-center gap-3">
                        <input type="checkbox" id="chk-${dayId}" value="${day}" 
                            class="w-5 h-5 sm:w-4 sm:h-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-zinc-950 accent-amber-500" 
                            ${isDefaultActive ? 'checked' : ''} onchange="app.toggleDayInputs('${dayId}')">
                        <span class="text-sm font-bold text-zinc-100">${day}</span>
                    </label>
                </div>
                
                <div class="flex flex-row gap-2 sm:gap-4 items-center flex-1 transition-opacity duration-300 ${isDefaultActive ? 'opacity-100' : 'opacity-50 pointer-events-none'}" id="inputs-${dayId}">
                    <div class="flex-1 relative">
                        <label class="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Abertura</label>
                        <input type="time" id="open-${dayId}" value="09:00" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 sm:px-3 py-2.5 sm:py-2 text-zinc-100 focus:border-amber-500 outline-none text-sm text-center sm:text-left">
                    </div>
                    <span class="text-zinc-600 mt-5 hidden sm:inline">-</span>
                    <span class="text-zinc-600 mt-5 sm:hidden">a</span>
                    <div class="flex-1 relative">
                        <label class="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Fecho</label>
                        <input type="time" id="close-${dayId}" value="20:00" class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 sm:px-3 py-2.5 sm:py-2 text-zinc-100 focus:border-amber-500 outline-none text-sm text-center sm:text-left">
                    </div>
                </div>
            `;
            container.appendChild(dayRow);
        });
    },

    toggleDayInputs: (dayId) => {
        const chk = document.getElementById(`chk-${dayId}`);
        const inputs = document.getElementById(`inputs-${dayId}`);
        if(chk && inputs) {
            if(chk.checked) {
                inputs.classList.remove('opacity-50', 'pointer-events-none');
                inputs.classList.add('opacity-100');
            } else {
                inputs.classList.remove('opacity-100');
                inputs.classList.add('opacity-50', 'pointer-events-none');
            }
        }
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
                
                if (data.dailySchedules) {
                    daysOfWeek.forEach(day => {
                        const dayId = day.toLowerCase();
                        const schedule = data.dailySchedules[day];
                        
                        const chk = document.getElementById(`chk-${dayId}`);
                        const openInput = document.getElementById(`open-${dayId}`);
                        const closeInput = document.getElementById(`close-${dayId}`);
                        
                        if (schedule && chk && openInput && closeInput) {
                            chk.checked = schedule.active;
                            openInput.value = schedule.open || "09:00";
                            closeInput.value = schedule.close || "20:00";
                            app.toggleDayInputs(dayId);
                        }
                    });
                } else if (data.days) {
                    daysOfWeek.forEach(day => {
                        const dayId = day.toLowerCase();
                        const chk = document.getElementById(`chk-${dayId}`);
                        const openInput = document.getElementById(`open-${dayId}`);
                        const closeInput = document.getElementById(`close-${dayId}`);
                        
                        if(chk) {
                            chk.checked = data.days.includes(day);
                            if(openInput) openInput.value = data.open || "09:00";
                            if(closeInput) closeInput.value = data.close || "20:00";
                            app.toggleDayInputs(dayId);
                        }
                    });
                }
            }
        } catch (error) {
            console.error("Erro ao carregar horários:", error);
        }
    },

    saveSchedule: async (event) => {
        const dailySchedules = {};
        let activeDays = [];
        
        daysOfWeek.forEach(day => {
            const dayId = day.toLowerCase();
            const chk = document.getElementById(`chk-${dayId}`);
            const openInput = document.getElementById(`open-${dayId}`);
            const closeInput = document.getElementById(`close-${dayId}`);
            
            if (chk) {
                dailySchedules[day] = {
                    active: chk.checked,
                    open: openInput ? openInput.value : "09:00",
                    close: closeInput ? closeInput.value : "20:00"
                };
                
                if(chk.checked) activeDays.push(day);
            }
        });

        const schedule = {
            days: activeDays,
            dailySchedules: dailySchedules,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const btn = event ? event.currentTarget : document.querySelector('#section-schedule button');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Salvando...';
        if (window.lucide) lucide.createIcons();

        try {
            await db.collection("settings").doc("schedule").set(schedule);
            alert("Horários atualizados com sucesso!");
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar horários.");
        } finally {
            btn.innerHTML = originalHTML;
            if (window.lucide) lucide.createIcons();
        }
    },

    // --- GESTÃO DA EMPRESA ---
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
            logoUrl: document.getElementById('comp-logo').value, 
            mapsUrl: document.getElementById('comp-maps').value, 
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
                if(document.getElementById('comp-logo')) document.getElementById('comp-logo').value = data.logoUrl || ""; 
                if(document.getElementById('comp-maps')) document.getElementById('comp-maps').value = data.mapsUrl || ""; 
                if(document.getElementById('comp-about')) document.getElementById('comp-about').value = data.about || "";
                if(document.getElementById('comp-phone')) document.getElementById('comp-phone').value = data.phone || "";
                if(document.getElementById('comp-email')) document.getElementById('comp-email').value = data.email || "";

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
        const container = document.getElementById('photo-categories-container');
        if (!container) return;

        if (categories.length === 0) {
            container.innerHTML = '<span class="text-xs text-zinc-500">Crie uma categoria primeiro</span>';
            return;
        }

        container.innerHTML = categories.map(cat => `
            <label class="cursor-pointer border rounded-lg px-3 py-1.5 text-xs font-bold transition-all select-none flex items-center gap-2 bg-zinc-900 border-zinc-800 text-zinc-500">
                <input type="checkbox" class="hidden category-checkbox" value="${cat.name}">
                ${cat.name}
            </label>
        `).join('');

        document.querySelectorAll('.category-checkbox').forEach(chk => {
            chk.addEventListener('change', function() {
                if (this.checked) {
                    this.parentElement.className = "cursor-pointer border rounded-lg px-3 py-1.5 text-xs font-bold transition-all select-none flex items-center gap-2 bg-amber-500/10 border-amber-500/50 text-amber-500";
                } else {
                    this.parentElement.className = "cursor-pointer border rounded-lg px-3 py-1.5 text-xs font-bold transition-all select-none flex items-center gap-2 bg-zinc-900 border-zinc-800 text-zinc-500";
                }
            });
        });
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
            const catDisplay = Array.isArray(item.category) ? item.category.join(', ') : (item.category || 'Geral');

            const div = document.createElement('div');
            div.className = "aspect-square rounded-xl bg-zinc-800 overflow-hidden relative group border border-zinc-800 shadow-md";
            div.innerHTML = `
                <img src="${item.url}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110">
                <div class="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-bold text-zinc-300 border border-white/10 uppercase tracking-wider max-w-[80%] truncate">
                    ${catDisplay}
                </div>
                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                     <button type="button" class="p-2.5 bg-amber-500 rounded-full hover:bg-amber-400 text-white shadow-lg transition-transform hover:scale-110" onclick="app.editPhoto('${item.id}')">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                     </button>
                     <button type="button" class="p-2.5 bg-red-500 rounded-full hover:bg-red-400 text-white shadow-lg transition-transform hover:scale-110" onclick="app.deletePhoto('${item.id}')">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                     </button>
                </div>`;
            grid.appendChild(div);
        });
        
        const addBtn = document.createElement('div');
        addBtn.className = "aspect-square rounded-xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center text-zinc-600 hover:text-amber-500 hover:border-amber-500/50 cursor-pointer transition-all bg-zinc-900/50 hover:bg-zinc-900";
        addBtn.innerHTML = `<i data-lucide="plus" class="w-8 h-8"></i><span class="text-[10px] font-bold mt-1">NOVA FOTO</span>`;
        addBtn.onclick = () => app.uploadPhoto();
        grid.appendChild(addBtn);
        lucide.createIcons();
    },

    uploadPhoto: () => {
        document.getElementById('photo-id').value = '';
        document.getElementById('gallery-form').reset();
        document.getElementById('gallery-modal-title').innerHTML = '<i data-lucide="image-plus" class="w-5 h-5 text-amber-500"></i> Adicionar à Galeria';
        app.updatePhotoPreview('');
        app.renderCategoryOptions(); 
        document.getElementById('gallery-modal').classList.remove('hidden');
        lucide.createIcons();
    },

    editPhoto: (id) => {
        const item = gallery.find(g => g.id === id);
        if (!item) return;

        document.getElementById('photo-id').value = item.id;
        document.getElementById('photo-url').value = item.url;
        document.getElementById('gallery-modal-title').innerHTML = '<i data-lucide="edit" class="w-5 h-5 text-amber-500"></i> Editar Foto';
        app.updatePhotoPreview(item.url);

        app.renderCategoryOptions(); 
        
        setTimeout(() => {
            const selectedCats = Array.isArray(item.category) ? item.category : [item.category];
            document.querySelectorAll('.category-checkbox').forEach(chk => {
                if (selectedCats.includes(chk.value)) {
                    chk.checked = true;
                    chk.parentElement.className = "cursor-pointer border rounded-lg px-3 py-1.5 text-xs font-bold transition-all select-none flex items-center gap-2 bg-amber-500/10 border-amber-500/50 text-amber-500";
                }
            });
        }, 50);

        document.getElementById('gallery-modal').classList.remove('hidden');
        lucide.createIcons();
    },

    closeGalleryModal: () => {
        document.getElementById('gallery-modal').classList.add('hidden');
        document.getElementById('gallery-form').reset();
        document.getElementById('photo-id').value = '';
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
        const id = document.getElementById('photo-id').value;
        const url = document.getElementById('photo-url').value;
        
        const selectedCategories = Array.from(document.querySelectorAll('.category-checkbox:checked')).map(chk => chk.value);

        if(selectedCategories.length === 0) {
            alert("Por favor, selecione pelo menos uma categoria.");
            return;
        }

        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Salvando...';
        lucide.createIcons();

        try {
            const photoData = {
                url: url,
                category: selectedCategories, 
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (id) {
                await db.collection("gallery").doc(id).update(photoData);
            } else {
                photoData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection("gallery").add(photoData);
            }
            app.closeGalleryModal();
        } catch (error) {
            console.error("Erro ao salvar foto:", error);
            alert("Erro ao salvar foto na galeria.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    },

    deletePhoto: async (id) => {
        if(confirm('Tem a certeza de que pretende remover esta foto da galeria?')) {
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