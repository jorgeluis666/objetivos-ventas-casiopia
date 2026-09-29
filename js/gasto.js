/* ============================================================
   gasto.js — módulo "Gasto publicitario".
   Solo usa las carpetas de pauta en Drive, una pestaña por fuente:
     Meta Ads    data/casiopia-meta.json    (carpeta "Meta Files")
     Google Ads  data/casiopia-google.json  (carpeta "Google Files")
   Los JSON los genera scripts/fetch-casiopia.js en el workflow
   sync-casiopia.yml: todos los días a las 07:00 (Lima) y a pedido
   con el botón "Sincronizar ahora".
   Expone window.Gasto.init() (llamado desde main.js al abrir la vista).
   ============================================================ */

(function (global) {
  const FILES = {
    meta:   'data/casiopia-meta.json',
    google: 'data/casiopia-google.json',
  };
  const SYNC_WORKFLOW = 'sync-casiopia.yml';
  const COLOR = { meta: '#b91c1c', google: '#D97706', ink: '#0f172a' };
  const axisColor = '#94A3B8';
  const gridColor = 'rgba(15,23,42,0.06)';
  const TAB_KEY = 'gp-tab';
  const PANE_CHARTS = {
    meta:   ['chart-gp-meta-daily', 'chart-gp-meta-spend', 'chart-gp-meta-roas'],
    google: ['chart-gp-google-spend'],
  };

  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const SHORT = m => m.slice(0, 3);

  const state = {
    data: {}, tab: 'meta', rendered: {},
    metaSel: null, googleSel: null, syncing: false,
  };

  // ── Formato ──
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n, dec = 0) => n == null ? '—'
    : 'S/. ' + n.toLocaleString('es-PE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const num = n => n == null ? '—' : Math.round(n).toLocaleString('es-PE');
  const pct = (n, dec = 1) => n == null || !Number.isFinite(n) ? '—' : n.toFixed(dec) + '%';
  const ratio = (a, b) => (b ? a / b : null);
  const roasFmt = n => n == null || !Number.isFinite(n) ? '—' : n.toFixed(2) + 'x';
  const moneyK = v => 'S/. ' + (v / 1000).toFixed(0) + 'k';

  // Fechas con hora se muestran en hora de Lima (UTC-5, sin horario de verano).
  function fechaHora(iso) {
    if (!iso) return '—';
    const t = Date.parse(iso);
    if (/T\d{2}:\d{2}/.test(iso) && Number.isFinite(t)) iso = new Date(t - 5 * 3600 * 1000).toISOString();
    const m =String(iso).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    if (!m) return iso;
    const d = `${+m[3]} ${MONTHS[+m[2] - 1].slice(0, 3).toLowerCase()} ${m[1]}`;
    return m[4] ? `${d}, ${m[4]}:${m[5]}` : d;
  }
  const fechaCorta = iso => { const [, mm, dd] = iso.split('-'); return `${+dd} ${MONTHS[+mm - 1].slice(0, 3).toLowerCase()}`; };

  function deltaPill(cur, prev, { neutral = false } = {}) {
    if (!prev) return '';
    const d = (cur - prev) / prev * 100;
    const cls = neutral ? 'gray' : d >= 0 ? 'green' : 'red';
    return `<span class="pill ${cls}">${d >= 0 ? '+' : ''}${pct(d)}</span>`;
  }

  // ── Carga ──
  async function loadJson(url) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      console.warn('[gasto] no se pudo cargar', url, err);
      return null;
    }
  }

  // ── Franja de fuente (arriba de cada pestaña) ──
  function renderSource(id, { name, where, generated, url, linkLabel, ok = true, note = '' }) {
    document.getElementById(id).innerHTML = `
      <div class="gp-source-l">
        <span class="gp-dot ${ok ? 'ok' : 'warn'}"></span>
        <span><b>Fuente:</b> ${esc(name)} <span class="muted">· ${esc(where)}</span></span>
      </div>
      <div class="gp-source-r">
        ${note ? `<span class="muted">${esc(note)}</span>` : ''}
        <span class="muted">${generated ? 'Sincronizado ' + esc(fechaHora(generated)) : 'Aún no sincronizado'}</span>
        ${url ? `<a class="btn ghost btn-sm" href="${esc(url)}" target="_blank" rel="noopener">${esc(linkLabel)} ↗</a>` : ''}
      </div>`;
  }

  function emptyState(hostId, { title, text, url, linkLabel }) {
    document.getElementById(hostId).innerHTML = `
      <div class="panel gp-empty">
        <div class="gp-empty-ic"><svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div>
        <div class="gp-empty-title">${esc(title)}</div>
        <p class="gp-empty-text">${text}</p>
        ${url ? `<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener">${esc(linkLabel)}</a>` : ''}
      </div>`;
  }

  function monthButtons(hostId, items, selected, onPick) {
    const host = document.getElementById(hostId);
    host.innerHTML = items.map(it =>
      `<button class="vt-btn${it.key === selected ? ' active' : ''}" data-key="${esc(it.key)}">${esc(it.label)}</button>`).join('');
    host.querySelectorAll('.vt-btn').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.key !== selected) onPick(b.dataset.key);
    }));
  }

  // Resalta en el eje X la etiqueta del periodo elegido (idx -1 = ninguno).
  function highlightX(chartId, idx) {
    const chart = global.Charts.getInstance(chartId);
    if (!chart) return;
    chart.options.scales.x.ticks.color = ctx => ctx.index === idx ? COLOR.ink : axisColor;
    chart.options.scales.x.ticks.font = ctx => ({ size: 11, weight: ctx.index === idx ? 700 : 400 });
    chart.update('none');
  }

  const kpi = ({ icon = 'slate', label, value, valueCls = '', sub = '', extra = '' }) => `
    <div class="kpi-card">
      <div class="kpi-icon ${icon}">${ICONS[icon] || ''}</div>
      <div class="kpi-lbl">${label}</div>
      <div class="kpi-val ${valueCls}">${value}</div>
      ${extra}
      <div class="kpi-sub">${sub}</div>
    </div>`;
  const ICONS = {
    blue:   '<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    green:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    amber:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    purple: '<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    slate:  '<svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    red:    '<svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  };

  // ════════════════════════════════════════════════════════════
  // META ADS
  // ════════════════════════════════════════════════════════════
  let metaBodyTpl = '';  // HTML original de #gp-meta-body (se guarda en init)
  const shortMonthKey = key => SHORT(MONTHS[+key.split('-')[1] - 1]);

  function renderMeta() {
    const d = state.data.meta;
    const has = !!d?.months?.length;
    renderSource('gp-meta-source', {
      name: 'Meta Files - Casiopia', where: `Carpeta de pauta · ${d?.files?.length || 0} archivos`,
      generated: d?.generated, url: d?.folder?.url || 'https://drive.google.com/drive/folders/166vtDwzl4YbqLnyqNpulZI2YltKb2FMm',
      linkLabel: 'Abrir carpeta', ok: has,
    });
    if (!has) {
      emptyState('gp-meta-body', {
        title: 'Meta Ads aún no sincronizado',
        text: 'No se encontró <code>data/casiopia-meta.json</code>. Se genera desde la carpeta de exportaciones de Ads Manager.',
      });
      return;
    }
    // Si antes se mostró el estado vacío, se restaura la estructura del panel
    const body = document.getElementById('gp-meta-body');
    if (!body.querySelector('#gp-meta-kpis')) body.innerHTML = metaBodyTpl;
    if (!state.metaSel) state.metaSel = d.months[d.months.length - 1].key;
    monthButtons('gp-meta-months', d.months.map(m => ({ key: m.key, label: shortMonthKey(m.key) })), state.metaSel,
      key => { state.metaSel = key; renderMeta(); });

    const i = d.months.findIndex(m => m.key === state.metaSel);
    const m = d.months[i];
    const prev = d.months[i - 1];
    const t = m.totals;
    // Mes parcial: el último día exportado no es el último del mes
    const [y, mm] = m.key.split('-').map(Number);
    const parcial = +m.hasta.slice(8) < new Date(y, mm, 0).getDate();
    document.getElementById('gp-meta-range').innerHTML =
      `Del ${fechaCorta(m.desde)} al ${fechaCorta(m.hasta)}${parcial ? ' <span class="pill amber">mes parcial</span>' : ''} · ${esc(m.archivos.join(', '))}`;

    const roas = ratio(t.value, t.spend);
    document.getElementById('gp-meta-kpis').innerHTML = [
      kpi({ icon: 'red', label: 'Inversión', value: money(t.spend), valueCls: 'red',
        sub: prev ? `${deltaPill(t.spend, prev.totals.spend, { neutral: true })} vs ${shortMonthKey(prev.key)}` : 'Importe gastado' }),
      kpi({ icon: 'purple', label: 'Compras', value: num(t.purchases), valueCls: 'purple',
        sub: `CPA ${money(ratio(t.spend, t.purchases), 2)}${prev ? ' · ' + deltaPill(t.purchases, prev.totals.purchases, { neutral: parcial }) : ''}` }),
      kpi({ icon: 'green', label: 'Valor de conversión', value: money(t.value), valueCls: 'green',
        sub: `ROAS ${roasFmt(roas)} · atribución de Meta` }),
      kpi({ icon: 'slate', label: 'CTR del enlace', value: pct(ratio(t.clicks, t.impressions) * 100, 2),
        sub: `${num(t.clicks)} clics · ${num(t.impressions)} impresiones` }),
    ].join('');

    // Embudo: cada barra = conversión respecto al paso anterior
    const steps = [
      ['Impresiones', t.impressions], ['Clics en el enlace', t.clicks], ['Visitas a la web', t.landing],
      ['Agregados al carrito', t.addToCart], ['Pagos iniciados', t.checkouts], ['Compras', t.purchases],
    ];
    document.getElementById('gp-meta-funnel').innerHTML = steps.map(([name, val], k) => {
      const rate = k === 0 ? null : ratio(val, steps[k - 1][1]);
      return `<div class="gp-funnel-row">
        <div class="gp-funnel-name">${name}</div>
        <div class="gp-funnel-bar"><div style="width:${k === 0 ? 100 : Math.max(Math.min(rate * 100, 100), 1.5)}%"></div></div>
        <div class="gp-funnel-val mono">${num(val)}</div>
        <div class="gp-funnel-rate">${k === 0 ? '' : pct(rate * 100)}</div>
      </div>`;
    }).join('') + (t.messages ? `<p class="gp-note">Además, ${num(t.messages)} conversaciones de mensajes iniciadas.</p>` : '');

    // Campañas
    document.getElementById('gp-meta-campaigns').innerHTML = `
      <div class="gp-table-wrap"><table class="rep-table">
        <thead><tr><th>Campaña</th><th class="r">Inversión</th><th class="r">Compras</th><th class="r">Valor conv.</th><th class="r">ROAS</th><th class="r">CPA</th></tr></thead>
        <tbody>${m.campaigns.map(c => {
          const share = ratio(c.spend, t.spend) * 100;
          const r = ratio(c.value, c.spend);
          return `<tr>
            <td><div class="rep-camp-name">${esc(c.name)}</div><div class="rep-bar"><div style="width:${share}%;"></div></div></td>
            <td class="r mono">${money(c.spend)}<span class="sub-val">${pct(share)}</span></td>
            <td class="r mono">${c.purchases || '—'}</td>
            <td class="r mono">${c.value ? money(c.value) : '—'}</td>
            <td class="r">${c.purchases ? `<span class="pill ${r >= 4 ? 'green' : r >= 2 ? 'amber' : 'red'}">${roasFmt(r)}</span>` : '<span class="pill gray">sin compras</span>'}</td>
            <td class="r mono">${c.purchases ? money(c.spend / c.purchases, 2) : '—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;

    // Anuncios
    const ads = m.ads.filter(a => a.purchases > 0).slice(0, 8);
    document.getElementById('gp-meta-ads').innerHTML = ads.length ? `
      <div class="gp-table-wrap"><table class="rep-table">
        <thead><tr><th>Anuncio</th><th class="r">Compras</th><th class="r">Inversión</th><th class="r">ROAS</th><th></th></tr></thead>
        <tbody>${ads.map((a, k) => `<tr>
          <td>${k === 0 ? '<span class="rep-star" title="Más compras del mes">★</span>' : ''}${esc(a.name)}<span class="sub-val">${esc(a.campaign)}</span></td>
          <td class="r mono">${a.purchases}</td>
          <td class="r mono">${money(a.spend)}</td>
          <td class="r"><span class="pill ${ratio(a.value, a.spend) >= 4 ? 'green' : 'amber'}">${roasFmt(ratio(a.value, a.spend))}</span></td>
          <td class="r">${a.preview ? `<a class="btn ghost btn-sm" href="${esc(a.preview)}" target="_blank" rel="noopener">Ver ↗</a>` : ''}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="gp-note">Ningún anuncio registró compras en este mes.</p>';

    // Público: barras de compras por edad + reparto por sexo
    const ages = m.age.filter(a => a.spend > 0 || a.purchases > 0);
    const maxP = Math.max(1, ...ages.map(a => a.purchases));
    const sexes = m.sex.filter(s => s.spend > 0);
    document.getElementById('gp-meta-audience').innerHTML = `
      <div class="rep-subttl" style="margin-top:0">Compras por edad</div>
      ${ages.map(a => `<div class="gp-aud-row">
        <div class="gp-aud-name">${esc(a.name)}</div>
        <div class="gp-aud-bar"><div style="width:${a.purchases / maxP * 100}%"></div></div>
        <div class="gp-aud-val"><span class="mono">${a.purchases}</span> <span class="muted">· ${money(a.spend)}</span></div>
      </div>`).join('')}
      <div class="rep-subttl">Inversión por sexo</div>
      <dl class="rep-metrics rep-metrics-wide">${sexes.map(s => `<div>
        <dt>${esc(s.name)}</dt>
        <dd>${pct(ratio(s.spend, t.spend) * 100, 0)} de la inversión · ${s.purchases} compras</dd>
      </div>`).join('')}</dl>`;

    // Gráficos
    metaDailyChart(m);
    if (!global.Charts.getInstance('chart-gp-meta-spend')) metaTrendCharts(d);
    highlightX('chart-gp-meta-spend', i);
    highlightX('chart-gp-meta-roas', i);
  }

  function metaDailyChart(m) {
    global.Charts.mount('chart-gp-meta-daily', {
      type: 'bar',
      data: {
        labels: m.daily.map(x => +x.d.slice(8)),
        datasets: [{ label: 'Inversión', data: m.daily.map(x => x.spend), backgroundColor: COLOR.meta, borderRadius: { topLeft: 4, topRight: 4 }, maxBarThickness: 14 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            title: items => fechaCorta(m.daily[items[0].dataIndex].d),
            label: c => ` Inversión: ${money(c.parsed.y, 2)}`,
            footer: items => { const x = m.daily[items[0].dataIndex]; return `Compras: ${x.purchases} · Valor: ${money(x.value)}`; },
          } },
        },
        scales: {
          x: { ticks: { color: axisColor, font: { size: 10 }, maxRotation: 0, autoSkipPadding: 6 }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: axisColor, font: { size: 10 }, callback: v => 'S/. ' + v }, grid: { color: gridColor } },
        },
      },
    });
  }

  function metaTrendCharts(d) {
    const labels = d.months.map(m => shortMonthKey(m.key));
    global.Charts.mount('chart-gp-meta-spend', {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Inversión', data: d.months.map(m => m.totals.spend), backgroundColor: COLOR.meta, borderRadius: { topLeft: 4, topRight: 4 }, maxBarThickness: 36 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            label: c => ` Inversión: ${money(c.parsed.y)}`,
            footer: items => { const t = d.months[items[0].dataIndex].totals; return `Compras: ${t.purchases} · CPA ${money(ratio(t.spend, t.purchases), 2)}`; },
          } },
        },
        scales: {
          x: { ticks: { color: axisColor, font: { size: 11 } }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: axisColor, font: { size: 10 }, callback: moneyK }, grid: { color: gridColor } },
        },
      },
    });
    global.Charts.mount('chart-gp-meta-roas', {
      type: 'line',
      data: { labels, datasets: [{
        label: 'ROAS', data: d.months.map(m => ratio(m.totals.value, m.totals.spend)),
        borderColor: COLOR.meta, backgroundColor: COLOR.meta, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6,
        pointBackgroundColor: '#ffffff', pointBorderWidth: 2, tension: 0.25,
      }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            label: c => ` ROAS: ${roasFmt(c.parsed.y)}`,
            footer: items => { const t = d.months[items[0].dataIndex].totals; return `Valor ${money(t.value)} ÷ inversión ${money(t.spend)}`; },
          } },
          datalabels: {
            display: true, align: 'top', offset: 4, color: '#475569', font: { size: 10, weight: 600 },
            formatter: v => v == null ? '' : v.toFixed(1),
          },
        },
        scales: {
          x: { ticks: { color: axisColor, font: { size: 11 } }, grid: { display: false } },
          y: { beginAtZero: true, grace: '15%', ticks: { color: axisColor, font: { size: 10 }, callback: v => v + 'x' }, grid: { color: gridColor } },
        },
      },
    });
  }

  // ════════════════════════════════════════════════════════════
  // GOOGLE ADS
  // ════════════════════════════════════════════════════════════
  function renderGoogle() {
    const d = state.data.google;
    const folder = d?.folder?.url || 'https://drive.google.com/drive/folders/1oN2HxlqXENM0KuAIOM_rtb17zJPCCAhO';
    const has = !!d?.months?.length;
    renderSource('gp-google-source', {
      name: 'Google Files - Casiopia', where: `Carpeta de pauta · ${d?.files?.length || 0} archivos`,
      generated: d?.generated, url: folder, linkLabel: 'Abrir carpeta', ok: has && !d?.avisos?.length,
    });
    const body = document.getElementById('gp-google-body');
    if (!has) {
      emptyState('gp-google-body', {
        title: d ? 'La carpeta de Google Ads todavía está vacía' : 'Google Ads aún no sincronizado',
        text: 'Cuando se suban los informes de campañas de Google Ads (un Google Sheet por mes, exportado desde Google Ads con el rango del mes), se sincronizarán solos y aparecerán aquí.',
        url: folder, linkLabel: 'Abrir carpeta en Drive',
      });
      return;
    }

    if (!state.googleSel) state.googleSel = d.months[d.months.length - 1].key;
    const i = d.months.findIndex(m => m.key === state.googleSel);
    const m = d.months[i];
    const prev = d.months[i - 1];
    const t = m.totals;
    const [y, mm] = m.key.split('-').map(Number);
    const parcial = m.hasta && +m.hasta.slice(8) < new Date(y, mm, 0).getDate();

    const avisos = (d.avisos || []).map(a => `<div class="insight warn" style="margin-bottom:10px;"><b>Revisar archivo:</b> ${esc(a)}</div>`).join('');

    body.innerHTML = `
      ${avisos}
      <div class="rep-toolbar">
        <div class="view-toggle" id="gp-google-months" role="group" aria-label="Mes de Google Ads"></div>
        <span class="rep-period-meta">Del ${esc(fechaCorta(m.desde))} al ${esc(fechaCorta(m.hasta || m.desde))}${parcial ? ' <span class="pill amber">mes parcial</span>' : ''} · ${esc(m.archivos.join(', '))}</span>
      </div>
      <div class="rep-stack">
        <div class="grid-4">${[
          kpi({ icon: 'amber', label: 'Inversión', value: money(t.spend), valueCls: 'amber',
            sub: prev ? `${deltaPill(t.spend, prev.totals.spend, { neutral: true })} vs ${shortMonthKey(prev.key)}` : 'Costo del mes' }),
          kpi({ icon: 'purple', label: 'Compras', value: num(t.purchases), valueCls: 'purple',
            sub: `Costo por compra ${money(ratio(t.spend, t.purchases), 2)}${prev ? ' · ' + deltaPill(t.purchases, prev.totals.purchases, { neutral: parcial }) : ''}` }),
          kpi({ icon: 'green', label: 'Valor de compras', value: money(t.purchaseValue), valueCls: 'green',
            sub: `ROAS ${roasFmt(ratio(t.purchaseValue, t.spend))} · atribución de Google` }),
          kpi({ icon: 'slate', label: 'CTR', value: pct(ratio(t.clicks, t.impressions) * 100, 2),
            sub: `${num(t.clicks)} clics · ${num(t.impressions)} impresiones · CPC ${money(ratio(t.spend, t.clicks), 2)}` }),
        ].join('')}</div>
        ${t.checkouts ? `<p class="gp-note">Google cuenta además <b>${num(t.checkouts)} pagos iniciados</b> como conversión (total del informe: ${num(t.conversions)} conversiones por ${money(t.value)}). Aquí el ROAS usa solo las compras.</p>` : ''}
        <div class="grid-2">
          <div class="panel">
            <div class="panel-head"><div><div class="panel-title">Inversión por tipo de campaña</div><div class="panel-sub">Costo, clics y CTR del mes</div></div></div>
            <div class="gp-table-wrap"><table class="rep-table">
              <thead><tr><th>Tipo</th><th class="r">Inversión</th><th class="r">Clics</th><th class="r">CTR</th></tr></thead>
              <tbody>${m.types.map(x => {
                const share = ratio(x.spend, t.spend) * 100;
                return `<tr>
                  <td><div class="rep-camp-name">${esc(x.name)}</div><div class="rep-bar"><div style="width:${share}%;background:${COLOR.google}"></div></div></td>
                  <td class="r mono">${money(x.spend)}<span class="sub-val">${pct(share)}</span></td>
                  <td class="r mono">${num(x.clicks)}</td>
                  <td class="r mono">${pct(ratio(x.clicks, x.impressions) * 100, 2)}</td>
                </tr>`;
              }).join('')}</tbody>
            </table></div>
          </div>
          <div class="panel">
            <div class="panel-head"><div><div class="panel-title">Compras por campaña</div><div class="panel-sub">Google no reporta costo por campaña en este informe</div></div></div>
            ${m.campaigns.length ? `<div class="gp-table-wrap"><table class="rep-table">
              <thead><tr><th>Campaña</th><th class="r">Compras</th><th class="r">Valor</th><th class="r">Pagos inic.</th></tr></thead>
              <tbody>${m.campaigns.map(c => `<tr>
                <td>${esc(c.name)}<span class="sub-val">${esc(c.type)}</span></td>
                <td class="r mono">${c.purchases ? c.purchases.toLocaleString('es-PE', { maximumFractionDigits: 1 }) : '—'}</td>
                <td class="r mono">${c.purchaseValue ? money(c.purchaseValue) : '—'}</td>
                <td class="r mono">${c.checkouts ? num(c.checkouts) : '—'}</td>
              </tr>`).join('')}</tbody>
            </table></div>` : '<p class="gp-note">Ninguna campaña registró conversiones en este mes.</p>'}
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><div class="panel-title">Inversión mensual</div><div class="panel-sub">Costo en Google Ads por mes · el tooltip muestra compras y ROAS</div></div></div>
          <div class="chart-wrap h-220"><canvas id="chart-gp-google-spend" role="img" aria-label="Inversión mensual en Google Ads"></canvas></div>
        </div>
      </div>`;
    monthButtons('gp-google-months', d.months.map(x => ({ key: x.key, label: shortMonthKey(x.key) })), state.googleSel,
      key => { state.googleSel = key; renderGoogle(); });

    global.Charts.mount('chart-gp-google-spend', {
      type: 'bar',
      data: { labels: d.months.map(x => shortMonthKey(x.key)), datasets: [{ label: 'Inversión', data: d.months.map(x => x.totals.spend), backgroundColor: COLOR.google, borderRadius: { topLeft: 4, topRight: 4 }, maxBarThickness: 36 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            label: c => ` Inversión: ${money(c.parsed.y)}`,
            footer: items => { const x = d.months[items[0].dataIndex].totals; return `Compras: ${num(x.purchases)} · ROAS ${roasFmt(ratio(x.purchaseValue, x.spend))}`; },
          } },
        },
        scales: {
          x: { ticks: { color: axisColor, font: { size: 11 } }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: axisColor, font: { size: 10 }, callback: moneyK }, grid: { color: gridColor } },
        },
      },
    });
    highlightX('chart-gp-google-spend', i);
  }

  // ════════════════════════════════════════════════════════════
  // Pestañas
  // ════════════════════════════════════════════════════════════
  const RENDER = {
    meta: renderMeta,
    google: renderGoogle,
  };

  function showTab(name) {
    if (!RENDER[name]) name = 'meta';
    state.tab = name;
    document.querySelectorAll('.gp-tab').forEach(t => {
      const on = t.dataset.pane === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('.gp-pane').forEach(p => { p.hidden = p.id !== 'gp-pane-' + name; });
    try { localStorage.setItem(TAB_KEY, name); } catch (e) { /* storage bloqueado */ }

    // Render perezoso: los charts se crean con la pestaña ya visible
    if (!state.rendered[name]) {
      state.rendered[name] = true;
      RENDER[name]();
    } else {
      requestAnimationFrame(() => global.Charts.replay(PANE_CHARTS[name]));
    }
  }

  function wireTabs() {
    const tabs = [...document.querySelectorAll('.gp-tab')];
    tabs.forEach((t, k) => {
      t.addEventListener('click', () => showTab(t.dataset.pane));
      // Flechas izquierda/derecha entre pestañas (patrón ARIA tablist)
      t.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const next = tabs[(k + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        next.focus();
        showTab(next.dataset.pane);
      });
    });
  }

  // Reemplaza los datos y vuelve a pintar la pestaña activa desde cero.
  function setData(data) {
    state.data = data;
    Object.values(PANE_CHARTS).flat().forEach(id => global.Charts.destroy(id));
    state.rendered = {};
    // Se conserva el mes elegido solo si sigue existiendo
    if (!data.meta?.months?.some(m => m.key === state.metaSel)) state.metaSel = null;
    if (!data.google?.months?.some(m => m.key === state.googleSel)) state.googleSel = null;
    showTab(state.tab);
    renderSync();
  }

  // ════════════════════════════════════════════════════════════
  // Sincronización (workflow sync-casiopia.yml vía GitHub API)
  // ════════════════════════════════════════════════════════════
  const lastGenerated = () => [state.data.meta?.generated, state.data.google?.generated]
    .filter(Boolean).sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null;

  function renderSync(msg = null, kind = 'ok') {
    const btn = document.getElementById('gp-sync-btn');
    btn.disabled = state.syncing;
    btn.classList.toggle('loading', state.syncing);
    btn.querySelector('span').textContent = state.syncing ? 'Sincronizando…' : 'Sincronizar ahora';
    document.getElementById('gp-sync-dot').className = `gp-dot ${state.syncing ? 'busy' : kind}`;
    const gen = lastGenerated();
    document.getElementById('gp-sync-text').innerHTML = msg || (gen
      ? `<b>Datos al ${esc(fechaHora(gen))}</b> <span class="muted">· se sincroniza sola todos los días a las 07:00 (Lima)</span>`
      : '<b>Aún no sincronizado</b> <span class="muted">· se sincroniza sola todos los días a las 07:00 (Lima)</span>');
  }

  async function syncNow() {
    if (state.syncing) return;
    state.syncing = true;
    renderSync('Lanzando la sincronización de las carpetas de Meta y Google…');
    const before = lastGenerated();
    try {
      const startedAt = Date.now();
      await global.Sheets.dispatch(SYNC_WORKFLOW);
      const run = await global.Sheets.waitForRun(SYNC_WORKFLOW, startedAt, {
        onStatus: s => renderSync(s === 'queued' ? 'En cola en GitHub Actions…' : 'Leyendo las carpetas de Drive…'),
      });
      if (run.conclusion !== 'success') {
        throw new Error(`el workflow terminó con estado "${run.conclusion}". <a href="${esc(run.html_url)}" target="_blank" rel="noopener">Ver detalle ↗</a>`);
      }
      // Lee los JSON recién commiteados, sin esperar el deploy de Pages
      const [meta, google] = await Promise.all([
        global.Sheets.fetchRepoJson(FILES.meta).catch(() => state.data.meta),
        global.Sheets.fetchRepoJson(FILES.google).catch(() => state.data.google),
      ]);
      state.syncing = false;
      setData({ meta, google });
      if (lastGenerated() === before) {
        renderSync(`<b>Sin cambios en Drive</b> <span class="muted">· verificado ${esc(fechaHora(new Date().toISOString()))}; los datos siguen al ${esc(fechaHora(before))}</span>`);
      }
    } catch (err) {
      console.error('[gasto] sync failed', err);
      state.syncing = false;
      renderSync(`<b>No se pudo sincronizar:</b> ${/<a /.test(err.message) ? err.message : esc(err.message)}`, 'warn');
    }
  }

  let started = false;
  async function init() {
    if (started) {
      requestAnimationFrame(() => global.Charts.replay(PANE_CHARTS[state.tab]));
      return;
    }
    started = true;
    metaBodyTpl = document.getElementById('gp-meta-body').innerHTML;
    wireTabs();
    document.getElementById('gp-sync-btn').addEventListener('click', () => global.Sheets.withPat(syncNow));
    const [meta, google] = await Promise.all([loadJson(FILES.meta), loadJson(FILES.google)]);
    try { state.tab = localStorage.getItem(TAB_KEY) || 'meta'; } catch (e) { /* storage bloqueado */ }
    setData({ meta, google });
  }

  global.Gasto = { init };
})(window);
