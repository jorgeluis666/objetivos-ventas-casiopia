/**
 * casiopia-sources.js — agregación pura de las tres fuentes de Casiopia.
 * No descarga nada: recibe el workbook de ventas (ExcelJS) o las filas CSV
 * de Meta / Google y devuelve los JSON que consume el dashboard.
 *
 *   ventasFromWorkbook(wb)          → data/casiopia-ventas.json
 *   metaFromCsvFiles([{name, text}]) → data/casiopia-meta.json
 *   googleFromTables([{name, rows}]) → data/casiopia-google.json
 *
 * Privacidad: la hoja Ventas trae nombres de clientes; aquí solo salen
 * totales por mes y canal, nunca filas individuales.
 */

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CHANNELS = ['Web', 'RRSS', 'La Mar', 'El Polo', 'Falabella', 'Otros'];

const round2 = n => Math.round(n * 100) / 100;
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

function toNumber(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value).replace(/ /g, ' ').trim();
  if (!raw || raw.startsWith('#')) return 0;
  const cleaned = raw.replace(/S\/\.?/gi, '').replace(/,/g, '').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// ── CSV (maneja comillas y saltos de línea dentro de campos) ──
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length && rows[0].length && rows[0][0].charCodeAt(0) === 0xfeff) rows[0][0] = rows[0][0].slice(1);
  return rows;
}

// Celda ExcelJS → valor plano (usa el resultado cacheado de las fórmulas).
function cellValue(v) {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result);
    if (v.richText) return v.richText.map(t => t.text).join('');
    if ('text' in v) return v.text;
    return null;
  }
  return v;
}

// ════════════════════════════════════════════════════════════
// VENTAS — "Ventas 2026.xlsx"
//   Hoja "Ventas": una fila por ítem vendido. Columnas usadas:
//     C mes · E pedido (CASIO…) · O cantidad · S total sin IGV · V canal
//   Hoja "EERR": objetivos mensuales y ventas netas del año anterior.
// La suma de "TOTAL SIN IGV" por mes y canal coincide con las líneas
// "VENTAS NETAS …" del EERR, así que la hoja Ventas es la fuente única.
// ════════════════════════════════════════════════════════════
function mapChannel(value) {
  const ch = norm(value);
  if (!ch) return null;
  if (/^(whatsapp|instagram|facebook|rrss)$/.test(ch)) return 'RRSS';
  if (ch === 'web') return 'Web';
  if (ch === 'la mar') return 'La Mar';
  if (ch === 'el polo' || ch === 'polo') return 'El Polo';
  if (ch === 'falabella') return 'Falabella';
  return 'Otros';
}

const VENTAS_COLS = { month: 3, order: 5, qty: 15, net: 19, channel: 22 };

// Filas del EERR por etiqueta (columna B) → objetivo de cada canal.
const EERR_LINES = [
  { key: 'objetivoTotal', re: /^objetivo ventas netas$/ },
  { key: 'objetivo:Web', re: /^objetivo web$/ },
  { key: 'objetivo:RRSS', re: /^objetivo rrss$/ },
  { key: 'objetivo:La Mar', re: /^objetivo la mar$/ },
  { key: 'objetivo:El Polo', re: /^objetivo el polo$/ },
  { key: 'objetivo:Otros', re: /^objetivo otros$/ },
  { key: 'ventas2025', re: /^ventas netas 2025$/ },
];

function readEERR(ws) {
  const out = {};
  if (!ws) return out;
  ws.eachRow(row => {
    const label = norm(cellValue(row.getCell(2).value));
    const line = EERR_LINES.find(l => l.re.test(label));
    if (!line || out[line.key]) return;
    // Meses en columnas C..N (3..14)
    out[line.key] = MONTHS.map((_, i) => {
      const v = cellValue(row.getCell(3 + i).value);
      return v == null || v === '' ? null : round2(toNumber(v));
    });
  });
  return out;
}

function ventasFromWorkbook(wb) {
  const ws = wb.getWorksheet('Ventas') || wb.worksheets.find(w => norm(w.name) === 'ventas');
  if (!ws) throw new Error('No existe la hoja "Ventas" en el Excel');

  const acc = {};
  ws.eachRow((row, r) => {
    if (r === 1) return;
    const month = MONTHS.find(m => norm(m) === norm(cellValue(row.getCell(VENTAS_COLS.month).value)));
    const net = cellValue(row.getCell(VENTAS_COLS.net).value);
    const channel = mapChannel(cellValue(row.getCell(VENTAS_COLS.channel).value));
    if (!month || !channel || typeof net !== 'number') return;

    const m = acc[month] ||= { net: {}, orders: {}, units: 0 };
    m.net[channel] = (m.net[channel] || 0) + net;
    m.units += toNumber(cellValue(row.getCell(VENTAS_COLS.qty).value));
    const order = String(cellValue(row.getCell(VENTAS_COLS.order).value) ?? '').trim();
    if (order) (m.orders[channel] ||= new Set()).add(order);
  });

  const eerr = readEERR(wb.getWorksheet('EERR'));
  const months = MONTHS.map((name, i) => {
    const m = acc[name];
    const objetivo = {};
    CHANNELS.forEach(ch => {
      const v = eerr['objetivo:' + ch]?.[i];
      objetivo[ch] = v == null ? null : v;
    });
    const base = {
      name,
      objetivoTotal: eerr.objetivoTotal?.[i] ?? null,
      objetivo,
      ventas2025: eerr.ventas2025?.[i] ?? null,
    };
    if (!m) return { ...base, total: 0, net: Object.fromEntries(CHANNELS.map(c => [c, 0])), orders: 0, ordersByChannel: {}, units: 0 };
    const net = Object.fromEntries(CHANNELS.map(c => [c, round2(m.net[c] || 0)]));
    const ordersByChannel = Object.fromEntries(CHANNELS.map(c => [c, m.orders[c]?.size || 0]));
    return {
      ...base,
      total: round2(Object.values(net).reduce((s, v) => s + v, 0)),
      net,
      orders: Object.values(ordersByChannel).reduce((s, v) => s + v, 0),
      ordersByChannel,
      units: Math.round(m.units),
    };
  });

  const lastWithData = months.reduce((last, m, i) => (m.total > 0 ? i : last), -1);
  return { channels: CHANNELS, months: months.slice(0, Math.max(lastWithData + 1, 0)) };
}

// ════════════════════════════════════════════════════════════
// META ADS — exportación "Raw Data Report" de Ads Manager
//   Una fila por día × anuncio × edad × sexo. Se agrega por mes.
// ════════════════════════════════════════════════════════════
const META_COLS = {
  day: 'Día', ad: 'Nombre del anuncio', age: 'Edad', sex: 'Sexo',
  campaign: 'Nombre de la campaña', adset: 'Nombre del conjunto de anuncios',
  spend: 'Importe gastado (PEN)', impressions: 'Impresiones', clicks: 'Clics en el enlace',
  landing: 'Visitas a la página de destino del sitio web', engagement: 'Interacciones con la publicación',
  addToCart: 'Artículos agregados al carrito', checkouts: 'Pagos iniciados', purchases: 'Compras',
  value: 'Valor de conversión de compras', messages: 'Conversaciones con mensajes iniciadas',
  preview: 'Enlace de vista previa',
};
const META_METRICS = ['spend', 'impressions', 'clicks', 'landing', 'engagement', 'addToCart', 'checkouts', 'purchases', 'value', 'messages'];
const SEX_LABEL = { female: 'Mujeres', male: 'Hombres', unknown: 'Sin dato' };

const emptyMetrics = () => Object.fromEntries(META_METRICS.map(k => [k, 0]));
function addMetrics(target, src) { META_METRICS.forEach(k => { target[k] += src[k]; }); }
function roundMetrics(m) {
  const out = {};
  META_METRICS.forEach(k => { out[k] = k === 'spend' || k === 'value' ? round2(m[k]) : Math.round(m[k]); });
  return out;
}

function metaFromCsvFiles(files) {
  const byMonth = {};

  for (const file of files) {
    const rows = parseCSV(file.text);
    if (!rows.length) continue;
    const header = rows[0].map(h => h.trim());
    const idx = Object.fromEntries(Object.entries(META_COLS).map(([k, name]) => [k, header.indexOf(name)]));
    if (idx.day < 0 || idx.spend < 0) throw new Error(`"${file.name}" no parece una exportación de Meta Ads (faltan Día / Importe gastado)`);
    const get = (r, k) => (idx[k] >= 0 ? r[idx[k]] : '');

    for (const r of rows.slice(1)) {
      const day = String(get(r, 'day')).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const key = day.slice(0, 7);
      const metrics = emptyMetrics();
      META_METRICS.forEach(k => { metrics[k] = toNumber(get(r, k)); });

      const m = byMonth[key] ||= {
        files: new Set(), totals: emptyMetrics(), days: {}, campaigns: {}, ads: {}, age: {}, sex: {},
      };
      m.files.add(file.name);
      addMetrics(m.totals, metrics);

      const d = m.days[day] ||= emptyMetrics();
      addMetrics(d, metrics);

      const campaign = String(get(r, 'campaign')).trim() || '(sin campaña)';
      addMetrics(m.campaigns[campaign] ||= emptyMetrics(), metrics);

      const adName = String(get(r, 'ad')).trim() || '(sin nombre)';
      const adKey = adName + '\u0000' + campaign;
      const ad = m.ads[adKey] ||= { name: adName, campaign, preview: '', ...emptyMetrics() };
      addMetrics(ad, metrics);
      if (!ad.preview && get(r, 'preview')) ad.preview = String(get(r, 'preview')).trim();

      const age = String(get(r, 'age')).trim();
      addMetrics(m.age[!age || norm(age) === 'unknown' ? 'Sin dato' : age] ||= emptyMetrics(), metrics);
      const sex = SEX_LABEL[norm(get(r, 'sex'))] || 'Sin dato';
      addMetrics(m.sex[sex] ||= emptyMetrics(), metrics);
    }
  }

  const months = Object.keys(byMonth).sort().map(key => {
    const m = byMonth[key];
    const [y, mm] = key.split('-').map(Number);
    const dayKeys = Object.keys(m.days).sort();
    const list = obj => Object.entries(obj).map(([name, v]) => ({ name, ...roundMetrics(v) }));
    return {
      key,
      label: `${MONTHS[mm - 1]} ${y}`,
      desde: dayKeys[0],
      hasta: dayKeys[dayKeys.length - 1],
      archivos: [...m.files],
      totals: roundMetrics(m.totals),
      daily: dayKeys.map(d => ({ d, ...roundMetrics(m.days[d]) })),
      campaigns: list(m.campaigns).filter(c => c.spend > 0 || c.purchases > 0).sort((a, b) => b.spend - a.spend),
      ads: Object.values(m.ads)
        .map(a => ({ name: a.name, campaign: a.campaign, preview: a.preview, ...roundMetrics(a) }))
        .filter(a => a.spend > 0 || a.purchases > 0)
        .sort((a, b) => b.purchases - a.purchases || b.value - a.value || b.spend - a.spend)
        .slice(0, 12),
      age: list(m.age).sort((a, b) => a.name.localeCompare(b.name)),
      sex: list(m.sex).sort((a, b) => b.spend - a.spend),
    };
  });

  return { months };
}

// ════════════════════════════════════════════════════════════
// GOOGLE ADS — exportación de informes (CSV / hoja de cálculo)
//   Formato no fijo: se busca la fila de encabezados y se mapean las
//   columnas por nombre (es/en). Se agrega por mes y por campaña.
// ════════════════════════════════════════════════════════════
const GOOGLE_COLS = {
  day: /^(dia|día|day|fecha|date)$/,
  month: /^(mes|month)$/,
  campaign: /^(campana|campaña|campaign)$/,
  spend: /^(costo|coste|cost)$/,
  impressions: /^(impr\.?|impresiones|impressions)$/,
  clicks: /^(clics|clicks)$/,
  conversions: /^(conversiones|conversions|compras|purchases)$/,
  value: /^(valor de conv\.?|valor de conversion|valor conv\.?|conv\. value|conversion value|all conv\. value)$/,
};
const GOOGLE_METRICS = ['spend', 'impressions', 'clicks', 'conversions', 'value'];
const SPANISH_MONTH = MONTHS.map(norm);

function monthKeyFrom(value, fallbackYear) {
  if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  const s = String(value ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // dd/mm/aaaa
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}`;
  const n = norm(s);
  const i = SPANISH_MONTH.findIndex(x => n.includes(x));
  if (i >= 0) return `${(n.match(/\d{4}/) || [fallbackYear])[0]}-${String(i + 1).padStart(2, '0')}`;
  return null;
}

function googleFromTables(tables, { year = new Date().getFullYear() } = {}) {
  const byMonth = {};
  for (const t of tables) {
    const headerRow = t.rows.findIndex(r => r.some(c => GOOGLE_COLS.spend.test(norm(c))));
    if (headerRow < 0) throw new Error(`"${t.name}" no tiene columna de costo reconocible`);
    const header = t.rows[headerRow].map(norm);
    const idx = Object.fromEntries(Object.entries(GOOGLE_COLS).map(([k, re]) => [k, header.findIndex(h => re.test(h))]));
    const fileMonth = monthKeyFrom(t.name, year);

    for (const r of t.rows.slice(headerRow + 1)) {
      const campaign = idx.campaign >= 0 ? String(r[idx.campaign] ?? '').trim() : '(total)';
      if (/^(total|totales)/i.test(campaign)) continue; // filas de totales del informe
      const key = (idx.day >= 0 && monthKeyFrom(r[idx.day], year))
        || (idx.month >= 0 && monthKeyFrom(r[idx.month], year))
        || fileMonth;
      if (!key) continue;
      const metrics = Object.fromEntries(GOOGLE_METRICS.map(k => [k, idx[k] >= 0 ? toNumber(r[idx[k]]) : 0]));
      if (!GOOGLE_METRICS.some(k => metrics[k])) continue;
      const m = byMonth[key] ||= { files: new Set(), totals: Object.fromEntries(GOOGLE_METRICS.map(k => [k, 0])), campaigns: {} };
      m.files.add(t.name);
      const c = m.campaigns[campaign || '(sin campaña)'] ||= Object.fromEntries(GOOGLE_METRICS.map(k => [k, 0]));
      GOOGLE_METRICS.forEach(k => { m.totals[k] += metrics[k]; c[k] += metrics[k]; });
    }
  }
  const r = m => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, k === 'spend' || k === 'value' ? round2(v) : round2(v)]));
  return {
    months: Object.keys(byMonth).sort().map(key => {
      const [y, mm] = key.split('-').map(Number);
      const m = byMonth[key];
      return {
        key, label: `${MONTHS[mm - 1]} ${y}`, archivos: [...m.files], totals: r(m.totals),
        campaigns: Object.entries(m.campaigns).map(([name, v]) => ({ name, ...r(v) })).sort((a, b) => b.spend - a.spend),
      };
    }),
  };
}

module.exports = {
  MONTHS, CHANNELS, parseCSV, cellValue, toNumber, mapChannel,
  ventasFromWorkbook, metaFromCsvFiles, googleFromTables,
};
