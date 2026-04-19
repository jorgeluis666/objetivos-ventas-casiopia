/* ============================================================
   main.js — entry point. Orquesta: carga de datos, navegación
   sidebar, render de vistas, wire del indicador de sync.
   ============================================================ */

(function () {
  const ds = window.DataStatic;
  const { channels, palette, d2025, months } = ds;

  const VIEW_TITLES = {
    'view-yoy':  'Comparativo interanual',
    'view-prod': 'Productos Web · 2026',
    'view-dist': 'Distribución por canal',
    'view-obj':  'Objetivos 2026',
  };

  const state = {
    d2026: null,
    weeklyData: null,
    transactions: null,
    generated: null,
    renderedProducts: false,
  };

  // ── Navegación ──
  function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('visible'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const view = document.getElementById(id);
    const btn  = document.querySelector(`.nav-item[data-view="${id}"]`);
    if (view) view.classList.add('visible');
    if (btn)  btn.classList.add('active');
    const title = document.getElementById('topbar-title');
    if (title) title.textContent = VIEW_TITLES[id] || '';

    // Render perezoso de productos para no bloquear primera pantalla
    if (id === 'view-prod' && !state.renderedProducts) {
      renderProducts();
      state.renderedProducts = true;
    }
  }

  function wireNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => showView(btn.dataset.view));
    });
  }

  // ── YoY ──
  const tot = o => channels.reduce((s, c) => s + (o[c] || 0), 0);
  const fmt = n => Math.round(n).toLocaleString('es-PE');

  function renderKpisYoY(d2026) {
    const el = document.getElementById('kpi-yoy');
    if (!el) return;
    el.innerHTML = '';
    months.forEach(m => {
      const t25 = tot(d2025[m]);
      const t26 = tot(d2026[m]);
      if (t26 === 0) {
        el.insertAdjacentHTML('beforeend', `
          <div class="kpi-card">
            <div class="kpi-icon amber">⏳</div>
            <div class="kpi-label">${m} · en curso</div>
            <div class="kpi-value muted" style="font-size:20px;">—</div>
            <div class="kpi-sub"><span class="pill amber">2025 · S/. ${fmt(t25)}</span></div>
          </div>`);
      } else {
        const d = (t26 - t25) / t25 * 100;
        const up = d >= 0;
        el.insertAdjacentHTML('beforeend', `
          <div class="kpi-card">
            <div class="kpi-icon ${up ? 'green' : 'red'}">${up ? '▲' : '▼'}</div>
            <div class="kpi-label">${m} · YoY</div>
            <div class="kpi-value">S/. ${fmt(t26)}</div>
            <div class="kpi-sub">
              <span class="pill ${up ? 'green' : 'red'}">${up ? '+' : ''}${d.toFixed(1)}%</span>
              <span class="muted">vs S/. ${fmt(t25)}</span>
            </div>
          </div>`);
      }
    });
  }

  function renderYoYTable(d2026) {
    const host = document.getElementById('yoy-tables');
    if (!host) return;
    const cmpMonths = ['Enero', 'Febrero', 'Marzo'];
    const activeCh = channels.filter(ch => cmpMonths.some(m => d2025[m][ch] > 0 || d2026[m][ch] > 0));
    let rows = '';
    activeCh.forEach(ch => {
      let cells = `<tr><td><span class="ch-name"><span class="ch-pip" style="background:${palette[ch]}"></span>${ch}</span></td>`;
      cmpMonths.forEach(m => {
        const v25 = d2025[m][ch], v26 = d2026[m][ch];
        if (v25 === 0 && v26 === 0) cells += `<td class="delta-zero">—</td>`;
        else if (v25 === 0)         cells += `<td class="delta-pos">nuevo<span class="sub-val mono">S/. ${fmt(v26)}</span></td>`;
        else {
          const d = (v26 - v25) / v25 * 100;
          cells += `<td class="${d >= 0 ? 'delta-pos' : 'delta-neg'}">${d >= 0 ? '+' : ''}${d.toFixed(1)}%<span class="sub-val mono">S/. ${fmt(v26)}</span></td>`;
        }
      });
      rows += cells + '</tr>';
    });
    let totRow = '<tr class="total-row"><td>Total</td>';
    cmpMonths.forEach(m => {
      const t25 = tot(d2025[m]);
      const t26 = tot(d2026[m]);
      const d = t25 > 0 ? (t26 - t25) / t25 * 100 : 0;
      totRow += `<td class="${d >= 0 ? 'delta-pos' : 'delta-neg'}">${d >= 0 ? '+' : ''}${d.toFixed(1)}%<span class="sub-val mono">S/. ${fmt(t26)}</span></td>`;
    });
    totRow += '</tr>';
    host.innerHTML = `<table class="ds-table">
      <thead><tr><th>Canal</th>${cmpMonths.map(m => `<th>${m}</th>`).join('')}</tr></thead>
      <tbody>${rows}${totRow}</tbody>
    </table>`;
  }

  // ── Productos (estáticos salvo charts.js) ──
  function renderProducts() {
    // KPIs (texto estático derivado del análisis del cliente)
    const kpi = document.getElementById('kpi-prod');
    if (kpi) {
      kpi.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-icon brand">$</div>
          <div class="kpi-label">Ingresos netos</div>
          <div class="kpi-value">S/. 29,055</div>
          <div class="kpi-sub muted">136 SKUs · 238 uds</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon green">#</div>
          <div class="kpi-label">Pedidos web</div>
          <div class="kpi-value">225</div>
          <div class="kpi-sub muted">1.06 uds / pedido promedio</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon amber">¤</div>
          <div class="kpi-label">Ticket promedio</div>
          <div class="kpi-value">S/. 129</div>
          <div class="kpi-sub muted">por unidad vendida</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon purple">★</div>
          <div class="kpi-label">Marca líder</div>
          <div class="kpi-value" style="font-size:18px;">Martín Aranda</div>
          <div class="kpi-sub muted">64.6% · S/. 18,778</div>
        </div>`;
    }

    // Charts de productos
    window.Charts.productCharts();

    // Copurchase cards
    const cpGrid = document.getElementById('copurchase-grid');
    if (cpGrid && !cpGrid.childElementCount) {
      ds.copurchaseData.forEach(c => {
        cpGrid.insertAdjacentHTML('beforeend', `
          <div class="copurchase-card">
            <div class="copurchase-icon">${c.icon}</div>
            <div class="copurchase-title">${c.title}</div>
            <div class="copurchase-desc">${c.desc}</div>
            <div class="copurchase-detail">${c.detail}</div>
          </div>`);
      });
    }

    // Next sales
    const ns = document.getElementById('next-sales-grid');
    if (ns && !ns.childElementCount) {
      ds.nextSales.forEach(x => {
        ns.insertAdjacentHTML('beforeend', `
          <div class="next-sale-card">
            <div class="next-sale-trigger">Si → ${x.trigger}</div>
            <div class="next-sale-suggest">${x.suggest}</div>
            <div class="next-sale-why">${x.why}</div>
          </div>`);
      });
    }

    // Multi-bars
    const mb = document.getElementById('multi-bars');
    if (mb && !mb.childElementCount) {
      ds.multiData.forEach(p => {
        const pct = Math.min((p.ratio / 2) * 100, 100);
        const color = p.ratio >= 2 ? 'var(--red)' : p.ratio >= 1.5 ? 'var(--amber)' : 'var(--brand)';
        const pillClass = p.ratio >= 2 ? 'red' : p.ratio >= 1.5 ? 'amber' : 'blue';
        mb.insertAdjacentHTML('beforeend', `
          <div class="multi-bar-row">
            <div class="multi-bar-name">${p.name}</div>
            <div class="multi-bar-track"><div class="multi-bar-fill" style="width:${pct}%;background:${color};"></div></div>
            <div><span class="pill ${pillClass}">${p.ratio.toFixed(1)}×</span></div>
            <div class="multi-bar-why">${p.why}</div>
          </div>`);
      });
      mb.insertAdjacentHTML('beforeend', `
        <div class="multi-bar-row" style="border-bottom:none;padding-bottom:0;">
          <span class="muted" style="font-size:11px;">Producto</span><span></span>
          <span class="muted" style="font-size:11px;text-align:center;">Uds/Pedido</span>
          <span class="muted" style="font-size:11px;">Razón probable</span>
        </div>`);
    }

    // Bundle ideas
    const bi = document.getElementById('bundle-ideas');
    if (bi && !bi.childElementCount) {
      ds.bundleIdeas.forEach(b => {
        bi.insertAdjacentHTML('beforeend', `
          <div class="bundle-card">
            <div class="bundle-head" style="background:${b.color};">
              <span class="bundle-icon">${b.icon}</span>
              <div>
                <div class="bundle-tag">${b.tag}</div>
                <div class="bundle-title">${b.title}</div>
              </div>
            </div>
            <div class="bundle-body">
              <div class="bundle-products">
                ${b.products.map(p => `<div class="bundle-product"><span class="arrow" style="color:${b.color};">▸</span>${p}</div>`).join('')}
              </div>
              <div class="bundle-mechanic">
                <div class="bundle-mechanic-label">Mecánica</div>
                <div class="bundle-mechanic-text">${b.mechanic}</div>
              </div>
              <div class="bundle-ticket-row">
                <span class="bundle-ticket-label">Ticket estimado</span>
                <span class="bundle-ticket-value" style="color:${b.color};">${b.ticket}</span>
              </div>
              <div class="bundle-why">${b.why}</div>
            </div>
          </div>`);
      });
    }
  }

  // ── Render completo con datos live ──
  function renderAll(liveData) {
    state.d2026        = liveData.d2026;
    state.weeklyData   = liveData.weeklyData;
    state.transactions = liveData.transactions;
    state.generated    = liveData.generated;

    renderKpisYoY(state.d2026);
    window.Charts.evoChart(state.d2026);
    renderYoYTable(state.d2026);

    const distMonths = ['Enero', 'Febrero', 'Marzo'];
    window.Charts.distCharts(state.d2026, distMonths);
    window.Charts.absChart(state.d2026, distMonths);

    window.Objectives.render({
      d2026: state.d2026,
      weeklyData: state.weeklyData,
      transactions: state.transactions,
    });

    if (state.renderedProducts) renderProducts();
    window.Sheets.updateGenerated(state.generated);
  }

  // ── Init ──
  async function init() {
    Chart.register(ChartDataLabels);
    Chart.defaults.plugins.datalabels.display = false;
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif';

    wireNav();
    showView('view-yoy');

    const live = await window.DataLive.load();
    if (live.source === 'fallback') {
      const host = document.getElementById('kpi-yoy');
      if (host) host.insertAdjacentHTML('beforebegin', `
        <div class="insight err" style="margin-bottom:14px;">
          No se pudo cargar <code>data/ventas-2026.json</code>. El pipeline de GitHub Actions tiene que correr al menos una vez (o ejecutá <code>npm run fetch</code> local).
        </div>`);
    }
    renderAll(live);

    window.Sheets.init({
      generated: live.generated,
      onUpdate: updated => renderAll(updated),
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
