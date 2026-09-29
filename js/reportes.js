/* ============================================================
   reportes.js — vista "Gasto publicitario".
   Lee window.ReportesData (data-reportes.js) y renderiza:
   selector de mes, KPIs, detalle Meta/Google, campañas,
   anuncios, lectura del mes y tendencia. Los archivos de la
   carpeta de Drive viven en el módulo Archivo (archivo.js).
   Expone window.Reportes.init() (llamado perezoso desde main.js).
   ============================================================ */

(function (global) {
  const R = global.ReportesData;

  const COLORS = { meta: '#b91c1c', google: '#D97706', web: '#059669' };
  const axisColor = '#94A3B8';
  const gridColor = 'rgba(15,23,42,0.06)';

  const state = {
    month: R.monthly[R.monthly.length - 1].key,
  };

  // ── Formato ──
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n, dec = 0) => n == null ? '—'
    : 'S/. ' + n.toLocaleString('es-PE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const num  = n => n == null ? '—' : n.toLocaleString('es-PE');
  const roas = n => n == null ? '—' : n.toFixed(2) + 'x';
  const pct  = (n, dec = 1) => n.toFixed(dec) + '%';

  const totalCompras = m => m.meta.compras + m.google.compras;
  const valorPlataformas = m => (m.meta.valor || 0) + (m.google.valor || 0);

  function getMonth(key) { return R.monthly.find(m => m.key === key); }
  function prevMonth(key) {
    const i = R.monthly.findIndex(m => m.key === key);
    return i > 0 ? R.monthly[i - 1] : null;
  }

  // neutral: sin juicio de bueno/malo (inversión, o mes parcial vs mes cerrado).
  function deltaPill(cur, prev, { neutral = false } = {}) {
    if (!prev) return '';
    const d = (cur - prev) / prev * 100;
    const cls = neutral ? 'gray' : d >= 0 ? 'green' : 'red';
    return `<span class="pill ${cls}">${d >= 0 ? '+' : ''}${pct(d)}</span>`;
  }

  // ── Selector de mes ──
  function renderPeriodTabs() {
    const host = document.getElementById('rep-period');
    host.innerHTML = R.monthly.map(m => `
      <button class="vt-btn${m.key === state.month ? ' active' : ''}" data-key="${m.key}">
        ${esc(m.label)}${m.parcial ? ' *' : ''}
      </button>`).join('');
    host.querySelectorAll('.vt-btn').forEach(b => {
      b.addEventListener('click', () => {
        if (b.dataset.key === state.month) return;
        state.month = b.dataset.key;
        renderMonth();
      });
    });
  }

  // ── KPIs ──
  function renderKpis(m, prev) {
    const host = document.getElementById('rep-kpis');
    const parcialNote = m.parcial ? ' · mes parcial' : '';
    const prevLbl = prev ? `<span class="muted">vs ${esc(prev.short)}${parcialNote}</span>` : '';

    let roasCard, objCard;
    if (m.web) {
      const avance = m.web.ventas / m.web.objetivo * 100;
      const ok = avance >= 100;
      roasCard = `
        <div class="kpi-card">
          <div class="kpi-icon green"><svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>
          <div class="kpi-lbl">ROAS web real</div>
          <div class="kpi-val green">${roas(m.web.roasReal)}</div>
          <div class="kpi-sub">${money(m.web.ventas)} en ${esc(m.web.plataforma)} ÷ inversión total</div>
        </div>`;
      objCard = `
        <div class="kpi-card">
          <div class="kpi-icon ${ok ? 'green' : 'amber'}"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></div>
          <div class="kpi-lbl">Avance objetivo web</div>
          <div class="kpi-val ${ok ? 'green' : 'amber'}">${pct(avance)}</div>
          <div class="rep-pb"><div class="rep-pb-fill" style="width:${Math.min(avance, 100)}%;background:${ok ? 'var(--green)' : 'var(--amber)'};"></div></div>
          <div class="kpi-sub">${money(m.web.ventas)} de ${money(m.web.objetivo)} · brecha ${money(Math.max(m.web.objetivo - m.web.ventas, 0))}</div>
        </div>`;
    } else {
      const blended = valorPlataformas(m) / m.inversion;
      roasCard = `
        <div class="kpi-card">
          <div class="kpi-icon slate"><svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>
          <div class="kpi-lbl">ROAS plataformas</div>
          <div class="kpi-val">${roas(blended)}</div>
          <div class="kpi-sub">Atribución Meta + Google · el reporte no trae facturación de la tienda</div>
        </div>`;
      objCard = `
        <div class="kpi-card">
          <div class="kpi-icon slate"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></div>
          <div class="kpi-lbl">Avance objetivo web</div>
          <div class="kpi-val muted" style="font-size:20px;">Pendiente</div>
          <div class="kpi-sub">Se completa con el cierre de ventas de la tienda</div>
        </div>`;
    }

    host.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-icon blue"><svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <div class="kpi-lbl">Inversión total</div>
        <div class="kpi-val blue">${money(m.inversion)}</div>
        <div class="kpi-sub">${deltaPill(m.inversion, prev?.inversion, { neutral: true })} ${prevLbl}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon purple"><svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></div>
        <div class="kpi-lbl">Compras atribuidas</div>
        <div class="kpi-val purple">${num(totalCompras(m))}</div>
        <div class="kpi-sub">${deltaPill(totalCompras(m), prev ? totalCompras(prev) : null, { neutral: m.parcial })} Meta ${m.meta.compras} · Google ${m.google.compras}</div>
      </div>
      ${roasCard}
      ${objCard}`;
  }

  // ── Meta vs Google ──
  function channelCard(kind, c, m) {
    const isMeta = kind === 'meta';
    const share = c.inv / m.inversion * 100;
    const cpa = c.compras ? c.inv / c.compras : null;
    const rows = [
      ['Inversión', money(c.inv, 2)],
      ['Compras', num(c.compras)],
      ['Valor de conversión', c.valor != null ? money(c.valor) : '—'],
      ['ROAS plataforma', roas(c.roas)],
      ['Costo por compra', cpa != null ? money(cpa, 2) : '—'],
    ];
    if (c.alcance)     rows.push(['Alcance', num(c.alcance)]);
    if (c.impresiones) rows.push(['Impresiones', num(c.impresiones)]);
    if (c.clics)       rows.push(['Clics', num(c.clics)]);

    return `
      <div class="panel rep-channel">
        <div class="panel-head">
          <div class="rep-ch-head">
            <span class="rep-ch-badge" style="background:${COLORS[kind]};">${isMeta ? 'M' : 'G'}</span>
            <div>
              <div class="panel-title">${isMeta ? 'Meta Ads' : 'Google Ads'}</div>
              <div class="panel-sub">${isMeta ? 'Facebook / Instagram' : 'Performance Max'} · ${pct(share)} de la inversión</div>
            </div>
          </div>
          <span class="pill ${c.roas >= 4 ? 'green' : c.roas >= 3 ? 'amber' : 'red'}">ROAS ${roas(c.roas)}</span>
        </div>
        <div class="rep-share"><div style="width:${share}%;background:${COLORS[kind]};"></div></div>
        <dl class="rep-metrics">
          ${rows.map(([k, v]) => `<div><dt>${k}</dt><dd class="mono">${v}</dd></div>`).join('')}
        </dl>
      </div>`;
  }

  function renderChannels(m) {
    document.getElementById('rep-channels').innerHTML =
      channelCard('meta', m.meta, m) + channelCard('google', m.google, m);
  }

  // ── Campañas y anuncios ──
  function renderCampaigns(m) {
    const totalGasto = m.campanas.reduce((s, c) => s + c.gasto, 0);
    const rows = m.campanas.map(c => {
      const share = c.gasto / totalGasto * 100;
      return `<tr>
        <td>
          <div class="rep-camp-name">${esc(c.name)}</div>
          <div class="rep-bar"><div style="width:${share}%;"></div></div>
        </td>
        <td class="r mono">${money(c.gasto)}<span class="sub-val">${pct(share)}</span></td>
        <td class="r mono">${c.compras || '—'}</td>
        <td class="r">${c.roas != null ? `<span class="pill ${c.roas >= 4 ? 'green' : c.roas >= 3 ? 'amber' : 'red'}">${roas(c.roas)}</span>` : '<span class="pill gray">branding</span>'}</td>
      </tr>`;
    }).join('');
    document.getElementById('rep-campaigns').innerHTML = `
      <table class="rep-table">
        <thead><tr><th>Campaña</th><th class="r">Gasto</th><th class="r">Compras</th><th class="r">ROAS</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderAds(m) {
    const rows = m.anuncios.map(a => `<tr>
        <td>${a.top ? '<span class="rep-star" title="Mejor anuncio del mes">★</span>' : ''}${esc(a.name)}</td>
        <td class="r mono">${a.compras}</td>
        <td class="r mono">${money(a.gasto)}</td>
        <td class="r"><span class="pill ${a.roas >= 6 ? 'green' : a.roas >= 4 ? 'blue' : 'amber'}">${roas(a.roas)}</span></td>
      </tr>`).join('');
    document.getElementById('rep-ads').innerHTML = `
      <table class="rep-table">
        <thead><tr><th>Anuncio (Meta)</th><th class="r">Compras</th><th class="r">Gasto</th><th class="r">ROAS</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // ── Público / semanas ──
  function renderAudience(m) {
    const pub = `
      <dl class="rep-metrics rep-metrics-wide">
        ${m.publico.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
      </dl>`;
    let weeks = '';
    if (m.semanas?.length) {
      const best = Math.max(...m.semanas.map(s => s.roas));
      weeks = `
        <div class="rep-subttl">Variación semanal · Meta</div>
        <table class="rep-table">
          <thead><tr><th>Semana</th><th class="r">Compras</th><th class="r">Valor conv.</th><th class="r">ROAS</th></tr></thead>
          <tbody>${m.semanas.map(s => `<tr>
            <td>${esc(s.label)}<span class="sub-val">${esc(s.nota)}</span></td>
            <td class="r mono">${s.compras}</td>
            <td class="r mono">${money(s.valor)}</td>
            <td class="r"><span class="pill ${s.roas === best ? 'green' : 'gray'}">${roas(s.roas)}</span></td>
          </tr>`).join('')}</tbody>
        </table>`;
    }
    document.getElementById('rep-audience').innerHTML = pub + weeks;
  }

  // ── Lectura del mes ──
  function renderInsights(m) {
    document.getElementById('rep-insights').innerHTML = `
      <div class="insight info" style="margin-bottom:14px;"><b>Destacado:</b> ${esc(m.destacado)}</div>
      <div class="rep-subttl">Qué hacer el próximo período</div>
      <ol class="rep-actions">${m.acciones.map(a => `<li>${esc(a)}</li>`).join('')}</ol>`;
  }

  function renderMonth() {
    const m = getMonth(state.month);
    const prev = prevMonth(state.month);
    renderPeriodTabs();

    const meta = document.getElementById('rep-period-meta');
    meta.innerHTML = `Periodo ${esc(m.periodo)}${m.parcial ? ' · <span class="pill amber">parcial</span>' : ''}`;
    const open = document.getElementById('rep-open-pdf');
    open.href = R.fileUrl('pdf', m.fileId);

    renderKpis(m, prev);
    renderChannels(m);
    renderCampaigns(m);
    renderAds(m);
    renderAudience(m);
    renderInsights(m);
    highlightTrend();
  }

  // ── Tendencia mensual ──
  function trendCharts() {
    const labels = R.monthly.map(m => m.short + (m.parcial ? '*' : ''));
    const money0 = v => 'S/. ' + (v / 1000).toFixed(0) + 'k';

    global.Charts.mount('chart-rep-inv', {
      type: 'bar',
      data: {
        labels,
        datasets: [
          // Borde superior blanco = 2px de separación entre segmentos apilados
          { label: 'Inversión Meta',   data: R.monthly.map(m => m.meta.inv),   backgroundColor: COLORS.meta,   stack: 'inv', borderColor: '#ffffff', borderWidth: { top: 2 } },
          { label: 'Inversión Google', data: R.monthly.map(m => m.google.inv), backgroundColor: COLORS.google, stack: 'inv', borderRadius: { topLeft: 4, topRight: 4 } },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            label: c => ` ${c.dataset.label}: ${money(c.parsed.y)}`,
            footer: items => `Compras atribuidas: ${totalCompras(R.monthly[items[0].dataIndex])}`,
          } },
        },
        scales: {
          x: { stacked: true, ticks: { color: axisColor, font: { size: 11 } }, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { color: axisColor, font: { size: 10 }, callback: money0 }, grid: { color: gridColor } },
        },
      },
    });

    global.Charts.mount('chart-rep-roas', {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Meta',          data: R.monthly.map(m => m.meta.roas),          backgroundColor: COLORS.meta,   borderRadius: 4 },
          { label: 'Google',        data: R.monthly.map(m => m.google.roas),        backgroundColor: COLORS.google, borderRadius: 4 },
          { label: 'Web real',      data: R.monthly.map(m => m.web ? m.web.roasReal : null), backgroundColor: COLORS.web, borderRadius: 4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y == null ? 'sin dato' : roas(c.parsed.y)}` } },
          datalabels: {
            display: ctx => ctx.dataset.data[ctx.dataIndex] != null,
            anchor: 'end', align: 'end', offset: 0,
            color: '#475569', font: { size: 10, weight: 600 },
            formatter: v => v.toFixed(1),
          },
        },
        scales: {
          x: { ticks: { color: axisColor, font: { size: 11 } }, grid: { display: false } },
          y: { beginAtZero: true, grace: '12%', ticks: { color: axisColor, font: { size: 10 }, callback: v => v + 'x' }, grid: { color: gridColor } },
        },
      },
    });
  }

  // Marca la etiqueta del mes seleccionado en ambos ejes X.
  function highlightTrend() {
    const idx = R.monthly.findIndex(m => m.key === state.month);
    ['chart-rep-inv', 'chart-rep-roas'].forEach(id => {
      const chart = global.Charts.getInstance(id);
      if (!chart) return;
      chart.options.scales.x.ticks.color = ctx => ctx.index === idx ? '#0f172a' : axisColor;
      chart.options.scales.x.ticks.font = ctx => ({ size: 11, weight: ctx.index === idx ? 700 : 400 });
      chart.update('none');
    });
  }

  let inited = false;
  function init() {
    if (inited || !R) return;
    inited = true;
    trendCharts();
    renderMonth();
  }

  global.Reportes = { init };
})(window);
