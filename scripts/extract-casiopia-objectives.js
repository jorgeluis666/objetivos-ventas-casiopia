const fs = require('fs');

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('Usage: node scripts/extract-casiopia-objectives.js <csv-path>');
  process.exit(1);
}

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

const rows = parseCSV(text);
const months = [
  'Enero', 'Febrero', 'Marzo', 'Abril',
  'Mayo', 'Junio', 'Julio', 'Agosto',
  'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function findExact(label) {
  const wanted = label.trim().toLowerCase();
  return rows.find(row => row.some(cell => String(cell).trim().toLowerCase() === wanted));
}

function findColumnValue(colIndex, label) {
  const wanted = label.trim().toUpperCase();
  return rows.find(row => String(row[colIndex] || '').trim().toUpperCase() === wanted);
}

function monthlyValues(row, offset = 2) {
  return months.map((_, i) => toNumber(row?.[i + offset]));
}

const totalObjective = monthlyValues(findExact('OBJETIVO VENTAS NETAS'));
const webObjective = monthlyValues(findExact('objetivo web'));
const rrssObjective = monthlyValues(findExact('objetivo RRSS'));
const laMarObjective = monthlyValues(findExact('objetivo La Mar'));

const actualSource = {
  Web: monthlyValues(findExact('VENTAS NETAS WEB')),
  RRSS: monthlyValues(findExact('VENTAS NETAS RRSS')),
  'La Mar': monthlyValues(findExact('VENTAS NETAS LA MAR')),
  'El Polo': monthlyValues(findColumnValue(3, 'EL POLO'), 5),
  Falabella: monthlyValues(findColumnValue(3, 'FALABELLA'), 5),
  Otros: monthlyValues(findColumnValue(3, 'OTROS'), 5),
};

const targets = {};
const actuals = {};

months.forEach((month, i) => {
  const web = webObjective[i] || 0;
  const rrss = rrssObjective[i] || 0;
  const laMar = laMarObjective[i] || 0;
  targets[month] = {
    Web: web,
    RRSS: rrss,
    'La Mar': laMar,
    'El Polo': Math.max(0, (totalObjective[i] || 0) - web - rrss - laMar),
    Falabella: 0,
    Otros: 0,
  };
  actuals[month] = Object.fromEntries(
    Object.entries(actualSource).map(([channel, values]) => [channel, values[i] || 0])
  );
});

console.log(JSON.stringify({ targets, actuals }, null, 2));
