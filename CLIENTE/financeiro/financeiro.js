/* financeiro.js - COMPLETO PARA COLEÇÃO HISTORY E IMPRESSÃO 80MM */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Expondo a função de impressão globalmente para o onclick do HTML funcionar
window.imprimirNota = function(dadosCodificados) {
    financeApp.imprimirNotaTermica(dadosCodificados);
};

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    financeApp.initCharts();
    financeApp.configurarEventos();
    financeApp.carregarDadosDoFirebase();
});

const financeApp = {

    configurarEventos: () => {
        document.getElementById('btn-hoje').addEventListener('click', (e) => financeApp.aplicarFiltroPeriodo('hoje', e.target));
        document.getElementById('btn-semana').addEventListener('click', (e) => financeApp.aplicarFiltroPeriodo('semana', e.target));
        document.getElementById('btn-mes').addEventListener('click', (e) => financeApp.aplicarFiltroPeriodo('mes', e.target));
        
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
    },

    carregarDadosDoFirebase: async () => {
        try {
            // Buscando da coleção 'history'
            const historyRef = collection(db, "history");
            const q = query(historyRef, orderBy("completedAt", "desc")); 
            const querySnapshot = await getDocs(q);
            
            todosOsDados = [];
            const barbeirosSet = new Set();

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                
                // Mapeando com os campos corretos do History
                todosOsDados.push({
                    id: doc.id,
                    data: data.date, // ex: "2026-02-27"
                    cliente: data.clientName || "Cliente Particular",
                    clienteId: data.userId,
                    servico: data.serviceName,
                    barbeiro: data.barberName,
                    valor: Number(data.finalPrice || data.price || 0),
                    status: data.status === 'completed' ? 'Concluído' : data.status,
                    dataHoraSucesso: data.completedAt
                });

                if(data.barberName) barbeirosSet.add(data.barberName);
            });

            // Preenchendo o select de exportação com os barbeiros encontrados
            const selectExport = document.getElementById('export-barber-select');
            selectExport.innerHTML = '<option value="todos">Todos os Barbeiros</option>';
            barbeirosSet.forEach(barbeiro => {
                const option = document.createElement('option');
                option.value = barbeiro;
                option.textContent = barbeiro;
                selectExport.appendChild(option);
            });

            // Inicia clicando em "Este Mês" por padrão
            document.getElementById('btn-mes').click();

        } catch (error) {
            console.error("Erro ao buscar dados do Firebase:", error);
        }
    },

    aplicarFiltroPeriodo: (periodo, botaoClicado) => {
        // Estiliza o botão selecionado
        document.querySelectorAll('.btn-periodo').forEach(btn => {
            btn.classList.remove('bg-zinc-800', 'text-white', 'shadow-sm');
            btn.classList.add('text-zinc-400');
        });
        botaoClicado.classList.add('bg-zinc-800', 'text-white', 'shadow-sm');
        botaoClicado.classList.remove('text-zinc-400');

        const hoje = new Date();
        const dataHojeStr = hoje.toISOString().split('T')[0];

        // Lógica de filtragem baseada no campo 'data'
        dadosExibidos = todosOsDados.filter(item => {
            if (periodo === 'hoje') return item.data === dataHojeStr;
            
            if (periodo === 'semana') {
                const dataItem = new Date(item.data);
                const diffTime = Math.abs(hoje - dataItem);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                return diffDays <= 7;
            } 
            
            if (periodo === 'mes') {
                const mesAtual = dataHojeStr.substring(0, 7); // Pega 'YYYY-MM'
                return item.data.startsWith(mesAtual);
            }
            return true;
        });

        financeApp.atualizarInterface(dadosExibidos);
    },

    atualizarInterface: (dados) => {
        financeApp.atualizarCards(dados);
        financeApp.renderLedger(dados);
        financeApp.atualizarGraficos(dados);
    },

    atualizarCards: (dados) => {
        const total = dados.reduce((acc, curr) => acc + curr.valor, 0);
        const qtdServicos = dados.length;
        const ticketMedio = total / (qtdServicos || 1);
        const clientesUnicos = new Set(dados.map(d => d.clienteId)).size;

        document.getElementById('card-faturamento').textContent = `€ ${total.toFixed(2)}`;
        document.getElementById('card-ticket').textContent = `€ ${ticketMedio.toFixed(2)}`;
        document.getElementById('card-servicos').textContent = qtdServicos;
        document.getElementById('card-clientes').textContent = clientesUnicos;
    },

    initCharts: () => {
        const ctxBarber = document.getElementById('barberRevenueChart').getContext('2d');
        graficos.barberChart = new Chart(ctxBarber, {
            type: 'bar',
            data: { 
                labels: [], 
                datasets: [{ 
                    label: 'Faturamento (€)', 
                    data: [], 
                    backgroundColor: 'rgba(245, 158, 11, 0.8)', 
                    borderRadius: 4 
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { y: { beginAtZero: true, grid: { color: '#27272a' } } } 
            }
        });

        const ctxServices = document.getElementById('servicesMixChart').getContext('2d');
        graficos.servicesChart = new Chart(ctxServices, {
            type: 'doughnut',
            data: { 
                labels: [], 
                datasets: [{ 
                    data: [], 
                    backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444'], 
                    borderWidth: 0 
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                cutout: '75%', 
                plugins: { legend: { position: 'right', labels: { color: '#a1a1aa', font: { size: 10 } } } } 
            }
        });
    },

    atualizarGraficos: (dados) => {
        const faturamentoBarbeiro = {};
        const mixServicos = {};

        dados.forEach(d => {
            faturamentoBarbeiro[d.barbeiro] = (faturamentoBarbeiro[d.barbeiro] || 0) + d.valor;
            mixServicos[d.servico] = (mixServicos[d.servico] || 0) + 1;
        });

        graficos.barberChart.data.labels = Object.keys(faturamentoBarbeiro);
        graficos.barberChart.data.datasets[0].data = Object.values(faturamentoBarbeiro);
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
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-zinc-500">Nenhum registo no histórico para este período.</td></tr>`;
            return;
        }

        dados.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-zinc-900/50 transition-colors group';
            
            // Badge verde e destacado para o status concluído
            const statusBadge = `<span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 text-emerald-500 bg-emerald-500/10">${row.status}</span>`;

            // Codifica o JSON da linha para injetar no botão de impressão de forma segura
            const dadosJson = encodeURIComponent(JSON.stringify(row));

            tr.innerHTML = `
                <td class="px-6 py-3 text-zinc-300 font-mono text-xs">${row.data}</td>
                <td class="px-6 py-3 text-zinc-500 font-mono text-[10px] truncate max-w-[100px]">${row.id}</td>
                <td class="px-6 py-3 text-zinc-300 text-xs font-medium">${row.barbeiro}</td>
                <td class="px-6 py-3">
                    <div class="flex flex-col">
                        <span class="text-zinc-300 text-xs">${row.servico}</span>
                        <span class="text-[10px] text-zinc-500">${row.cliente}</span>
                    </div>
                </td>
                <td class="px-6 py-3 text-right font-medium text-zinc-100">€ ${row.valor.toFixed(2)}</td>
                <td class="px-6 py-3 text-center">${statusBadge}</td>
                <td class="px-6 py-3 text-center">
                    <button onclick="window.imprimirNota('${dadosJson}')" class="p-1.5 text-zinc-500 hover:text-amber-500 hover:bg-amber-500/10 rounded transition-colors" title="Imprimir Recibo">
                        <i data-lucide="printer" class="w-4 h-4"></i>
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
            d.data, d.barbeiro, d.cliente, d.servico, `€ ${d.valor.toFixed(2)}`, d.status
        ]);

        doc.autoTable({
            startY: 40,
            head: [['Data', 'Barbeiro', 'Cliente', 'Serviço', 'Valor', 'Status']],
            body: linhasTabela,
            theme: 'grid',
            headStyles: { fillColor: [24, 24, 27], textColor: [161, 161, 170] },
            styles: { fontSize: 8 }
        });

        doc.save(`financeiro_history_${selectBarbeiro === 'todos' ? 'Geral' : selectBarbeiro}.pdf`);
    },

    imprimirNotaTermica: (dadosJsonCodificados) => {
        const dados = JSON.parse(decodeURIComponent(dadosJsonCodificados));
        
        // Estrutura HTML limpa e formatada perfeitamente para 80mm
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

                <div style="text-align: center; margin-top: 25px; font-size: 11px;">
                    <p>Status: <strong>CONCLUÍDO</strong></p>
                    <p style="margin-top: 15px;">Agradecemos a preferência!</p>
                    <p style="margin-top: 5px;">................................</p>
                </div>
            </div>
        `;

        // Cria o elemento invisível, insere no DOM e dispara a impressão
        const divPrint = document.createElement('div');
        divPrint.innerHTML = cupomHTML;
        document.body.appendChild(divPrint);
        
        // Delay minúsculo para garantir que o CSS aplique no momento da impressão
        setTimeout(() => {
            window.print();
            document.body.removeChild(divPrint); // Limpa o DOM após imprimir
        }, 150);
    }
};