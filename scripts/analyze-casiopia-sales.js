const fs = require('fs');

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('Usage: node scripts/analyze-casiopia-sales.js <ventas-csv> [--js-out=<path>]');
  process.exit(1);
}
const jsOutArg = process.argv.find(arg => arg.startsWith('--js-out='));
const jsOutPath = jsOutArg ? jsOutArg.slice('--js-out='.length) : null;

const text = fs.readFileSync(sourcePath, 'utf8');

function parseCSV(input) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      // skip
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toNumber(value) {
  if (value == null) return 0;
  const raw = String(value).replace(/\u00a0/g, ' ').trim();
  if (!raw || raw === '#DIV/0!') return 0;
  const cleaned = raw
    .replace(/S\/\.?/gi, '')
    .replace(/,/g, '')
    .replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function mapChannel(value) {
  const ch = String(value || '').trim();
  if (!ch) return '';
  if (/^(whatsapp|instagram|facebook|rrss)$/i.test(ch)) return 'RRSS';
  if (/^web$/i.test(ch)) return 'Web';
  if (/^la mar$/i.test(ch)) return 'La Mar';
  if (/^el polo$/i.test(ch)) return 'El Polo';
  if (/^falabella$/i.test(ch)) return 'Falabella';
  return 'Otros';
}

function parseDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

const rows = parseCSV(text).slice(1);
let lastDate = '';
let lastMonth = '';
let lastChannel = '';
const monthly = {};
const weekly = {};
const channels = new Set();
const chToUpper = {
  Web: 'WEB',
  RRSS: 'RRSS',
  'La Mar': 'LA_MAR',
  'El Polo': 'EL_POLO',
  Falabella: 'FALABELLA',
  Otros: 'OTROS',
};

for (const row of rows) {
  if (row[3]) lastDate = row[3];
  if (row[2]) lastMonth = row[2];
  if (row[21]) lastChannel = row[21];
  const channel = mapChannel(row[21] || lastChannel);
  const month = row[2] || lastMonth;
  const amount = toNumber(row[18]);
  if (!month || !channel || amount === 0) continue;
  const date = parseDate(lastDate);
  const day = date && Number.isFinite(date.getTime()) ? date.getDate() : null;
  const week = day ? Math.ceil(day / 7) : null;
  channels.add(channel);
  monthly[month] ||= {};
  monthly[month][channel] = Math.round(((monthly[month][channel] || 0) + amount) * 100) / 100;
  if (week) {
    weekly[month] ||= [];
    let weekRow = weekly[month].find(w => w.w === week);
    if (!weekRow) {
      weekRow = { w: week, TOTAL: 0 };
      Object.values(chToUpper).forEach(key => { weekRow[key] = 0; });
      weekly[month].push(weekRow);
    }
    const key = chToUpper[channel];
    weekRow[key] = Math.round((weekRow[key] + amount) * 100) / 100;
    weekRow.TOTAL = Math.round((weekRow.TOTAL + amount) * 100) / 100;
  }
}

const monthDays = {
  Enero: 31, Febrero: 28, Marzo: 31, Abril: 30,
  Mayo: 31, Junio: 30, Julio: 31, Agosto: 31,
  Septiembre: 30, Octubre: 31, Noviembre: 30, Diciembre: 31,
};

Object.entries(monthDays).forEach(([month, days]) => {
  const weekCount = Math.ceil(days / 7);
  weekly[month] ||= [];
  for (let w = 1; w <= weekCount; w++) {
    if (!weekly[month].some(row => row.w === w)) {
      const weekRow = { w, TOTAL: 0 };
      Object.values(chToUpper).forEach(key => { weekRow[key] = 0; });
      weekly[month].push(weekRow);
    }
  }
  weekly[month].sort((a, b) => a.w - b.w);
});

const output = { channels: [...channels], monthly, weekly };

if (jsOutPath) {
  const js = `/* Generated from Ventas 2026.xlsx - Ventas.csv. */\n` +
    `(function (global) {\n` +
    `  global.CasiopiaWeeklyData = ${JSON.stringify(weekly, null, 2)};\n` +
    `})(window);\n`;
  fs.writeFileSync(jsOutPath, js, 'utf8');
  console.log(`[casiopia-sales] wrote ${jsOutPath}`);
} else {
  console.log(JSON.stringify(output, null, 2));
}
