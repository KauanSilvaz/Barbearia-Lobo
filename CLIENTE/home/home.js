import { db, messaging } from './firebase-config.js';
import { 
    collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getToken } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

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
    btnStatusConfirm: document.getElementById('btn-status-confirm'),
    btnEnableNotifications: document.getElementById('btn-enable-notifications'),
    
    // Elementos do formulário de cliente
    btnToggleClient: document.getElementById('btn-toggle-client'),
    textToggleClient: document.getElementById('text-toggle-client'),
    clientSelectContainer: document.getElementById('client-select-container'),
    newClientContainer: document.getElementById('new-client-container'),
    newClientName: document.getElementById('new-client-name'),
    newClientPhone: document.getElementById('new-client-phone'),

    // Elementos do Pagamento
    paymentModal: document.getElementById('payment-modal'),
    paymentForm: document.getElementById('payment-form'),
    paymentBookingId: document.getElementById('payment-booking-id'),
    paymentTotal: document.getElementById('payment-total'),
    paymentReceived: document.getElementById('payment-received'),
    paymentChange: document.getElementById('payment-change'),
    cashDetails: document.getElementById('cash-details'),
    btnClosePayment: document.getElementById('btn-close-payment'),
    paymentMethodRadios: document.getElementsByName('payment_method'),
};

let isCreatingNewClient = false;

// URL DA SUA API NO BACKEND (Exemplo Vercel)
// Depois que você hospedar o passo 5, cole a URL real aqui:
const API_NOTIFICACOES_URL = '/api/enviar-notificacao'; 

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
    syncCompanyLogo();

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

    onSnapshot(collection(db, "users"), (snapshot) => {
        state.users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        updateSelectOptions(els.formClient, state.users);
        renderApp();
    });
}

function syncCompanyLogo() {
    const watermarkImg = document.getElementById('watermark-img');
    const headerLogo = document.getElementById('header-logo');

    if (!watermarkImg && !headerLogo) return;

    onSnapshot(doc(db, "settings", "company"), (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            if (data.logoUrl) {
                if (watermarkImg) watermarkImg.src = data.logoUrl;
                if (headerLogo) headerLogo.src = data.logoUrl;
            }
        }
    });
}

// --- RENDERIZAÇÃO ---
function renderHeader(visibleBarbers) {
    els.gridHeader.innerHTML = '<div class="w-16 flex-shrink-0 border-r border-zinc-800/50 bg-zinc-900/50"></div>';
    
    visibleBarbers.forEach(barber => {
        const avatarUrl = barber.photoUrl && barber.photoUrl.trim() !== '' 
            ? barber.photoUrl 
            : `https://api.dicebear.com/7.x/avataaars/svg?seed=${barber.name}`;

        const th = document.createElement('div');
        th.className = 'flex-1 min-w-[150px] p-3 text-center border-r border-zinc-800/50 text-zinc-200 font-medium text-sm bg-zinc-900/40';
        th.innerHTML = `
            <div class="flex flex-col items-center justify-center gap-2">
                <div class="relative">
                    <img src="${avatarUrl}" alt="${barber.name}" class="w-10 h-10 rounded-full bg-zinc-800 border-2 border-zinc-700 object-cover">
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
    const topPadding = 20; 
    
    const totalHeight = (endHour - startHour + 1) * 60 * pixelsPerMinute + topPadding;

    const gridContainer = document.createElement('div');
    gridContainer.className = 'flex relative min-w-max';
    gridContainer.style.height = `${totalHeight}px`;

    const timeCol = document.createElement('div');
    timeCol.className = 'w-16 flex-shrink-0 border-r border-zinc-800/50 relative bg-zinc-950/80 z-20 backdrop-blur-sm sticky left-0';

    const linesContainer = document.createElement('div');
    linesContainer.className = 'absolute inset-0 pointer-events-none w-full min-w-max flex';
    linesContainer.innerHTML = `<div class="w-16 flex-shrink-0"></div>`;
    const linesContent = document.createElement('div');
    linesContent.className = 'flex-1 relative';

    for (let h = startHour; h <= endHour; h++) {
        const maxMinutes = (h === endHour) ? 0 : 55;

        for (let m = 0; m <= maxMinutes; m += 5) {
            const topPx = (h - startHour) * 60 * pixelsPerMinute + (m * pixelsPerMinute) + topPadding;
            
            const timeLabel = document.createElement('div');
            timeLabel.style.top = `${topPx}px`;

            const hLine = document.createElement('div');
            hLine.style.top = `${topPx}px`;

            if (m === 0) {
                timeLabel.className = 'absolute w-full text-center text-[11px] text-zinc-300 font-bold -mt-2 z-10';
                timeLabel.textContent = `${h.toString().padStart(2, '0')}:00`;
                hLine.className = 'absolute w-[200vw] border-t border-zinc-700/60 z-10';
            } else if (m === 30) {
                timeLabel.className = 'absolute w-full text-center text-[10px] text-zinc-500 font-medium -mt-1.5';
                timeLabel.textContent = `${h.toString().padStart(2, '0')}:30`;
                hLine.className = 'absolute w-[200vw] border-t border-zinc-800/50 border-dashed';
            } else {
                timeLabel.className = 'absolute w-full text-center text-[8px] text-zinc-700/70 font-medium -mt-1';
                timeLabel.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                hLine.className = 'absolute w-[200vw] border-t border-zinc-800/20 border-dotted';
            }

            timeCol.appendChild(timeLabel);
            linesContent.appendChild(hLine);
        }
    }

    linesContainer.appendChild(linesContent);
    gridContainer.appendChild(timeCol);

    const todaysBookings = state.appointments.filter(b => b.date === currentDateStr);

    visibleBarbers.forEach(barber => {
        const bCol = document.createElement('div');
        bCol.className = 'flex-1 min-w-[150px] border-r border-zinc-800/50 relative cursor-pointer hover:bg-zinc-800/10 transition-colors z-10 group';
        
        bCol.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            bCol.classList.add('bg-zinc-800/30'); 
        });
        
        bCol.addEventListener('dragleave', () => {
            bCol.classList.remove('bg-zinc-800/30');
        });

        bCol.addEventListener('drop', async (e) => {
            e.preventDefault();
            bCol.classList.remove('bg-zinc-800/30');
            
            const apptId = e.dataTransfer.getData('text/plain');
            const offsetY = Number(e.dataTransfer.getData('offsetY')) || 0;
            if (!apptId) return;

            const rect = bCol.getBoundingClientRect();
            const y = e.clientY - rect.top + els.gridBody.scrollTop - topPadding - offsetY;

            let newStartMins = (y / pixelsPerMinute) + (startHour * 60);
            newStartMins = Math.max(startHour * 60, Math.floor(newStartMins / 5) * 5);

            const appt = state.appointments.find(a => a.id === apptId);
            if(!appt) return;
            const duration = appt.endTime - appt.startTime;

            try {
                await updateDoc(doc(db, "bookings", apptId), {
                    barberId: barber.id,
                    barberName: barber.name,
                    startTime: newStartMins,
                    endTime: newStartMins + duration
                });
            } catch (error) {
                console.error("Erro ao mover agendamento:", error);
            }
        });

        bCol.onclick = (e) => {
            if(e.target !== bCol) return;
            const rect = bCol.getBoundingClientRect();
            const y = e.clientY - rect.top + els.gridBody.scrollTop - topPadding;
            let clickedMinuteOfDay = (y / pixelsPerMinute) + (startHour * 60);
            clickedMinuteOfDay = Math.max(startHour * 60, Math.floor(clickedMinuteOfDay / 5) * 5);
            openModal({ barberId: barber.id, startTime: clickedMinuteOfDay });
        };

        const bBookings = todaysBookings.filter(b => b.barberId === barber.id);
        const sortedBookings = [...bBookings].sort((a, b) => a.startTime - b.startTime);

        const groups = [];
        let currentGroup = [];
        let groupEnd = 0;

        sortedBookings.forEach(appt => {
            const service = state.services.find(s => s.id === appt.serviceId) || {};
            const duration = (appt.endTime && appt.startTime) ? (appt.endTime - appt.startTime) : (Number(service.duration) || 30);
            const endTime = appt.startTime + duration;

            if (currentGroup.length > 0 && appt.startTime >= groupEnd) {
                groups.push(currentGroup);
                currentGroup = [];
            }
            currentGroup.push({ appt, service, duration, endTime });
            groupEnd = Math.max(groupEnd, endTime);
        });
        if (currentGroup.length > 0) groups.push(currentGroup);

        groups.forEach(group => {
            const columns = [];
            group.forEach(item => {
                let placed = false;
                for (let i = 0; i < columns.length; i++) {
                    const lastInCol = columns[i][columns[i].length - 1];
                    if (lastInCol.endTime <= item.appt.startTime) {
                        columns[i].push(item);
                        item.colIndex = i;
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    item.colIndex = columns.length;
                    columns.push([item]);
                }
            });

            const numCols = columns.length;

            group.forEach(item => {
                const { appt, service, duration } = item;
                const clientUser = state.users.find(u => u.id === appt.userId);
                const displayName = clientUser ? (clientUser.name || 'Usuário App') : (appt.clientName || 'Cliente Avulso');

                const startMins = appt.startTime - (startHour * 60);
                const topPx = (startMins * pixelsPerMinute) + topPadding;
                const heightPx = duration * pixelsPerMinute;

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

                let opacityClass = '';
                let textDecorationClass = 'text-zinc-100';
                
                if (appt.status === 'completed') {
                    opacityClass = 'opacity-40 grayscale hover:grayscale-0 border-l-zinc-400 bg-zinc-800';
                    dotColor = 'bg-zinc-400';
                    textDecorationClass = 'line-through text-zinc-500';
                }

                const widthPct = 100 / numCols;
                const leftPct = item.colIndex * widthPct;

                const card = document.createElement('div');
                card.className = `absolute rounded-lg p-2.5 text-xs border-l-[4px] border-t border-r border-b backdrop-blur-md shadow-lg transition-all overflow-hidden flex flex-col justify-between cursor-pointer hover:z-30 z-20 ${colorClasses} ${opacityClass}`;
                
                card.style.top = `${topPx}px`;
                card.style.height = `${Math.max(heightPx, 45)}px`;
                card.style.left = `calc(${leftPct}% + 4px)`;
                card.style.width = `calc(${widthPct}% - 8px)`;

                if (appt.status !== 'completed') {
                    card.draggable = true;
                    card.addEventListener('dragstart', (e) => {
                        e.stopPropagation(); 
                        e.dataTransfer.setData('text/plain', appt.id);
                        const rect = card.getBoundingClientRect();
                        e.dataTransfer.setData('offsetY', e.clientY - rect.top);
                        setTimeout(() => card.classList.add('opacity-40'), 0); 
                    });
                    
                    card.addEventListener('dragend', () => {
                        card.classList.remove('opacity-40');
                    });
                }

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
                    openModal({ ...appt, displayName: clientUser ? displayName : appt.clientName });
                };
                bCol.appendChild(card);
            });
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
    isCreatingNewClient = false;
    els.clientSelectContainer.classList.remove('hidden');
    els.newClientContainer.classList.add('hidden');
    els.btnToggleClient.innerHTML = `<i data-lucide="user-plus" class="w-3 h-3"></i> <span id="text-toggle-client">Novo Cliente</span>`;
    els.formClient.setAttribute('required', 'true');
    els.newClientName.removeAttribute('required');
    els.newClientName.value = '';
    els.newClientPhone.value = '';

    els.formId.value = data.id || '';
    els.formStatus.value = data.status || 'confirmed';
    els.formClient.value = data.userId || (state.users.length > 0 ? state.users[0].id : '');
    els.formDate.value = data.date || getLocalYYYYMMDD(state.currentDate);
    els.formBarber.value = data.barberId || state.barbers[0]?.id || '';
    els.formService.value = data.serviceId || state.services[0]?.id || '';
    els.formTime.value = data.startTime ? formatMinutesToTime(data.startTime) : '09:00';

    if (data.id) {
        els.btnDelete.classList.remove('hidden');
        els.modalActions.classList.remove('hidden');
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

// --- NOTIFICAÇÕES: SOLICITAR PERMISSÃO ---
if (els.btnEnableNotifications) {
    els.btnEnableNotifications.onclick = async () => {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                // CHAVE VAPID: Vá no Firebase Console > Project Settings > Cloud Messaging > Web configuration > Generate Key pair
                // Substitua a string abaixo pela chave pública gerada lá.
                const currentToken = await getToken(messaging, { vapidKey: 'BExxxxxxxxxxxxxxxxxxxxxxxxxxxxxSUA_CHAVE_VAPID_AQUIxxxxxxxxxxxxxxxxxxxxxxxxxxx' });
                if (currentToken) {
                    console.log('Token FCM:', currentToken);
                    // Aqui você pode salvar o token no documento do administrador logado
                    // Exemplo: await updateDoc(doc(db, "employees", adminId), { fcmToken: currentToken });
                    alert('Notificações ativadas! Você será avisado sobre agendamentos.');
                }
            } else {
                alert('Permissão para notificações não foi concedida.');
            }
        } catch (error) {
            console.error('Erro ao pedir permissão de notificação:', error);
        }
    };
}

window.app = {
    updateStatus: async (newStatus) => {
        if (!els.formId.value) return;
        
        const bookingId = els.formId.value;
        const bookingData = state.appointments.find(a => a.id === bookingId);
        
        if (newStatus === 'completed' && bookingData) {
            openPaymentModal(bookingData);
        } else {
            const bookingRef = doc(db, "bookings", bookingId);
            await updateDoc(bookingRef, { status: newStatus });
            els.formStatus.value = newStatus;
            closeModal();
        }
    }
};

els.btnCloseModal.onclick = closeModal;
els.barberFilter.onchange = (e) => { state.selectedBarber = e.target.value; renderApp(); };
document.getElementById('btn-new-appt').onclick = () => openModal();
document.getElementById('btn-next-days').onclick = () => { state.currentDate.setDate(state.currentDate.getDate() + 1); renderApp(); };
document.getElementById('btn-prev-days').onclick = () => { state.currentDate.setDate(state.currentDate.getDate() - 1); renderApp(); };
document.getElementById('btn-today').onclick = () => { state.currentDate = new Date(); renderApp(); };

els.btnToggleClient.onclick = () => {
    isCreatingNewClient = !isCreatingNewClient;
    
    if (isCreatingNewClient) {
        els.clientSelectContainer.classList.add('hidden');
        els.newClientContainer.classList.remove('hidden');
        els.textToggleClient.textContent = "Selecionar Existente";
        els.btnToggleClient.innerHTML = `<i data-lucide="users" class="w-3 h-3"></i> <span id="text-toggle-client">Selecionar Existente</span>`;
        els.formClient.removeAttribute('required');
        els.newClientName.setAttribute('required', 'true');
    } else {
        els.clientSelectContainer.classList.remove('hidden');
        els.newClientContainer.classList.add('hidden');
        els.btnToggleClient.innerHTML = `<i data-lucide="user-plus" class="w-3 h-3"></i> <span id="text-toggle-client">Novo Cliente</span>`;
        els.formClient.setAttribute('required', 'true');
        els.newClientName.removeAttribute('required');
    }
    lucide.createIcons();
};

els.form.onsubmit = async (e) => {
    e.preventDefault();
    
    const submitBtn = e.submitter;
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "Salvando...";
    submitBtn.disabled = true;

    try {
        let userId = "";
        let clientName = "";

        if (isCreatingNewClient) {
            clientName = els.newClientName.value;
            const newClientData = {
                name: clientName,
                phone: els.newClientPhone.value || "",
                createdAt: new Date().toISOString()
            };
            const userDocRef = await addDoc(collection(db, "users"), newClientData);
            userId = userDocRef.id;
        } else {
            const selectedUser = state.users.find(u => u.id === els.formClient.value);
            clientName = selectedUser ? selectedUser.name : "Cliente Desconhecido";
            userId = selectedUser ? selectedUser.id : "";
        }

        const service = state.services.find(s => s.id === els.formService.value);
        const barber = state.barbers.find(b => b.id === els.formBarber.value);
        const [hours, minutes] = els.formTime.value.split(':').map(Number);
        const startMins = (hours * 60) + minutes;
        const durationMins = Number(service?.duration) || 30;

        const bookingData = {
            barberId: barber.id,
            barberName: barber.name,
            companyId: "sami", 
            date: els.formDate.value,
            startTime: startMins,
            endTime: startMins + durationMins, 
            price: service?.price || 0,
            serviceId: service.id,
            serviceName: service.name,
            clientName: clientName, 
            status: els.formStatus.value || "confirmed",
            userId: userId, 
        };

        const isNew = !els.formId.value;

        if (!isNew) {
            await updateDoc(doc(db, "bookings", els.formId.value), bookingData);
        } else {
            bookingData.createdAt = new Date().toISOString();
            await addDoc(collection(db, "bookings"), bookingData);
        }

        // --- DISPARAR NOTIFICAÇÃO PRO BACKEND (API) ---
        // Apenas para testes, não vai travar o salvamento se a API falhar.
        try {
            await fetch(API_NOTIFICACOES_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: isNew ? 'agendamento' : 'atualizacao',
                    nomeCliente: clientName,
                    nomeBarbeiro: barber.name,
                    data: els.formDate.value.split('-').reverse().join('/'),
                    hora: formatMinutesToTime(startMins)
                })
            });
        } catch (notifErr) {
            console.log("Aviso: Notificação não enviada (API não configurada ainda).", notifErr);
        }
        // ----------------------------------------------

        closeModal();
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Ocorreu um erro ao salvar o agendamento.");
    } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
};

els.btnDelete.onclick = async () => {
    if (confirm("Tem certeza que deseja excluir este agendamento?")) {
        const bookingId = els.formId.value;
        const bookingData = state.appointments.find(a => a.id === bookingId);

        await deleteDoc(doc(db, "bookings", bookingId));

        // --- DISPARAR NOTIFICAÇÃO DE CANCELAMENTO ---
        if (bookingData) {
            try {
                await fetch(API_NOTIFICACOES_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tipo: 'cancelamento',
                        nomeCliente: bookingData.clientName,
                        nomeBarbeiro: bookingData.barberName,
                        data: bookingData.date.split('-').reverse().join('/'),
                        hora: formatMinutesToTime(bookingData.startTime)
                    })
                });
            } catch (notifErr) {
                console.log("Aviso: Notificação não enviada.", notifErr);
            }
        }
        // ----------------------------------------------

        closeModal();
    }
};

let currentPaymentTotal = 0;

function openPaymentModal(booking) {
    closeModal(); 
    
    const service = state.services.find(s => s.id === booking.serviceId);
    currentPaymentTotal = Number(booking.price) || Number(service?.price) || 0;
    
    els.paymentBookingId.value = booking.id;
    els.paymentTotal.textContent = `€ ${currentPaymentTotal.toFixed(2).replace('.', ',')}`;
    
    els.paymentForm.reset();
    els.cashDetails.classList.add('hidden');
    els.paymentReceived.required = false;
    els.paymentChange.textContent = '€ 0,00';
    els.paymentChange.classList.remove('text-red-500', 'text-emerald-400', 'text-zinc-400');
    els.paymentChange.classList.add('text-zinc-400');

    els.paymentModal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

els.btnClosePayment.onclick = () => {
    els.paymentModal.classList.add('hidden');
    const bookingData = state.appointments.find(a => a.id === els.paymentBookingId.value);
    if(bookingData) openModal(bookingData);
};

Array.from(els.paymentMethodRadios).forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'dinheiro') {
            els.cashDetails.classList.remove('hidden');
            els.paymentReceived.required = true;
            els.paymentReceived.value = ''; 
            els.paymentReceived.focus();
        } else {
            els.cashDetails.classList.add('hidden');
            els.paymentReceived.required = false;
            els.paymentReceived.value = currentPaymentTotal; 
        }
        
        els.paymentReceived.dispatchEvent(new Event('input'));
    });
});

els.paymentReceived.addEventListener('input', (e) => {
    const received = Number(e.target.value) || 0;
    const change = received - currentPaymentTotal;
    
    els.paymentChange.classList.remove('text-red-500', 'text-emerald-400', 'text-zinc-400');

    if (received === 0) {
        els.paymentChange.textContent = `€ 0,00`;
        els.paymentChange.classList.add('text-zinc-400');
    } else if (change < 0) {
        els.paymentChange.textContent = `Faltam € ${Math.abs(change).toFixed(2).replace('.', ',')}`;
        els.paymentChange.classList.add('text-red-500'); 
    } else {
        els.paymentChange.textContent = `€ ${change.toFixed(2).replace('.', ',')}`;
        els.paymentChange.classList.add('text-emerald-400'); 
    }
});

els.paymentForm.onsubmit = async (e) => {
    e.preventDefault();
    
    const method = document.querySelector('input[name="payment_method"]:checked').value;
    let received = Number(els.paymentReceived.value);
    
    if (method !== 'dinheiro') received = currentPaymentTotal;
    
    if (method === 'dinheiro' && received < currentPaymentTotal) {
        alert("O valor recebido é menor que o total a pagar.");
        return;
    }

    const submitBtn = e.submitter;
    const originalContent = submitBtn.innerHTML;
    submitBtn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Processando...`;
    submitBtn.disabled = true;

    try {
        const bookingId = els.paymentBookingId.value;
        const bookingData = state.appointments.find(a => a.id === bookingId);
        const change = method === 'dinheiro' ? (received - currentPaymentTotal) : 0;
        
        const transactionData = {
            originalBookingId: bookingId,
            companyId: bookingData.companyId || "sami",
            userId: bookingData.userId,
            clientName: bookingData.clientName,
            barberId: bookingData.barberId,
            barberName: bookingData.barberName,
            serviceId: bookingData.serviceId,
            serviceName: bookingData.serviceName,
            scheduledDate: bookingData.date,
            completedAt: new Date().toISOString(),
            duration: (bookingData.endTime && bookingData.startTime) ? (bookingData.endTime - bookingData.startTime) : 0,
            currency: 'EUR',
            subtotal: currentPaymentTotal,
            taxRate: 23, 
            taxAmount: currentPaymentTotal - (currentPaymentTotal / 1.23), 
            discountAmount: 0,
            finalPrice: currentPaymentTotal,
            paymentMethod: method,          
            amountReceived: received,
            changeReturned: change,
            paymentStatus: 'paid',          
            invoiceStatus: 'pending',       
        };

        await addDoc(collection(db, "history"), transactionData);

        const bookingRef = doc(db, "bookings", bookingId);
        await updateDoc(bookingRef, { status: 'completed' });
        
        els.paymentModal.classList.add('hidden');
        
    } catch (error) {
        console.error("Erro ao finalizar pagamento:", error);
        alert("Ocorreu um erro ao processar o pagamento.");
    } finally {
        submitBtn.innerHTML = originalContent;
        submitBtn.disabled = false;
        if (window.lucide) lucide.createIcons();
    }
};

initFirebaseSync();