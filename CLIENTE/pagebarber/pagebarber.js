import { db } from './firebase-config.js';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- VERIFICAÇÃO DE LOGIN ---
const loggedBarberId = sessionStorage.getItem('loggedBarberId');
const loggedBarberName = sessionStorage.getItem('loggedBarberName');
const loggedBarberPhoto = sessionStorage.getItem('loggedBarberPhoto');

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

const app = {
    currentDate: new Date(),
    view: 'agenda',
    appointments: [], 
    historyData: [],
    users: [],
    services: [],

    init: () => {
        app.setupFirebaseListeners();
        lucide.createIcons();
    },

    setupFirebaseListeners: () => {
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

        document.getElementById('metric-today-money').innerText = `€ ${moneyToday.toFixed(2)}`;
        document.getElementById('metric-today-clients').innerHTML = `${clientsTodayCount} <span class="text-[10px] font-normal text-zinc-500">agendados</span>`;
        document.getElementById('metric-month-money').innerText = `€ ${moneyMonth.toFixed(2)}`;
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
        const header = document.getElementById('grid-header');
        const body = document.getElementById('grid-body');
        const dateDisplay = document.getElementById('current-date-display');
        
        const dateKey = getLocalYYYYMMDD(app.currentDate);
        dateDisplay.innerText = getLocalYYYYMMDD(new Date()) === dateKey ? 'Hoje' : app.currentDate.toLocaleDateString('pt-PT', {day:'numeric', month:'short'});

        header.innerHTML = `
            <div class="w-16 border-r border-zinc-800/50 bg-zinc-900/50"></div>
            <div class="flex-1 py-3 text-center">
                <div class="text-[10px] uppercase font-bold text-amber-500">${app.currentDate.toLocaleDateString('pt-PT', { weekday: 'long' })}</div>
                <div class="text-xl font-bold text-white">${app.currentDate.getDate()}</div>
            </div>`;

        body.innerHTML = '';
        HOURS.forEach(hour => {
            const hourMins = hour * 60;
            // Busca agendamentos que iniciam nesta hora
            const apptsInSlot = app.appointments.filter(a => a.date === dateKey && Math.floor(a.startTime / 60) === hour);
            
            // Ordena os agendamentos pela ordem de início (ex: 9:00 vem antes de 9:20)
            apptsInSlot.sort((a, b) => a.startTime - b.startTime);

            const row = document.createElement('div');
            row.className = 'flex min-h-[80px] border-b border-zinc-800/50 relative';
            
            let slotsHTML = '';
            
            if (apptsInSlot.length > 0) {
                apptsInSlot.forEach(appt => {
                    const statusClass = appt.status === 'completed' 
                        ? 'border-zinc-500 bg-zinc-900 opacity-60 grayscale' 
                        : 'border-amber-500 bg-zinc-800 hover:bg-zinc-700';
                        
                    const clientName = appt.clientName || 'Cliente';
                    const serviceObj = app.services.find(s => s.id === appt.serviceId);
                    const serviceName = serviceObj?.name || appt.serviceName || 'Serviço';
                    
                    // Calcula visualmente o intervalo
                    const durationMins = (appt.endTime && appt.startTime) ? (appt.endTime - appt.startTime) : (Number(serviceObj?.duration) || 30);
                    const endTimeDisplay = formatMinutesToTime(appt.startTime + durationMins);

                    slotsHTML += `
                        <div class="w-full mb-1 rounded-lg border-l-4 p-2 shadow-sm ${statusClass} cursor-pointer transition-colors" onclick="app.openModal('${appt.id}')">
                            <div class="flex justify-between items-start">
                                <p class="text-sm font-bold text-white truncate ${appt.status === 'completed' ? 'line-through text-zinc-400' : ''}">${clientName}</p>
                                <span class="text-[10px] text-zinc-400 font-mono bg-zinc-950/50 px-1.5 py-0.5 rounded border border-zinc-800/50">
                                    ${formatMinutesToTime(appt.startTime)} - ${endTimeDisplay}
                                </span>
                            </div>
                            <p class="text-[10px] text-zinc-400 flex items-center gap-1 mt-1">
                                <i data-lucide="scissors" class="w-3 h-3"></i> ${serviceName}
                            </p>
                        </div>`;
                });
            } else {
                slotsHTML = `
                    <div class="w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer" onclick="app.openModal(null, ${hourMins})">
                        <div class="text-[10px] text-zinc-600 font-medium">+ Adicionar</div>
                    </div>`;
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

    openModal: (id = null, startMins = null) => {
        const form = document.getElementById('appt-form');
        const actions = document.getElementById('edit-actions');
        const saveBtn = document.getElementById('btn-save');
        
        form.reset();
        document.getElementById('appt-id').value = '';
        document.getElementById('appt-date').value = getLocalYYYYMMDD(app.currentDate);
        
        // Define a hora baseado no clique ou usa 09:00 como padrão
        if (startMins !== null) {
            document.getElementById('appt-time').value = formatMinutesToTime(startMins);
        } else {
            document.getElementById('appt-time').value = "09:00";
        }

        if (id) {
            const appt = app.appointments.find(a => a.id === id);
            if(appt) {
                document.getElementById('appt-id').value = appt.id;
                document.getElementById('appt-client').value = appt.userId || '';
                document.getElementById('appt-service').value = appt.serviceId || '';
                document.getElementById('appt-date').value = appt.date;
                // Converte os minutos salvos de volta para o formato de input (HH:MM)
                document.getElementById('appt-time').value = formatMinutesToTime(appt.startTime);
                
                document.getElementById('modal-title').innerText = 'Gerir Agendamento';
                actions.classList.remove('hidden');
                saveBtn.innerText = 'Atualizar Agendamento';

                if (appt.status === 'completed') {
                    actions.querySelector('button[onclick="app.completeAppt()"]').classList.add('hidden');
                    saveBtn.classList.add('hidden');
                } else {
                    actions.querySelector('button[onclick="app.completeAppt()"]').classList.remove('hidden');
                    saveBtn.classList.remove('hidden');
                }
            }
        } else {
            document.getElementById('modal-title').innerText = 'Novo Agendamento';
            actions.classList.add('hidden');
            saveBtn.classList.remove('hidden');
            saveBtn.innerText = 'Salvar Agendamento';
        }

        document.getElementById('appointment-modal').classList.remove('hidden');
    },

    closeModal: () => document.getElementById('appointment-modal').classList.add('hidden'),

    saveAppt: async () => {
        const id = document.getElementById('appt-id').value;
        const service = app.services.find(s => s.id === document.getElementById('appt-service').value);
        const user = app.users.find(u => u.id === document.getElementById('appt-client').value);
        
        if (!service || !user) {
            alert("Por favor, selecione um cliente e um serviço.");
            return;
        }

        // Lê a hora do input "HH:MM" e converte para total de minutos
        const timeInput = document.getElementById('appt-time').value;
        const [hours, minutes] = timeInput.split(':').map(Number);
        const startMins = (hours * 60) + minutes;
        
        // Duração precisa calculada com base no serviço
        const durationMins = Number(service.duration) || 30;

        const bookingData = {
            barberId: loggedBarberId,
            barberName: loggedBarberName,
            companyId: "sami", 
            date: document.getElementById('appt-date').value,
            startTime: startMins,
            endTime: startMins + durationMins, // Calcula e salva a hora exata do fim
            price: service.price || 0,
            serviceId: service.id,
            serviceName: service.name,
            clientName: user.name, 
            userId: user.id,
            status: "confirmed" 
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

    completeAppt: async () => {
        const id = document.getElementById('appt-id').value;
        if (!id) return;

        const bookingData = app.appointments.find(a => a.id === id);
        if (!bookingData) return;

        try {
            await addDoc(collection(db, "history"), {
                ...bookingData,
                originalBookingId: id,
                status: 'completed',
                completedAt: new Date().toISOString(),
                finalPrice: Number(bookingData.price) || 0,
                duration: (bookingData.endTime && bookingData.startTime) 
                    ? (bookingData.endTime - bookingData.startTime) 
                    : 0
            });

            await updateDoc(doc(db, "bookings", id), { status: 'completed' });
            app.closeModal();
        } catch (error) {
            console.error("Erro ao finalizar:", error);
            alert("Erro ao finalizar o agendamento e gerar histórico.");
        }
    },

    deleteAppt: async () => {
        const id = document.getElementById('appt-id').value;
        if (!id) return;

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
        window.location.href = 'login.html';
    }
};

document.addEventListener('DOMContentLoaded', app.init);
window.app = app;