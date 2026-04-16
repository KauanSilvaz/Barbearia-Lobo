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

// --- UTILS & FUSO HORÁRIO (Lisboa/Portugal) ---

// Mantém formato YYYY-MM-DD APENAS para alimentar os <input type="date"> do HTML
const getLocalYYYYMMDD = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().split('T')[0];
};

// Nova função para o banco de dados (DD/MM/YYYY)
const getFormattedDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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

const getLisbonDateObj = () => {
    const lisbonTimeStr = new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" });
    return new Date(lisbonTimeStr);
};

// Atualizado para retornar a data atual de Lisboa em DD/MM/YYYY para comparar com a linha do tempo
const getLisbonCurrentDateStr = () => {
    const now = getLisbonDateObj();
    return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
};

const getLisbonCurrentTime = () => {
    const now = getLisbonDateObj();
    return { h: now.getHours(), m: now.getMinutes() };
};

const app = {
    currentDate: new Date(),
    view: 'agenda',
    schedule: null, 
    appointments: [], 
    historyData: [],
    users: [],
    services: [],
    currentEmployee: null, 
    isCreatingNewClient: false,
    currentPaymentTotal: 0,
    autoScrollToCurrentTime: true,
    savedScrollTop: 0,

    init: () => {
        app.setupFirebaseListeners();
        app.syncCompanyLogo();
        app.setupPaymentListeners();
        
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
        onSnapshot(doc(db, "settings", "schedule"), (snapshot) => {
            if (snapshot.exists()) {
                app.schedule = snapshot.data();
                app.renderGrid();
            }
        });

        onSnapshot(doc(db, "employees", loggedBarberId), (docSnap) => {
            if (docSnap.exists()) {
                app.currentEmployee = docSnap.data();
                const barberColor = app.currentEmployee.color || '#f59e0b';
                
                document.getElementById('barber-photo').style.borderColor = barberColor;
                document.getElementById('barber-icon').style.color = barberColor;
                document.getElementById('barber-icon').style.borderColor = `${barberColor}40`; 
                document.getElementById('barber-icon').style.backgroundColor = `${barberColor}1A`; 
                document.getElementById('fab-new').style.backgroundColor = barberColor;
                document.getElementById('fab-new').style.color = '#000'; 
                
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
        const inputDateStr = getLocalYYYYMMDD(app.currentDate);
        const dbDateStr = getFormattedDate(app.currentDate);
        
        const currentMonth = app.currentDate.getMonth();
        const currentYear = app.currentDate.getFullYear();

        let moneyToday = 0;
        let moneyMonth = 0;
        let totalMonthCount = 0;
        let clientsTodayCount = 0;

        app.historyData.forEach(h => {
            const dateField = h.date || h.scheduledDate || (h.completedAt ? h.completedAt.split('T')[0] : ''); 
            const hDate = new Date(h.completedAt || dateField); 
            const price = Number(h.finalPrice || h.price) || 0;

            if (dateField === inputDateStr || dateField === dbDateStr) moneyToday += price;
            
            if (hDate.getMonth() === currentMonth && hDate.getFullYear() === currentYear) {
                moneyMonth += price;
                totalMonthCount++;
            }
        });

        app.appointments.forEach(a => {
            if (a.date === inputDateStr || a.date === dbDateStr) clientsTodayCount++;
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
        app.autoScrollToCurrentTime = false;
        app.savedScrollTop = 0;
        app.updateMetrics();
        app.renderGrid();
    },

    renderGrid: () => {
        const emp = app.currentEmployee;
        if (!emp) return; 

        if (!app.autoScrollToCurrentTime) {
            app.savedScrollTop = document.getElementById('grid-body').scrollTop;
        }

        const header = document.getElementById('grid-header');
        const body = document.getElementById('grid-body');
        const dateDisplay = document.getElementById('current-date-display');
        
        const todayStr = getLocalYYYYMMDD(new Date());
        
        // Passamos os dois formatos para garantir que marcações antigas continuem aparecendo
        const dbDateStr = getFormattedDate(app.currentDate);
        const inputDateStr = getLocalYYYYMMDD(app.currentDate);

        dateDisplay.innerText = todayStr === inputDateStr ? 'Hoje' : app.currentDate.toLocaleDateString('pt-PT', {day:'numeric', month:'short'});

        if (emp.isBlocked) {
            body.innerHTML = `
                <div class="h-full w-full bg-red-950/20 flex flex-col items-center justify-center p-6 text-center mt-10 rounded-xl border border-red-900/30">
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

        const barberColor = emp.color || '#f59e0b';
        
        const daysMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const dayOfWeek = daysMap[app.currentDate.getDay()];

        let startHour = 8; 
        let endHour = 22; 

        if (app.schedule) {
            if (app.schedule.dailySchedules && app.schedule.dailySchedules[dayOfWeek]) {
                const dayConfig = app.schedule.dailySchedules[dayOfWeek];
                if (dayConfig.active) {
                    if (dayConfig.open) startHour = parseInt(dayConfig.open.split(':')[0], 10);
                    if (dayConfig.close) {
                        const closeParts = dayConfig.close.split(':');
                        const closeH = parseInt(closeParts[0], 10);
                        const closeM = parseInt(closeParts[1], 10);
                        endHour = closeM > 0 ? closeH + 1 : closeH;
                    }
                }
            } else if (app.schedule.open && app.schedule.close) {
                startHour = parseInt(app.schedule.open.split(':')[0], 10);
                const closeParts = app.schedule.close.split(':');
                const closeH = parseInt(closeParts[0], 10);
                const closeM = parseInt(closeParts[1], 10);
                endHour = closeM > 0 ? closeH + 1 : closeH;
            }
        }

        const todaysBookings = app.appointments.filter(b => b.date === dbDateStr || b.date === inputDateStr);

        todaysBookings.forEach(appt => {
            const service = app.services.find(s => s.id === appt.serviceId) || {};
            const duration = (appt.endTime && appt.startTime) ? (appt.endTime - appt.startTime) : (Number(service.duration) || 30);
            const apptEndH = Math.ceil((appt.startTime + duration) / 60);
            const apptStartH = Math.floor(appt.startTime / 60);
            
            if (apptStartH < startHour) startHour = apptStartH;
            if (apptEndH > endHour) endHour = apptEndH;
        });

        endHour = Math.max(endHour, startHour + 1);

        const pixelsPerMinute = 2.5; 
        const topPadding = 20; 
        const totalHeight = (endHour - startHour + 1) * 60 * pixelsPerMinute + topPadding;

        header.innerHTML = `
            <div class="w-16 flex-shrink-0 border-r border-zinc-800/50 bg-zinc-900/50 sticky left-0 z-20"></div>
            <div class="flex-1 w-full min-w-[200px] p-3 text-center bg-zinc-900/40">
                <div class="text-[10px] uppercase font-bold" style="color: ${barberColor}">${app.currentDate.toLocaleDateString('pt-PT', { weekday: 'long' })}</div>
                <div class="text-xl font-bold text-white">${app.currentDate.getDate()}</div>
            </div>`;

        body.innerHTML = '';
        const gridContainer = document.createElement('div');
        gridContainer.className = 'flex relative w-full min-w-max';
        gridContainer.style.height = `${totalHeight}px`;

        const timeCol = document.createElement('div');
        timeCol.className = 'w-16 flex-shrink-0 border-r border-zinc-800/50 relative bg-zinc-950/80 z-20 backdrop-blur-sm sticky left-0';

        const linesContainer = document.createElement('div');
        linesContainer.className = 'absolute inset-0 pointer-events-none w-full flex';
        linesContainer.innerHTML = `<div class="w-16 flex-shrink-0 sticky left-0"></div>`;
        const linesContent = document.createElement('div');
        linesContent.className = 'flex-1 relative w-full';

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
                    hLine.className = 'absolute w-full border-t border-zinc-700/60 z-10';
                } else if (m === 30) {
                    timeLabel.className = 'absolute w-full text-center text-[10px] text-zinc-500 font-medium -mt-1.5';
                    timeLabel.textContent = `${h.toString().padStart(2, '0')}:30`;
                    hLine.className = 'absolute w-full border-t border-zinc-800/50 border-dashed';
                } else {
                    timeLabel.className = 'absolute w-full text-center text-[8px] text-zinc-700/70 font-medium -mt-1';
                    timeLabel.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    hLine.className = 'absolute w-full border-t border-zinc-800/20 border-dotted';
                }

                timeCol.appendChild(timeLabel);
                linesContent.appendChild(hLine);
            }
        }

        const lisbonDateStr = getLisbonCurrentDateStr();
        
        if (dbDateStr === lisbonDateStr || inputDateStr === getLocalYYYYMMDD(getLisbonDateObj())) {
            const { h: currentH, m: currentM } = getLisbonCurrentTime();
            const topPx = (currentH - startHour) * 60 * pixelsPerMinute + (currentM * pixelsPerMinute) + topPadding;

            const timeLine = document.createElement('div');
            timeLine.id = 'current-time-line-bar';
            timeLine.className = 'absolute left-0 w-full border-t-[2px] shadow-[0_0_12px_rgba(245,158,11,0.8)] z-50 pointer-events-none transition-all duration-1000 ease-linear';
            timeLine.style.top = `${topPx}px`;
            timeLine.style.borderColor = barberColor; 
            timeLine.style.display = (currentH >= startHour && currentH <= endHour) ? 'block' : 'none';
            linesContent.appendChild(timeLine);

            const timeBadge = document.createElement('div');
            timeBadge.id = 'current-time-line-badge';
            timeBadge.className = 'absolute right-0 text-black text-[11px] font-bold px-2 py-0.5 rounded-l-md shadow-lg z-50 transform -translate-y-1/2 flex items-center gap-1.5 transition-all duration-1000 ease-linear';
            timeBadge.style.top = `${topPx}px`;
            timeBadge.style.backgroundColor = barberColor; 
            timeBadge.style.display = (currentH >= startHour && currentH <= endHour) ? 'flex' : 'none';
            timeBadge.innerHTML = `<span class="animate-pulse w-1.5 h-1.5 bg-black rounded-full"></span> <span id="current-time-text">${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}</span>`;
            timeCol.appendChild(timeBadge);

            if (window.currentTimeInterval) clearInterval(window.currentTimeInterval);
            
            window.currentTimeInterval = setInterval(() => {
                const { h, m } = getLisbonCurrentTime();
                const bar = document.getElementById('current-time-line-bar');
                const badge = document.getElementById('current-time-line-badge');
                const text = document.getElementById('current-time-text');
                
                if (bar && badge && text) {
                    if (h < startHour || h > endHour) {
                        bar.style.display = 'none';
                        badge.style.display = 'none';
                    } else {
                        bar.style.display = 'block';
                        badge.style.display = 'flex';
                        const newTop = (h - startHour) * 60 * pixelsPerMinute + (m * pixelsPerMinute) + topPadding;
                        bar.style.top = `${newTop}px`;
                        badge.style.top = `${newTop}px`;
                        text.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    }
                }
            }, 30000); 
        } else {
            if (window.currentTimeInterval) clearInterval(window.currentTimeInterval);
        }

        linesContainer.appendChild(linesContent);
        gridContainer.appendChild(timeCol);

        const bCol = document.createElement('div');
        bCol.className = 'flex-1 relative cursor-pointer hover:bg-zinc-800/10 transition-colors z-10 w-full min-w-[200px]';

        bCol.onclick = (e) => {
            if(e.target !== bCol) return;
            const rect = bCol.getBoundingClientRect();
            const y = e.clientY - rect.top - topPadding;
            let clickedMinuteOfDay = (y / pixelsPerMinute) + (startHour * 60);
            clickedMinuteOfDay = Math.max(startHour * 60, Math.floor(clickedMinuteOfDay / 5) * 5);
            app.openModal(null, clickedMinuteOfDay);
        };

        const sortedBookings = [...todaysBookings].sort((a, b) => a.startTime - b.startTime);
        const groups = [];
        let currentGroup = [];
        let groupEnd = 0;

        sortedBookings.forEach(appt => {
            const service = app.services.find(s => s.id === appt.serviceId) || {};
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
                const clientUser = app.users.find(u => u.id === appt.userId);
                const displayName = clientUser ? (clientUser.name || 'Usuário App') : (appt.clientName || 'Cliente Avulso');

                const startMins = appt.startTime - (startHour * 60);
                const topPx = (startMins * pixelsPerMinute) + topPadding;
                const heightPx = duration * pixelsPerMinute;

                const topLine = document.createElement('div');
                topLine.className = 'absolute left-0 w-full border-t-[1.5px] border-red-500 z-10 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.6)] opacity-50';
                topLine.style.top = `${topPx}px`;

                const bottomLine = document.createElement('div');
                bottomLine.className = 'absolute left-0 w-full border-t-[1.5px] border-red-500 z-10 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.6)] opacity-50';
                bottomLine.style.top = `${topPx + heightPx}px`;

                const topBadge = document.createElement('div');
                topBadge.className = 'absolute right-0 bg-red-600/90 text-white text-[11px] font-bold px-2 py-0.5 rounded-l-md shadow-lg z-20 transform -translate-y-1/2';
                topBadge.style.top = `${topPx}px`;
                topBadge.textContent = formatMinutesToTime(appt.startTime);

                const bottomBadge = document.createElement('div');
                bottomBadge.className = 'absolute right-0 bg-red-600/90 text-white text-[11px] font-bold px-2 py-0.5 rounded-l-md shadow-lg z-20 transform -translate-y-1/2';
                bottomBadge.style.top = `${topPx + heightPx}px`;
                bottomBadge.textContent = formatMinutesToTime(appt.startTime + duration);

                linesContent.appendChild(topLine);
                linesContent.appendChild(bottomLine);
                timeCol.appendChild(topBadge);
                timeCol.appendChild(bottomBadge);

                let colorClasses = "bg-zinc-900 border-zinc-800";
                let opacityClass = '';
                let textDecorationClass = 'text-zinc-100';
                let dotColorClass = '';
                
                if (appt.status === 'completed') {
                    opacityClass = 'opacity-40 grayscale hover:grayscale-0 border-l-zinc-400 bg-zinc-800';
                    textDecorationClass = 'line-through text-zinc-500';
                    dotColorClass = 'background-color: #a1a1aa'; 
                } else {
                    opacityClass = 'border-l-[4px]';
                    dotColorClass = `background-color: ${barberColor}`; 
                }

                const widthPct = 100 / numCols;
                const leftPct = item.colIndex * widthPct;

                const card = document.createElement('div');
                card.className = `absolute rounded-lg p-2.5 text-xs border-t border-r border-b backdrop-blur-md shadow-lg transition-all overflow-hidden flex flex-col justify-between cursor-pointer hover:z-30 z-20 ${colorClasses} ${opacityClass}`;
                
                card.style.top = `${topPx}px`;
                card.style.height = `${Math.max(heightPx, 45)}px`;
                card.style.left = `calc(${leftPct}% + 4px)`;
                card.style.width = `calc(${widthPct}% - 8px)`;
                if(appt.status !== 'completed') card.style.borderLeftColor = barberColor;

                card.innerHTML = `
                    <div class="flex flex-col gap-1 h-full">
                        <div class="flex justify-between items-start gap-1">
                            <div class="flex items-center gap-1.5 truncate">
                                <div class="w-2 h-2 rounded-full flex-shrink-0 shadow-sm" style="${dotColorClass}"></div>
                                <span class="font-bold truncate text-[12px] leading-tight ${textDecorationClass}">${displayName}</span>
                                ${appt.notes ? `<i data-lucide="message-square-text" class="w-3 h-3 text-sky-400 ml-1 flex-shrink-0"></i>` : ''}
                            </div>
                            ${appt.status === 'completed' 
                                ? `<i data-lucide="check-check" class="w-4 h-4 flex-shrink-0 text-emerald-500"></i>` 
                                : ``
                            }
                        </div>
                        
                        <div class="opacity-90 truncate text-[10px] leading-tight flex items-center gap-1 text-zinc-400">
                            <i data-lucide="scissors" class="w-3 h-3" style="color: ${appt.status === 'completed' ? '#a1a1aa' : barberColor}"></i>
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
                    app.openModal(appt.id);
                };

                bCol.appendChild(card);
            });
        });

        gridContainer.appendChild(bCol);
        body.appendChild(linesContainer);
        body.appendChild(gridContainer);

        // --- LÓGICA DE SCROLL AUTOMÁTICO ---
        const isToday = (dbDateStr === lisbonDateStr || inputDateStr === getLocalYYYYMMDD(getLisbonDateObj()));
        if (isToday && app.autoScrollToCurrentTime) {
            if (window.scrollTimeoutId) clearTimeout(window.scrollTimeoutId);
            window.scrollTimeoutId = setTimeout(() => {
                const timeLine = document.getElementById('current-time-line-bar');
                if (timeLine) {
                    const topPx = parseFloat(timeLine.style.top);
                    body.scrollTo({
                        top: Math.max(0, topPx - 100), 
                        behavior: 'smooth'
                    });
                }
                app.autoScrollToCurrentTime = false; 
            }, 300);
        } else if (!app.autoScrollToCurrentTime && app.savedScrollTop !== undefined) {
            body.scrollTop = app.savedScrollTop;
        }

        if (window.lucide) lucide.createIcons();
    },

    renderHistory: () => {
        const list = document.getElementById('history-list');
        
        const past = [...app.historyData].sort((a,b) => {
            const dateA = new Date(a.completedAt || a.scheduledDate || a.date || 0);
            const dateB = new Date(b.completedAt || b.scheduledDate || b.date || 0);
            return dateB - dateA;
        });
        
        if (past.length === 0) {
            list.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-zinc-500 text-sm">Nenhum histórico encontrado.</td></tr>`;
            return;
        }

        list.innerHTML = past.map(a => {
            const rawDate = a.date || a.scheduledDate || (a.completedAt ? a.completedAt.split('T')[0] : '');
            const formattedDate = (rawDate && rawDate.includes('-')) ? rawDate.split('-').reverse().join('/') : (rawDate || 'Sem data');

            return `
            <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td class="py-3 pl-2 text-zinc-400 text-xs">${formattedDate}</td>
                <td class="py-3 font-medium text-white text-xs">${a.clientName || 'Cliente'}</td>
                <td class="py-3 text-zinc-400 text-xs">${a.serviceName || 'Serviço'}</td>
                <td class="py-3 text-right pr-2 text-emerald-500 font-bold text-xs">€ ${Number(a.finalPrice || a.price || 0).toFixed(2)}</td>
            </tr>`;
        }).join('');
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
            document.getElementById('new-client-email').value = '';
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
        const dateKeyInput = getLocalYYYYMMDD(app.currentDate);
        const isPastDate = dateKeyInput < todayStr;

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
        document.getElementById('new-client-email').value = '';

        document.getElementById('appt-id').value = '';
        document.getElementById('appt-date').value = dateKeyInput;
        document.getElementById('appt-notes').value = '';
        
        if (startMins !== null) {
            document.getElementById('appt-time').value = formatMinutesToTime(startMins);
        } else {
            if (dateKeyInput === todayStr) {
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
                
                // Tratativa especial para carregar a data de volta pro formulário HTML (que exige YYYY-MM-DD)
                if (currentAppt.date && currentAppt.date.includes('/')) {
                    const [d, m, y] = currentAppt.date.split('/');
                    document.getElementById('appt-date').value = `${y}-${m}-${d}`;
                } else {
                    document.getElementById('appt-date').value = currentAppt.date;
                }
                
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

        const barberColor = app.currentEmployee?.color || '#f59e0b';
        saveBtn.style.backgroundColor = barberColor;
        saveBtn.style.color = '#000';

        document.getElementById('appointment-modal').classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
    },

    closeModal: () => document.getElementById('appointment-modal').classList.add('hidden'),

    saveAppt: async () => {
        if (app.currentEmployee?.isBlocked) return;
        const apptDateInput = document.getElementById('appt-date').value;
        
        if (apptDateInput < getLocalYYYYMMDD(new Date())) {
            alert("Não é possível salvar informações em dias passados.");
            return;
        }

        // Converte a data do form do HTML (YYYY-MM-DD) para salvar no banco (DD/MM/YYYY)
        const [y, m, d] = apptDateInput.split('-');
        const dbDate = `${d}/${m}/${y}`;

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
                email: document.getElementById('new-client-email')?.value || "",
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
            date: dbDate, // Salva no formato DD/MM/YYYY
            startTime: startMins,
            endTime: startMins + durationMins, 
            price: (service?.isPromo && service?.promoPrice) ? Number(service.promoPrice) : (Number(service?.price) || 0),
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

    sendReminder: async () => {
        if (app.currentEmployee?.isBlocked) return;
        
        const id = document.getElementById('appt-id').value;
        if (!id) return;
        
        const bookingData = app.appointments.find(a => a.id === id);
        if (!bookingData) return;

        const clientUser = app.users.find(u => u.id === bookingData.userId);

        if (!clientUser || !clientUser.email) {
            app.showToast("Este cliente não possui um e-mail cadastrado em seu perfil.");
            return;
        }

        const btnRemind = document.getElementById('btn-remind-barber');
        const btnOriginalHTML = btnRemind.innerHTML;
        btnRemind.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Enviando...`;
        btnRemind.disabled = true;
        if (window.lucide) lucide.createIcons();

        try {
            let formattedDate = bookingData.date;
            if(formattedDate.includes('-')) formattedDate = formattedDate.split('-').reverse().join('/');

            await addDoc(collection(db, "fila_emails"), {
                tipo: "manual",
                emailDestino: clientUser.email,
                nomeCliente: clientUser.name || bookingData.clientName,
                dataAgendamento: formattedDate,
                horaAgendamento: formatMinutesToTime(bookingData.startTime),
                barbeiroNome: bookingData.barberName || loggedBarberName,
                servico: bookingData.serviceName || "Serviço",
                preco: bookingData.price || 0,
                status: "pendente",
                criadoEm: new Date().toISOString()
            });
            
            app.showToast("Aviso enviado para a fila! O e-mail será disparado em segundos.");
        } catch (error) {
            console.error("Erro ao enfileirar e-mail:", error);
            app.showToast("Ocorreu um erro ao tentar enviar o aviso.");
        } finally {
            btnRemind.innerHTML = btnOriginalHTML;
            btnRemind.disabled = false;
            if (window.lucide) lucide.createIcons();
        }
    },

    openPaymentModal: () => {
        if (app.currentEmployee?.isBlocked) return;
        
        const id = document.getElementById('appt-id').value;
        if (!id) return;
        
        const booking = app.appointments.find(a => a.id === id);
        if (!booking) return;

        // Se a data do banco for DD/MM/YYYY, formata para YYYY-MM-DD para comparar
        let checkDate = booking.date;
        if (checkDate.includes('/')) {
            const [d, m, y] = checkDate.split('/');
            checkDate = `${y}-${m}-${d}`;
        }

        if (checkDate < getLocalYYYYMMDD(new Date())) {
            alert("Este agendamento pertence ao passado e é imutável.");
            return;
        }

        app.closeModal(); 
        
        const service = app.services.find(s => s.id === booking.serviceId);
        
        // Verifica qual é o preço atualizado ativo no momento do pagamento
        const precoAtivo = (service?.isPromo && service?.promoPrice) 
            ? Number(service.promoPrice) 
            : Number(service?.price || 0);

        // Usa o preço ativo. Se não achar (ex: serviço deletado), tenta usar o salvo no agendamento.
        app.currentPaymentTotal = precoAtivo > 0 ? precoAtivo : (Number(booking.price) || 0);
        
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
            let checkDate = booking.date;
            if (checkDate.includes('/')) {
                const [d, m, y] = checkDate.split('/');
                checkDate = `${y}-${m}-${d}`;
            }

            if (checkDate < getLocalYYYYMMDD(new Date())) {
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