#!/usr/bin/env node
/**
 * fetch-casiopia.js — sincroniza las tres fuentes del módulo Gasto publicitario.
 *
 *   Ventas      Excel "Ventas 2026 Dashboard.xlsx" (cliente)   → data/casiopia-ventas.json
 *   Meta Ads    carpeta "Meta Files - Casiopia" (pauta)         → data/casiopia-meta.json
 *   Google Ads  carpeta "Google Files - Casiopia" (pauta)       → data/casiopia-google.json
 *
 * Sin credenciales: los archivos y carpetas están compartidos como
 * "cualquier persona con el enlace", así que se leen por sus enlaces
 * públicos de Google Drive (descarga directa, exportación CSV de Sheets y
 * la vista embebida de la carpeta para listar su contenido).
 *
 * Modos:
 *   node scripts/fetch-casiopia.js                 → enlaces públicos de Drive
 *   node scripts/fetch-casiopia.js --local=<dir>   → <dir>/ventas-2026.xlsx, <dir>/meta/*.csv,
 *                                                     <dir>/google/*.{csv,xlsx}
 *
 * Cada fuente es independiente: si una falla, se conserva su JSON anterior,
 * se avisa en consola y el resto se actualiza igual.
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const src = require('./lib/casiopia-sources');

const ROOT = path.join(__dirname, '..');

const SOURCES = {
  ventas: { fileId: '1u1tWfos-R5MbN7z72i1X6_BSkzh3L_nF', name: 'Ventas 2026 Dashboard.xlsx', out: 'data/casiopia-ventas.json' },
  meta:   { folderId: '166vtDwzl4YbqLnyqNpulZI2YltKb2FMm', out: 'data/casiopia-meta.json' },
  google: { folderId: '1oN2HxlqXENM0KuAIOM_rtb17zJPCCAhO', out: 'data/casiopia-google.json' },
};

const MIME = {
  sheet: 'application/vnd.google-apps.spreadsheet',
  xlsx:  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv:   'text/csv',
};

const localArg = process.argv.find(a => a.startsWith('--local='));
const LOCAL_DIR = localArg ? path.resolve(localArg.slice('--local='.length)) : null;

// ── Google Drive por enlaces públicos ──
const NOT_PUBLIC = 'no es accesible con el enlace: compártelo como "Cualquier persona con el enlace · Lector"';

async function get(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res;
}

const decodeHtml = s => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .trim();

// Lista una carpeta pública con la vista embebida de Drive (sin API).
// Cada entrada trae id, título e ícono con el MIME type.
async function listFolder(folderId) {
  const html = await (await get(`https://drive.google.com/embeddedfolderview?id=${folderId}`)).text();
  if (!html.includes('flip-entries')) throw new Error(`la carpeta ${folderId} ${NOT_PUBLIC}`);
  const files = [];
  const re = /<div class="flip-entry" id="entry-([^"]+)"[\s\S]*?\/type\/([^"]+)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(html))) files.push({ id: m[1], mimeType: decodeHtml(m[2]), name: decodeHtml(m[3]) });
  return files.sort((a, b) => a.name.localeCompare(b.name));
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
  if (LOCAL_DIR) {
    const file = path.join(LOCAL_DIR, 'ventas-2026.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    return {
      // En local no se conoce la fecha de edición en Drive (la del archivo es la de descarga)
      source: { name: SOURCES.ventas.name, modifiedTime: null, url: `https://drive.google.com/file/d/${SOURCES.ventas.fileId}/view` },
      ...src.ventasFromWorkbook(wb),
    };
  }
  const { buf, name } = await downloadBuffer(SOURCES.ventas.fileId);
  const wb = await workbookFromBuffer(buf);
  return {
    source: { name: name || SOURCES.ventas.name, modifiedTime: null, url: `https://drive.google.com/file/d/${SOURCES.ventas.fileId}/view` },
    ...src.ventasFromWorkbook(wb),
  };
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

// ── Escritura tolerante a fallos ──
function nowLima() {
  // ISO con offset de Lima (UTC-5, sin horario de verano)
  const d = new Date(Date.now() - 5 * 3600 * 1000);
  return d.toISOString().replace(/\.\d{3}Z$/, '-05:00');
}

function writeJson(rel, payload) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  // Si los datos no cambiaron, no tocar el archivo (evita commits vacíos del cron).
  if (prev && JSON.stringify({ ...prev, generated: null }) === JSON.stringify({ ...payload, generated: null })) {
    console.log(`[casiopia] ${rel}: sin cambios`);
    return;
  }
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`[casiopia] ${rel}: actualizado`);
}

async function main() {
  const jobs = [['ventas', syncVentas], ['meta', syncMeta], ['google', syncGoogle]];
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
