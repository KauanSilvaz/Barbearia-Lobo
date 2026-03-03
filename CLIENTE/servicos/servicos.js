/* servicos.js */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAmljKXhjb9GlY1ABEA-GPJqNsftsv_hVk",
  authDomain: "ksstech-79520.firebaseapp.com",
  projectId: "ksstech-79520",
  storageBucket: "ksstech-79520.firebasestorage.app",
  messagingSenderId: "935997511388",
  appId: "1:935997511388:web:9c336727d3e588ee30c619",
  measurementId: "G-TM49C8N0T1"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

let services = [];
let categories = []; 
let currentFilter = 'all';

const app = {
    init: () => {
        onSnapshot(collection(db, "services"), (snapshot) => {
            services = [];
            snapshot.forEach((doc) => {
                services.push({ id: doc.id, ...doc.data() });
            });
            app.renderGrid();
            app.updateStats();
        });

        onSnapshot(collection(db, "categories"), (snapshot) => {
            categories = [];
            snapshot.forEach((doc) => {
                categories.push({ id: doc.id, ...doc.data() });
            });
            app.populateCategorySelect();
            if(!document.getElementById('category-modal').classList.contains('hidden')){
                app.renderCategoryList();
            }
            app.renderGrid(); 
        });
        
        document.getElementById('form-is-promo').addEventListener('change', (e) => {
            const field = document.getElementById('promo-fields');
            if(e.target.checked) field.classList.remove('hidden');
            else field.classList.add('hidden');
        });

        document.getElementById('service-form').onsubmit = app.handleFormSubmit;
        document.getElementById('btn-delete').onclick = app.deleteService;
        
        lucide.createIcons();
    },

    updateStats: () => {
        document.getElementById('stat-services').innerText = services.filter(s => s.type === 'service').length;
        document.getElementById('stat-combos').innerText = services.filter(s => s.type === 'combo').length;
        document.getElementById('stat-promos').innerText = services.filter(s => s.isPromo).length;
    },

    filter: (type) => {
        currentFilter = type;
        const ids = ['filter-all', 'filter-service', 'filter-combo'];
        ids.forEach(id => {
            const btn = document.getElementById(id);
            if(id === `filter-${type}`) {
                btn.className = "px-4 py-1.5 text-xs font-medium rounded-md bg-zinc-800 text-white shadow-sm";
            } else {
                btn.className = "px-4 py-1.5 text-xs font-medium rounded-md text-zinc-400 hover:text-white";
            }
        });
        app.renderGrid();
    },

    renderGrid: () => {
        const grid = document.getElementById('services-grid');
        grid.innerHTML = '';
        const filtered = services.filter(s => currentFilter === 'all' ? true : s.type === currentFilter);

        filtered.forEach(s => {
            const hasPromo = s.isPromo && s.promoPrice;
            const complexityClass = s.complexity || 'facil';
            // Se isActive não existir no banco (itens antigos), consideramos true por padrão
            const isActive = s.isActive !== false; 
            
            const cat = categories.find(c => c.id === s.categoryId);
            const categoryName = cat ? cat.name : 'Sem Categoria';
            
            const card = document.createElement('div');
            // Adiciona opacidade e tons de cinza se estiver suspenso
            card.className = `relative flex flex-col bg-zinc-900 border rounded-xl p-5 transition-all hover:-translate-y-1 cursor-pointer ${s.type === 'combo' ? 'border-amber-500/30' : 'border-zinc-800'} ${!isActive ? 'opacity-60 grayscale' : ''}`;
            
            const imgHTML = s.image ? `<img src="${s.image}" alt="${s.name}" class="w-full h-32 object-cover rounded-lg mb-4 border border-zinc-800/50">` : '';
            const descHTML = s.description ? `<p class="text-xs text-zinc-400 mb-4 line-clamp-2 flex-grow">${s.description}</p>` : '<div class="flex-grow"></div>';
            const suspendedBadge = !isActive ? `<span class="bg-red-500/10 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/20">SUSPENSO</span>` : '';

            card.innerHTML = `
                ${imgHTML}
                <div class="flex items-start justify-between mb-3">
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center ${s.type === 'combo' ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400'}">
                        <i data-lucide="${s.type === 'combo' ? 'layers' : 'scissors'}" class="w-5 h-5"></i>
                    </div>
                    <div class="flex gap-2 items-center flex-wrap justify-end">
                        ${suspendedBadge}
                        <span class="bg-zinc-800 text-zinc-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-zinc-700">${categoryName}</span>
                        ${hasPromo ? '<span class="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded-full">PROMO</span>' : ''}
                    </div>
                </div>
                <h3 class="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <span class="complexity-dot bg-${complexityClass}"></span>
                    ${s.name}
                </h3>
                <p class="text-xs text-zinc-500 mb-2">${s.type === 'combo' ? 'Combo Promocional' : 'Serviço Único'}</p>
                ${descHTML}
                <div class="flex items-center justify-between pt-3 border-t border-zinc-800/50 mt-auto">
                    <span class="text-zinc-400 text-xs flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> ${s.duration} min</span>
                    <span class="font-bold text-lg ${hasPromo ? 'text-emerald-500' : 'text-white'}">€ ${(hasPromo ? s.promoPrice : s.price).toFixed(2)}</span>
                </div>
            `;
            card.onclick = () => app.openModal(s.id);
            grid.appendChild(card);
        });
        lucide.createIcons();
    },

    openModal: (id = null) => {
        const form = document.getElementById('service-form');
        form.reset();
        document.getElementById('form-id').value = id || '';
        document.getElementById('promo-fields').classList.add('hidden');
        document.getElementById('btn-delete').classList.toggle('hidden', !id);

        if(id) {
            const s = services.find(x => x.id === id);
            document.getElementById('modal-title').innerText = 'Editar Item';
            document.getElementById('form-name').value = s.name;
            document.getElementById('form-price').value = s.price;
            document.getElementById('form-duration').value = s.duration;
            document.getElementById('form-complexity').value = s.complexity || 'facil';
            document.getElementById('form-category').value = s.categoryId || '';
            
            // NOVOS CAMPOS:
            document.getElementById('form-image').value = s.image || '';
            document.getElementById('form-description').value = s.description || '';
            document.getElementById('form-is-active').checked = s.isActive !== false; // Padrão é true
            
            app.setType(s.type);
            if(s.isPromo) {
                document.getElementById('form-is-promo').checked = true;
                document.getElementById('promo-fields').classList.remove('hidden');
                document.getElementById('form-promo-price').value = s.promoPrice;
            }
        } else {
            document.getElementById('modal-title').innerText = 'Novo Serviço';
            document.getElementById('form-complexity').value = 'facil';
            document.getElementById('form-category').value = ''; 
            
            // RESET NOVOS CAMPOS:
            document.getElementById('form-image').value = '';
            document.getElementById('form-description').value = '';
            document.getElementById('form-is-active').checked = true; // Por padrão, começa ativo
            
            app.setType('service');
        }
        document.getElementById('service-modal').classList.remove('hidden');
    },

    closeModal: () => document.getElementById('service-modal').classList.add('hidden'),

    setType: (type) => {
        document.getElementById('form-type').value = type;
        const isCombo = type === 'combo';
        document.getElementById('type-combo').className = isCombo ? "flex-1 py-2 text-sm font-medium rounded-md bg-zinc-800 text-white" : "flex-1 py-2 text-sm font-medium rounded-md text-zinc-400";
        document.getElementById('type-service').className = !isCombo ? "flex-1 py-2 text-sm font-medium rounded-md bg-zinc-800 text-white" : "flex-1 py-2 text-sm font-medium rounded-md text-zinc-400";
        document.getElementById('combo-selection').classList.toggle('hidden', !isCombo);
        if(isCombo) app.renderComboList();
    },

    renderComboList: () => {
        const list = document.getElementById('combo-items-list');
        list.innerHTML = '';
        services.filter(s => s.type === 'service').forEach(s => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between bg-zinc-900 p-2 rounded border border-zinc-800';
            div.innerHTML = `
                <div class="flex items-center gap-2">
                    <input type="checkbox" value="${s.id}" class="combo-item-cb" onchange="app.calcComboSuggestion()">
                    <span class="text-sm text-zinc-300">${s.name}</span>
                </div>
                <span class="text-xs text-zinc-500">€${s.price.toFixed(2)}</span>
            `;
            list.appendChild(div);
        });
    },

    calcComboSuggestion: () => {
        const checks = document.querySelectorAll('.combo-item-cb:checked');
        let p = 0, t = 0;
        checks.forEach(c => {
            const s = services.find(x => x.id === c.value);
            p += s.price; t += s.duration;
        });
        document.getElementById('combo-suggested-price').innerText = `€ ${p.toFixed(2)}`;
        document.getElementById('combo-suggested-time').innerText = `${t} min`;
    },

    handleFormSubmit: async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('form-id').value;
        const serviceData = {
            type: document.getElementById('form-type').value,
            name: document.getElementById('form-name').value,
            categoryId: document.getElementById('form-category').value, 
            complexity: document.getElementById('form-complexity').value,
            price: parseFloat(document.getElementById('form-price').value),
            duration: parseInt(document.getElementById('form-duration').value),
            isPromo: document.getElementById('form-is-promo').checked,
            promoPrice: parseFloat(document.getElementById('form-promo-price').value) || null,
            
            // NOVOS DADOS PARA SALVAR:
            image: document.getElementById('form-image').value,
            description: document.getElementById('form-description').value,
            isActive: document.getElementById('form-is-active').checked
        };

        try {
            if (id) {
                await updateDoc(doc(db, "services", id), serviceData);
            } else {
                await addDoc(collection(db, "services"), serviceData);
            }
            app.closeModal();
        } catch (error) {
            console.error("Erro ao salvar serviço: ", error);
            alert("Erro ao salvar. Verifique o console.");
        }
    },

    deleteService: async () => {
        const id = document.getElementById('form-id').value;
        if(id && confirm("Tem certeza que deseja excluir este item?")) {
            try {
                await deleteDoc(doc(db, "services", id));
                app.closeModal();
            } catch (error) {
                console.error("Erro ao excluir serviço: ", error);
            }
        }
    },

    // --- MÉTODOS DE CATEGORIAS ---

    populateCategorySelect: () => {
        const select = document.getElementById('form-category');
        select.innerHTML = '<option value="" disabled selected>Selecione uma categoria...</option>';
        if (categories.length === 0) {
            select.innerHTML = '<option value="" disabled selected>Crie uma categoria primeiro</option>';
            return;
        }
        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.innerText = c.name;
            select.appendChild(opt);
        });
    },

    openCategoryModal: () => {
        document.getElementById('category-form').reset();
        document.getElementById('category-form-id').value = '';
        app.renderCategoryList();
        document.getElementById('category-modal').classList.remove('hidden');
    },

    closeCategoryModal: () => {
        document.getElementById('category-modal').classList.add('hidden');
    },

    renderCategoryList: () => {
        const list = document.getElementById('category-list');
        list.innerHTML = '';
        
        if (categories.length === 0) {
            list.innerHTML = '<p class="text-xs text-zinc-500 text-center py-4">Nenhuma categoria cadastrada.</p>';
            return;
        }

        categories.forEach(c => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between bg-zinc-950 p-3 rounded-lg border border-zinc-800';
            div.innerHTML = `
                <span class="text-sm font-medium text-zinc-100">${c.name}</span>
                <div class="flex items-center gap-2">
                    <button type="button" onclick="app.editCategory('${c.id}')" class="text-zinc-500 hover:text-amber-500 transition-colors"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                    <button type="button" onclick="app.deleteCategory('${c.id}')" class="text-zinc-500 hover:text-red-500 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            `;
            list.appendChild(div);
        });
        lucide.createIcons();
    },

    handleCategorySubmit: async (e) => {
        e.preventDefault();
        const id = document.getElementById('category-form-id').value;
        const name = document.getElementById('category-form-name').value;

        try {
            if (id) {
                await updateDoc(doc(db, "categories", id), { name });
            } else {
                await addDoc(collection(db, "categories"), { name });
            }
            document.getElementById('category-form').reset();
            document.getElementById('category-form-id').value = '';
        } catch (error) {
            console.error("Erro ao salvar categoria:", error);
        }
    },

    editCategory: (id) => {
        const cat = categories.find(c => c.id === id);
        if(cat) {
            document.getElementById('category-form-id').value = cat.id;
            document.getElementById('category-form-name').value = cat.name;
            document.getElementById('category-form-name').focus();
        }
    },

    deleteCategory: async (id) => {
        const inUse = services.some(s => s.categoryId === id);
        if (inUse) {
            alert("Não é possível excluir: existem serviços usando esta categoria.");
            return;
        }

        if(confirm("Deseja realmente excluir esta categoria?")) {
            try {
                await deleteDoc(doc(db, "categories", id));
            } catch (error) {
                console.error("Erro ao excluir categoria:", error);
            }
        }
    }
};

window.app = app;
document.addEventListener('DOMContentLoaded', app.init);