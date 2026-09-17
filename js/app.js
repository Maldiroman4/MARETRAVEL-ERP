/**
 * MARETRAVEL ERP - Orquestador Principal de la Aplicación
 * Manejo de rutas, KPIs ejecutivos, Modales, Notificaciones Toast y Atajos de Teclado.
 */

window.app = {
  currentView: 'dashboard',
  AUTH_KEY: 'MARETRAVEL_AUTH_SESSION_V1',
  initialized: false,

  start() {
    this.bindAuthEvents();
    if (this.isAuthenticated()) {
      this.showApp();
      if (!this.initialized) {
        try { this.init(); } catch (err) { console.error('Error init:', err); }
      }
    } else {
      this.showLogin();
    }
  },

  isAuthenticated() {
    try {
      const auth = localStorage.getItem(this.AUTH_KEY);
      if (!auth) return false;
      const parsed = JSON.parse(auth);
      return parsed && (parsed.username === 'luis' || parsed.user === 'luis' || parsed.role === 'Administrador General');
    } catch (e) {
      return false;
    }
  },

  showLogin() {
    const loginScreen = document.getElementById('login-screen');
    const appLayout = document.getElementById('app-layout');
    if (loginScreen) loginScreen.style.setProperty('display', 'flex', 'important');
    if (appLayout) appLayout.style.setProperty('display', 'none', 'important');
    try {
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    } catch (e) {}

    setTimeout(() => {
      const userInp = document.getElementById('login-username');
      if (userInp) userInp.focus();
    }, 100);
  },

  showApp() {
    const loginScreen = document.getElementById('login-screen');
    const appLayout = document.getElementById('app-layout');
    if (loginScreen) loginScreen.style.setProperty('display', 'none', 'important');
    if (appLayout) appLayout.style.setProperty('display', 'flex', 'important');

    // Actualizar nombre de usuario en la barra lateral
    const nameEl = document.getElementById('sidebar-user-name');
    if (nameEl) nameEl.textContent = 'Luis';

    try {
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    } catch (e) {}
  },

  bindAuthEvents() {
    const form = document.getElementById('login-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleLogin(e));
    }

    const btnSubmit = document.getElementById('btn-login-submit');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', (e) => this.handleLogin(e));
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => this.handleLogout());
    }
  },

  handleLogin(e) {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    const userEl = document.getElementById('login-username');
    const passEl = document.getElementById('login-password');
    const errorAlert = document.getElementById('login-error-alert');
    const errorText = document.getElementById('login-error-text');

    const username = (userEl ? userEl.value : '').trim().toLowerCase();
    const password = (passEl ? passEl.value : '').trim();

    // Credenciales autorizadas oficiales: usuario: luis / contraseña: 585858
    if ((username === 'luis' || username === 'admin') && (password === '585858')) {
      if (errorAlert) errorAlert.style.display = 'none';
      const sessionData = {
        username: 'luis',
        name: 'Luis',
        role: 'Administrador General',
        loginTime: new Date().toLocaleString()
      };
      try {
        localStorage.setItem(this.AUTH_KEY, JSON.stringify(sessionData));
      } catch (err) {
        console.warn('LocalStorage error:', err);
      }

      if (passEl) passEl.value = '';

      this.showApp();
      if (!this.initialized) {
        try {
          this.init();
        } catch (initErr) {
          console.error('Error during init:', initErr);
        }
      }
      this.showToast('¡Bienvenido al sistema MARETRAVEL ERP, Luis!', 'success');
      return false;
    } else {
      if (errorAlert) {
        errorAlert.style.display = 'flex';
        if (errorText) {
          errorText.textContent = 'Usuario o contraseña incorrectos. Verifique sus credenciales.';
        }
      }
      if (passEl) {
        passEl.value = '';
        passEl.focus();
      }
      try {
        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
      } catch (e) {}
      return false;
    }
  },

  handleLogout() {
    if (confirm('¿Desea cerrar la sesión de MARETRAVEL ERP?')) {
      localStorage.removeItem(this.AUTH_KEY);
      const errorAlert = document.getElementById('login-error-alert');
      if (errorAlert) errorAlert.style.display = 'none';
      const passEl = document.getElementById('login-password');
      if (passEl) passEl.value = '';
      this.showLogin();
      this.showToast('Sesión cerrada correctamente.', 'info');
    }
  },

  init() {
    this.initialized = true;
    this.bindNavigation();
    this.bindGlobalEvents();
    this.updateExchangeRateWidget();
    this.updateTopbarDate();
    this.updateDashboardKpis();

    // Inicializar submódulos
    if (window.bankAccountsModule) window.bankAccountsModule.init();
    if (window.accountsModule) window.accountsModule.init();
    if (window.gdsModule) window.gdsModule.init();
    if (window.debitNotesModule) window.debitNotesModule.init();
    if (window.creditNotesModule) window.creditNotesModule.init();
    if (window.cashRegisterModule) window.cashRegisterModule.init();
    if (window.otherIncomesModule) window.otherIncomesModule.init();
    if (window.reportsModule) window.reportsModule.init();
    if (window.calendarModule) window.calendarModule.init();
    if (window.settingsModule) window.settingsModule.init();

    // Re-renderizar iconos Lucide
    if (window.lucide) window.lucide.createIcons();

    // Escuchar actualizaciones de la base de datos
    window.addEventListener('maretravel_db_updated', () => {
      this.updateDashboardKpis();
      this.updateExchangeRateWidget();
      if (window.calendarModule) window.calendarModule.updateNotificationBadge();
    });
  },

  bindNavigation() {
    const navLinks = document.querySelectorAll('.nav-item');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        if (view) this.navigateTo(view);
      });
    });
  },

  navigateTo(viewName) {
    if (viewName === 'caja' || viewName === 'reportes' || viewName === 'arqueo') {
      this.navigateTo('operaciones');
      if (window.operationsHubModule) {
        window.operationsHubModule.switchTab('cash');
        if (viewName === 'arqueo' && window.cashRegisterModule) {
          window.cashRegisterModule.currentTab = 'arqueo';
          window.cashRegisterModule.showTabContent('arqueo');
          document.querySelectorAll('.cash-tab-btn').forEach(btn => {
            const isArqueo = btn.dataset.tab === 'arqueo';
            btn.classList.toggle('active', isArqueo);
            btn.classList.toggle('btn-primary', isArqueo);
            btn.classList.toggle('btn-secondary', !isArqueo);
          });
        }
      }
      return;
    }

    this.currentView = viewName;

    // Actualizar sidebar activa
    document.querySelectorAll('.nav-item').forEach(link => {
      if (link.dataset.view === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Cambiar vistas visibles
    document.querySelectorAll('.view-section').forEach(section => {
      section.classList.remove('active');
    });

    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.classList.add('active');
    }

    // Actualizar título de la barra superior
    const titleMap = {
      'dashboard': 'Panel de Control Ejecutivo',
      'operaciones': 'Ventas & Emisiones (Todo en Uno)',
      'cuentas': 'Gestión de Cuentas (Clientes y Proveedores)',
      'gds': 'Control y Emisión de Boletos Aéreos',
      'notas-debito': 'Notas de Débito (Facturación y Ventas)',
      'notas-credito': 'Notas de Crédito a Proveedores (Cuentas por Pagar)',
      'calendario': 'Calendario de Itinerarios y Fechas de Vuelo',
      'caja': 'Caja, Cobranzas y Pagos Multimoneda',
      'otros-ingresos': 'Otros Ingresos Operativos (Comisiones de Plataforma)',
      'reportes': 'Reportes y Contabilidad de la Empresa',
      'cuentas-bancarias': 'Gestión de Cuentas Bancarias Oficiales',
      'configuracion': 'Configuración del Sistema y Parámetros'
    };
    const titleEl = document.getElementById('current-page-title');
    if (titleEl) titleEl.textContent = titleMap[viewName] || 'MARETRAVEL ERP';

    // Disparar refresco del módulo correspondiente
    if (viewName === 'dashboard') this.updateDashboardKpis();
    if (viewName === 'operaciones' && window.operationsHubModule) window.operationsHubModule.render();
    if (viewName === 'cuentas' && window.accountsModule) window.accountsModule.render();
    if (viewName === 'gds' && window.gdsModule) window.gdsModule.render();
    if (viewName === 'notas-debito' && window.debitNotesModule) window.debitNotesModule.render();
    if (viewName === 'notas-credito' && window.creditNotesModule) window.creditNotesModule.render();
    if (viewName === 'calendario' && window.calendarModule) window.calendarModule.render();
    if (viewName === 'caja' && window.cashRegisterModule) window.cashRegisterModule.render();
    if (viewName === 'otros-ingresos' && window.otherIncomesModule) window.otherIncomesModule.render();
    if (viewName === 'reportes' && window.reportsModule) window.reportsModule.render();
    if (viewName === 'cuentas-bancarias' && window.bankAccountsModule) window.bankAccountsModule.render();
    if (viewName === 'configuracion' && window.settingsModule) window.settingsModule.render();

    if (window.lucide) window.lucide.createIcons();
  },

  updateExchangeRateWidget() {
    const data = window.db.get();
    const buy = data.systemSettings.activeExchangeBuy || 6.86;
    const sell = data.systemSettings.activeExchangeSell || 6.96;

    const buyEl = document.getElementById('topbar-tc-buy');
    const sellEl = document.getElementById('topbar-tc-sell');
    if (buyEl) buyEl.textContent = Number(buy).toFixed(2);
    if (sellEl) sellEl.textContent = Number(sell).toFixed(2);
  },

  updateTopbarDate() {
    const el = document.getElementById('topbar-current-date-text');
    if (!el) return;
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    el.textContent = `${day}/${month}/${year}`;
  },

  updateDashboardKpis() {
    const data = window.db.get();

    // 1. Total Ventas Facturadas (NDs)
    let totalSalesBob = 0;
    (data.debitNotes || []).forEach(nd => {
      if (nd.status !== 'ANULADA') totalSalesBob += nd.totalAmountBob;
    });

    // 2. Cuentas por Cobrar a Clientes (Saldo pendiente NDs)
    let pendingReceivableBob = 0;
    (data.debitNotes || []).forEach(nd => {
      if (nd.status !== 'ANULADA' && nd.status !== 'BORRADOR') pendingReceivableBob += nd.balanceBob;
    });

    // 3. Cuentas por Pagar a Proveedores (Saldo pendiente NCs)
    let pendingPayableBob = 0;
    (data.creditNotes || []).forEach(nc => {
      if (nc.status !== 'ANULADA') pendingPayableBob += nc.balance;
    });

    // 4. Total Recaudado en Caja Hoy
    const today = new Date().toISOString().split('T')[0];
    let collectedTodayBob = 0;
    let collectedTodayUsd = 0;
    (data.cashReceipts || []).forEach(r => {
      if (r.status === 'VALIDO') {
        collectedTodayBob += r.totalPaidBob;
        collectedTodayUsd += r.totalPaidUsd;
      }
    });

    // Asignar a elementos del DOM
    const kpiSales = document.getElementById('kpi-total-sales');
    const kpiReceivable = document.getElementById('kpi-total-receivable');
    const kpiPayable = document.getElementById('kpi-total-payable');
    const kpiCashToday = document.getElementById('kpi-cash-today');

    if (kpiSales) kpiSales.textContent = `BOB ${totalSalesBob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
    if (kpiReceivable) kpiReceivable.textContent = `BOB ${pendingReceivableBob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
    if (kpiPayable) kpiPayable.textContent = `BOB ${pendingPayableBob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
    if (kpiCashToday) kpiCashToday.textContent = `BOB ${collectedTodayBob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;

    const kpiCashUsdSub = document.getElementById('kpi-cash-today-usd-sub');
    if (kpiCashUsdSub) kpiCashUsdSub.textContent = `Equivalente: USD ${collectedTodayUsd.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;

    // Renderizar los 3 gráficos estadísticos de barras SOLO si el dashboard está activo
    if (this.currentView === 'dashboard') {
      this.renderDashboardCharts(data);
    }
  },

  renderDashboardCharts(data) {
    const dashView = document.getElementById('view-dashboard');
    if (!dashView || !dashView.classList.contains('active')) {
      return;
    }

    if (!data) data = window.db.get();

    // Cache de instancias de Chart.js
    if (!this._chartInstances) {
      this._chartInstances = { services: null, clients: null, providers: null };
    }

    const now = new Date();
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    const monthBadge = document.getElementById('dashboard-services-month-badge');
    if (monthBadge) monthBadge.textContent = currentMonthLabel;

    // -------------------------------------------------------------
    // 1. SERVICIOS MÁS SOLICITADOS DURANTE EL MES
    // -------------------------------------------------------------
    const serviceCounts = {};
    const countedTicketIds = new Set();

    // A. Servicios facturados en Notas de Débito
    (data.debitNotes || []).forEach(nd => {
      if (nd.status === 'ANULADA') return;
      (nd.items || []).forEach(it => {
        if (it.gdsTicketId) countedTicketIds.add(it.gdsTicketId);
        let name = 'Boletos Aéreos';
        const st = (it.serviceType || '').toUpperCase();
        if (st.includes('BOLETO') || st.includes('GDS') || st.includes('AEREO')) {
          name = 'Boletos Aéreos';
        } else if (st.includes('COMISION') || st.includes('PLATAFORMA') || it.isCommissionItem) {
          name = 'Comisión Plataforma GDS';
        } else if (st.includes('HOTEL') || st.includes('HOSPEDAJE')) {
          name = 'Hotelería y Hospedaje';
        } else if (st.includes('PAQUETE') || st.includes('TOUR') || st.includes('CRUCERO') || st.includes('CONCIERTO')) {
          name = 'Paquetes Turísticos';
        } else if (st.includes('SEGURO') || st.includes('ASISTENCIA')) {
          name = 'Seguros de Asistencia';
        } else if (st.includes('RENT') || st.includes('AUTO') || st.includes('VEHIC')) {
          name = 'Alquiler de Autos';
        } else if (st.includes('VISA')) {
          name = 'Asesoramiento Visas';
        } else if (it.description) {
          name = it.description.slice(0, 24);
        } else {
          name = 'Otros Servicios';
        }

        serviceCounts[name] = serviceCounts[name] || { name, count: 0, amount: 0 };
        serviceCounts[name].count += 1;
        serviceCounts[name].amount += Number(it.totalAmount || 0);
      });
    });

    // B. Boletos GDS emitidos (disponibles o emitidos este mes)
    (data.gdsTickets || []).forEach(tkt => {
      if (tkt.status === 'ANULADO') return;
      if (countedTicketIds.has(tkt.id)) return;
      const name = 'Boletos Aéreos';
      serviceCounts[name] = serviceCounts[name] || { name, count: 0, amount: 0 };
      serviceCounts[name].count += 1;
      serviceCounts[name].amount += Number(tkt.ticketPrice || tkt.totalAmount || 0);
    });

    // C. Otros Ingresos Operativos (Comisiones de Plataforma)
    (data.otherIncomes || []).forEach(inc => {
      if (inc.status === 'ANULADA') return;
      const name = 'Comisión Plataforma GDS';
      serviceCounts[name] = serviceCounts[name] || { name, count: 0, amount: 0 };
      serviceCounts[name].count += 1;
      serviceCounts[name].amount += Number(inc.amount || 0);
    });

    const topServices = Object.values(serviceCounts)
      .sort((a, b) => b.count - a.count || b.amount - a.amount)
      .slice(0, 5);

    // -------------------------------------------------------------
    // 2. CLIENTES MÁS FRECUENTES O CON MÁS DÉBITOS REALIZADOS
    // -------------------------------------------------------------
    const clientCounts = {};
    (data.debitNotes || []).forEach(nd => {
      if (nd.status === 'ANULADA') return;
      const name = nd.accountName || 'Cliente No Especificado';
      clientCounts[name] = clientCounts[name] || { name, count: 0, amount: 0 };
      clientCounts[name].count += 1;
      clientCounts[name].amount += Number(nd.totalAmountBob || 0);
    });

    const topClients = Object.values(clientCounts)
      .sort((a, b) => b.count - a.count || b.amount - a.amount)
      .slice(0, 5);

    // -------------------------------------------------------------
    // 3. PROVEEDORES CON MÁS NOTAS DE CRÉDITO REALIZADAS
    // -------------------------------------------------------------
    const providerCounts = {};
    (data.creditNotes || []).forEach(nc => {
      if (nc.status === 'ANULADA') return;
      const name = nc.providerName || 'Proveedor General';
      providerCounts[name] = providerCounts[name] || { name, count: 0, amount: 0 };
      providerCounts[name].count += 1;
      providerCounts[name].amount += Number(nc.totalAmount || 0);
    });

    const topProviders = Object.values(providerCounts)
      .sort((a, b) => b.count - a.count || b.amount - a.amount)
      .slice(0, 5);

    // Helper unificado para renderizar widget con Chart.js y lista descriptiva
    const renderBarWidget = (config) => {
      const {
        key,
        canvasId,
        listId,
        items,
        datasetLabel,
        barColor,
        borderColor,
        unitSingular,
        unitPlural
      } = config;

      // 1. Renderizar Canvas con Chart.js
      const canvas = document.getElementById(canvasId);
      if (canvas) {
        if (typeof window.Chart !== 'undefined') {
          if (canvas.parentElement) canvas.parentElement.style.display = 'block';

          if (this._chartInstances[key]) {
            try {
              this._chartInstances[key].destroy();
            } catch (e) {
              console.warn('Error destruyendo chart anterior:', e);
            }
            this._chartInstances[key] = null;
          }

          const labels = items.length > 0
            ? items.map(it => it.name.length > 18 ? it.name.slice(0, 16) + '...' : it.name)
            : ['Sin datos'];
          const values = items.length > 0 ? items.map(it => it.count) : [0];

          const ctx = canvas.getContext('2d');
        try {
          this._chartInstances[key] = new Chart(ctx, {
            type: 'bar',
            data: {
              labels,
              datasets: [{
                label: datasetLabel,
                data: values,
                backgroundColor: barColor,
                borderColor: borderColor,
                borderWidth: 1.5,
                borderRadius: 8,
                maxBarThickness: 42
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              animation: { duration: 500 },
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: 'rgba(15, 23, 42, 0.92)',
                  titleFont: { size: 12, weight: '700' },
                  bodyFont: { size: 12 },
                  padding: 10,
                  cornerRadius: 8,
                  callbacks: {
                    title: (tooltipItems) => {
                      const idx = tooltipItems[0]?.dataIndex;
                      return items[idx] ? items[idx].name : '';
                    },
                    label: (context) => {
                      const idx = context.dataIndex;
                      const it = items[idx];
                      if (!it) return '';
                      return ` ${context.parsed.y} ${context.parsed.y === 1 ? unitSingular : unitPlural} | BOB ${Number(it.amount || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    precision: 0,
                    font: { family: 'ui-monospace, monospace', size: 11 },
                    color: '#64748b'
                  },
                  grid: { color: '#f1f5f9' }
                },
                x: {
                  ticks: {
                    font: { size: 11, weight: '600' },
                    color: '#475569'
                  },
                  grid: { display: false }
                }
              }
            }
          });
        } catch (err) {
          console.warn('Error inicializando Chart.js:', err);
        }
      } else {
        if (canvas.parentElement) canvas.parentElement.style.display = 'none';
      }
    }

      // 2. Renderizar Lista Detallada con Barras Horizontales de Progreso
      const listEl = document.getElementById(listId);
      if (listEl) {
        if (items.length === 0) {
          listEl.innerHTML = `
            <div style="text-align: center; padding: 24px 12px; color: #94a3b8; font-size: 0.82rem;">
              <i data-lucide="info" style="width: 22px; height: 22px; margin-bottom: 4px; display: inline-block;"></i>
              <div>Sin registros suficientes en este período.</div>
            </div>
          `;
        } else {
          const maxVal = Math.max(...items.map(it => it.count), 1);
          listEl.innerHTML = items.map((it, idx) => {
            const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-other';
            const pct = Math.max(Math.round((it.count / maxVal) * 100), 10);
            return `
              <div class="chart-rank-item">
                <div class="chart-rank-header">
                  <div class="chart-rank-name" title="${it.name}">
                    <span class="rank-badge ${rankClass}">#${idx + 1}</span>
                    <span>${it.name}</span>
                  </div>
                  <div class="chart-rank-stats">
                    <strong>${it.count} ${it.count === 1 ? unitSingular : unitPlural}</strong> &bull; BOB ${Number(it.amount || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div class="chart-rank-track">
                  <div class="chart-rank-fill" style="width: ${pct}%; background: ${borderColor};"></div>
                </div>
              </div>
            `;
          }).join('');
        }
      }
    };

    // Renderizar Gráfico 1: Servicios más solicitados
    renderBarWidget({
      key: 'services',
      canvasId: 'chart-services-canvas',
      listId: 'chart-services-list',
      items: topServices,
      datasetLabel: 'Servicios Solicitados',
      barColor: 'rgba(2, 132, 199, 0.85)',
      borderColor: '#0284c7',
      unitSingular: 'solicitud',
      unitPlural: 'solicitudes'
    });

    // Renderizar Gráfico 2: Clientes más frecuentes / más débitos
    renderBarWidget({
      key: 'clients',
      canvasId: 'chart-clients-canvas',
      listId: 'chart-clients-list',
      items: topClients,
      datasetLabel: 'Débitos Emitidos',
      barColor: 'rgba(5, 150, 105, 0.85)',
      borderColor: '#059669',
      unitSingular: 'débito',
      unitPlural: 'débitos'
    });

    // Renderizar Gráfico 3: Proveedores con más NC
    renderBarWidget({
      key: 'providers',
      canvasId: 'chart-providers-canvas',
      listId: 'chart-providers-list',
      items: topProviders,
      datasetLabel: 'Notas de Crédito',
      barColor: 'rgba(217, 119, 6, 0.85)',
      borderColor: '#d97706',
      unitSingular: 'crédito',
      unitPlural: 'créditos'
    });

    // Refrescar iconos Lucide
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }

    // Si Chart.js aún no terminó de inicializarse, reintentar en 300ms
    if (typeof window.Chart === 'undefined' && !this._chartRetryScheduled) {
      this._chartRetryScheduled = true;
      setTimeout(() => {
        this._chartRetryScheduled = false;
        if (typeof window.Chart !== 'undefined') {
          this.renderDashboardCharts();
        }
      }, 350);
    }
  },

  bindGlobalEvents() {
    // 1. Evitar cierre accidental: Detener propagación de eventos click dentro del contenedor del modal
    document.querySelectorAll('.modal-card, .modal-content, .modal-dialog, .modal-body, .modal-box').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });

    // 2. Cerrar modales ÚNICAMENTE con botón explícito [x], [Cancelar] o .btn-close
    document.querySelectorAll('[data-close-modal], .btn-close, .modal-close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const modalId = btn.dataset.closeModal || btn.closest('.modal-overlay')?.id;
        if (modalId) this.closeModal(modalId);
      });
    });

    // 3. Cerrar modal al hacer clic en el fondo (backdrop) EXCLUSIVAMENTE si el clic fue directo en el overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.closeModal(overlay.id);
        }
      });
    });

    // Cerrar modal al presionar ESC (cierra el modal superior activo)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const activeModals = Array.from(document.querySelectorAll('.modal-overlay.active'));
        if (activeModals.length > 0) {
          activeModals.sort((a, b) => {
            const zA = parseInt(window.getComputedStyle(a).zIndex, 10) || 0;
            const zB = parseInt(window.getComputedStyle(b).zIndex, 10) || 0;
            return zB - zA;
          });
          this.closeModal(activeModals[0].id);
        }
      }
    });

    // Atajos de Teclado ERP
    window.addEventListener('keydown', (e) => {
      if (e.altKey) {
        if (e.key === '1' || e.key === 'd') { e.preventDefault(); this.navigateTo('dashboard'); }
        if (e.key === '2' || e.key === 'c') { e.preventDefault(); this.navigateTo('cuentas'); }
        if (e.key === '3' || e.key === 'g') { e.preventDefault(); this.navigateTo('gds'); }
        if (e.key === '4' || e.key === 'n') { e.preventDefault(); this.navigateTo('notas-debito'); }
        if (e.key === '5' || e.key === 'p') { e.preventDefault(); this.navigateTo('notas-credito'); }
        if (e.key === '6' || e.key === 'j') { e.preventDefault(); this.navigateTo('caja'); }
        if (e.key === '7' || e.key === 'r') { e.preventDefault(); this.navigateTo('reportes'); }
        if (e.key === '8' || e.key === 'v') { e.preventDefault(); this.navigateTo('calendario'); }
      }
    });

    // Click en widget de tipo de cambio abre modal rápido sin salir de la vista actual
    const tcPill = document.getElementById('topbar-tc-pill');
    if (tcPill) {
      tcPill.addEventListener('click', () => this.openQuickExchangeRateModal());
    }
  },

  openQuickExchangeRateModal() {
    const data = window.db.get();
    const buy = data.systemSettings.activeExchangeBuy || 6.86;
    const sell = data.systemSettings.activeExchangeSell || 6.96;

    const buyInp = document.getElementById('quick-tc-buy');
    const sellInp = document.getElementById('quick-tc-sell');
    if (buyInp) buyInp.value = Number(buy).toFixed(2);
    if (sellInp) sellInp.value = Number(sell).toFixed(2);

    this.openModal('modal-quick-exchange-rate');
    setTimeout(() => {
      if (sellInp) {
        sellInp.focus();
        sellInp.select();
      }
    }, 120);
  },

  saveQuickExchangeRate(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const data = window.db.get();

    const buyInp = document.getElementById('quick-tc-buy');
    const sellInp = document.getElementById('quick-tc-sell');

    const buyVal = buyInp ? buyInp.value.toString().replace(',', '.') : '6.86';
    const sellVal = sellInp ? sellInp.value.toString().replace(',', '.') : '6.96';

    const buy = parseFloat(buyVal) || 6.86;
    const sell = parseFloat(sellVal) || 6.96;

    if (!data.systemSettings) data.systemSettings = {};
    data.systemSettings.activeExchangeBuy = buy;
    data.systemSettings.activeExchangeSell = sell;

    const newRate = {
      id: 'TC-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      buyRate: buy,
      sellRate: sell,
      createdById: data.currentUser?.id || 'USR-001',
      createdByName: data.currentUser?.name || 'Luis',
      createdAt: new Date().toLocaleString()
    };

    if (!data.exchangeRates) data.exchangeRates = [];
    data.exchangeRates.unshift(newRate);

    window.db.save(data);
    this.updateExchangeRateWidget();
    this.closeModal('modal-quick-exchange-rate');
    this.showToast(`¡Tipo de Cambio actualizado! Compra: BOB ${buy.toFixed(2)} | Venta: BOB ${sell.toFixed(2)}`, 'success');

    if (window.settingsModule && typeof window.settingsModule.render === 'function') {
      window.settingsModule.render();
    }
    return false;
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      // Blindaje contra cierre involuntario: Detener propagación de clics dentro de la tarjeta
      const card = modal.querySelector('.modal-card, .modal-content, .modal-dialog, .modal-box') || modal.firstElementChild;
      if (card && !card._hasStopPropBound) {
        card.addEventListener('click', (e) => e.stopPropagation());
        card._hasStopPropBound = true;
      }

      // Stacking de modales dinámico para sub-modales / modales superpuestos
      const activeModals = Array.from(document.querySelectorAll('.modal-overlay.active')).filter(m => m !== modal);
      let maxZ = 1000;
      activeModals.forEach(m => {
        const computedZ = parseInt(window.getComputedStyle(m).zIndex, 10);
        if (!isNaN(computedZ) && computedZ >= maxZ) {
          maxZ = computedZ;
        }
      });

      if (activeModals.length > 0) {
        modal.style.zIndex = (maxZ + 20).toString();
      } else {
        modal.style.zIndex = '1000';
      }

      modal.classList.add('active');
      if (window.lucide) window.lucide.createIcons();
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      modal.style.zIndex = '';
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-octagon';
    if (type === 'warning') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}" style="flex-shrink:0;"></i>
      <div style="flex:1;">${message}</div>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }
};

// Utilidad global de debounce para alto rendimiento y prevención de congelamiento
window.debounce = function(func, wait = 300) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
};

// Arrancar cuando el DOM esté listo con verificación de sesión
document.addEventListener('DOMContentLoaded', () => {
  window.app.start();
});
