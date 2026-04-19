/* ============================================================
   objectives.js — vista de Objetivos 2026.
   Renderiza month-tabs, pace cards, weekly charts y tabla editable.
   Expone window.Objectives.render({ d2026, weeklyData, transactions }).
   ============================================================ */

(function (global) {
  const ds = global.DataStatic;
  const {
    channels, palette, d2025, defaultTargets, monthDays, months, STEP, chToUpper,
  } = ds;

  const fmt = n => Math.round(n).toLocaleString('es-PE');
  const tot = o => channels.reduce((s, c) => s + (o[c] || 0), 0);
  const pctFill  = p => p >= 100 ? 'var(--green)' : p >= 80 ? 'var(--amber)' : 'var(--brand)';
  const pctColor = p => p >= 100 ? 'var(--green-text)' : p >= 80 ? 'var(--amber-text)' : 'var(--brand-text)';

  // Estado interno
  const state = {
    targets: JSON.parse(JSON.stringify(defaultTargets)),
    d2026: null,
    weeklyData: null,
    transactions: null,
    avgTickets: {},
  };

  // ── Calendar helpers (hoy vive en 2026) ──
  const today = new Date();
  function daysPassed(m) {
    if (m === 'Abril') {
      if (today.getFullYear() < 2026) return 0;
      if (today.getFullYear() > 2026 || today.getMonth() > 3) return monthDays.Abril;
      if (today.getMonth() < 3) return 0;
      return today.getDate();
    }
    return monthDays[m];
  }
  function daysRemaining(m) {
    if (m === 'Abril') return Math.max(0, monthDays.Abril - daysPassed('Abril'));
    return 0;
  }

  // ── Avg ticket por canal (monto / qty) ──
  function computeAvgTickets(d2026, transactions) {
    const out = {};
    months.forEach(m => {
      const row = {}; let totalAmount = 0, totalQty = 0;
      channels.forEach(ch => {
        const up = chToUpper[ch];
        const amt = d2026[m][ch] || 0;
        const qty = (transactions[m] && transactions[m][up]) || 0;
        row[up] = qty > 0 ? Math.round(amt / qty) : 0;
        totalAmount += amt;
        totalQty    += qty;
      });
      row.TOTAL = totalQty > 0 ? Math.round(totalAmount / totalQty) : 0;
      out[m] = row;
    });
    return out;
  }

  // ── Refrescar fila individual ──
  function refreshObjRow(m, ch) {
    state.targets[m][ch] = parseFloat(document.getElementById(`inp-${m}-${ch}`).value) || 0;
    const real = state.d2026[m][ch];
    const tgt  = state.targets[m][ch];
    const p    = tgt > 0 ? real / tgt * 100 : 0;
    const isApr = m === 'Abril';

    const pb = document.getElementById(`pb-${m}-${ch}`);
    const pv = document.getElementById(`pv-${m}-${ch}`);
    const gv = document.getElementById(`gv-${m}-${ch}`);

    if (isApr) {
      pb.style.width = '0%'; pv.textContent = '—'; pv.style.color = 'var(--muted)';
      gv.textContent = 'en curso'; gv.className = 'gap-val'; gv.style.color = 'var(--muted)';
    } else {
      pb.style.width = Math.min(p, 100).toFixed(1) + '%';
      pb.style.background = pctFill(p);
      pv.textContent = p.toFixed(0) + '%';
      pv.style.color = pctColor(p);
      const gap = real - tgt;
      gv.textContent = (gap >= 0 ? '+' : '') + 'S/. ' + fmt(gap);
      gv.className = 'gap-val ' + (gap >= 0 ? 'g-pos' : 'g-neg');
    }
    refreshObjTotal(m);
    refreshPaceCards(m);
  }

  function refreshObjTotal(m) {
    const tr = channels.reduce((s, ch) => s + state.d2026[m][ch], 0);
    const tt = channels.reduce((s, ch) => s + (state.targets[m][ch] || 0), 0);
    const p = tt > 0 ? tr / tt * 100 : 0;
    const isApr = m === 'Abril';

    const pb = document.getElementById(`pb-tot-${m}`);
    const pv = document.getElementById(`pv-tot-${m}`);
    const gv = document.getElementById(`gv-tot-${m}`);
    const mt = document.getElementById(`mt-${m}`);
    if (mt) mt.textContent = 'S/. ' + fmt(tt);

    if (isApr) {
      pb.style.width = '0%'; pv.textContent = '—'; pv.style.color = 'var(--muted)';
      gv.textContent = 'en curso'; gv.style.color = 'var(--muted)'; gv.className = 'gap-val';
    } else {
      pb.style.width = Math.min(p, 100).toFixed(1) + '%';
      pb.style.background = pctFill(p);
      pv.textContent = p.toFixed(0) + '%';
      pv.style.color = pctColor(p);
      const gap = tr - tt;
      gv.textContent = (gap >= 0 ? '+' : '') + 'S/. ' + fmt(gap);
      gv.className = 'gap-val ' + (gap >= 0 ? 'g-pos' : 'g-neg');
    }
  }

  function refreshPaceCards(m) {
    const el = document.getElementById(`pace-${m}`);
    if (!el) return;

    const tt        = channels.reduce((s, ch) => s + (state.targets[m][ch] || 0), 0);
    const real      = channels.reduce((s, ch) => s + state.d2026[m][ch], 0);
    const isApr     = m === 'Abril';
    const remDays   = daysRemaining(m);
    const passed    = daysPassed(m);
    const faltante  = Math.max(0, tt - real);
    const dailyNeed = remDays > 0 ? faltante / remDays : 0;
    const avgTk     = state.avgTickets[m].TOTAL;
    const txnsNeed  = dailyNeed > 0 && avgTk > 0 ? Math.ceil(dailyNeed / avgTk) : 0;

    const pctMet    = tt > 0 ? real / tt * 100 : 0;
    const dailyReal = passed > 0 ? real / passed : 0;

    if (isApr) {
      el.innerHTML = `
        <div class="pace-grid">
          <div class="pace-card dark">
            <div class="pace-lbl">Días restantes</div>
            <div class="pace-val">${remDays}</div>
            <div class="pace-sub">de 30 en abril</div>
          </div>
          <div class="pace-card ${faltante > 0 ? 'red-border' : 'green-border'}">
            <div class="pace-lbl">Faltante para meta</div>
            <div class="pace-val ${faltante > 0 ? 'red' : 'green'}">S/. ${fmt(faltante)}</div>
            <div class="pace-sub">Meta total: S/. ${fmt(tt)}</div>
          </div>
          <div class="pace-card amber-border">
            <div class="pace-lbl">Venta diaria necesaria</div>
            <div class="pace-val">S/. ${fmt(dailyNeed)}</div>
            <div class="pace-sub">para los ${remDays} días restantes</div>
          </div>
          <div class="pace-card brand-border">
            <div class="pace-lbl">Transacciones necesarias</div>
            <div class="pace-val brand">${txnsNeed}/día</div>
            <div class="pace-sub">ticket promedio S/. ${avgTk}</div>
          </div>
        </div>
        <div class="pace-footnote">
          Referencia de marzo: <strong>${Math.round(Object.values(state.transactions.Marzo || {}).reduce((a, b) => a + b, 0) / 31)} transacciones/día</strong>
          con ticket promedio <strong>S/. ${state.avgTickets.Marzo.TOTAL}</strong> → para alcanzar la meta de abril necesitas mantener un ritmo similar o superior.
        </div>`;
    } else {
      const totalTx = avgTk > 0 ? Math.round(real / avgTk) : 0;
      const closeColor = real >= tt ? 'green' : pctMet >= 90 ? 'amber' : 'red';
      el.innerHTML = `
        <div class="pace-grid">
          <div class="pace-card ${closeColor}-border">
            <div class="pace-lbl">Cierre del mes</div>
            <div class="pace-val ${closeColor}">${pctMet.toFixed(1)}%</div>
            <div class="pace-sub">${real >= tt ? '✓ Objetivo alcanzado' : 'de la meta'}</div>
          </div>
          <div class="pace-card ${real >= tt ? 'green-border' : 'red-border'}">
            <div class="pace-lbl">${real >= tt ? 'Excedente' : 'Brecha final'}</div>
            <div class="pace-val ${real >= tt ? 'green' : 'red'}">${real >= tt ? '+' : ''}S/. ${fmt(real - tt)}</div>
            <div class="pace-sub">vs meta S/. ${fmt(tt)}</div>
          </div>
          <div class="pace-card">
            <div class="pace-lbl">Venta diaria real</div>
            <div class="pace-val">S/. ${fmt(dailyReal)}</div>
            <div class="pace-sub">promedio sobre ${passed} días</div>
          </div>
          <div class="pace-card brand-border">
            <div class="pace-lbl">Transacciones totales</div>
            <div class="pace-val brand">${totalTx}</div>
            <div class="pace-sub">ticket promedio S/. ${state.avgTickets[m].TOTAL}</div>
          </div>
        </div>`;
    }
  }

  // ── Render principal de la vista ──
  function render({ d2026, weeklyData, transactions, weekly2025 }) {
    state.d2026        = d2026;
    state.weeklyData   = weeklyData;
    state.transactions = transactions;
    state.weekly2025   = weekly2025 || {};
    state.avgTickets   = computeAvgTickets(d2026, transactions);

    // Chart combinado arriba de los month tabs (52 semanas 2025 + 2026 disponibles)
    if (global.Charts?.combinedWeeklyChart) {
      global.Charts.combinedWeeklyChart(state.weekly2025, state.weeklyData);
    }

    const monthTabsEl   = document.getElementById('month-tabs');
    const monthPanelsEl = document.getElementById('month-panels');
    if (!monthTabsEl || !monthPanelsEl) return;
    monthTabsEl.innerHTML   = '';
    monthPanelsEl.innerHTML = '';

    months.forEach((m, i) => {
      const isApr       = m === 'Abril';
      const monthTotal  = channels.reduce((s, ch) => s + d2026[m][ch], 0);
      const total2025   = tot(d2025[m]);

      // Panel HTML
      const panel = document.createElement('div');
      panel.className = 'mpanel' + (i === 0 ? ' visible' : '');
      panel.id = 'mpanel-' + m;

      let rows = '';
      channels.forEach(ch => {
        const real  = d2026[m][ch];
        const ref25 = d2025[m][ch];
        const share = monthTotal > 0 ? (real / monthTotal * 100).toFixed(1) : '—';
        rows += `<tr>
          <td><span class="ch-name"><span class="ch-pip" style="background:${palette[ch]}"></span>${ch}</span></td>
          <td class="r mono text-2">S/. ${fmt(ref25)}</td>
          <td class="r mono">${isApr ? '<span class="muted">—</span>' : 'S/. ' + fmt(real)}</td>
          <td class="r">${isApr ? '—' : share + '%'}</td>
          <td class="r"><div class="stepper">
            <button class="step-btn" data-step="-${STEP}" data-month="${m}" data-ch="${ch}">−</button>
            <input class="obj-input" type="number" id="inp-${m}-${ch}" value="${state.targets[m][ch]}" min="0" step="${STEP}">
            <button class="step-btn" data-step="${STEP}" data-month="${m}" data-ch="${ch}">+</button>
          </div></td>
          <td class="r" style="min-width:140px;"><div class="pb-wrap"><div class="pb-bg"><div class="pb-fill" id="pb-${m}-${ch}"></div></div><span class="pct-val" id="pv-${m}-${ch}"></span></div></td>
          <td class="r" id="gv-${m}-${ch}"></td>
        </tr>`;
      });

      panel.innerHTML = `
        ${isApr ? `<div class="period-note">Abril 2026 está en curso · ${daysPassed('Abril')} días transcurridos · Referencia 2025: <strong>S/. ${fmt(total2025)}</strong></div>` : ''}
        <div id="pace-${m}" style="margin-bottom:16px;"></div>
        <div class="panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">Avance por canal</div>
              <div class="panel-sub">${m} 2026 · ajustable</div>
            </div>
          </div>
          <table>
            <thead><tr>
              <th>Canal</th>
              <th class="r">Ref. 2025</th>
              <th class="r">Real 2026</th>
              <th class="r">% mes</th>
              <th class="r">Objetivo S/.</th>
              <th class="r" style="min-width:140px;">Avance</th>
              <th class="r">Brecha</th>
            </tr></thead>
            <tbody>${rows}
              <tr style="background:#F8FAFC;">
                <td><strong>Total</strong></td>
                <td class="r mono text-2">S/. ${fmt(total2025)}</td>
                <td class="r mono">${isApr ? '<span class="muted">—</span>' : 'S/. ' + fmt(monthTotal)}</td>
                <td class="r">${isApr ? '—' : '100%'}</td>
                <td class="r mono text-2" id="mt-${m}"></td>
                <td class="r" style="min-width:140px;"><div class="pb-wrap"><div class="pb-bg"><div class="pb-fill" id="pb-tot-${m}"></div></div><span class="pct-val" id="pv-tot-${m}"></span></div></td>
                <td class="r" id="gv-tot-${m}"></td>
              </tr>
            </tbody>
          </table>
        </div>`;

      monthPanelsEl.appendChild(panel);

      // Bind stepper + input
      panel.querySelectorAll('.step-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const m2 = btn.dataset.month, ch = btn.dataset.ch, step = parseFloat(btn.dataset.step);
          const inp = document.getElementById(`inp-${m2}-${ch}`);
          const cur = parseFloat(inp.value || 0);
          inp.value = Math.max(0, Math.round((cur + step) / STEP) * STEP);
          refreshObjRow(m2, ch);
        });
      });
      channels.forEach(ch => {
        document.getElementById(`inp-${m}-${ch}`).addEventListener('input', () => refreshObjRow(m, ch));
        refreshObjRow(m, ch);
      });
      refreshPaceCards(m);

      // Month tab button
      const tab = document.createElement('button');
      tab.className = 'month-tab' + (i === 0 ? ' active' : '') + (isApr ? ' active-current' : '');
      tab.textContent = m + (isApr ? ' ◉' : '');
      tab.addEventListener('click', () => {
        monthTabsEl.querySelectorAll('.month-tab').forEach(t => t.classList.remove('active'));
        monthPanelsEl.querySelectorAll('.mpanel').forEach(p => p.classList.remove('visible'));
        tab.classList.add('active');
        panel.classList.add('visible');
      });
      monthTabsEl.appendChild(tab);
    });
  }

  global.Objectives = { render, state };
})(window);
