import { db } from './firebase-config.js';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- VERIFICAÇÃO DE LOGIN ---
const loggedBarberId = localStorage.getItem('loggedBarberId') || sessionStorage.getItem('loggedBarberId');
const loggedBarberName = localStorage.getItem('loggedBarberName') || sessionStorage.getItem('loggedBarberName');
const loggedBarberPhoto = localStorage.getItem('loggedBarberPhoto') || sessionStorage.getItem('loggedBarberPhoto');

if (!loggedBarberId) {
    window.location.href = 'login.html';
}

document.getElementById('barber-name').textContent = loggedBarberName;
if (loggedBarberPhoto) {
    document.getElementById('barber-photo').src = loggedBarberPhoto;
    document.getElementById('barber-photo').classList.remove('hidden');
    document.getElementById('barber-icon').classList.add('hidden');
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 9); // 9h às 21h

// Utils
const getLocalYYYYMMDD = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().split('T')[0];
};

const formatMinutesToTime = (minutes) => {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
};

const timeToMins = (timeStr) => {
    if(!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

const app = {
    currentDate: new Date(),
    view: 'agenda',
    appointments: [], 
    historyData: [],
    users: [],
    services: [],
    currentEmployee: null, 
    isCreatingNewClient: false,
    currentPaymentTotal: 0,

    init: () => {
        app.setupFirebaseListeners();
        app.syncCompanyLogo();
        app.setupPaymentListeners();
        
        // Garante que o botão do mobile chame a abertura do modal corretamente
        document.getElementById('fab-new').onclick = () => app.openModal();
        
        lucide.createIcons();
    },

    showToast: (msg) => {
        const existing = document.getElementById('custom-toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.id = 'custom-toast';
        toast.className = 'fixed top-24 left-1/2 -translate-x-1/2 bg-red-600 text-white px-5 py-3 rounded-xl shadow-2xl z-[100] animate-slideUp text-sm font-bold border border-red-500 flex items-center gap-2 transition-all duration-300';
        toast.innerHTML = `<i data-lucide="alert-circle" class="w-5 h-5"></i> ${msg}`;
        document.body.appendChild(toast);
        if (window.lucide) lucide.createIcons();
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, -20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    syncCompanyLogo: () => {
        const watermarkImg = document.getElementById('watermark-img');
        if (!watermarkImg) return;
        onSnapshot(doc(db, "settings", "company"), (snapshot) => {
            if (snapshot.exists() && snapshot.data().logoUrl) {
                watermarkImg.src = snapshot.data().logoUrl;
            }
        });
    },

    setupFirebaseListeners: () => {
        onSnapshot(doc(db, "employees", loggedBarberId), (docSnap) => {
            if (docSnap.exists()) {
                app.currentEmployee = docSnap.data();
                app.renderGrid(); 
            }
        });

        const qBookings = query(collection(db, "bookings"), where("barberId", "==", loggedBarberId));
        onSnapshot(qBookings, (snapshot) => {
            app.appointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            app.updateMetrics();
            app.renderGrid();
        });

        const qHistory = query(collection(db, "history"), where("barberId", "==", loggedBarberId));
        onSnapshot(qHistory, (snapshot) => {
            app.historyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            app.updateMetrics();
            app.renderHistory();
        });

        onSnapshot(collection(db, "users"), (snapshot) => {
            app.users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            app.updateSelectOptions(document.getElementById('appt-client'), app.users, "Selecione um Cliente");
        });

        onSnapshot(collection(db, "services"), (snapshot) => {
            app.services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            app.updateSelectOptions(document.getElementById('appt-service'), app.services, "Selecione um Serviço");
        });
    },

    updateSelectOptions: (selectEl, data, placeholder = null) => {
        selectEl.innerHTML = '';
        if (placeholder) {
            selectEl.add(new Option(placeholder, '', true, true));
            selectEl.options[0].disabled = true;
        }
        data.forEach(item => selectEl.add(new Option(item.name, item.id)));
    },

    updateMetrics: () => {
        const todayStr = getLocalYYYYMMDD(app.currentDate);
        const currentMonth = app.currentDate.getMonth();
        const currentYear = app.currentDate.getFullYear();

        let moneyToday = 0;
        let moneyMonth = 0;
        let totalMonthCount = 0;
        let clientsTodayCount = 0;

        app.historyData.forEach(h => {
            const hDate = new Date(h.date || h.completedAt);
            const price = Number(h.finalPrice || h.price) || 0;

            if (h.date === todayStr) moneyToday += price;
            
            if (hDate.getMonth() === currentMonth && hDate.getFullYear() === currentYear) {
                moneyMonth += price;
                totalMonthCount++;
            }
        });

        app.appointments.forEach(a => {
            if (a.date === todayStr) clientsTodayCount++;
        });

        document.getElementById('metric-today-money').innerHTML = `€ ${moneyToday.toFixed(2)} <span class="block text-[11px] text-emerald-400 mt-1 border-t border-zinc-700/50 pt-1">Teu: € ${(moneyToday * 0.5).toFixed(2)}</span>`;
        document.getElementById('metric-month-money').innerHTML = `€ ${moneyMonth.toFixed(2)} <span class="block text-[11px] text-emerald-400 mt-1 border-t border-zinc-700/50 pt-1">Teu: € ${(moneyMonth * 0.5).toFixed(2)}</span>`;
        
        document.getElementById('metric-today-clients').innerHTML = `${clientsTodayCount} <span class="text-[10px] font-normal text-zinc-500 block mt-1">agendados</span>`;
        document.getElementById('metric-month-count').innerText = `${totalMonthCount}`;
    },

    switchView: (viewName) => {
        app.view = viewName;
        const isAgenda = viewName === 'agenda';
        
        document.getElementById('tab-agenda').className = isAgenda 
            ? "flex-1 md:flex-none px-6 py-1.5 text-sm font-medium rounded-md text-white bg-zinc-800 shadow-sm transition-all"
            : "flex-1 md:flex-none px-6 py-1.5 text-sm font-medium rounded-md text-zinc-500 hover:text-zinc-300 transition-all";
            
        document.getElementById('tab-history').className = !isAgenda 
            ? "flex-1 md:flex-none px-6 py-1.5 text-sm font-medium rounded-md text-white bg-zinc-800 shadow-sm transition-all"
            : "flex-1 md:flex-none px-6 py-1.5 text-sm font-medium rounded-md text-zinc-500 hover:text-zinc-300 transition-all";

        document.getElementById('view-agenda').classList.toggle('hidden', !isAgenda);
        document.getElementById('view-history').classList.toggle('hidden', isAgenda);
        document.getElementById('date-controls').classList.toggle('hidden', !isAgenda);
    },

    changeDate: (days) => {
        app.currentDate.setDate(app.currentDate.getDate() + days);
        app.updateMetrics();
        app.renderGrid();
    },

    renderGrid: () => {
        const emp = app.currentEmployee;
        if (!emp) return; 

        const header = document.getElementById('grid-header');
        const body = document.getElementById('grid-body');
        const dateDisplay = document.getElementById('current-date-display');
        
        const todayStr = getLocalYYYYMMDD(new Date());
        const dateKey = getLocalYYYYMMDD(app.currentDate);
        dateDisplay.innerText = todayStr === dateKey ? 'Hoje' : app.currentDate.toLocaleDateString('pt-PT', {day:'numeric', month:'short'});

        if (emp.isBlocked) {
            body.innerHTML = `
                <div class="h-full w-full bg-red-950/20 flex flex-col items-center justify-center p-6 text-center">
                    <div class="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-4 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                        <i data-lucide="lock" class="w-8 h-8"></i>
                    </div>
                    <h2 class="text-xl font-bold text-red-500 uppercase tracking-widest">Acesso Bloqueado</h2>
                    <p class="text-sm text-red-400 mt-2 max-w-xs">Acesso restrito pela gerência. Não podes operar na agenda. Podes apenas consultar o teu histórico.</p>
                </div>`;
            header.innerHTML = '';
            if (window.lucide) lucide.createIcons();
            return;
        }

        const targetDayStr = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][app.currentDate.getDay()];
        const worksTargetDate = emp.schedule?.days?.includes(targetDayStr) ?? true;
        const workStartMins = timeToMins(emp.schedule?.workStart || '09:00');
        const workEndMins = timeToMins(emp.schedule?.workEnd || '20:00');
        const lunchStartMins = timeToMins(emp.schedule?.lunchStart || '12:00');
        const lunchEndMins = timeToMins(emp.schedule?.lunchEnd || '13:00');
        const isPastDate = dateKey < todayStr; 

        header.innerHTML = `
            <div class="w-16 border-r border-zinc-800/50 bg-zinc-900/50"></div>
            <div class="flex-1 py-3 text-center">
                <div class="text-[10px] uppercase font-bold text-amber-500">${app.currentDate.toLocaleDateString('pt-PT', { weekday: 'long' })}</div>
                <div class="text-xl font-bold text-white">${app.currentDate.getDate()}</div>
            </div>`;

        body.innerHTML = '';
        HOURS.forEach(hour => {
            const hourMins = hour * 60;
            const apptsInSlot = app.appointments.filter(a => a.date === dateKey && Math.floor(a.startTime / 60) === hour);
            apptsInSlot.sort((a, b) => a.startTime - b.startTime);

            const row = document.createElement('div');
            row.className = 'flex min-h-[80px] border-b border-zinc-800/50 relative';
            
            let slotsHTML = '';
            const isWorkingSlot = worksTargetDate && (hourMins >= workStartMins && hourMins < workEndMins) && !(hourMins >= lunchStartMins && hourMins < lunchEndMins);
            
            if (apptsInSlot.length > 0) {
                apptsInSlot.forEach(appt => {
                    const statusClass = appt.status === 'completed' 
                        ? 'border-zinc-500 bg-zinc-900 opacity-60 grayscale' 
                        : 'border-amber-500 bg-zinc-800 hover:bg-zinc-700';
                        
                    const clientName = appt.clientName || 'Cliente';
                    const serviceObj = app.services.find(s => s.id === appt.serviceId);
                    const serviceName = serviceObj?.name || appt.serviceName || 'Serviço';
                    const durationMins = (appt.endTime && appt.startTime) ? (appt.endTime - appt.startTime) : (Number(serviceObj?.duration) || 30);
                    const endTimeDisplay = formatMinutesToTime(appt.startTime + durationMins);

                    slotsHTML += `
                        <div class="w-full mb-1 rounded-lg border-l-4 p-2 shadow-sm ${statusClass} cursor-pointer transition-colors" onclick="app.openModal('${appt.id}')">
                            <div class="flex justify-between items-start">
                                <div class="flex items-center truncate">
                                    <p class="text-sm font-bold text-white truncate ${appt.status === 'completed' ? 'line-through text-zinc-400' : ''}">${clientName}</p>
                                    ${appt.notes ? `<i data-lucide="message-square-text" class="w-3.5 h-3.5 text-sky-400 ml-1.5 flex-shrink-0"></i>` : ''}
                                </div>
                                <span class="text-[10px] text-zinc-400 font-mono bg-zinc-950/50 px-1.5 py-0.5 rounded border border-zinc-800/50 flex-shrink-0 ml-2">
                                    ${formatMinutesToTime(appt.startTime)} - ${endTimeDisplay}
                                </span>
                            </div>
                            <p class="text-[10px] text-zinc-400 flex items-center gap-1 mt-1">
                                <i data-lucide="scissors" class="w-3 h-3"></i> ${serviceName}
                            </p>
                        </div>`;
                });
            } else {
                if (isPastDate) {
                    slotsHTML = `<div class="w-full h-full flex items-center justify-center opacity-30 cursor-not-allowed select-none">
                        <div class="text-[10px] text-zinc-600 font-medium">PASSADO</div>
                    </div>`;
                } else if (!isWorkingSlot) {
                    slotsHTML = `<div class="w-full h-full flex items-center justify-center opacity-30 cursor-not-allowed select-none bg-red-950/10 rounded-lg">
                        <div class="text-[10px] text-red-900/50 font-bold uppercase">Folga/Pausa</div>
                    </div>`;
                } else {
                    slotsHTML = `
                        <div class="w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer bg-zinc-800/20 rounded-lg border border-dashed border-zinc-700 hover:border-amber-500/50" onclick="app.openModal(null, ${hourMins})">
                            <div class="text-[10px] text-amber-500 font-medium">+ Adicionar</div>
                        </div>`;
                }
            }

            row.innerHTML = `
                <div class="w-16 border-r border-zinc-800/50 flex justify-center pt-3 text-[10px] text-zinc-500 font-mono">${hour}:00</div>
                <div class="flex-1 p-1.5 flex flex-col justify-center">${slotsHTML}</div>`;
            
            body.appendChild(row);
        });
        
        if (window.lucide) lucide.createIcons();
    },

    renderHistory: () => {
        const list = document.getElementById('history-list');
        const past = [...app.historyData].sort((a,b) => new Date(b.completedAt || b.date) - new Date(a.completedAt || a.date));
        
        if (past.length === 0) {
            list.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-zinc-500 text-sm">Nenhum histórico encontrado.</td></tr>`;
            return;
        }

        list.innerHTML = past.map(a => `
            <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td class="py-3 pl-2 text-zinc-400 text-xs">${a.date.split('-').reverse().join('/')}</td>
                <td class="py-3 font-medium text-white text-xs">${a.clientName || 'Cliente'}</td>
                <td class="py-3 text-zinc-400 text-xs">${a.serviceName || 'Serviço'}</td>
                <td class="py-3 text-right pr-2 text-emerald-500 font-bold text-xs">€ ${Number(a.finalPrice || a.price || 0).toFixed(2)}</td>
            </tr>`).join('');
    },

    toggleClient: () => {
        app.isCreatingNewClient = !app.isCreatingNewClient;
        const btn = document.getElementById('btn-toggle-client');
        const text = document.getElementById('text-toggle-client');
        const selectContainer = document.getElementById('client-select-container');
        const newContainer = document.getElementById('new-client-container');
        const select = document.getElementById('appt-client');
        const inputName = document.getElementById('new-client-name');

        if (app.isCreatingNewClient) {
            selectContainer.classList.add('hidden');
            newContainer.classList.remove('hidden');
            text.textContent = "Selecionar Existente";
            btn.innerHTML = `<i data-lucide="users" class="w-3 h-3"></i> <span id="text-toggle-client">Selecionar Existente</span>`;
            select.removeAttribute('required');
            inputName.setAttribute('required', 'true');
        } else {
            selectContainer.classList.remove('hidden');
            newContainer.classList.add('hidden');
            btn.innerHTML = `<i data-lucide="user-plus" class="w-3 h-3"></i> <span id="text-toggle-client">Novo Cliente</span>`;
            select.setAttribute('required', 'true');
            inputName.removeAttribute('required');
        }
        if (window.lucide) lucide.createIcons();
    },

    openModal: (id = null, startMins = null) => {
        if (app.currentEmployee?.isBlocked) {
            app.showToast("Acesso bloqueado pela gerência.");
            return;
        }

        const form = document.getElementById('appt-form');
        const actions = document.getElementById('edit-actions');
        const saveBtn = document.getElementById('btn-save');
        
        const todayStr = getLocalYYYYMMDD(new Date());
        const dateKey = getLocalYYYYMMDD(app.currentDate);
        const isPastDate = dateKey < todayStr;

        if (isPastDate && !id) {
            app.showToast("Não é possível adicionar agendamentos no passado.");
            return;
        }

        form.reset();
        app.isCreatingNewClient = false;
        document.getElementById('client-select-container').classList.remove('hidden');
        document.getElementById('new-client-container').classList.add('hidden');
        document.getElementById('btn-toggle-client').innerHTML = `<i data-lucide="user-plus" class="w-3 h-3"></i> <span id="text-toggle-client">Novo Cliente</span>`;
        document.getElementById('appt-client').setAttribute('required', 'true');
        document.getElementById('new-client-name').removeAttribute('required');

        document.getElementById('appt-id').value = '';
        document.getElementById('appt-date').value = dateKey;
        document.getElementById('appt-notes').value = '';
        
        if (startMins !== null) {
            document.getElementById('appt-time').value = formatMinutesToTime(startMins);
        } else {
            if (dateKey === todayStr) {
                const now = new Date();
                let m = now.getMinutes();
                m = Math.ceil(m / 5) * 5; 
                if (m === 60) { m = 0; now.setHours(now.getHours() + 1); }
                document.getElementById('appt-time').value = formatMinutesToTime(now.getHours() * 60 + m);
            } else {
                document.getElementById('appt-time').value = "09:00";
            }
        }

        let currentAppt = null;
        if (id) {
            currentAppt = app.appointments.find(a => a.id === id);
            if(currentAppt) {
                document.getElementById('appt-id').value = currentAppt.id;
                document.getElementById('appt-client').value = currentAppt.userId || '';
                document.getElementById('appt-service').value = currentAppt.serviceId || '';
                document.getElementById('appt-date').value = currentAppt.date;
                document.getElementById('appt-time').value = formatMinutesToTime(currentAppt.startTime);
                document.getElementById('appt-notes').value = currentAppt.notes || ''; 
            }
        }

        const isReadOnly = isPastDate || (currentAppt && currentAppt.status === 'completed');
        const formInputs = document.querySelectorAll('#appt-form input:not(#appt-id), #appt-form select, #appt-form textarea');
        formInputs.forEach(input => input.disabled = isReadOnly);
        document.getElementById('btn-toggle-client').style.display = isReadOnly ? 'none' : 'flex';

        if (isReadOnly) {
            document.getElementById('modal-title').innerText = (currentAppt && currentAppt.status === 'completed') ? 'Agendamento (Concluído)' : 'Agendamento (Apenas Leitura)';
            actions.classList.add('hidden');
            saveBtn.classList.add('hidden');
        } else {
            if (id) {
                document.getElementById('modal-title').innerText = 'Gerir Agendamento';
                actions.classList.remove('hidden');
                saveBtn.innerText = 'Atualizar Agendamento';
                saveBtn.classList.remove('hidden');
            } else {
                document.getElementById('modal-title').innerText = 'Novo Agendamento';
                actions.classList.add('hidden');
                saveBtn.classList.remove('hidden');
                saveBtn.innerText = 'Salvar Agendamento';
            }
        }

        document.getElementById('appointment-modal').classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
    },

    closeModal: () => document.getElementById('appointment-modal').classList.add('hidden'),

    saveAppt: async () => {
        if (app.currentEmployee?.isBlocked) return;
        const apptDate = document.getElementById('appt-date').value;
        if (apptDate < getLocalYYYYMMDD(new Date())) {
            alert("Não é possível salvar informações em dias passados.");
            return;
        }

        const id = document.getElementById('appt-id').value;
        const service = app.services.find(s => s.id === document.getElementById('appt-service').value);
        
        let userId = "";
        let clientName = "";

        if (app.isCreatingNewClient) {
            clientName = document.getElementById('new-client-name').value;
            if (!clientName || !service) {
                alert("Por favor, preencha o nome do cliente e selecione um serviço.");
                return;
            }
            const newClientData = {
                name: clientName,
                phone: document.getElementById('new-client-phone').value || "",
                createdAt: new Date().toISOString()
            };
            const userDocRef = await addDoc(collection(db, "users"), newClientData);
            userId = userDocRef.id;
        } else {
            const user = app.users.find(u => u.id === document.getElementById('appt-client').value);
            if (!user || !service) {
                alert("Por favor, selecione um cliente e um serviço.");
                return;
            }
            clientName = user.name;
            userId = user.id;
        }

        const timeInput = document.getElementById('appt-time').value;
        const startMins = timeToMins(timeInput);
        const durationMins = Number(service.duration) || 30;

        const bookingData = {
            barberId: loggedBarberId,
            barberName: loggedBarberName,
            companyId: "sami", 
            date: apptDate,
            startTime: startMins,
            endTime: startMins + durationMins, 
            price: service.price || 0,
            serviceId: service.id,
            serviceName: service.name,
            clientName: clientName, 
            userId: userId,
            status: "confirmed",
            notes: document.getElementById('appt-notes').value
        };

        try {
            if (id) {
                const currentStatus = app.appointments.find(a => a.id === id)?.status || 'confirmed';
                await updateDoc(doc(db, "bookings", id), { ...bookingData, status: currentStatus });
            } else {
                bookingData.createdAt = new Date().toISOString();
                await addDoc(collection(db, "bookings"), bookingData);
            }
            app.closeModal();
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Ocorreu um erro ao salvar o agendamento.");
        }
    },

    openPaymentModal: () => {
        if (app.currentEmployee?.isBlocked) return;
        
        const id = document.getElementById('appt-id').value;
        if (!id) return;
        
        const booking = app.appointments.find(a => a.id === id);
        if (!booking) return;

        if (booking.date < getLocalYYYYMMDD(new Date())) {
            alert("Este agendamento pertence ao passado e é imutável.");
            return;
        }

        app.closeModal(); 
        
        const service = app.services.find(s => s.id === booking.serviceId);
        app.currentPaymentTotal = Number(booking.price) || Number(service?.price) || 0;
        
        document.getElementById('payment-booking-id').value = booking.id;
        document.getElementById('payment-total').textContent = `€ ${app.currentPaymentTotal.toFixed(2).replace('.', ',')}`;
        
        document.getElementById('payment-form').reset();
        document.getElementById('cash-details').classList.add('hidden');
        document.getElementById('payment-received').required = false;
        document.getElementById('payment-change').textContent = '€ 0,00';
        document.getElementById('payment-change').className = 'text-xl font-bold text-zinc-400';

        document.getElementById('payment-modal').classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
    },

    closePaymentModal: () => {
        document.getElementById('payment-modal').classList.add('hidden');
        const bookingId = document.getElementById('payment-booking-id').value;
        if (bookingId) app.openModal(bookingId);
    },

    setupPaymentListeners: () => {
        const radios = document.getElementsByName('payment_method');
        const paymentReceived = document.getElementById('payment-received');
        const paymentChange = document.getElementById('payment-change');
        const cashDetails = document.getElementById('cash-details');

        Array.from(radios).forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'dinheiro') {
                    cashDetails.classList.remove('hidden');
                    paymentReceived.required = true;
                    paymentReceived.value = ''; 
                    paymentReceived.focus();
                } else {
                    cashDetails.classList.add('hidden');
                    paymentReceived.required = false;
                    paymentReceived.value = app.currentPaymentTotal; 
                }
                paymentReceived.dispatchEvent(new Event('input'));
            });
        });

        paymentReceived.addEventListener('input', (e) => {
            const received = Number(e.target.value) || 0;
            const change = received - app.currentPaymentTotal;
            
            paymentChange.classList.remove('text-red-500', 'text-emerald-400', 'text-zinc-400');

            if (received === 0) {
                paymentChange.textContent = `€ 0,00`;
                paymentChange.classList.add('text-zinc-400');
            } else if (change < 0) {
                paymentChange.textContent = `Faltam € ${Math.abs(change).toFixed(2).replace('.', ',')}`;
                paymentChange.classList.add('text-red-500'); 
            } else {
                paymentChange.textContent = `€ ${change.toFixed(2).replace('.', ',')}`;
                paymentChange.classList.add('text-emerald-400'); 
            }
        });

        document.getElementById('payment-form').onsubmit = async (e) => {
            e.preventDefault();
            
            const method = document.querySelector('input[name="payment_method"]:checked').value;
            let received = Number(paymentReceived.value);
            
            if (method !== 'dinheiro') received = app.currentPaymentTotal;
            
            if (method === 'dinheiro' && received < app.currentPaymentTotal) {
                alert("O valor recebido é menor que o total a pagar.");
                return;
            }

            const submitBtn = e.submitter;
            const originalContent = submitBtn.innerHTML;
            submitBtn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Processando...`;
            submitBtn.disabled = true;

            try {
                const bookingId = document.getElementById('payment-booking-id').value;
                const bookingData = app.appointments.find(a => a.id === bookingId);
                const change = method === 'dinheiro' ? (received - app.currentPaymentTotal) : 0;
                
                const transactionData = {
                    originalBookingId: bookingId,
                    companyId: bookingData.companyId || "sami",
                    userId: bookingData.userId,
                    clientName: bookingData.clientName,
                    barberId: bookingData.barberId,
                    barberName: bookingData.barberName,
                    serviceId: bookingData.serviceId,
                    serviceName: bookingData.serviceName,
                    date: bookingData.date, 
                    scheduledDate: bookingData.date,
                    completedAt: new Date().toISOString(),
                    duration: (bookingData.endTime && bookingData.startTime) ? (bookingData.endTime - bookingData.startTime) : 0,
                    currency: 'EUR',
                    subtotal: app.currentPaymentTotal,
                    taxRate: 23, 
                    taxAmount: app.currentPaymentTotal - (app.currentPaymentTotal / 1.23), 
                    discountAmount: 0,
                    finalPrice: app.currentPaymentTotal,
                    paymentMethod: method,          
                    amountReceived: received,
                    changeReturned: change,
                    status: 'completed',
                    paymentStatus: 'paid',          
                    invoiceStatus: 'pending',       
                };

                await addDoc(collection(db, "history"), transactionData);
                await updateDoc(doc(db, "bookings", bookingId), { status: 'completed' });
                
                document.getElementById('payment-modal').classList.add('hidden');
                
            } catch (error) {
                console.error("Erro ao finalizar pagamento:", error);
                alert("Ocorreu um erro ao processar o pagamento.");
            } finally {
                submitBtn.innerHTML = originalContent;
                submitBtn.disabled = false;
                if (window.lucide) lucide.createIcons();
            }
        };
    },

    deleteAppt: async () => {
        if (app.currentEmployee?.isBlocked) return;
        
        const id = document.getElementById('appt-id').value;
        if (!id) return;
        
        const booking = app.appointments.find(a => a.id === id);
        
        if (booking) {
            if (booking.date < getLocalYYYYMMDD(new Date())) {
                alert("Não é possível excluir agendamentos passados.");
                return;
            }
            if (booking.status === 'completed') {
                alert("Não é possível excluir um agendamento já concluído.");
                return;
            }
        }

        if (confirm("Tem certeza que deseja excluir este agendamento?")) {
            try {
                await deleteDoc(doc(db, "bookings", id));
                app.closeModal();
            } catch (error) {
                console.error("Erro ao excluir:", error);
                alert("Erro ao excluir o agendamento.");
            }
        }
    },

    logout: () => {
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = 'login.html';
    }
};

document.addEventListener('DOMContentLoaded', app.init);
window.app = app;