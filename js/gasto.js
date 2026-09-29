/* ============================================================
   gasto.js — módulo "Gasto publicitario".
   Pestañas por fuente, cada una con sus propios datos:
     Ventas      data/casiopia-ventas.json  (Excel de ventas)
     Meta Ads    data/casiopia-meta.json    (carpeta de Drive)
     Google Ads  data/casiopia-google.json  (carpeta de Drive)
     Reportes    window.Reportes (resumen de los PDF de agencia)
   Los JSON los genera scripts/fetch-casiopia.js (GitHub Actions).
   Expone window.Gasto.init() (llamado desde main.js al abrir la vista).
   ============================================================ */

(function (global) {
  const ds = global.DataStatic;
  const CHANNELS = ds.objectiveChannels;
  const PALETTE = ds.objectivePalette;

  const FILES = {
    ventas: 'data/casiopia-ventas.json',
    meta:   'data/casiopia-meta.json',
    google: 'data/casiopia-google.json',
  };
  const COLOR = { meta: '#b91c1c', google: '#D97706', ink: '#0f172a' };
  const axisColor = '#94A3B8';
  const gridColor = 'rgba(15,23,42,0.06)';
  const TAB_KEY = 'gp-tab';
  const PANE_CHARTS = {
    ventas:   ['chart-gp-ventas'],
    meta:     ['chart-gp-meta-daily', 'chart-gp-meta-spend', 'chart-gp-meta-roas'],
    google:   ['chart-gp-google-spend'],
    reportes: ['chart-rep-inv', 'chart-rep-roas'],
  };

  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const SHORT = m => m.slice(0, 3);
  const YEAR = 'Año';

  const state = {
    data: {}, tab: 'ventas', rendered: {},
    ventasSel: null, metaSel: null, googleSel: null,
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
  // VENTAS
  // ════════════════════════════════════════════════════════════
  function ventasPeriod(v, sel) {
    const list = sel === YEAR ? v.months : v.months.filter(m => m.name === sel);
    const sum = f => list.reduce((s, m) => s + (f(m) || 0), 0);
    const anyObj = f => list.some(m => f(m) != null);
    const net = Object.fromEntries(CHANNELS.map(c => [c, sum(m => m.net[c])]));
    return {
      label: sel === YEAR ? `Enero – ${v.months[v.months.length - 1].name}` : sel,
      total: sum(m => m.total),
      objetivoTotal: anyObj(m => m.objetivoTotal) ? sum(m => m.objetivoTotal) : null,
      ventas2025: anyObj(m => m.ventas2025) ? sum(m => m.ventas2025) : null,
      net,
      objetivo: Object.fromEntries(CHANNELS.map(c => [c, anyObj(m => m.objetivo[c]) ? sum(m => m.objetivo[c]) : null])),
      orders: sum(m => m.orders),
      ordersByChannel: Object.fromEntries(CHANNELS.map(c => [c, sum(m => m.ordersByChannel?.[c])])),
      units: sum(m => m.units),
    };
  }

  function renderVentas() {
    const v = state.data.ventas;
    renderSource('gp-ventas-source', {
      name: v?.source?.name || 'Ventas 2026.xlsx', where: 'Excel en Google Drive',
      generated: v?.generated, url: v?.source?.url, linkLabel: 'Abrir Excel', ok: !!v?.months?.length,
      note: v?.source?.modifiedTime ? 'Excel editado ' + fechaHora(v.source.modifiedTime) : '',
    });
    if (!v?.months?.length) {
      emptyState('gp-ventas-body', {
        title: 'Ventas aún no sincronizadas',
        text: 'No se encontró <code>data/casiopia-ventas.json</code>. Se genera con <code>npm run fetch:casiopia</code> o con el workflow de sincronización.',
      });
      return;
    }
    if (!state.ventasSel) state.ventasSel = v.months[v.months.length - 1].name;

    const items = [...v.months.map(m => ({ key: m.name, label: SHORT(m.name) })), { key: YEAR, label: 'Año' }];
    monthButtons('gp-ventas-months', items, state.ventasSel, key => { state.ventasSel = key; renderVentas(); });

    const p = ventasPeriod(v, state.ventasSel);
    const avance = ratio(p.total, p.objetivoTotal);
    const ok = avance != null && avance >= 1;
    const webObj = p.objetivo.Web;
    const current = new Date();
    const enCurso = state.ventasSel === MONTHS[current.getMonth()] && current.getFullYear() === 2026;

    document.getElementById('gp-ventas-kpis').innerHTML = [
      kpi({ icon: 'blue', label: 'Ventas netas', value: money(p.total), valueCls: 'blue',
        sub: `${p.ventas2025 ? deltaPill(p.total, p.ventas2025, { neutral: enCurso }) + ' vs 2025' : 'Sin IGV'}${enCurso ? ' · mes en curso' : ''}` }),
      kpi({ icon: avance == null ? 'slate' : ok ? 'green' : 'amber', label: 'Avance del objetivo',
        value: avance == null ? 'Sin objetivo' : pct(avance * 100), valueCls: avance == null ? 'muted' : ok ? 'green' : 'amber',
        extra: avance == null ? '' : `<div class="rep-pb"><div class="rep-pb-fill" style="width:${Math.min(avance * 100, 100)}%;background:${ok ? 'var(--green)' : 'var(--amber)'};"></div></div>`,
        sub: avance == null ? 'El EERR no define objetivo para este periodo' : `${money(p.total)} de ${money(p.objetivoTotal)}` }),
      kpi({ icon: 'purple', label: 'Venta Web', value: money(p.net.Web), valueCls: 'purple',
        sub: `${pct(ratio(p.net.Web, p.total) * 100)} del total${webObj ? ` · objetivo ${money(webObj)} (${pct(ratio(p.net.Web, webObj) * 100, 0)})` : ''}` }),
      kpi({ icon: 'slate', label: 'Pedidos', value: num(p.orders),
        sub: `Ticket promedio ${money(ratio(p.total, p.orders))} · ${num(p.units)} unidades` }),
    ].join('');

    // Leyenda + gráfico (se crea una vez; el mes solo cambia el resaltado)
    if (!global.Charts.getInstance('chart-gp-ventas')) ventasChart(v);
    highlightX('chart-gp-ventas', state.ventasSel === YEAR ? -1 : v.months.findIndex(m => m.name === state.ventasSel));

    // Tabla por canal
    document.getElementById('gp-ventas-table-title').textContent = `Detalle por canal · ${p.label}`;
    const row = (name, pip, sales, obj, orders, strong = false) => {
      const av = ratio(sales, obj);
      return `<tr${strong ? ' class="gp-total-row"' : ''}>
        <td>${pip ? `<span class="ch-name"><span class="ch-pip" style="background:${pip}"></span>${esc(name)}</span>` : `<strong>${esc(name)}</strong>`}</td>
        <td class="r mono">${money(sales)}</td>
        <td class="r mono">${pct(ratio(sales, p.total) * 100)}</td>
        <td class="r mono">${obj ? money(obj) : '<span class="muted">—</span>'}</td>
        <td class="gp-av">${av == null ? '<span class="muted">—</span>' : `
          <div class="gp-av-wrap"><div class="rep-pb"><div class="rep-pb-fill" style="width:${Math.min(av * 100, 100)}%;background:${av >= 1 ? 'var(--green)' : 'var(--amber)'};"></div></div>
          <span class="mono">${pct(av * 100, 0)}</span></div>`}</td>
        <td class="r mono">${orders ? num(orders) : '—'}</td>
        <td class="r mono">${orders ? money(sales / orders) : '—'}</td>
      </tr>`;
    };
    document.getElementById('gp-ventas-table').innerHTML = `
      <div class="gp-table-wrap"><table class="rep-table">
        <thead><tr><th>Canal</th><th class="r">Ventas netas</th><th class="r">Mix</th><th class="r">Objetivo</th><th>Avance</th><th class="r">Pedidos</th><th class="r">Ticket</th></tr></thead>
        <tbody>
          ${CHANNELS.filter(c => p.net[c] || p.objetivo[c]).map(c => row(c, PALETTE[c], p.net[c], p.objetivo[c], p.ordersByChannel[c])).join('')}
          ${row('Total', null, p.total, p.objetivoTotal, p.orders, true)}
        </tbody>
      </table></div>`;
  }

  function ventasChart(v) {
    const used = CHANNELS.filter(c => v.months.some(m => m.net[c]));
    document.getElementById('gp-ventas-legend').innerHTML =
      used.map(c => `<span class="legend-item"><span class="lsq" style="background:${PALETTE[c]}"></span>${esc(c)}</span>`).join('') +
      '<span class="legend-item"><span class="ld gp-ld-dash"></span>Objetivo</span>';

    const last = used[used.length - 1];
    global.Charts.mount('chart-gp-ventas', {
      type: 'bar',
      data: {
        labels: v.months.map(m => SHORT(m.name)),
        datasets: [
          ...used.map(c => ({
            label: c, data: v.months.map(m => m.net[c]), backgroundColor: PALETTE[c], stack: 'v',
            // 2px de superficie entre segmentos; esquinas redondeadas solo arriba
            borderColor: '#ffffff', borderWidth: c === last ? 0 : { top: 2 },
            borderRadius: c === last ? { topLeft: 4, topRight: 4 } : 0,
            order: 2,
          })),
          {
            label: 'Objetivo', type: 'line', data: v.months.map(m => m.objetivoTotal),
            borderColor: COLOR.ink, backgroundColor: COLOR.ink, borderWidth: 2, borderDash: [5, 4],
            pointRadius: 4, pointBackgroundColor: '#ffffff', pointBorderWidth: 2, tension: 0, order: 1,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            itemSort: (a, b) => (a.dataset.type === 'line') - (b.dataset.type === 'line'),
            callbacks: {
              label: c => ` ${c.dataset.label}: ${money(c.parsed.y)}`,
              footer: items => {
                const m = v.months[items[0].dataIndex];
                return `Total: ${money(m.total)}${m.objetivoTotal ? ` · ${pct(m.total / m.objetivoTotal * 100, 0)} del objetivo` : ''}`;
              },
            },
          },
        },
        scales: {
          x: { stacked: true, ticks: { color: axisColor, font: { size: 11 } }, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { color: axisColor, font: { size: 10 }, callback: moneyK }, grid: { color: gridColor } },
        },
      },
    });
  }

  // ════════════════════════════════════════════════════════════
  // META ADS
  // ════════════════════════════════════════════════════════════
  const shortMonthKey = key => SHORT(MONTHS[+key.split('-')[1] - 1]);

  function renderMeta() {
    const d = state.data.meta;
    const has = !!d?.months?.length;
    renderSource('gp-meta-source', {
      name: 'Datos de Meta Ads', where: `Carpeta de Drive · ${d?.files?.length || 0} archivos`,
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
      name: 'Google Files - Casiopia', where: `Carpeta de Drive · ${d?.files?.length || 0} archivos`,
      generated: d?.generated, url: folder, linkLabel: 'Abrir carpeta', ok: has,
    });
    const body = document.getElementById('gp-google-body');
    if (!has) {
      emptyState('gp-google-body', {
        title: d ? 'La carpeta de Google Ads todavía está vacía' : 'Google Ads aún no sincronizado',
        text: 'Cuando se suban exportaciones de Google Ads (Google Sheets, CSV o Excel; idealmente un archivo por mes con las columnas <em>Día, Campaña, Costo, Impr., Clics, Conversiones</em> y <em>Valor de conv.</em>), se sincronizarán solas y aparecerán aquí.',
        url: folder, linkLabel: 'Abrir carpeta en Drive',
      });
      return;
    }

    if (!state.googleSel) state.googleSel = d.months[d.months.length - 1].key;
    const i = d.months.findIndex(m => m.key === state.googleSel);
    const m = d.months[i];
    const t = m.totals;
    body.innerHTML = `
      <div class="rep-toolbar">
        <div class="view-toggle" id="gp-google-months" role="group" aria-label="Mes de Google Ads"></div>
        <span class="rep-period-meta">${esc(m.archivos.join(', '))}</span>
      </div>
      <div class="rep-stack">
        <div class="grid-4">${[
          kpi({ icon: 'amber', label: 'Inversión', value: money(t.spend), valueCls: 'amber', sub: `${num(t.clicks)} clics · ${num(t.impressions)} impresiones` }),
          kpi({ icon: 'purple', label: 'Conversiones', value: num(t.conversions), valueCls: 'purple', sub: `Costo por conversión ${money(ratio(t.spend, t.conversions), 2)}` }),
          kpi({ icon: 'green', label: 'Valor de conversión', value: money(t.value), valueCls: 'green', sub: 'Atribución de Google Ads' }),
          kpi({ icon: 'slate', label: 'ROAS', value: roasFmt(ratio(t.value, t.spend)), sub: `CTR ${pct(ratio(t.clicks, t.impressions) * 100, 2)}` }),
        ].join('')}</div>
        <div class="grid-2">
          <div class="panel">
            <div class="panel-head"><div><div class="panel-title">Campañas</div><div class="panel-sub">Ordenadas por inversión</div></div></div>
            <div class="gp-table-wrap"><table class="rep-table">
              <thead><tr><th>Campaña</th><th class="r">Inversión</th><th class="r">Conv.</th><th class="r">ROAS</th></tr></thead>
              <tbody>${m.campaigns.map(c => `<tr>
                <td>${esc(c.name)}</td><td class="r mono">${money(c.spend)}</td>
                <td class="r mono">${num(c.conversions)}</td><td class="r mono">${roasFmt(ratio(c.value, c.spend))}</td>
              </tr>`).join('')}</tbody>
            </table></div>
          </div>
          <div class="panel">
            <div class="panel-head"><div><div class="panel-title">Inversión mensual</div><div class="panel-sub">Costo en Google Ads por mes</div></div></div>
            <div class="chart-wrap h-220"><canvas id="chart-gp-google-spend" role="img" aria-label="Inversión mensual en Google Ads"></canvas></div>
          </div>
        </div>
      </div>`;
    monthButtons('gp-google-months', d.months.map(x => ({ key: x.key, label: shortMonthKey(x.key) })), state.googleSel,
      key => { state.googleSel = key; renderGoogle(); });

    global.Charts.mount('chart-gp-google-spend', {
      type: 'bar',
      data: { labels: d.months.map(x => shortMonthKey(x.key)), datasets: [{ label: 'Inversión', data: d.months.map(x => x.totals.spend), backgroundColor: COLOR.google, borderRadius: { topLeft: 4, topRight: 4 }, maxBarThickness: 36 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` Inversión: ${money(c.parsed.y)}` } } },
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
    ventas: renderVentas,
    meta: renderMeta,
    google: renderGoogle,
    reportes: () => global.Reportes?.init(),
  };

  function showTab(name) {
    if (!RENDER[name]) name = 'ventas';
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

  let started = false;
  async function init() {
    if (started) {
      requestAnimationFrame(() => global.Charts.replay(PANE_CHARTS[state.tab]));
      return;
    }
    started = true;
    wireTabs();
    const [ventas, meta, google] = await Promise.all([loadJson(FILES.ventas), loadJson(FILES.meta), loadJson(FILES.google)]);
    state.data = { ventas, meta, google };
    let saved = null;
    try { saved = localStorage.getItem(TAB_KEY); } catch (e) { /* storage bloqueado */ }
    showTab(saved || 'ventas');
  }

  global.Gasto = { init };
})(window);
