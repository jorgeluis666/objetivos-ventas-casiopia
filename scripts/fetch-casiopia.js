#!/usr/bin/env node
/**
 * fetch-casiopia.js — sincroniza las tres fuentes del módulo Gasto publicitario.
 *
 *   Ventas      Excel "Ventas 2026.xlsx" en Drive          → data/casiopia-ventas.json
 *   Meta Ads    carpeta "Datos de Meta Ads" (Google Sheets) → data/casiopia-meta.json
 *   Google Ads  carpeta "Google Files - Casiopia"           → data/casiopia-google.json
 *
 * Modos:
 *   node scripts/fetch-casiopia.js                 → Google Drive API (service account)
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
const CREDENTIALS_PATH = path.join(ROOT, 'credentials', 'service-account.json');

const SOURCES = {
  ventas: { fileId: '1VydwmmTNpZtFi9RRy7TAXVpvgA54p5xy', out: 'data/casiopia-ventas.json' },
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

// ── Drive API ──
let _drive = null;
function drive() {
  if (_drive) return _drive;
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`No existe ${CREDENTIALS_PATH}. Colocá la service account JSON ahí.`);
  }
  const { google } = require('googleapis');
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  _drive = google.drive({ version: 'v3', auth });
  return _drive;
}

const DRIVE_OPTS = { supportsAllDrives: true };

async function driveMeta(fileId) {
  const { data } = await drive().files.get({ fileId, fields: 'id,name,mimeType,modifiedTime', ...DRIVE_OPTS });
  return data;
}

async function listFolder(folderId) {
  const files = [];
  let pageToken;
  do {
    const { data } = await drive().files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id,name,mimeType,modifiedTime)',
      pageSize: 100, pageToken, includeItemsFromAllDrives: true, ...DRIVE_OPTS,
    });
    files.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

async function downloadBuffer(fileId) {
  const res = await drive().files.get({ fileId, alt: 'media', ...DRIVE_OPTS }, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
}

// Google Sheets → CSV de su primera hoja (límite de exportación: 10 MB).
async function exportCsv(fileId) {
  const res = await drive().files.export({ fileId, mimeType: MIME.csv }, { responseType: 'text' });
  return String(res.data);
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
      source: { name: 'Ventas 2026.xlsx', modifiedTime: null, url: `https://drive.google.com/file/d/${SOURCES.ventas.fileId}/view` },
      ...src.ventasFromWorkbook(wb),
    };
  }
  const meta = await driveMeta(SOURCES.ventas.fileId);
  const wb = await workbookFromBuffer(await downloadBuffer(SOURCES.ventas.fileId));
  return {
    source: { name: meta.name, modifiedTime: meta.modifiedTime, url: driveUrl(meta) },
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
    const text = f.mimeType === MIME.sheet ? await exportCsv(f.id) : (await downloadBuffer(f.id)).toString('utf8');
    files.push({ name: f.name, text });
    console.log(`[casiopia] meta: ${f.name}`);
  }
  return {
    folder,
    files: listed.map(f => ({ name: f.name, modifiedTime: f.modifiedTime, url: driveUrl(f) })),
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
      else if (f.mimeType === MIME.csv) rows = src.parseCSV((await downloadBuffer(f.id)).toString('utf8'));
      else rows = firstSheetRows(await workbookFromBuffer(await downloadBuffer(f.id)));
      tables.push({ name: f.name, rows });
      console.log(`[casiopia] google: ${f.name}`);
    }
    listed = listed.map(f => ({ name: f.name, modifiedTime: f.modifiedTime, url: driveUrl(f) }));
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
