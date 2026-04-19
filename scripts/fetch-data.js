#!/usr/bin/env node
/**
 * Lee el Google Sheet "TASA DE VENTAS DIARIAS 2026" y genera data/ventas-2026.json
 * con totales mensuales, datos semanales y transacciones por canal.
 *
 * Modos:
 *   node scripts/fetch-data.js                   → lee desde Google Sheets API
 *   node scripts/fetch-data.js --csv-dir=<path>  → lee CSVs locales (dev / bootstrap)
 */

const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '1WQhZyWVWq7cnLybU-LfXRBVg8B66jbNNPqfcYD_assM';
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials', 'service-account.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'ventas-2026.json');

const MONTHS = [
  { sheet: 'ENERO',   name: 'Enero',   monthIndex: 0, days: 31 },
  { sheet: 'FEBRERO', name: 'Febrero', monthIndex: 1, days: 28 },
  { sheet: 'MARZO',   name: 'Marzo',   monthIndex: 2, days: 31 },
  { sheet: 'ABRIL',   name: 'Abril',   monthIndex: 3, days: 30 },
];
const YEAR = 2026;

// Columnas del sheet (0-indexed dentro del rango A:I):
// 0=FECHA, 1=CANT/MONTO, 2=WHATSAPP, 3=INSTAGRAM, 4=FACEBOOK, 5=SHOWROOM, 6=WEB, 7=TIENDA, 8=TOTAL
const CHANNEL_COLS = [
  { col: 2, upper: 'WHATSAPP',  title: 'WhatsApp'  },
  { col: 3, upper: 'INSTAGRAM', title: 'Instagram' },
  { col: 4, upper: 'FACEBOOK',  title: 'Facebook'  },
  { col: 5, upper: 'SHOWROOM',  title: 'Showroom'  },
  { col: 6, upper: 'WEB',       title: 'Web'       },
  { col: 7, upper: 'TIENDA',    title: 'Tienda'    },
];

function toNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (s === '' || s === '-') return 0;
  const cleaned = s
    .replace(/S\/\.?/gi, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
    .replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Agrupa días del mes en semanas calendario (Lun–Dom, clipadas al mes).
 * Día 1 arranca en W1; cada lunes subsecuente incrementa el número de semana.
 * Replica la estructura de weeklyData original del dashboard.
 */
function buildWeekMap(year, monthIndex, daysInMonth) {
  const dayToWeek = new Array(daysInMonth + 1);
  let weekNum = 1;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, monthIndex, d).getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
    if (d > 1 && dow === 1) weekNum++;
    dayToWeek[d] = weekNum;
  }
  return dayToWeek;
}

function parseSheet(rows, monthConfig) {
  const totals = {};
  const transactions = {};
  CHANNEL_COLS.forEach(c => { totals[c.title] = 0; transactions[c.upper] = 0; });

  const dayToWeek = buildWeekMap(YEAR, monthConfig.monthIndex, monthConfig.days);
  const weekCount = dayToWeek[monthConfig.days];

  const weeklyTotals = [];
  for (let w = 1; w <= weekCount; w++) {
    const row = { w, TOTAL: 0 };
    CHANNEL_COLS.forEach(c => { row[c.upper] = 0; });
    weeklyTotals.push(row);
  }

  let dayCounter = 0;
  let pendingCantidad = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const label = String(row[1] || '').trim().toUpperCase();
    if (label === 'CANTIDAD') {
      pendingCantidad = row;
    } else if (label === 'MONTO' && pendingCantidad) {
      dayCounter++;
      if (dayCounter > monthConfig.days) break;
      const w = dayToWeek[dayCounter];
      const weekRow = weeklyTotals[w - 1];

      for (const c of CHANNEL_COLS) {
        const qty = toNumber(pendingCantidad[c.col]);
        const amount = toNumber(row[c.col]);
        transactions[c.upper] += qty;
        totals[c.title] += amount;
        weekRow[c.upper] += amount;
        weekRow.TOTAL += amount;
      }
      pendingCantidad = null;
    }
  }

  CHANNEL_COLS.forEach(c => { totals[c.title] = round2(totals[c.title]); });
  weeklyTotals.forEach(wr => {
    wr.TOTAL = round2(wr.TOTAL);
    CHANNEL_COLS.forEach(c => { wr[c.upper] = round2(wr[c.upper]); });
  });

  return { totals, transactions, weeklyTotals };
}

// --- CSV parser (mínimo, maneja campos entrecomillados) ---
function parseCSVText(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

async function loadRowsFromApi(monthConfig) {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`No existe ${CREDENTIALS_PATH}. Colocá la service account JSON ahí.`);
  }
  const { google } = require('googleapis');
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${monthConfig.sheet}!A1:I100`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  return res.data.values || [];
}

function loadRowsFromCsv(monthConfig, csvDir) {
  // Busca archivos del formato canónico "TASA DE VENTAS DIARIAS 2026 - <MES>*.csv"
  // excluyendo copias ("Copia de ...") y sheets de años anteriores.
  const candidates = fs.readdirSync(csvDir).filter(f => {
    const up = f.toUpperCase();
    if (!up.endsWith('.CSV')) return false;
    if (!up.startsWith('TASA DE VENTAS DIARIAS 2026')) return false;
    return up.includes(monthConfig.sheet);
  });
  if (candidates.length === 0) {
    throw new Error(`No se encontró CSV para ${monthConfig.sheet} en ${csvDir}`);
  }
  const filePath = path.join(csvDir, candidates[0]);
  const text = fs.readFileSync(filePath, 'utf8');
  return parseCSVText(text);
}

function parseArgs(argv) {
  const args = { csvDir: null };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--csv-dir=')) args.csvDir = a.substring('--csv-dir='.length);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const source = args.csvDir ? `CSV (${args.csvDir})` : 'Google Sheets API';
  console.log(`[fetch] fuente: ${source}`);

  const d2026 = {};
  const weeklyData = {};
  const transactions = {};

  for (const m of MONTHS) {
    console.log(`[fetch] leyendo "${m.sheet}"...`);
    let rows;
    try {
      rows = args.csvDir
        ? loadRowsFromCsv(m, args.csvDir)
        : await loadRowsFromApi(m);
    } catch (err) {
      console.error(`  ! ${m.sheet}: ${err.message}`);
      d2026[m.name] = Object.fromEntries(CHANNEL_COLS.map(c => [c.title, 0]));
      transactions[m.name] = Object.fromEntries(CHANNEL_COLS.map(c => [c.upper, 0]));
      weeklyData[m.name] = [];
      continue;
    }

    const parsed = parseSheet(rows, m);
    d2026[m.name] = parsed.totals;
    transactions[m.name] = parsed.transactions;
    weeklyData[m.name] = parsed.weeklyTotals;

    const monthTotal = round2(Object.values(parsed.totals).reduce((a, b) => a + b, 0));
    console.log(`  ${m.name}: S/. ${monthTotal.toLocaleString('es-PE')} · ${parsed.weeklyTotals.length} semanas`);
  }

  // Timestamp en hora Lima (UTC-5), sin sufijo de zona, al estilo del ejemplo del spec
  const nowUtc = new Date();
  const lima = new Date(nowUtc.getTime() - 5 * 60 * 60 * 1000);
  const generated = lima.toISOString().replace(/\.\d{3}Z$/, '');

  const output = { generated, d2026, weeklyData, transactions };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`[fetch] escrito ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
