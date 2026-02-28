import { db } from './firebase-config.js';
import { 
    collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const state = {
    appointments: [],
    barbers: [],
    services: [],
    users: [], 
    currentDate: new Date(),
    selectedBarber: 'all',
};

const els = {
    gridHeader: document.getElementById('grid-header'),
    gridBody: document.getElementById('grid-body'),
    barberFilter: document.getElementById('barber-filter'),
    currentMonthDisplay: document.getElementById('current-month-display'),
    modal: document.getElementById('appointment-modal'),
    form: document.getElementById('appointment-form'),
    formId: document.getElementById('form-id'),
    formStatus: document.getElementById('form-status'),
    formClient: document.getElementById('form-client'), 
    formService: document.getElementById('form-service'),
    formBarber: document.getElementById('form-barber'),
    formDate: document.getElementById('form-date'),
    formTime: document.getElementById('form-time'),
    btnDelete: document.getElementById('btn-delete'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    modalActions: document.getElementById('modal-actions'),
    btnStatusConfirm: document.getElementById('btn-status-confirm') // Referência adicionada
};

if (els.formTime.tagName === 'SELECT') {
    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.id = 'form-time';
    timeInput.required = true;
    timeInput.className = els.formTime.className;
    els.formTime.replaceWith(timeInput);
    els.formTime = timeInput;
}

// --- UTILS ---
const getLocalYYYYMMDD = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().split('T')[0];
};

const formatMinutesToTime = (minutes) => {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
};

// --- FIREBASE SYNC ---
function initFirebaseSync() {
    onSnapshot(collection(db, "employees"), (snapshot) => {
        state.barbers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        updateSelectOptions(els.barberFilter, state.barbers, "Todos os Barbeiros");
        updateSelectOptions(els.formBarber, state.barbers);
        renderApp();
    });

    onSnapshot(collection(db, "services"), (snapshot) => {
        state.services = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        updateSelectOptions(els.formService, state.services);
        renderApp();
    });

    onSnapshot(collection(db, "bookings"), (snapshot) => {
        state.appointments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderApp();
    });

    // Povoa o select de clientes na inicialização
    onSnapshot(collection(db, "users"), (snapshot) => {
        state.users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        updateSelectOptions(els.formClient, state.users);
        renderApp();
    });
}

// --- RENDERIZAÇÃO ---
function renderHeader(visibleBarbers) {
    els.gridHeader.innerHTML = '<div class="w-16 flex-shrink-0 border-r border-zinc-800/50 bg-zinc-900/50"></div>';
    
    visibleBarbers.forEach(barber => {
        const th = document.createElement('div');
        th.className = 'flex-1 min-w-[150px] p-3 text-center border-r border-zinc-800/50 text-zinc-200 font-medium text-sm bg-zinc-900/40';
        th.innerHTML = `
            <div class="flex flex-col items-center justify-center gap-2">
                <div class="relative">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${barber.name}" class="w-10 h-10 rounded-full bg-zinc-800 border-2 border-zinc-700">
                    <div class="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-900"></div>
                </div>
                <span class="truncate w-full font-semibold tracking-wide">${barber.name}</span>
            </div>
        `;
        els.gridHeader.appendChild(th);
    });
}

function renderGrid(visibleBarbers, currentDateStr) {
    els.gridBody.innerHTML = '';
    
    const startHour = 8; 
    const endHour = 22; 
    const pixelsPerMinute = 2.5; 
    const topPadding = 20; // Espaço no topo para não comer o horário
    
    const totalHeight = (endHour - startHour + 1) * 60 * pixelsPerMinute + topPadding;

    const gridContainer = document.createElement('div');
    gridContainer.className = 'flex relative min-w-max';
    gridContainer.style.height = `${totalHeight}px`;

    // 1. Coluna de Horários (Eixo Y)
    const timeCol = document.createElement('div');
    timeCol.className = 'w-16 flex-shrink-0 border-r border-zinc-800/50 relative bg-zinc-950/80 z-20 backdrop-blur-sm sticky left-0';

    const linesContainer = document.createElement('div');
    linesContainer.className = 'absolute inset-0 pointer-events-none w-full min-w-max flex';
    linesContainer.innerHTML = `<div class="w-16 flex-shrink-0"></div>`;
    const linesContent = document.createElement('div');
    linesContent.className = 'flex-1 relative';

    for (let h = startHour; h <= endHour; h++) {
        // Soma o topPadding em tudo que usa eixo Y
        const topPx = (h - startHour) * 60 * pixelsPerMinute + topPadding;
        
        const timeLabel = document.createElement('div');
        timeLabel.className = 'absolute w-full text-center text-[11px] text-zinc-500 font-medium -mt-2';
        timeLabel.style.top = `${topPx}px`;
        timeLabel.textContent = `${h.toString().padStart(2, '0')}:00`;
        timeCol.appendChild(timeLabel);

        const hLine = document.createElement('div');
        hLine.className = 'absolute w-[200vw] border-t border-zinc-800/30';
        hLine.style.top = `${topPx}px`;
        linesContent.appendChild(hLine);
        
        const hLineHalf = document.createElement('div');
        hLineHalf.className = 'absolute w-[200vw] border-t border-zinc-800/10 border-dashed';
        hLineHalf.style.top = `${topPx + (30 * pixelsPerMinute)}px`;
        linesContent.appendChild(hLineHalf);
    }
    linesContainer.appendChild(linesContent);
    gridContainer.appendChild(timeCol);

    // 2. Colunas dos Barbeiros e Agendamentos
    const todaysBookings = state.appointments.filter(b => b.date === currentDateStr);

    visibleBarbers.forEach(barber => {
        const bCol = document.createElement('div');
        bCol.className = 'flex-1 min-w-[150px] border-r border-zinc-800/50 relative cursor-pointer hover:bg-zinc-800/10 transition-colors z-10 group';
        
        bCol.onclick = (e) => {
            if(e.target !== bCol) return;
            const rect = bCol.getBoundingClientRect();
            const y = e.clientY - rect.top + els.gridBody.scrollTop - topPadding; // Abate o padding no clique
            let clickedMinuteOfDay = (y / pixelsPerMinute) + (startHour * 60);
            clickedMinuteOfDay = Math.max(startHour * 60, Math.floor(clickedMinuteOfDay / 15) * 15);
            openModal({ barberId: barber.id, startTime: clickedMinuteOfDay });
        };

        const bBookings = todaysBookings.filter(b => b.barberId === barber.id);
        
        bBookings.forEach(appt => {
            const service = state.services.find(s => s.id === appt.serviceId) || {};
            const clientUser = state.users.find(u => u.id === appt.userId);
            const displayName = clientUser ? (clientUser.name || 'Usuário App') : (appt.clientName || 'Cliente Avulso');

            const startMins = appt.startTime - (startHour * 60);
            const duration = (appt.endTime && appt.startTime) ? (appt.endTime - appt.startTime) : (Number(service.duration) || 30);
            
            // Soma o topPadding na renderização do card
            const topPx = (startMins * pixelsPerMinute) + topPadding;
            const heightPx = duration * pixelsPerMinute;

            // Design Baseado em Complexidade
            let colorClasses = "border-l-zinc-500 bg-zinc-900 border-zinc-800";
            let iconColor = "text-zinc-400";
            let dotColor = "bg-zinc-500";
            
            if (service.complexity === "facil") {
                colorClasses = "border-l-emerald-500 bg-zinc-900 border-zinc-800";
                iconColor = "text-emerald-500";
                dotColor = "bg-emerald-500";
            }
            if (service.complexity === "medio") {
                colorClasses = "border-l-amber-500 bg-zinc-900 border-zinc-800";
                iconColor = "text-amber-500";
                dotColor = "bg-amber-500";
            }
            if (service.complexity === "dificil") {
                colorClasses = "border-l-rose-500 bg-zinc-900 border-zinc-800";
                iconColor = "text-rose-500";
                dotColor = "bg-rose-500";
            }

            // Marcação visual para serviços finalizados
            let opacityClass = '';
            let textDecorationClass = 'text-zinc-100';
            
            if (appt.status === 'completed') {
                opacityClass = 'opacity-40 grayscale hover:grayscale-0 border-l-zinc-400 bg-zinc-800';
                dotColor = 'bg-zinc-400';
                textDecorationClass = 'line-through text-zinc-500';
            }

            // Construção do Card Moderno
            const card = document.createElement('div');
            card.className = `absolute left-1.5 right-1.5 rounded-lg p-2.5 text-xs border-l-[4px] border-t border-r border-b backdrop-blur-md shadow-lg transition-all overflow-hidden flex flex-col justify-between cursor-pointer hover:scale-[1.02] hover:z-30 z-20 ${colorClasses} ${opacityClass}`;
            card.style.top = `${topPx}px`;
            card.style.height = `${Math.max(heightPx, 45)}px`; // Mínimo de 45px para não quebrar layout

            card.innerHTML = `
                <div class="flex flex-col gap-1 h-full">
                    <div class="flex justify-between items-start gap-1">
                        <div class="flex items-center gap-1.5 truncate">
                            <div class="w-2 h-2 rounded-full ${dotColor} flex-shrink-0 shadow-sm"></div>
                            <span class="font-bold truncate text-[12px] leading-tight ${textDecorationClass}">${displayName}</span>
                        </div>
                        ${appt.status === 'completed' 
                            ? `<i data-lucide="check-check" class="w-4 h-4 flex-shrink-0 text-emerald-500"></i>` 
                            : ``
                        }
                    </div>
                    
                    <div class="opacity-90 truncate text-[10px] leading-tight flex items-center gap-1 text-zinc-400">
                        <i data-lucide="scissors" class="w-3 h-3 ${iconColor}"></i>
                        ${service.name || appt.serviceName || 'Serviço'}
                    </div>

                    <div class="mt-auto font-mono text-[10px] bg-zinc-950/50 rounded px-1.5 py-0.5 inline-flex items-center gap-1 self-start text-zinc-400 border border-zinc-800/50">
                        <i data-lucide="clock" class="w-3 h-3 opacity-70"></i>
                        ${formatMinutesToTime(appt.startTime)} - ${formatMinutesToTime(appt.endTime || (appt.startTime + duration))}
                    </div>
                </div>
            `;

            card.onclick = (e) => {
                e.stopPropagation();
                // Passamos displayName para o modal saber qual cliente é
                openModal({ ...appt, displayName: clientUser ? displayName : appt.clientName });
            };
            bCol.appendChild(card);
        });

        gridContainer.appendChild(bCol);
    });

    els.gridBody.appendChild(linesContainer);
    els.gridBody.appendChild(gridContainer);
    if (window.lucide) lucide.createIcons();
}

function renderApp() {
    const currentDateStr = getLocalYYYYMMDD(state.currentDate);
    els.currentMonthDisplay.textContent = state.currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    els.formDate.value = currentDateStr;

    const visibleBarbers = state.selectedBarber === 'all' 
        ? state.barbers 
        : state.barbers.filter(b => b.id === state.selectedBarber);

    renderHeader(visibleBarbers);
    renderGrid(visibleBarbers, currentDateStr);
}

// --- CONTROLES DO MODAL E AÇÕES ---
function openModal(data = {}) {
    els.formId.value = data.id || '';
    els.formStatus.value = data.status || 'confirmed';
    
    // Preenche o select usando o userId
    els.formClient.value = data.userId || (state.users.length > 0 ? state.users[0].id : '');
    
    els.formDate.value = data.date || getLocalYYYYMMDD(state.currentDate);
    els.formBarber.value = data.barberId || state.barbers[0]?.id || '';
    els.formService.value = data.serviceId || state.services[0]?.id || '';
    
    els.formTime.value = data.startTime ? formatMinutesToTime(data.startTime) : '09:00';

    if (data.id) {
        els.btnDelete.classList.remove('hidden');
        els.modalActions.classList.remove('hidden');
        // Oculta o botão confirmar, deixando apenas o finalizar
        if (els.btnStatusConfirm) els.btnStatusConfirm.classList.add('hidden');
    } else {
        els.btnDelete.classList.add('hidden');
        els.modalActions.classList.add('hidden');
    }

    els.modal.classList.remove('hidden');
}

function closeModal() {
    els.modal.classList.add('hidden');
    els.form.reset();
}

function updateSelectOptions(selectEl, data, defaultText = null) {
    selectEl.innerHTML = '';
    if (defaultText) selectEl.add(new Option(defaultText, 'all'));
    data.forEach(item => selectEl.add(new Option(item.name, item.id)));
}

window.app = {
    updateStatus: async (newStatus) => {
        if (!els.formId.value) return;
        
        const bookingId = els.formId.value;
        const bookingRef = doc(db, "bookings", bookingId);
        
        // Pega todos os dados atuais do agendamento
        const bookingData = state.appointments.find(a => a.id === bookingId);
        
        if (newStatus === 'completed' && bookingData) {
            try {
                // 1. Salvar na coleção "history" com todos os detalhes disponíveis
                await addDoc(collection(db, "history"), {
                    ...bookingData,
                    originalBookingId: bookingId,
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    finalPrice: Number(bookingData.price) || 0,
                    duration: (bookingData.endTime && bookingData.startTime) 
                        ? (bookingData.endTime - bookingData.startTime) 
                        : 0
                });

                // 2. Atualizar o status do agendamento atual
                await updateDoc(bookingRef, { status: 'completed' });
                console.log("Histórico gerado e agendamento finalizado com sucesso.");
            } catch (error) {
                console.error("Erro ao finalizar agendamento e salvar histórico:", error);
                alert("Ocorreu um erro ao tentar salvar o histórico.");
            }
        } else {
            await updateDoc(bookingRef, { status: newStatus });
        }
        
        els.formStatus.value = newStatus;
        closeModal();
    }
};

// --- EVENTOS ---
els.btnCloseModal.onclick = closeModal;
els.barberFilter.onchange = (e) => { state.selectedBarber = e.target.value; renderApp(); };
document.getElementById('btn-new-appt').onclick = () => openModal();
document.getElementById('btn-next-days').onclick = () => { state.currentDate.setDate(state.currentDate.getDate() + 1); renderApp(); };
document.getElementById('btn-prev-days').onclick = () => { state.currentDate.setDate(state.currentDate.getDate() - 1); renderApp(); };
document.getElementById('btn-today').onclick = () => { state.currentDate = new Date(); renderApp(); };

els.form.onsubmit = async (e) => {
    e.preventDefault();
    
    const service = state.services.find(s => s.id === els.formService.value);
    const barber = state.barbers.find(b => b.id === els.formBarber.value);
    
    // Pega o usuário selecionado no select
    const selectedUser = state.users.find(u => u.id === els.formClient.value);
    const clientName = selectedUser ? selectedUser.name : "Cliente Desconhecido";
    const userId = selectedUser ? selectedUser.id : "";
    
    const [hours, minutes] = els.formTime.value.split(':').map(Number);
    const startMins = (hours * 60) + minutes;
    
    // Força a conversão para número para garantir que a duração some corretamente na grade
    const durationMins = Number(service?.duration) || 30;

    const bookingData = {
        barberId: barber.id,
        barberName: barber.name,
        companyId: "sami", 
        date: els.formDate.value,
        startTime: startMins,
        endTime: startMins + durationMins, // Duração exata presa ao serviço
        price: service?.price || 0,
        serviceId: service.id,
        serviceName: service.name,
        clientName: clientName, 
        status: els.formStatus.value || "confirmed",
        userId: userId, 
    };

    if (els.formId.value) {
        await updateDoc(doc(db, "bookings", els.formId.value), bookingData);
    } else {
        bookingData.createdAt = new Date().toISOString();
        await addDoc(collection(db, "bookings"), bookingData);
    }
    closeModal();
};

els.btnDelete.onclick = async () => {
    if (confirm("Tem certeza que deseja excluir este agendamento?")) {
        await deleteDoc(doc(db, "bookings", els.formId.value));
        closeModal();
    }
};

// --- INIT ---
initFirebaseSync();