/**
 * MARETRAVEL ERP - Módulo de Calendario de Itinerarios y Recordatorios de Viaje
 * Permite visualizar fechas de salida e ida/vuelta de cada cliente, alertando a la administración
 * y con soporte para abrir en ventana independiente (Pop-out) y envío de WhatsApp.
 */

window.calendarModule = {
  currentDate: new Date(),
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(),
  selectedReminderId: null,

  init() {
    this.bindEvents();
    this.updateNotificationBadge();
    this.render();
  },

  bindEvents() {
    // Navegación de mes
    const btnPrev = document.getElementById('cal-btn-prev');
    if (btnPrev) btnPrev.addEventListener('click', () => this.changeMonth(-1));

    const btnNext = document.getElementById('cal-btn-next');
    if (btnNext) btnNext.addEventListener('click', () => this.changeMonth(1));

    const btnToday = document.getElementById('cal-btn-today');
    if (btnToday) btnToday.addEventListener('click', () => this.goToToday());

    // Botón abrir en ventana aparte (Pop-out)
    const btnPopout = document.getElementById('btn-open-calendar-popout');
    if (btnPopout) {
      btnPopout.addEventListener('click', () => this.openInSeparateWindow());
    }

    // Botón campana de notificaciones
    const bellBtn = document.getElementById('topbar-bell-btn');
    if (bellBtn) {
      bellBtn.addEventListener('click', () => this.openNotificationCenter());
    }

    // Botón nuevo recordatorio
    const btnNew = document.getElementById('btn-new-travel-reminder');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.openNewReminderModal());
    }

    // Formulario de guardar recordatorio
    const form = document.getElementById('travel-reminder-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSaveReminder(e));
    }

    // Checkbox tiene vuelta
    const checkHasReturn = document.getElementById('trv-has-return');
    if (checkHasReturn) {
      checkHasReturn.addEventListener('change', (e) => {
        const row = document.getElementById('trv-return-fields-row');
        if (row) row.style.display = e.target.checked ? 'grid' : 'none';
      });
    }

    // Filtros de búsqueda en calendario
    const searchInput = document.getElementById('cal-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.render());
    }
  },

  goToToday() {
    const now = new Date();
    this.viewYear = now.getFullYear();
    this.viewMonth = now.getMonth();
    this.render();
  },

  changeMonth(delta) {
    this.viewMonth += delta;
    if (this.viewMonth > 11) {
      this.viewMonth = 0;
      this.viewYear++;
    } else if (this.viewMonth < 0) {
      this.viewMonth = 11;
      this.viewYear--;
    }
    this.render();
  },

  openInSeparateWindow() {
    const w = 1260;
    const h = 820;
    const screenW = (typeof screen !== 'undefined' && screen.width) ? screen.width : 1280;
    const screenH = (typeof screen !== 'undefined' && screen.height) ? screen.height : 800;
    const left = (screenW - w) / 2;
    const top = (screenH - h) / 2;
    window.open(
      'calendario.html',
      'CalendarioMaretravel',
      `width=${w},height=${h},top=${top},left=${left},resizable=yes,scrollbars=yes,status=no`
    );
  },

  render() {
    const data = window.db.get();
    const reminders = data.travelReminders || [];
    const search = (document.getElementById('cal-search-input')?.value || '').toLowerCase();

    // Mes y Año en título
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const titleEl = document.getElementById('cal-month-title');
    if (titleEl) {
      titleEl.textContent = `${monthNames[this.viewMonth]} ${this.viewYear}`;
    }

    const grid = document.getElementById('calendar-days-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Días del mes actual
    const firstDayIndex = new Date(this.viewYear, this.viewMonth, 1).getDay(); // 0 = Domingo
    const daysInMonth = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(this.viewYear, this.viewMonth, 0).getDate();

    // Celdas de días del mes anterior (blancos)
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell is-other-month';
      cell.innerHTML = `<div class="cal-day-header"><span class="cal-day-num">${dayNum}</span></div>`;
      grid.appendChild(cell);
    }

    const nowCal = new Date();
    const todayStr = `${nowCal.getFullYear()}-${String(nowCal.getMonth() + 1).padStart(2, '0')}-${String(nowCal.getDate()).padStart(2, '0')}`;

    // Días del mes activo
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${this.viewYear}-${String(this.viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = (dateStr === todayStr);

      // Buscar eventos de salida (Ida) o retorno (Vuelta)
      const dayReminders = reminders.filter(r => {
        const matchDeparture = r.departureDate === dateStr;
        const matchReturn = r.hasReturn && r.returnDate === dateStr;
        const matchSearch = !search ||
          r.passengerName.toLowerCase().includes(search) ||
          r.clientName.toLowerCase().includes(search) ||
          r.route.toLowerCase().includes(search);

        return (matchDeparture || matchReturn) && matchSearch;
      });

      const cell = document.createElement('div');
      cell.className = `cal-day-cell ${isToday ? 'is-today' : ''}`;
      
      let eventsHtml = '';
      if (dayReminders.length > 0) {
        eventsHtml = dayReminders.map(rem => {
          const isDeparture = rem.departureDate === dateStr;
          const isReturn = rem.hasReturn && rem.returnDate === dateStr;

          if (isDeparture) {
            return `
              <div class="cal-event-chip chip-departure" onclick="window.calendarModule.showReminderDetails('${rem.id}', event)" title="Ida: ${rem.passengerName} (${rem.route})">
                <div class="chip-time">🛫 ${rem.departureTime || 'S/H'}</div>
                <div class="chip-title">${rem.passengerName.split('/')[0]} - ${rem.route}</div>
              </div>
            `;
          }

          if (isReturn) {
            return `
              <div class="cal-event-chip chip-return" onclick="window.calendarModule.showReminderDetails('${rem.id}', event)" title="Retorno: ${rem.passengerName} (${rem.route})">
                <div class="chip-time">🛬 ${rem.returnTime || 'S/H'}</div>
                <div class="chip-title">${rem.passengerName.split('/')[0]} - RETORNO</div>
              </div>
            `;
          }
          return '';
        }).join('');
      }

      cell.innerHTML = `
        <div class="cal-day-header">
          <span class="cal-day-num ${isToday ? 'today-badge' : ''}">${d}</span>
          ${isToday ? '<span class="today-tag">HOY</span>' : ''}
        </div>
        <div class="cal-day-events">
          ${eventsHtml}
        </div>
      `;

      grid.appendChild(cell);
    }

    // Días del mes siguiente para completar la grilla de 35 o 42 celdas
    const totalCells = firstDayIndex + daysInMonth;
    const nextDays = (totalCells <= 35) ? (35 - totalCells) : (42 - totalCells);
    for (let n = 1; n <= nextDays; n++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell is-other-month';
      cell.innerHTML = `<div class="cal-day-header"><span class="cal-day-num">${n}</span></div>`;
      grid.appendChild(cell);
    }

    this.updateNotificationBadge();
    if (window.lucide) window.lucide.createIcons();
  },

  // ==========================================================================
  // NOTIFICACIONES Y ALERTAS PARA LA ADMINISTRACIÓN
  // ==========================================================================
  getUrgentReminders() {
    const data = window.db.get();
    const reminders = data.travelReminders || [];
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const tmrw = new Date(now);
    tmrw.setDate(now.getDate() + 1);
    const tomorrow = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`;

    const alerts = [];

    reminders.forEach(r => {
      // Salidas hoy
      if (r.departureDate === today) {
        alerts.push({
          type: 'SALIDA_HOY',
          badge: 'badge-rose',
          title: '🚨 VUELO DE IDA SALE HOY',
          urgency: 'ALTA',
          time: r.departureTime,
          reminder: r
        });
      }
      // Retornos hoy
      if (r.hasReturn && r.returnDate === today) {
        alerts.push({
          type: 'RETORNO_HOY',
          badge: 'badge-amber',
          title: '🛬 PASAJERO REGRESA HOY',
          urgency: 'ALTA',
          time: r.returnTime,
          reminder: r
        });
      }
      // Salidas mañana
      if (r.departureDate === tomorrow) {
        alerts.push({
          type: 'SALIDA_MANANA',
          badge: 'badge-blue',
          title: '⚠️ VIAJA MAÑANA (24 Horas)',
          urgency: 'MEDIA',
          time: r.departureTime,
          reminder: r
        });
      }
    });

    return alerts;
  },

  updateNotificationBadge() {
    const alerts = this.getUrgentReminders();
    const badge = document.getElementById('bell-counter-badge');
    if (badge) {
      if (alerts.length > 0) {
        badge.textContent = alerts.length;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  },

  openNotificationCenter() {
    const alerts = this.getUrgentReminders();
    const container = document.getElementById('notifications-list-container');
    if (!container) return;

    if (alerts.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-muted);">
          <i data-lucide="check-circle" style="width: 36px; height: 36px; color: #10b981; margin-bottom: 8px;"></i>
          <p>No hay vuelos de salida ni retornos programados para hoy o mañana.</p>
        </div>
      `;
    } else {
      container.innerHTML = alerts.map(a => {
        const rem = a.reminder;
        return `
          <div class="notification-card" style="padding: 14px; border-radius: 8px; background: #f8fafc; border: 1px solid var(--border-light); margin-bottom: 10px; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <span class="badge ${a.badge}">${a.title} - ${a.time || 'Horario a confirmar'}</span>
                <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--navy); margin-top: 6px;">
                  ${rem.passengerName}
                </h4>
                <div style="font-size: 0.8rem; color: #475569;">
                  <strong>Ruta:</strong> ${rem.route} (${rem.airline}) | <strong>Boleto:</strong> ${rem.ticketNumber || 'S/N'}
                </div>
                <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">
                  <strong>Cliente:</strong> ${rem.clientName} | <strong>Cel:</strong> ${rem.clientPhone || 'S/N'}
                </div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <button class="btn btn-secondary btn-sm" onclick="window.calendarModule.showReminderDetails('${rem.id}')" title="Ver Detalle">
                  <i data-lucide="eye"></i>
                </button>
                <button class="btn btn-success btn-sm" onclick="window.calendarModule.sendWhatsAppReminder('${rem.id}')" title="Recordatorio por WhatsApp">
                  <i data-lucide="send"></i> WA
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    if (window.lucide) window.lucide.createIcons();
    window.app.openModal('modal-notifications-center');
  },

  // ==========================================================================
  // DETALLES DEL ITINERARIO Y ACCIONES DE ADMINISTRACIÓN
  // ==========================================================================
  showReminderDetails(reminderId, event = null) {
    if (event) event.stopPropagation();
    const data = window.db.get();
    const r = data.travelReminders.find(x => x.id === reminderId);
    if (!r) return;

    this.selectedReminderId = reminderId;
    const body = document.getElementById('reminder-detail-modal-body');
    if (!body) return;

    body.innerHTML = `
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
        <div>
          <div style="margin-bottom: 16px;">
            <span class="badge badge-blue" style="font-size: 0.8rem; margin-bottom: 6px;">
              ${r.hasReturn ? 'VIAJE IDA Y VUELTA (ROUNDTRIP)' : 'SOLO IDA (ONE-WAY)'}
            </span>
            <h2 style="font-size: 1.3rem; font-weight: 800; color: var(--navy);">${r.passengerName}</h2>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              Doc. Identidad / Pasaporte: <strong>${r.passengerDoc || 'Sin Documento'}</strong>
            </div>
          </div>

          <div style="background: #f8fafc; border: 1px solid var(--border-light); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <h4 style="font-size: 0.82rem; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 8px;">
              DATOS DEL VUELO / ITINERARIO
            </h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.88rem;">
              <div><strong>Ruta:</strong> <span class="font-mono">${r.route}</span></div>
              <div><strong>Aerolínea:</strong> ${r.airline}</div>
              <div><strong>Vuelo / Operador:</strong> ${r.flightNumber || 'Por confirmar'}</div>
              <div><strong>Nro de Boleto:</strong> <span class="font-mono">${r.ticketNumber || 'S/N'}</span></div>
            </div>
          </div>

          <!-- Fechas de Ida y Vuelta -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div style="background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 8px; padding: 12px;">
              <div style="font-size: 0.75rem; color: #0891b2; font-weight: 700;">🛫 FECHA DE SALIDA (IDA)</div>
              <div style="font-size: 1.15rem; font-weight: 800; color: #0e7490; font-family: monospace;">
                ${r.departureDate}
              </div>
              <div style="font-size: 0.85rem; font-weight: 600; color: #155e75;">
                Hora: ${r.departureTime || 'Por confirmar'}
              </div>
            </div>

            <div style="background: ${r.hasReturn ? '#fffbeb' : '#f1f5f9'}; border: 1px solid ${r.hasReturn ? '#fde68a' : '#e2e8f0'}; border-radius: 8px; padding: 12px;">
              <div style="font-size: 0.75rem; color: ${r.hasReturn ? '#b45309' : '#64748b'}; font-weight: 700;">
                🛬 FECHA DE RETORNO (VUELTA)
              </div>
              <div style="font-size: 1.15rem; font-weight: 800; color: ${r.hasReturn ? '#92400e' : '#64748b'}; font-family: monospace;">
                ${r.hasReturn ? r.returnDate : 'NO APLICA (Solo ida)'}
              </div>
              <div style="font-size: 0.85rem; font-weight: 600; color: ${r.hasReturn ? '#78350f' : '#64748b'};">
                Hora: ${r.hasReturn ? (r.returnTime || 'Por confirmar') : '-'}
              </div>
            </div>
          </div>

          <div style="font-size: 0.85rem; line-height: 1.4; color: #334155;">
            <strong>Alojamiento / Hotel:</strong> ${r.hotelName || '-'}<br>
            <strong>Observaciones de Viaje:</strong> ${r.observations || 'Sin observaciones adicionales.'}
          </div>
        </div>

        <!-- Columna de Datos de Contacto y Acciones -->
        <div style="border-left: 1px solid var(--border-light); padding-left: 20px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <h4 style="font-size: 0.82rem; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 12px;">
              DATOS DE CONTACTO
            </h4>
            <div style="font-size: 0.88rem; margin-bottom: 10px;">
              <strong>Cliente / Empresa:</strong><br>
              ${r.clientName}
            </div>
            <div style="font-size: 0.88rem; margin-bottom: 10px;">
              <strong>Celular / WhatsApp:</strong><br>
              <a href="tel:${r.clientPhone}" style="color: #0369a1; font-weight: 700; text-decoration: none;">
                📞 +591 ${r.clientPhone || 'Sin teléfono'}
              </a>
            </div>
            <div style="font-size: 0.88rem; margin-bottom: 14px;">
              <strong>Correo Electrónico:</strong><br>
              ${r.clientEmail || 'Sin email registrado'}
            </div>
          </div>

          <!-- Botones de Acción Inmediata -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-success" onclick="window.calendarModule.sendWhatsAppReminder('${r.id}')">
              <i data-lucide="message-circle"></i> Notificar por WhatsApp
            </button>
            <button class="btn btn-secondary" onclick="window.calendarModule.printBoardingItinerary('${r.id}')">
              <i data-lucide="printer"></i> Imprimir Itinerario
            </button>
            <button class="btn btn-danger btn-sm" onclick="window.calendarModule.deleteReminder('${r.id}')">
              <i data-lucide="trash-2"></i> Eliminar Itinerario
            </button>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    window.app.openModal('modal-reminder-detail');
  },

  sendWhatsAppReminder(reminderId) {
    const data = window.db.get();
    const r = data.travelReminders.find(x => x.id === reminderId);
    if (!r) return;

    const phone = (r.clientPhone || '').replace(/\D/g, '');
    if (!phone) {
      alert('Este pasajero no tiene número de celular registrado.');
      return;
    }

    const fullPhone = phone.startsWith('591') ? phone : `591${phone}`;

    let msg = `Hola estimado(a) *${r.passengerName}*, le saludamos cordialmente de *MARETRAVEL - Agencia de Viajes*.\n\n`;
    msg += `Le recordamos los detalles de su viaje programado:\n`;
    msg += `✈️ *Ruta:* ${r.route} (${r.airline})\n`;
    msg += `🛫 *Fecha de Salida:* ${r.departureDate} a las ${r.departureTime || 'horario programado'}\n`;
    if (r.hasReturn && r.returnDate) {
      msg += `🛬 *Fecha de Retorno:* ${r.returnDate} a las ${r.returnTime || 'horario programado'}\n`;
    }
    if (r.ticketNumber) msg += `🎫 *Nro. Boleto:* ${r.ticketNumber}\n`;
    if (r.hotelName && r.hotelName !== '-') msg += `🏨 *Alojamiento:* ${r.hotelName}\n`;
    msg += `\nRecuerde presentarse en el aeropuerto con 2 horas de anticipación para vuelos nacionales y 3 horas para internacionales llevando su documento de identidad vigente.\n\n`;
    msg += `¡Le deseamos un excelente vuelo! Quedamos a su disposición.`;

    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  },

  printBoardingItinerary(reminderId) {
    const data = window.db.get();
    const r = data.travelReminders.find(x => x.id === reminderId);
    if (!r) return;

    const settings = data.systemSettings;
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    printArea.innerHTML = `
      <div class="print-page">
        <!-- Membrete Oficial MARETRAVEL -->
        <div class="print-header">
          <img src="assets/logo.jpg" class="print-logo" alt="MARETRAVEL Logo">
          <div class="print-agency-info">
            <div class="print-agency-title">${settings.agencyCommercialName}</div>
            <div>NIT: ${settings.agencyNit}</div>
            <div>${settings.agencyAddress}</div>
            <div>Telf: ${settings.agencyPhone}</div>
          </div>
        </div>

        <div class="print-doc-title">
          <h2>CONFIRMACIÓN DE ITINERARIO DE VIAJE</h2>
          <div class="print-doc-number">CÓDIGO: ${r.id}</div>
        </div>

        <div class="print-meta-grid">
          <div><strong>Pasajero:</strong> ${r.passengerName}</div>
          <div><strong>Doc. Identidad:</strong> ${r.passengerDoc || 'S/D'}</div>
          <div><strong>Cliente / Empresa:</strong> ${r.clientName}</div>
          <div><strong>Teléfono Contacto:</strong> +591 ${r.clientPhone || 'S/N'}</div>
          <div><strong>Aerolínea / Operador:</strong> ${r.airline}</div>
          <div><strong>Nro de Boleto:</strong> ${r.ticketNumber || 'S/N'}</div>
        </div>

        <!-- Itinerario -->
        <table class="print-table" style="margin-top: 14px;">
          <thead>
            <tr>
              <th>Tramo</th>
              <th>Ruta</th>
              <th>Fecha</th>
              <th>Hora Presentación</th>
              <th>Vuelo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>IDA</strong></td>
              <td class="font-mono"><strong>${r.route.split('-')[0]} ➔ ${r.route.split('-')[1]}</strong></td>
              <td class="font-mono">${r.departureDate}</td>
              <td class="font-mono">${r.departureTime || '06:00'}</td>
              <td class="font-mono">${r.flightNumber || 'OB-640'}</td>
              <td><span class="badge badge-emerald">CONFIRMADO</span></td>
            </tr>
            ${r.hasReturn ? `
              <tr>
                <td><strong>VUELTA</strong></td>
                <td class="font-mono"><strong>${r.route.split('-')[1]} ➔ ${r.route.split('-')[0]}</strong></td>
                <td class="font-mono">${r.returnDate}</td>
                <td class="font-mono">${r.returnTime || '18:00'}</td>
                <td class="font-mono">${r.flightNumber || 'OB-641'}</td>
                <td><span class="badge badge-emerald">CONFIRMADO</span></td>
              </tr>
            ` : ''}
          </tbody>
        </table>

        ${r.hotelName && r.hotelName !== '-' ? `
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; font-size: 9pt; margin-bottom: 16px;">
            <strong>Alojamiento Hotelero:</strong> ${r.hotelName} (Reserva confirmada con MARETRAVEL)
          </div>
        ` : ''}

        <div style="font-size: 8pt; color: #475569; line-height: 1.3; margin-top: 16px;">
          * Presentación obligatoria en aeropuerto: 2 horas antes en vuelos domésticos y 3 horas en vuelos internacionales.<br>
          * Franquicia de equipaje según regulaciones de la aerolínea transportadora.<br>
          * Para cualquier cambio o asistencia durante su viaje, comuníquese con nuestra central de atención 24/7.
        </div>

        <div class="print-signatures" style="margin-top: 50px;">
          <div class="signature-box">
            <strong>EMITIDO POR</strong><br>
            MARETRAVEL TURISMO<br>
            Firma y Sello
          </div>
          <div class="signature-box">
            <strong>CONFORME PASAJERO</strong><br>
            ${r.passengerName}<br>
            Firma
          </div>
        </div>
      </div>
    `;

    window.print();
  },

  openNewReminderModal() {
    const form = document.getElementById('travel-reminder-form');
    if (form) form.reset();

    const data = window.db.get();
    const clients = data.accounts.filter(a => a.relationType === 'CLIENTE' || a.relationType === 'AMBOS');
    const select = document.getElementById('trv-client-select');
    if (select) {
      select.innerHTML = '<option value="">-- Seleccionar Cliente --</option>' +
        clients.map(c => `<option value="${c.id}" data-phone="${c.cellphone || c.phone || ''}" data-name="${c.name}">${c.name} (${c.code})</option>`).join('');
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const retDate = new Date(now);
    retDate.setDate(now.getDate() + 3);
    const retStr = `${retDate.getFullYear()}-${String(retDate.getMonth() + 1).padStart(2, '0')}-${String(retDate.getDate()).padStart(2, '0')}`;

    document.getElementById('trv-has-return').checked = true;
    document.getElementById('trv-return-fields-row').style.display = 'grid';
    document.getElementById('trv-departure-date').value = todayStr;
    document.getElementById('trv-departure-time').value = '09:00';
    document.getElementById('trv-return-date').value = retStr;
    document.getElementById('trv-return-time').value = '18:00';

    window.app.openModal('modal-new-travel-reminder');
  },

  handleSaveReminder(e) {
    e.preventDefault();
    const data = window.db.get();
    const clientSelect = document.getElementById('trv-client-select');
    const opt = clientSelect.options[clientSelect.selectedIndex];

    const hasReturn = document.getElementById('trv-has-return').checked;

    const newReminder = {
      id: 'TRV-' + Date.now(),
      clientId: clientSelect.value,
      clientName: opt?.dataset.name || 'Cliente Particular',
      clientPhone: document.getElementById('trv-client-phone').value.trim() || opt?.dataset.phone || '',
      clientEmail: document.getElementById('trv-client-email').value.trim(),
      passengerName: document.getElementById('trv-passenger-name').value.trim().toUpperCase(),
      passengerDoc: document.getElementById('trv-passenger-doc').value.trim().toUpperCase(),
      route: document.getElementById('trv-route').value.trim().toUpperCase(),
      airline: document.getElementById('trv-airline').value.trim(),
      flightNumber: document.getElementById('trv-flight-number').value.trim(),
      ticketNumber: document.getElementById('trv-ticket-number').value.trim(),
      departureDate: document.getElementById('trv-departure-date').value,
      departureTime: document.getElementById('trv-departure-time').value,
      returnDate: hasReturn ? document.getElementById('trv-return-date').value : '',
      returnTime: hasReturn ? document.getElementById('trv-return-time').value : '',
      hasReturn: hasReturn,
      hotelName: document.getElementById('trv-hotel-name').value.trim() || '-',
      status: 'PROGRAMADO',
      observations: document.getElementById('trv-observations').value.trim(),
      createdAt: new Date().toLocaleString()
    };

    if (!data.travelReminders) data.travelReminders = [];
    data.travelReminders.unshift(newReminder);

    window.db.save(data);
    window.app.closeModal('modal-new-travel-reminder');
    window.app.showToast('Itinerario de viaje registrado en el calendario', 'success');
    this.render();
  },

  deleteReminder(reminderId) {
    if (!confirm('¿Confirma que desea eliminar este itinerario del calendario?')) return;
    const data = window.db.get();
    data.travelReminders = (data.travelReminders || []).filter(x => x.id !== reminderId);
    window.db.save(data);
    window.app.closeModal('modal-reminder-detail');
    window.app.showToast('Itinerario eliminado', 'info');
    this.render();
  }
};
