#!/usr/bin/env node
/**
 * fetch-casiopia.js — sincroniza las fuentes de Drive del dashboard:
 *
 *   Ventas      Excel "Ventas 2026 Dashboard.xlsx" (Objetivos)  → data/casiopia-ventas.json
 *               (venta neta por mes, canal y semana, pedidos, objetivos del
 *               EERR y referencia 2025)
 *   Meta Ads    carpeta "Meta Files - Casiopia" (pauta)         → data/casiopia-meta.json
 *   Google Ads  carpeta "Google Files - Casiopia" (pauta)       → data/casiopia-google.json
 *   Reportes    carpeta "Reportes Casiopia" + archivos sueltos  → data/casiopia-reportes.json
 *               (índice del Archivo de Reportes: nombre, tipo, fecha y peso;
 *               no se copia el contenido de los archivos)
 *
 * Sin credenciales: las carpetas están compartidas como
 * "cualquier persona con el enlace", así que se leen por sus enlaces
 * públicos de Google Drive (descarga directa, exportación CSV de Sheets y
 * la vista embebida de la carpeta para listar su contenido).
 *
 * Modos:
 *   node scripts/fetch-casiopia.js                 → enlaces públicos de Drive
 *   node scripts/fetch-casiopia.js --local=<dir>   → <dir>/ventas-2026.xlsx, <dir>/meta/*.csv,
 *                                                    <dir>/google/*.{csv,xlsx} (Reportes no tiene modo local)
 *
 * Cada fuente es independiente: si una falla, se conserva su JSON anterior,
 * se avisa en consola y el resto se actualiza igual.
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const src = require('./lib/casiopia-sources');

const ROOT = path.join(__dirname, '..');

const VENTAS_FILE_ID = '1u1tWfos-R5MbN7z72i1X6_BSkzh3L_nF';   // "Ventas 2026 Dashboard.xlsx"

const SOURCES = {
  ventas: { fileId: VENTAS_FILE_ID, out: 'data/casiopia-ventas.json' },
  meta:   { folderId: '166vtDwzl4YbqLnyqNpulZI2YltKb2FMm', out: 'data/casiopia-meta.json' },
  google: { folderId: '1oN2HxlqXENM0KuAIOM_rtb17zJPCCAhO', out: 'data/casiopia-google.json' },
  reportes: {
    folderId: '15Juqtuk1r8QVYiaaxySMLC0biSBcPlaJ',
    out: 'data/casiopia-reportes.json',
    // Archivos subidos (xlsx, pdf…) fuera de la carpeta que también lista el
    // Archivo de Reportes: "Ventas 2026 Dashboard.xlsx".
    extra: [VENTAS_FILE_ID],
  },
};

const MIME = {
  sheet:  'application/vnd.google-apps.spreadsheet',
  slides: 'application/vnd.google-apps.presentation',
  doc:    'application/vnd.google-apps.document',
  xlsx:   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv:    'text/csv',
  pdf:    'application/pdf',
};

// Tipo que entiende el módulo Archivo (define las URLs de vista y descarga).
function kindOf(mimeType, name = '') {
  if (mimeType === MIME.slides) return 'slides';
  if (mimeType === MIME.sheet) return 'sheet';
  if (mimeType === MIME.doc) return 'doc';
  if (mimeType === MIME.pdf || /\.pdf$/i.test(name)) return 'pdf';
  if (mimeType === MIME.xlsx || /\.xlsx?$/i.test(name)) return 'xlsx';
  return 'file';
}

const localArg = process.argv.find(a => a.startsWith('--local='));
const LOCAL_DIR = localArg ? path.resolve(localArg.slice('--local='.length)) : null;

// ── Google Drive por enlaces públicos ──
const NOT_PUBLIC = 'no es accesible con el enlace: compártelo como "Cualquier persona con el enlace · Lector"';

async function get(url, headers = {}) {
  const res = await fetch(url, { redirect: 'follow', headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res;
}

const decodeHtml = s => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .trim();

// Lista una carpeta pública con la vista embebida de Drive (sin API).
// Cada entrada trae id, título, ícono con el MIME type y fecha de modificación
// (en inglés por el Accept-Language: "5:30 PM", "Jul 20" o "11/17/25").
async function listFolder(folderId) {
  const url = `https://drive.google.com/embeddedfolderview?id=${folderId}`;
  const html = await (await get(url, { 'Accept-Language': 'en-US' })).text();
  if (!html.includes('flip-entries')) throw new Error(`la carpeta ${folderId} ${NOT_PUBLIC}`);
  const files = [];
  const re = /<div class="flip-entry" id="entry-([^"]+)"[\s\S]*?\/type\/([^"]+)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>(?:<\/a><\/div><div class="flip-entry-last-modified"><div>([^<]*)<\/div>)?/g;
  let m;
  while ((m = re.exec(html))) {
    files.push({ id: m[1], mimeType: decodeHtml(m[2]), name: decodeHtml(m[3]), modified: driveDate(decodeHtml(m[4] || '')) });
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

// Fecha de la vista embebida → 'YYYY-MM-DD' (hora de Lima), o null.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function driveDate(text) {
  const today = nowLima().slice(0, 10);
  const pad = n => String(n).padStart(2, '0');
  if (/^\d{1,2}:\d{2}\s*[AP]M$/i.test(text)) return today;
  let m = text.match(/^([A-Z][a-z]{2}) (\d{1,2})$/);
  if (m && MON.includes(m[1])) {
    // Sin año = año en curso (o el anterior si la fecha quedaría en el futuro)
    let y = +today.slice(0, 4);
    const md = `${pad(MON.indexOf(m[1]) + 1)}-${pad(m[2])}`;
    if (`${y}-${md}` > today) y--;
    return `${y}-${md}`;
  }
  m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) return `20${m[3]}-${pad(m[1])}-${pad(m[2])}`;
  return null;
}

// Nombre y peso de un archivo subido sin descargarlo entero: pide 1 byte y
// lee Content-Disposition y Content-Range. (El Last-Modified de esta
// respuesta no es la fecha de edición, así que no se usa.)
async function fileMeta(fileId) {
  const url = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
  const res = await get(url, { Range: 'bytes=0-0' });
  if (/text\/html/.test(res.headers.get('content-type') || '')) throw new Error(`el archivo ${fileId} ${NOT_PUBLIC}`);
  await res.arrayBuffer();
  const name = ((res.headers.get('content-disposition') || '').match(/filename="([^"]+)"/) || [])[1] || null;
  const size = +((res.headers.get('content-range') || '').split('/')[1] || res.headers.get('content-length')) || null;
  return { name, size };
}

// Descarga directa de un archivo subido (xlsx, csv…). confirm=t evita la
// pantalla de "no se puede analizar en busca de virus" en archivos grandes.
async function downloadBuffer(fileId) {
  const res = await get(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`);
  if (/text\/html/.test(res.headers.get('content-type') || '')) throw new Error(`el archivo ${fileId} ${NOT_PUBLIC}`);
  const disposition = res.headers.get('content-disposition') || '';
  const name = (disposition.match(/filename\*=UTF-8''([^;]+)/i) || [])[1];
  return { buf: Buffer.from(await res.arrayBuffer()), name: name ? decodeURIComponent(name) : null };
}

// Google Sheets → CSV de su primera hoja.
async function exportCsv(fileId) {
  const res = await get(`https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`);
  if (!/text\/csv/.test(res.headers.get('content-type') || '')) throw new Error(`la hoja ${fileId} ${NOT_PUBLIC}`);
  return res.text();
}

async function workbookFromBuffer(buf) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

// Primera hoja de un xlsx como matriz de valores planos.
function firstSheetRows(wb) {
  const ws = wb.worksheets[0];
  const rows = [];
  ws?.eachRow({ includeEmpty: false }, row => {
    const vals = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => { vals[col - 1] = src.cellValue(cell.value); });
    rows.push(vals);
  });
  return rows;
}

const driveUrl = f => f.mimeType === MIME.sheet
  ? `https://docs.google.com/spreadsheets/d/${f.id}/edit`
  : `https://drive.google.com/file/d/${f.id}/view`;
const folderUrl = id => `https://drive.google.com/drive/folders/${id}`;

// ── Fuentes ──
async function syncVentas() {
  const { fileId } = SOURCES.ventas;
  const wb = new ExcelJS.Workbook();
  let name = 'Ventas 2026 Dashboard.xlsx';
  if (LOCAL_DIR) await wb.xlsx.readFile(path.join(LOCAL_DIR, 'ventas-2026.xlsx'));
  else {
    const file = await downloadBuffer(fileId);
    name = file.name || name;
    await wb.xlsx.load(file.buf);
  }
  const data = src.ventasFromWorkbook(wb);
  const skipped = Object.entries(data.ignored);
  if (skipped.length) {
    console.log(`::warning::[casiopia] ventas: canales no reconocidos, fuera del total: ${skipped.map(([k, v]) => `${k} (S/ ${v})`).join(', ')}`);
  }
  console.log(`[casiopia] ventas: ${name}`);
  return { source: { name, url: `https://docs.google.com/spreadsheets/d/${fileId}/edit` }, ...data };
}

async function syncMeta() {
  const folder = { id: SOURCES.meta.folderId, url: folderUrl(SOURCES.meta.folderId) };
  if (LOCAL_DIR) {
    const dir = path.join(LOCAL_DIR, 'meta');
    const names = fs.readdirSync(dir).filter(f => f.endsWith('.csv')).sort();
    // Sin extensión, igual que el título del Google Sheet en Drive
    const title = name => name.replace(/\.csv$/i, '');
    const files = names.map(name => ({ name: title(name), text: fs.readFileSync(path.join(dir, name), 'utf8') }));
    return { folder, files: names.map(name => ({ name: title(name) })), ...src.metaFromCsvFiles(files) };
  }
  const listed = (await listFolder(folder.id)).filter(f => f.mimeType === MIME.sheet || f.mimeType === MIME.csv);
  const files = [];
  for (const f of listed) {
    const text = f.mimeType === MIME.sheet ? await exportCsv(f.id) : (await downloadBuffer(f.id)).buf.toString('utf8');
    files.push({ name: f.name, text });
    console.log(`[casiopia] meta: ${f.name}`);
  }
  return {
    folder,
    files: listed.map(f => ({ name: f.name, url: driveUrl(f) })),
    ...src.metaFromCsvFiles(files),
  };
}

async function syncGoogle() {
  const folder = { id: SOURCES.google.folderId, url: folderUrl(SOURCES.google.folderId) };
  const tables = [];
  let listed = [];
  if (LOCAL_DIR) {
    const dir = path.join(LOCAL_DIR, 'google');
    const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.(csv|xlsx)$/i.test(f)).sort() : [];
    for (const name of names) {
      const file = path.join(dir, name);
      if (/\.csv$/i.test(name)) tables.push({ name, rows: src.parseCSV(fs.readFileSync(file, 'utf8')) });
      else { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file); tables.push({ name, rows: firstSheetRows(wb) }); }
    }
    listed = names.map(name => ({ name }));
  } else {
    const all = await listFolder(folder.id);
    listed = all.filter(f => [MIME.sheet, MIME.csv, MIME.xlsx].includes(f.mimeType));
    for (const f of listed) {
      let rows;
      if (f.mimeType === MIME.sheet) rows = src.parseCSV(await exportCsv(f.id));
      else if (f.mimeType === MIME.csv) rows = src.parseCSV((await downloadBuffer(f.id)).buf.toString('utf8'));
      else rows = firstSheetRows(await workbookFromBuffer((await downloadBuffer(f.id)).buf));
      tables.push({ name: f.name, rows });
      console.log(`[casiopia] google: ${f.name}`);
    }
    listed = listed.map(f => ({ name: f.name, url: driveUrl(f) }));
  }
  return { folder, files: listed, ...src.googleFromTables(tables) };
}

// Índice de la carpeta de reportes + archivos sueltos. Los archivos subidos
// (PDF, Excel…) traen peso exacto; los nativos de Google (Slides) no lo exponen.
async function syncReportes() {
  const { folderId, extra } = SOURCES.reportes;
  if (LOCAL_DIR) throw new Error('el índice de reportes se lee solo desde Drive (sin modo --local)');
  const files = [];
  for (const f of await listFolder(folderId)) {
    const entry = { id: f.id, name: f.name, kind: kindOf(f.mimeType, f.name), size: null, modified: f.modified };
    if (!f.mimeType.startsWith('application/vnd.google-apps.')) {
      try {
        entry.size = (await fileMeta(f.id)).size;
      } catch (err) {
        console.log(`::warning::[casiopia] reportes: sin peso de ${f.name} (${err.message})`);
      }
    }
    files.push(entry);
  }
  console.log(`[casiopia] reportes: ${files.length} archivos en la carpeta`);
  // Los sueltos no pasan por la vista de carpeta y no traen fecha: se toma
  // como fecha la sincronización en que cambió su peso por última vez.
  const prev = readJson(SOURCES.reportes.out)?.files || [];
  for (const id of extra) {
    const meta = await fileMeta(id);
    const name = meta.name || id;
    const old = prev.find(p => p.id === id);
    const modified = old && old.size === meta.size && old.modified ? old.modified : nowLima().slice(0, 10);
    files.push({ id, name, kind: kindOf('', name), size: meta.size, modified, extra: true });
    console.log(`[casiopia] reportes: ${name} (vinculado)`);
  }
  return { folder: { id: folderId, url: folderUrl(folderId) }, files };
}

// ── Escritura tolerante a fallos ──
function nowLima() {
  // ISO con offset de Lima (UTC-5, sin horario de verano)
  const d = new Date(Date.now() - 5 * 3600 * 1000);
  return d.toISOString().replace(/\.\d{3}Z$/, '-05:00');
}

function readJson(rel) {
  const file = path.join(ROOT, rel);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

function writeJson(rel, payload) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const prev = readJson(rel);
  // Si los datos no cambiaron, no tocar el archivo (evita commits vacíos del cron).
  if (prev && JSON.stringify({ ...prev, generated: null }) === JSON.stringify({ ...payload, generated: null })) {
    console.log(`[casiopia] ${rel}: sin cambios`);
    return;
  }
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`[casiopia] ${rel}: actualizado`);
}

async function main() {
  const jobs = [['ventas', syncVentas], ['meta', syncMeta], ['google', syncGoogle], ['reportes', syncReportes]];
  let failed = 0;
  for (const [name, fn] of jobs) {
    try {
      const data = await fn();
      writeJson(SOURCES[name].out, { generated: nowLima(), ...data });
    } catch (err) {
      failed++;
      // ::warning:: se ve como anotación en GitHub Actions
      console.log(`::warning::[casiopia] ${name}: ${err.message} (se conserva el JSON anterior)`);
    }
  }
  if (failed === jobs.length) process.exit(1);
}

main();
