/* financeiro.js - COMPLETO COM PDV (CAIXA), REAL-TIME SYNC, BLINDAGEM DE DATAS, EXCLUSÃO E CORES NO GRÁFICO */
/* ATUALIZAÇÃO: Filtros de "Todo Período" e "Período Personalizado" adicionados */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, query, orderBy, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAmljKXhjb9GlY1ABEA-GPJqNsftsv_hVk",
  authDomain: "ksstech-79520.firebaseapp.com",
  projectId: "ksstech-79520",
  storageBucket: "ksstech-79520.firebasestorage.app",
  messagingSenderId: "935997511388",
  appId: "1:935997511388:web:9c336727d3e588ee30c619",
  measurementId: "G-TM49C8N0T1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let todosOsDados = []; 
let dadosExibidos = []; 
let graficos = {}; 

// Estado Global do PDV/Caixa
const posState = {
    services: [],
    barbers: [],
    users: [],
    currentTotal: 0
};

// Expondo a função de impressão globalmente para o onclick do HTML
window.imprimirNota = function(dadosCodificados) {
    financeApp.imprimirNotaTermica(dadosCodificados);
};

// Expondo a função de exclusão globalmente para o onclick do HTML
window.excluirRegistro = function(id) {
    financeApp.excluirRegistro(id);
};

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    financeApp.initCharts();
    financeApp.configurarEventos();
    financeApp.iniciarSincronizacaoRealTime();
    financeApp.syncCompanyLogo();
});

const financeApp = {

    syncCompanyLogo: () => {
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
    },

    configurarEventos: () => {
        document.getElementById('btn-hoje').addEventListener('click', (e) => financeApp.aplicarFiltroPeriodo('hoje', e.target));
        document.getElementById('btn-semana').addEventListener('click', (e) => financeApp.aplicarFiltroPeriodo('semana', e.target));
        document.getElementById('btn-mes').addEventListener('click', (e) => financeApp.aplicarFiltroPeriodo('mes', e.target));

        // ── NOVOS FILTROS ──────────────────────────────────────────────
        document.getElementById('btn-todo').addEventListener('click', (e) => financeApp.aplicarFiltroPeriodo('todo', e.target));

        document.getElementById('btn-personalizado').addEventListener('click', (e) => {
            // Ativa o botão visualmente
            financeApp.aplicarFiltroPeriodo('personalizado', e.target);
            // Abre/fecha o painel de datas
            const painel = document.getElementById('painel-personalizado');
            const estaOculto = painel.classList.contains('hidden');
            if (estaOculto) {
                painel.classList.remove('hidden');
                painel.classList.add('flex');
            } else {
                painel.classList.add('hidden');
                painel.classList.remove('flex');
            }
        });

        document.getElementById('btn-aplicar-periodo').addEventListener('click', () => {
            const inicio = document.getElementById('data-inicio').value;
            const fim = document.getElementById('data-fim').value;
            if (!inicio || !fim) {
                alert('Por favor, selecione as duas datas.');
                return;
            }
            if (inicio > fim) {
                alert('A data inicial não pode ser maior que a data final.');
                return;
            }
            financeApp.aplicarFiltroPeriodoPersonalizado(inicio, fim);
        });
        // ── FIM NOVOS FILTROS ──────────────────────────────────────────

        document.getElementById('btn-exportar').addEventListener('click', financeApp.exportarExtratoPDF);
        
        document.getElementById('input-busca').addEventListener('input', (e) => {
            const termo = e.target.value.toLowerCase();
            const filtrado = dadosExibidos.filter(item => 
                item.servico.toLowerCase().includes(termo) || 
                item.barbeiro.toLowerCase().includes(termo) ||
                item.cliente.toLowerCase().includes(termo)
            );
            financeApp.renderLedger(filtrado);
        });

        // Eventos do Modal PDV (Caixa)
        document.getElementById('btn-abrir-caixa').addEventListener('click', financeApp.abrirModalPos);
        document.getElementById('btn-close-pos').addEventListener('click', financeApp.fecharModalPos);
        
        // Atualiza valor quando muda o serviço
        document.getElementById('pos-service').addEventListener('change', (e) => {
            const service = posState.services.find(s => s.id === e.target.value);
        
            if (service) {
                // Se for promo, usa o promoPrice, senão usa o price normal
                posState.currentTotal = (service.isPromo && service.promoPrice) 
                    ? Number(service.promoPrice) 
                    : Number(service.price);
            } else {
                posState.currentTotal = 0;
            }
        
            document.getElementById('pos-total').textContent = `€ ${posState.currentTotal.toFixed(2).replace('.', ',')}`;
            // Dispara recalculo de troco se estiver em dinheiro
            document.getElementById('pos-received').dispatchEvent(new Event('input'));
        });

        // Alternância de métodos de pagamento no PDV
        const radios = document.getElementsByName('pos_method');
        Array.from(radios).forEach(radio => {
            radio.addEventListener('change', (e) => {
                const cashDetails = document.getElementById('pos-cash-details');
                const receivedInput = document.getElementById('pos-received');
                
                if (e.target.value === 'dinheiro') {
                    cashDetails.classList.remove('hidden');
                    receivedInput.required = true;
                    receivedInput.value = ''; 
                    receivedInput.focus();
                } else {
                    cashDetails.classList.add('hidden');
                    receivedInput.required = false;
                    receivedInput.value = posState.currentTotal; 
                }
                receivedInput.dispatchEvent(new Event('input'));
            });
        });

        // Cálculo de Troco
        document.getElementById('pos-received').addEventListener('input', (e) => {
            const received = Number(e.target.value) || 0;
            const change = received - posState.currentTotal;
            const changeDisplay = document.getElementById('pos-change');
            
            changeDisplay.classList.remove('text-red-500', 'text-emerald-400', 'text-zinc-400');

            if (received === 0) {
                changeDisplay.textContent = `€ 0,00`;
                changeDisplay.classList.add('text-zinc-400');
            } else if (change < 0) {
                changeDisplay.textContent = `Faltam € ${Math.abs(change).toFixed(2).replace('.', ',')}`;
                changeDisplay.classList.add('text-red-500'); 
            } else {
                changeDisplay.textContent = `€ ${change.toFixed(2).replace('.', ',')}`;
                changeDisplay.classList.add('text-emerald-400'); 
            }
        });

        // Submit do Form do PDV
        document.getElementById('pos-form').addEventListener('submit', financeApp.salvarVendaPos);
    },

    iniciarSincronizacaoRealTime: () => {
        // 1. Sincroniza o Histórico (Real-time)
        const historyRef = collection(db, "history");

        // ✅ Escutamos a coleção inteira diretamente, sem orderBy para não ocultar nada
        onSnapshot(historyRef, (snapshot) => {
            todosOsDados = [];
            const barbeirosSet = new Set();

            snapshot.forEach((doc) => {
                const data = doc.data();
                
                // 🛡️ BLINDAGEM DE DATAS: Recebe qualquer formato e padroniza para YYYY-MM-DD
                let rawDate = data.completedAt || data.scheduledDate || data.date || "";
                let dataFormatada = "";

                if (rawDate.includes('T')) {
                    // Cenário 1: Formato ISO com Hora (ex: "2026-03-16T18:43:37.629Z")
                    dataFormatada = rawDate.split('T')[0];
                } else if (rawDate.includes('/')) {
                    // Cenário 2: Formato PT/BR com barras (ex: "16/03/2026")
                    const partes = rawDate.split('/');
                    if (partes.length === 3) {
                        const dia = partes[0].padStart(2, '0');
                        const mes = partes[1].padStart(2, '0');
                        const ano = partes[2];
                        dataFormatada = `${ano}-${mes}-${dia}`;
                    } else {
                        dataFormatada = new Date().toISOString().split('T')[0]; // Falha segura
                    }
                } else if (rawDate.includes('-')) {
                    // Cenário 3: Já está no formato ISO simples (ex: "2026-03-16")
                    dataFormatada = rawDate;
                } else {
                    // Cenário 4: Veio vazio ou corrompido, assume a data de hoje
                    dataFormatada = new Date().toISOString().split('T')[0];
                }

                todosOsDados.push({
                    id: doc.id,
                    data: dataFormatada,
                    cliente: data.clientName || "Cliente Avulso",
                    clienteId: data.userId || "avulso",
                    servico: data.serviceName || "Venda Avulsa",
                    barbeiro: data.barberName || "Geral",
                    valor: Number(data.finalPrice || data.price || 0),
                    metodo: data.paymentMethod || 'Não Inf.',
                    recebido: data.amountReceived || Number(data.finalPrice || data.price || 0),
                    troco: data.changeReturned || 0,
                    status: 'Concluído',
                    dataHoraSucesso: data.completedAt || data.scheduledDate || data.date || new Date().toISOString()
                });
                
                if(data.barberName) barbeirosSet.add(data.barberName);
            });

            // ✅ Ordenação feita no lado do cliente com JavaScript
            todosOsDados.sort((a, b) => new Date(b.dataHoraSucesso) - new Date(a.dataHoraSucesso));

            // Preenche select de exportação
            const selectExport = document.getElementById('export-barber-select');
            const valorAtual = selectExport.value;
            selectExport.innerHTML = '<option value="todos">Todos os Barbeiros</option>';
            barbeirosSet.forEach(barbeiro => {
                const option = document.createElement('option');
                option.value = barbeiro;
                option.textContent = barbeiro;
                selectExport.appendChild(option);
            });
            selectExport.value = valorAtual || 'todos';

            // Reaplica o filtro ativo (Hoje, Semana, Mês, Todo, Personalizado)
            const botaoAtivo = document.querySelector('.btn-periodo.bg-zinc-800') || document.getElementById('btn-mes');
            if (botaoAtivo) {
                // Se o filtro personalizado estiver ativo, reaplica as datas salvas
                if (botaoAtivo.id === 'btn-personalizado') {
                    const inicio = document.getElementById('data-inicio').value;
                    const fim = document.getElementById('data-fim').value;
                    if (inicio && fim) {
                        financeApp.aplicarFiltroPeriodoPersonalizado(inicio, fim);
                    } else {
                        botaoAtivo.click();
                    }
                } else {
                    botaoAtivo.click();
                }
            }
        });

        // 2. Sincroniza dados auxiliares para o PDV e para as cores do gráfico
        onSnapshot(collection(db, "services"), (snap) => {
            posState.services = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        });
        
        onSnapshot(collection(db, "employees"), (snap) => {
            posState.barbers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (dadosExibidos.length > 0) {
                financeApp.atualizarGraficos(dadosExibidos);
            }
        });
        
        onSnapshot(collection(db, "users"), (snap) => {
            posState.users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        });
    },

    // --- FUNÇÕES DO PDV (CAIXA) ---
    abrirModalPos: () => {
        const selectSvc = document.getElementById('pos-service');
        const selectBrb = document.getElementById('pos-barber');
        const selectCli = document.getElementById('pos-client');

        // Preenche Serviços
        selectSvc.innerHTML = '<option value="" disabled selected>Selecione...</option>';
        posState.services.forEach(s => {
            // Verifica se é promo e se tem preço promocional, senão usa o preço normal
            const precoAtivo = (s.isPromo && s.promoPrice) ? s.promoPrice : s.price;
            selectSvc.add(new Option(`${s.name} (€${precoAtivo.toFixed(2).replace('.', ',')})`, s.id));
        });
        
        // Preenche Barbeiros
        selectBrb.innerHTML = '<option value="" disabled selected>Selecione...</option>';
        posState.barbers.forEach(b => selectBrb.add(new Option(b.name, b.id)));
        
        // Preenche Clientes
        selectCli.innerHTML = '<option value="">Cliente Avulso (Sem cadastro)</option>';
        posState.users.forEach(u => selectCli.add(new Option(u.name, u.id)));

        // Resets
        document.getElementById('pos-form').reset();
        posState.currentTotal = 0;
        document.getElementById('pos-total').textContent = '€ 0,00';
        document.getElementById('pos-cash-details').classList.add('hidden');
        document.getElementById('pos-change').textContent = '€ 0,00';
        document.getElementById('pos-change').className = 'text-xl font-bold text-zinc-400';

        document.getElementById('pos-modal').classList.remove('hidden');
    },

    fecharModalPos: () => {
        document.getElementById('pos-modal').classList.add('hidden');
    },

    salvarVendaPos: async (e) => {
        e.preventDefault();
        
        const method = document.querySelector('input[name="pos_method"]:checked').value;
        let received = Number(document.getElementById('pos-received').value);
        
        if (method !== 'dinheiro') received = posState.currentTotal;
        
        if (method === 'dinheiro' && received < posState.currentTotal) {
            alert("O valor recebido é menor que o total a pagar.");
            return;
        }

        const submitBtn = e.submitter;
        const originalContent = submitBtn.innerHTML;
        submitBtn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Finalizando...`;
        submitBtn.disabled = true;

        try {
            const service = posState.services.find(s => s.id === document.getElementById('pos-service').value);
            const barber = posState.barbers.find(b => b.id === document.getElementById('pos-barber').value);
            const clientSelect = document.getElementById('pos-client');
            
            let clientId = clientSelect.value;
            let clientName = "Cliente Avulso";
            if (clientId) {
                const client = posState.users.find(u => u.id === clientId);
                if (client) clientName = client.name;
            }

            const change = method === 'dinheiro' ? (received - posState.currentTotal) : 0;
            const dataHoje = new Date().toISOString();
            
            // Payload padrão 
            const transactionData = {
                originalBookingId: "lancamento_manual",
                companyId: "sami",
                userId: clientId,
                clientName: clientName,
                barberId: barber.id,
                barberName: barber.name,
                serviceId: service.id,
                serviceName: service.name,
                
                scheduledDate: dataHoje.split('T')[0],
                completedAt: dataHoje,
                duration: 0,
                
                currency: 'EUR',
                subtotal: posState.currentTotal,
                taxRate: 23, 
                taxAmount: posState.currentTotal - (posState.currentTotal / 1.23), 
                discountAmount: 0,
                finalPrice: posState.currentTotal,
                
                paymentMethod: method,          
                amountReceived: received,
                changeReturned: change,
                paymentStatus: 'paid',          
                invoiceStatus: 'pending',       
            };

            await addDoc(collection(db, "history"), transactionData);
            financeApp.fecharModalPos();
            
        } catch (error) {
            console.error("Erro ao salvar venda PDV:", error);
            alert("Ocorreu um erro ao processar a venda.");
        } finally {
            submitBtn.innerHTML = originalContent;
            submitBtn.disabled = false;
        }
    },

    excluirRegistro: async (id) => {
        if (confirm("Tem a certeza que deseja excluir este registo? Esta ação não pode ser desfeita.")) {
            try {
                await deleteDoc(doc(db, "history", id));
            } catch (error) {
                console.error("Erro ao excluir registo:", error);
                alert("Erro ao excluir o registo. Tente novamente.");
            }
        }
    },

    // --- FUNÇÕES DE INTERFACE ---
    aplicarFiltroPeriodo: (periodo, botaoClicado) => {
        // Remove estilo ativo de todos os botões de período
        document.querySelectorAll('.btn-periodo').forEach(btn => {
            btn.classList.remove('bg-zinc-800', 'text-white', 'shadow-sm');
            btn.classList.add('text-zinc-400');
        });
        // Ativa o botão clicado
        botaoClicado.classList.add('bg-zinc-800', 'text-white', 'shadow-sm');
        botaoClicado.classList.remove('text-zinc-400');

        // Fecha o painel personalizado ao trocar para qualquer outro filtro
        if (periodo !== 'personalizado') {
            const painel = document.getElementById('painel-personalizado');
            if (painel) {
                painel.classList.add('hidden');
                painel.classList.remove('flex');
            }
        }

        const hoje = new Date();
        const dataHojeStr = hoje.toISOString().split('T')[0];

        dadosExibidos = todosOsDados.filter(item => {
            if (periodo === 'hoje') return item.data === dataHojeStr;
            
            if (periodo === 'semana') {
                const dataItem = new Date(item.data);
                const diffTime = Math.abs(hoje - dataItem);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                return diffDays <= 7;
            } 
            
            if (periodo === 'mes') {
                const mesAtual = dataHojeStr.substring(0, 7); 
                return item.data.startsWith(mesAtual);
            }

            // ── NOVOS FILTROS ──────────────────────────────────────────
            if (periodo === 'todo') return true; // Exibe absolutamente tudo

            if (periodo === 'personalizado') return true; // Carrega tudo enquanto aguarda o "Aplicar"
            // ── FIM NOVOS FILTROS ──────────────────────────────────────

            return true;
        });

        financeApp.atualizarCards(dadosExibidos);
        financeApp.renderLedger(dadosExibidos);
        financeApp.atualizarGraficos(dadosExibidos);
    },

    // ── NOVA FUNÇÃO: Filtro por intervalo de datas personalizado ──────
    aplicarFiltroPeriodoPersonalizado: (inicio, fim) => {
        // Filtra apenas registos cujas datas estão dentro do intervalo [inicio, fim]
        // Funciona pois as datas estão no formato YYYY-MM-DD — comparação de string é válida
        dadosExibidos = todosOsDados.filter(item => item.data >= inicio && item.data <= fim);

        financeApp.atualizarCards(dadosExibidos);
        financeApp.renderLedger(dadosExibidos);
        financeApp.atualizarGraficos(dadosExibidos);
    },
    // ── FIM NOVA FUNÇÃO ───────────────────────────────────────────────

    atualizarCards: (dados) => {
        const total = dados.reduce((acc, curr) => acc + curr.valor, 0);
        const qtdServicos = dados.length;
        const ticketMedio = total / (qtdServicos || 1);
        const clientesUnicos = new Set(dados.map(d => d.clienteId)).size;

        document.getElementById('card-faturamento').textContent = `€ ${total.toFixed(2).replace('.', ',')}`;
        document.getElementById('card-ticket').textContent = `€ ${ticketMedio.toFixed(2).replace('.', ',')}`;
        document.getElementById('card-servicos').textContent = qtdServicos;
        document.getElementById('card-clientes').textContent = clientesUnicos;
    },

    initCharts: () => {
        const ctxBarber = document.getElementById('barberRevenueChart').getContext('2d');
        graficos.barberChart = new Chart(ctxBarber, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Faturamento (€)', data: [], backgroundColor: [], borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#27272a' } } } }
        });

        const ctxServices = document.getElementById('servicesMixChart').getContext('2d');
        graficos.servicesChart = new Chart(ctxServices, {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'right', labels: { color: '#a1a1aa', font: { size: 10 } } } } }
        });
    },

    atualizarGraficos: (dados) => {
        const faturamentoBarbeiro = {};
        const mixServicos = {};

        dados.forEach(d => {
            faturamentoBarbeiro[d.barbeiro] = (faturamentoBarbeiro[d.barbeiro] || 0) + d.valor;
            mixServicos[d.servico] = (mixServicos[d.servico] || 0) + 1;
        });

        const labelsBarbeiros = Object.keys(faturamentoBarbeiro);
        const dataBarbeiros = Object.values(faturamentoBarbeiro);
        
        const coresBarbeiros = labelsBarbeiros.map(nomeBarbeiro => {
            const barbeiro = posState.barbers.find(b => b.name === nomeBarbeiro);
            return (barbeiro && barbeiro.color) ? barbeiro.color : '#10b981';
        });

        graficos.barberChart.data.labels = labelsBarbeiros;
        graficos.barberChart.data.datasets[0].data = dataBarbeiros;
        graficos.barberChart.data.datasets[0].backgroundColor = coresBarbeiros; 
        graficos.barberChart.update();

        graficos.servicesChart.data.labels = Object.keys(mixServicos);
        graficos.servicesChart.data.datasets[0].data = Object.values(mixServicos);
        graficos.servicesChart.update();
    },

    renderLedger: (dados) => {
        const tbody = document.getElementById('ledger-body');
        if(!tbody) return;
        tbody.innerHTML = '';

        if(dados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-zinc-500">Nenhum registo no histórico para este período.</td></tr>`;
            return;
        }

        const iconesMetodo = {
            'mbway': '<i data-lucide="smartphone" class="w-3 h-3 text-sky-400 mr-1"></i> MB WAY',
            'multibanco': '<i data-lucide="credit-card" class="w-3 h-3 text-blue-500 mr-1"></i> Multibanco',
            'cartao': '<i data-lucide="credit-card" class="w-3 h-3 text-zinc-400 mr-1"></i> Cartão',
            'dinheiro': '<i data-lucide="banknote" class="w-3 h-3 text-emerald-500 mr-1"></i> Dinheiro',
            'Não Inf.': '<i data-lucide="help-circle" class="w-3 h-3 text-zinc-600 mr-1"></i> Não Inf.'
        };

        dados.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-zinc-900/50 transition-colors group';
            
            const metodoBadge = `<div class="flex items-center text-xs text-zinc-300 bg-zinc-950 px-2 py-1 rounded border border-zinc-800 w-max">
                ${iconesMetodo[row.metodo] || iconesMetodo['Não Inf.']}
            </div>`;

            // Formata YYYY-MM-DD de volta para DD/MM/YYYY na visualização
            const partesData = row.data.split('-');
            const dataExibicao = partesData.length === 3 ? `${partesData[2]}/${partesData[1]}/${partesData[0]}` : row.data;

            const dadosJson = encodeURIComponent(JSON.stringify(row));

            tr.innerHTML = `
                <td class="px-6 py-3 text-zinc-300 font-mono text-xs">${dataExibicao}</td>
                <td class="px-6 py-3 text-zinc-300 text-xs font-medium">${row.barbeiro}</td>
                <td class="px-6 py-3">
                    <div class="flex flex-col">
                        <span class="text-zinc-300 text-xs">${row.servico}</span>
                        <span class="text-[10px] text-zinc-500">${row.cliente}</span>
                    </div>
                </td>
                <td class="px-6 py-3">${metodoBadge}</td>
                <td class="px-6 py-3 text-right font-medium text-zinc-100">€ ${row.valor.toFixed(2).replace('.', ',')}</td>
                <td class="px-6 py-3 text-center flex justify-center gap-1">
                    <button onclick="window.imprimirNota('${dadosJson}')" class="p-1.5 text-zinc-500 hover:text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors" title="Imprimir Recibo">
                        <i data-lucide="printer" class="w-4 h-4"></i>
                    </button>
                    <button onclick="window.excluirRegistro('${row.id}')" class="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors" title="Excluir Registo">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        lucide.createIcons();
    },

    exportarExtratoPDF: () => {
        const selectBarbeiro = document.getElementById('export-barber-select').value;
        let dadosParaExportar = dadosExibidos;
        let tituloAdicional = "";

        if (selectBarbeiro !== "todos") {
            dadosParaExportar = dadosExibidos.filter(d => d.barbeiro === selectBarbeiro);
            tituloAdicional = ` - Barbeiro: ${selectBarbeiro}`;
        }

        if (dadosParaExportar.length === 0) {
            alert("Não há dados para exportar neste período/filtro.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text("Extrato Financeiro (Histórico) - Barbearia Lobo", 14, 20);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleDateString()} ${tituloAdicional}`, 14, 28);
        
        const totalExportacao = dadosParaExportar.reduce((acc, curr) => acc + curr.valor, 0);
        doc.text(`Faturamento Total Listado: € ${totalExportacao.toFixed(2)}`, 14, 34);

        const linhasTabela = dadosParaExportar.map(d => [
            d.data, d.barbeiro, d.cliente, d.servico, d.metodo.toUpperCase(), `€ ${d.valor.toFixed(2)}`
        ]);

        doc.autoTable({
            startY: 40,
            head: [['Data', 'Barbeiro', 'Cliente', 'Serviço', 'Pagto', 'Valor']],
            body: linhasTabela,
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
            styles: { fontSize: 8 }
        });

        doc.save(`financeiro_history_${selectBarbeiro === 'todos' ? 'Geral' : selectBarbeiro}.pdf`);
    },

    imprimirNotaTermica: (dadosJsonCodificados) => {
        const dados = JSON.parse(decodeURIComponent(dadosJsonCodificados));
        
        const metodoText = dados.metodo ? dados.metodo.toUpperCase() : 'NÃO INFORMADO';
        
        const cupomHTML = `
            <div id="recibo-termico">
                <div style="text-align: center; margin-bottom: 5px;">
                    <h1 style="margin: 0; font-size: 20px; text-transform: uppercase;">Barbearia Lobo</h1>
                    <p style="margin: 0; font-size: 11px;">Comprovante de Serviço e Pagamento</p>
                </div>
                
                <p style="margin: 10px 0 5px 0; border-top: 1px dashed #000; padding-top: 5px;">
                    <strong>Data/Hora:</strong> ${dados.dataHoraSucesso ? new Date(dados.dataHoraSucesso).toLocaleString() : dados.data}<br>
                    <strong>ID Trans.:</strong> ${dados.id.substring(0, 10)}
                </p>
                
                <div style="margin-bottom: 5px;">
                    <strong>Cliente:</strong> ${dados.cliente}<br>
                    <strong>Barbeiro:</strong> ${dados.barbeiro}
                </div>

                <table style="width: 100%; border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin: 10px 0; padding: 5px 0;">
                    <thead>
                        <tr>
                            <th style="text-align: left; font-size: 12px;">DESCRIÇÃO</th>
                            <th style="text-align: right; font-size: 12px;">VALOR</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="font-size: 13px; padding-top: 5px;">${dados.servico}</td>
                            <td style="text-align: right; font-size: 13px; padding-top: 5px;">€ ${dados.valor.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>

                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; margin-top: 5px;">
                    <span>TOTAL PAGO</span>
                    <span>€ ${dados.valor.toFixed(2)}</span>
                </div>
                
                <div style="margin-top: 10px; font-size: 12px;">
                    <strong>Forma de Pagto:</strong> ${metodoText}<br>
                    <strong>Valor Recebido:</strong> € ${dados.recebido.toFixed(2)}<br>
                    <strong>Troco:</strong> € ${dados.troco.toFixed(2)}
                </div>

                <div style="text-align: center; margin-top: 25px; font-size: 11px;">
                    <p>Status: <strong>PAGO</strong></p>
                    <p style="margin-top: 15px;">Agradecemos a preferência!</p>
                    <p style="margin-top: 5px;">................................</p>
                </div>
            </div>
        `;

        const divPrint = document.createElement('div');
        divPrint.innerHTML = cupomHTML;
        document.body.appendChild(divPrint);
        
        setTimeout(() => {
            window.print();
            document.body.removeChild(divPrint); 
        }, 150);
    }
};