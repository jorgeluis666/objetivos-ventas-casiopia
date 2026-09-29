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
// VENTAS — "Ventas 2026 Dashboard.xlsx"
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
// GOOGLE ADS — informe de campañas exportado desde Google Ads
//   Fila 1 título · fila 2 rango ("1 de abril de 2026 - 30 de abril de 2026")
//   · fila 3 encabezados. Números con coma decimal ("1899,26").
//   Filas "Total: Cuenta" / "Total: <tipo>" traen costo, impresiones y clics;
//   las filas campaña × acción de conversión traen conversiones y valor
//   (sin costo). "Conversiones" mezcla pagos iniciados y compras, así que
//   se separan por el nombre de la acción.
// ════════════════════════════════════════════════════════════
const MONTH_NAMES_ES = [
  ['enero'], ['febrero'], ['marzo'], ['abril'], ['mayo'], ['junio'], ['julio'],
  ['agosto'], ['septiembre', 'setiembre'], ['octubre'], ['noviembre'], ['diciembre'],
];

// Número de Google Ads en español: "1.899,26" / "1899,26" / "--"
function toNumberEs(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value).trim();
  if (!s || s === '--') return 0;
  const n = parseFloat(s.replace(/[^\d,.\-]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

// "1 de abril de 2026" → { key: '2026-04', iso: '2026-04-01' }
function parseEsDate(text) {
  const m = norm(text).match(/(\d{1,2}) de ([a-z]+) de (\d{4})/);
  if (!m) return null;
  const mi = MONTH_NAMES_ES.findIndex(names => names.includes(m[2]));
  if (mi < 0) return null;
  const mm = String(mi + 1).padStart(2, '0');
  return { key: `${m[3]}-${mm}`, iso: `${m[3]}-${mm}-${m[1].padStart(2, '0')}` };
}
const monthInTitle = title => {
  const t = norm(title);
  const mi = MONTH_NAMES_ES.findIndex(names => names.some(n => t.includes(n)));
  return mi < 0 ? null : mi;
};

const GOOGLE_COLS = {
  action: 'accion de conversion', campaign: 'campana', type: 'tipo de campana',
  spend: 'costo', impressions: 'impr.', clicks: 'clics',
  conversions: 'conversiones', value: 'valor de conv.',
};

function googleFromTables(tables) {
  const byMonth = {};
  const avisos = [];

  for (const t of tables) {
    const headerRow = t.rows.findIndex(r => r.some(c => norm(c) === 'costo') && r.some(c => norm(c) === 'campana'));
    if (headerRow < 0) throw new Error(`"${t.name}" no parece un informe de campañas de Google Ads (faltan Campaña / Costo)`);
    const header = t.rows[headerRow].map(norm);
    const idx = Object.fromEntries(Object.entries(GOOGLE_COLS).map(([k, name]) => [k, header.indexOf(name)]));
    const cell = (r, k) => (idx[k] >= 0 ? r[idx[k]] : '');

    // Rango de fechas: primera celda anterior al encabezado con "d de mes de aaaa - …"
    const rangeText = t.rows.slice(0, headerRow).map(r => String(r[0] || '')).find(c => / - /.test(c) && parseEsDate(c));
    const [from, to] = rangeText ? rangeText.split(' - ').map(parseEsDate) : [];
    if (!from) { avisos.push(`"${t.name}": no se encontró el rango de fechas del informe; se omitió.`); continue; }

    const titleMonth = monthInTitle(t.name);
    if (titleMonth != null && titleMonth !== +from.key.slice(5) - 1) {
      avisos.push(`"${t.name}" contiene datos del ${rangeText.trim()}, no del mes de su nombre.`);
    }
    if (byMonth[from.key]) {
      // Dos archivos con el mismo rango: se queda el que coincide con su nombre
      const keepNew = titleMonth === +from.key.slice(5) - 1;
      avisos.push(`"${t.name}" y "${byMonth[from.key].archivo}" cubren el mismo periodo; se usa "${keepNew ? t.name : byMonth[from.key].archivo}".`);
      if (!keepNew) continue;
    }

    const m = byMonth[from.key] = {
      archivo: t.name, desde: from.iso, hasta: to?.iso || null,
      totals: { spend: 0, impressions: 0, clicks: 0, conversions: 0, value: 0, purchases: 0, purchaseValue: 0, checkouts: 0 },
      types: [], campaigns: {},
    };

    for (const r of t.rows.slice(headerRow + 1)) {
      const action = String(cell(r, 'action') || '').trim();
      const hasAction = action && action !== '--';
      const campaign = String(cell(r, 'campaign') || '').trim();
      const conv = toNumberEs(cell(r, 'conversions'));
      const value = toNumberEs(cell(r, 'value'));
      const kind = /purchase|compra/i.test(action) ? 'purchase' : /checkout|pago/i.test(action) ? 'checkout' : 'other';

      // Filas de totales: "Total: Cuenta", "Total: <tipo de campaña>", "Total: Campañas filtradas".
      // Sin acción = total real (costo, impresiones, clics); con acción = desglose por acción.
      const label = r.map(c => String(c ?? '').trim()).find(c => /^total:/i.test(c));
      if (label) {
        const name = label.replace(/^total:\s*/i, '');
        if (/filtrad/i.test(name)) continue;
        const isAccount = norm(name) === 'cuenta';
        if (!hasAction) {
          const row = {
            spend: toNumberEs(cell(r, 'spend')), impressions: toNumberEs(cell(r, 'impressions')),
            clicks: toNumberEs(cell(r, 'clicks')), conversions: conv, value,
          };
          if (isAccount) Object.assign(m.totals, row);
          else if (row.spend || row.impressions) m.types.push({ name, ...row });
        } else if (isAccount) {
          if (kind === 'purchase') { m.totals.purchases += conv; m.totals.purchaseValue += value; }
          if (kind === 'checkout') m.totals.checkouts += conv;
        }
        continue;
      }
      if (!conv && !value) continue;
      if (!campaign || campaign === '--' || !hasAction) continue;
      const c = m.campaigns[campaign] ||= { name: campaign, type: String(cell(r, 'type') || '').trim(), purchases: 0, purchaseValue: 0, checkouts: 0, conversions: 0, value: 0 };
      c.conversions += conv; c.value += value;
      if (kind === 'purchase') { c.purchases += conv; c.purchaseValue += value; }
      if (kind === 'checkout') c.checkouts += conv;
    }
  }

  const r2 = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? round2(v) : v]));
  return {
    avisos,
    months: Object.keys(byMonth).sort().map(key => {
      const m = byMonth[key];
      const [y, mm] = key.split('-').map(Number);
      return {
        key, label: `${MONTHS[mm - 1]} ${y}`, archivos: [m.archivo], desde: m.desde, hasta: m.hasta,
        totals: r2(m.totals),
        types: m.types.map(r2).sort((a, b) => b.spend - a.spend),
        campaigns: Object.values(m.campaigns).map(r2).sort((a, b) => b.purchaseValue - a.purchaseValue || b.conversions - a.conversions),
      };
    }),
  };
}

module.exports = {
  MONTHS, CHANNELS, parseCSV, cellValue, toNumber, mapChannel,
  ventasFromWorkbook, metaFromCsvFiles, googleFromTables,
};
