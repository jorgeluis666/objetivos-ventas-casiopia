/* ============================================================
   archivo.js — vista "Archivo de Reportes".
   Accesos directos a los archivos de la carpeta de Drive y a los
   archivos vinculados (el Excel "Ventas 2026 Dashboard"): KPIs,
   filtros, tabla y previsualización en modal sin salir del tablero.

   Qué archivos se listan lo decide el índice de Drive
   data/casiopia-reportes.json (scripts/fetch-casiopia.js, workflow
   sync-casiopia.yml: todos los días a las 07:00 de Lima y a pedido
   con el botón "Sincronizar con Drive"). Nombre, tipo y periodo de
   cada archivo salen de la ficha curada de window.ReportesData; los
   archivos nuevos sin ficha se clasifican por su nombre.
   Expone window.Archivo.init() (llamado perezoso desde main.js).
   ============================================================ */

(function (global) {
  const R = global.ReportesData;
  const INDEX_FILE = 'data/casiopia-reportes.json';
  const SYNC_WORKFLOW = 'sync-casiopia.yml';

  // Etiqueta visible y color de pill por categoría
  const TYPES = {
    Mensual:     { label: 'Reporte mensual',   pill: 'blue' },
    Avance:      { label: 'Reporte parcial',   pill: 'amber' },
    Cierre:      { label: 'Reporte de cierre', pill: 'green' },
    Semanal:     { label: 'Reporte semanal',   pill: 'gray' },
    Ejecutivo:   { label: 'Reporte ejecutivo', pill: 'purple' },
    Presupuesto: { label: 'Propuesta',         pill: 'purple' },
    Dashboard:   { label: 'Dashboard',         pill: 'gray' },
    Datos:       { label: 'Libro de datos',    pill: 'green' },
    Otro:        { label: 'Documento',         pill: 'gray' },
  };
  const CAMPAIGN_TYPES = new Set(['Mensual', 'Avance', 'Cierre', 'Semanal', 'Ejecutivo']);
  const FORMATS = { pdf: 'PDF', slides: 'SLIDES', xlsx: 'EXCEL', sheet: 'SHEETS', doc: 'DOCS', file: 'ARCHIVO' };

  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MONTH_RE = /\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\b/gi;

  const state = { q: '', type: '', period: '', sort: 'recent', current: false, index: null, syncing: false };
  let all = [];

  // ── Helpers ──
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  // Formato propio: es-PE abrevia septiembre como "set".
  const ymd = iso => iso.split('-').map(Number);
  const fecha = iso => { const [y, m, d] = ymd(iso); return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`; };
  // Fecha y hora en Lima (UTC-5, sin horario de verano)
  function fechaHora(iso) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '—';
    const [d, hm] = new Date(t - 5 * 3600 * 1000).toISOString().split('T');
    return `${fecha(d)}, ${hm.slice(0, 5)}`;
  }

  function peso(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  // Mes de referencia del documento: el último mes que nombra su periodo
  // ("26 ene – 08 feb 2026" → 2026-02). Clave 'YYYY-MM' para ordenar.
  function periodKey(f) {
    const months = [...f.periodo.matchAll(MONTH_RE)].map(m => m[1].toLowerCase());
    const year = (f.periodo.match(/\b(20\d\d)\b/) || [])[1];
    if (!months.length || !year) return null;
    const idx = MONTHS.findIndex(m => m.startsWith(months[months.length - 1]));
    return `${year}-${String(idx + 1).padStart(2, '0')}`;
  }
  function periodLabel(key) {
    const [y, m] = key.split('-');
    return `${cap(MONTHS[+m - 1])} ${y}`;
  }

  const DOCS = R.docsPath;
  const EXPORT = { slides: 'export/pdf', sheet: 'export?format=xlsx', doc: 'export?format=pdf' };
  const previewUrl  = f => DOCS[f.kind]
    ? `https://docs.google.com/${DOCS[f.kind]}/d/${f.id}/preview`
    : `https://drive.google.com/file/d/${f.id}/preview`;
  const downloadUrl = f => EXPORT[f.kind]
    ? `https://docs.google.com/${DOCS[f.kind]}/d/${f.id}/${EXPORT[f.kind]}`
    : `https://drive.google.com/uc?export=download&id=${f.id}`;

  // ── Índice de Drive + ficha curada ──
  // Ficha de un archivo que apareció en Drive y no está en data-reportes.js:
  // tipo y periodo se deducen del nombre ("Reporte_Casiopia_Octubre2026.pdf").
  const PERIOD_RE = /(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*[\s_-]*(?:de[\s_-]*)?(20\d\d)/i;
  function guessCat(name, kind) {
    const n = name.toLowerCase();
    if (/propuesta|presupuesto/.test(n)) return 'Presupuesto';
    if (/dashboard/.test(n)) return kind === 'xlsx' || kind === 'sheet' ? 'Datos' : 'Dashboard';
    if (/cierre/.test(n)) return 'Cierre';
    if (/ejecutivo/.test(n)) return 'Ejecutivo';
    if (/\bvs\b|\bsem\b|semanal/.test(n)) return 'Semanal';
    if (/avance|parcial/.test(n)) return 'Avance';
    if (kind === 'xlsx' || kind === 'sheet') return 'Datos';
    if (/reporte/.test(n)) return 'Mensual';
    return 'Otro';
  }
  function autoEntry(s) {
    const name = s.name.replace(/(\.(pdf|xlsx?|csv|docx?|pptx?))+$/i, '');
    const m = name.match(PERIOD_RE);
    const mes = m && (m[1].toLowerCase() === 'set' ? 'sep' : m[1].toLowerCase());
    return {
      id: s.id, file: s.name, name, cat: guessCat(name, s.kind),
      periodo: m ? `${cap(mes)} ${m[2]}` : '', nuevo: true,
    };
  }

  // Sin índice (primer deploy, JSON caído) se muestra la ficha curada tal cual.
  function buildFiles(index) {
    if (!index?.files?.length) return R.library.map(f => ({ ...f, per: periodKey(f) }));
    const curated = new Map([...R.library, ...R.extras].map(f => [f.id, f]));
    return index.files.map(s => {
      const c = curated.get(s.id) || autoEntry(s);
      const f = {
        ...c,
        kind: s.kind || c.kind,
        size: s.size ?? c.size ?? null,
        fecha: c.fecha || s.modified || index.generated.slice(0, 10),
        extra: !!s.extra,
      };
      return { ...f, per: periodKey(f) };
    });
  }

  async function loadIndex() {
    try {
      const res = await fetch(INDEX_FILE, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      console.warn('[archivo] sin índice de Drive, se usa la ficha curada', err);
      return null;
    }
  }

  // ── KPIs de la carpeta ──
  function renderKpis() {
    const vigentes = all.filter(f => !f.dup).length;
    const campaign = all.filter(f => CAMPAIGN_TYPES.has(f.cat)).length;
    const latest = [...all].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.per || '').localeCompare(a.per || ''))[0];
    const total = all.reduce((s, f) => s + (f.size || 0), 0);

    document.getElementById('arch-kpis').innerHTML = `
      <div class="kpi-card">
        <div class="kpi-lbl">Archivos en Drive</div>
        <div class="kpi-val">${all.length}</div>
        <div class="kpi-sub">${vigentes} vigentes + ${all.length - vigentes} versiones anteriores</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">Reportes de campaña</div>
        <div class="kpi-val">${campaign}</div>
        <div class="kpi-sub">Mensuales, semanales y parciales</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">Último documento</div>
        <div class="kpi-val">${latest ? esc(fecha(latest.fecha)) : '—'}</div>
        <div class="kpi-sub">${latest ? esc(latest.name) : 'Sin documentos'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">Peso del archivo</div>
        <div class="kpi-val">${peso(total)}</div>
        <div class="kpi-sub">Total almacenado en Drive</div>
      </div>`;

    const linked = all.filter(f => f.extra).length;
    document.getElementById('arch-sub').textContent =
      `${all.length - linked} en la carpeta Reportes Casiopia` +
      (linked ? ` + ${linked} ${linked === 1 ? 'archivo vinculado' : 'archivos vinculados'}` : '');
  }

  // ── Filtros ──
  // Se rehacen tras cada sincronización; un filtro que ya no existe se limpia.
  function fillSelects() {
    const type = document.getElementById('arch-type');
    const usedTypes = Object.keys(TYPES).filter(k => all.some(f => f.cat === k));
    type.innerHTML = '<option value="">Todos los tipos</option>' +
      usedTypes.map(k => `<option value="${k}">${TYPES[k].label}</option>`).join('');
    type.value = state.type;
    state.type = type.value;

    const period = document.getElementById('arch-period');
    const keys = [...new Set(all.map(f => f.per).filter(Boolean))].sort().reverse();
    period.innerHTML = '<option value="">Todos los periodos</option>' +
      keys.map(k => `<option value="${k}">${periodLabel(k)}</option>`).join('');
    period.value = state.period;
    state.period = period.value;
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    const list = all
      .filter(f => !state.current || !f.dup)
      .filter(f => !state.type || f.cat === state.type)
      .filter(f => !state.period || f.per === state.period)
      .filter(f => !q || [f.name, f.file, f.periodo, TYPES[f.cat]?.label, FORMATS[f.kind]]
        .join(' ').toLowerCase().includes(q));
    const sorters = {
      recent: (a, b) => b.fecha.localeCompare(a.fecha) || (b.per || '').localeCompare(a.per || ''),
      oldest: (a, b) => a.fecha.localeCompare(b.fecha) || (a.per || '').localeCompare(b.per || ''),
      name:   (a, b) => a.name.localeCompare(b.name, 'es'),
      size:   (a, b) => (b.size || 0) - (a.size || 0),
    };
    return list.sort(sorters[state.sort]);
  }

  // ── Tabla ──
  function version(f) {
    if (f.dup)   return ['old', 'Versión anterior'];
    if (f.nuevo) return ['new', 'Nuevo en Drive'];
    if (f.extra) return ['ok', 'Archivo vinculado'];
    return ['ok', 'Versión vigente'];
  }

  function renderList() {
    const list = filtered();
    const host = document.getElementById('arch-list');
    if (!list.length) {
      host.innerHTML = '<p class="arch-empty">No hay documentos que coincidan con los filtros.</p>';
      return;
    }
    host.innerHTML = `
      <table class="arch-table">
        <thead><tr>
          <th>Documento</th><th>Tipo</th><th>Periodo</th><th>Formato</th>
          <th class="r">Peso</th><th>Actualizado</th><th>Acciones</th>
        </tr></thead>
        <tbody>${list.map(f => {
          const t = TYPES[f.cat] || { label: f.cat, pill: 'gray' };
          const [verCls, verTxt] = version(f);
          return `<tr>
            <td>
              <div class="arch-doc-name">${esc(f.name)}</div>
              <div class="arch-doc-file">${esc(f.file)}</div>
            </td>
            <td><span class="pill ${t.pill}">${esc(t.label)}</span></td>
            <td class="arch-nowrap${f.per ? '' : ' muted'}">${f.per ? periodLabel(f.per) : esc(f.periodo || 'Sin periodo')}</td>
            <td><span class="arch-fmt">${FORMATS[f.kind] || 'ARCHIVO'}</span></td>
            <td class="r arch-nowrap">${f.size ? peso(f.size) : '—'}</td>
            <td class="arch-nowrap">
              ${esc(fecha(f.fecha))}
              <div class="arch-ver ${verCls}">${verTxt}</div>
            </td>
            <td>
              <div class="arch-actions">
                <button class="btn primary btn-sm" data-preview="${f.id}">Ver</button>
                <a class="btn btn-sm" href="${R.fileUrl(f.kind, f.id)}" target="_blank" rel="noopener">Drive</a>
                <a class="btn btn-sm" href="${downloadUrl(f)}" target="_blank" rel="noopener">Descargar</a>
              </div>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  }

  // ── Previsualización ──
  let lastFocus = null;
  function openPreview(f) {
    const modal = document.getElementById('modal-arch-preview');
    document.getElementById('arch-preview-title').textContent = f.name;
    document.getElementById('arch-preview-file').textContent = f.file;
    document.getElementById('arch-preview-drive').href = R.fileUrl(f.kind, f.id);
    document.getElementById('arch-preview-dl').href = downloadUrl(f);
    document.getElementById('arch-preview-frame').src = previewUrl(f);
    lastFocus = document.activeElement;
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    modal.querySelector('[data-action="close"]').focus();
  }
  function closePreview() {
    const modal = document.getElementById('modal-arch-preview');
    if (!modal.classList.contains('visible')) return;
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    document.getElementById('arch-preview-frame').src = 'about:blank';
    lastFocus?.focus();
  }

  // ════════════════════════════════════════════════════════════
  // Sincronización (workflow sync-casiopia.yml vía GitHub API)
  // ════════════════════════════════════════════════════════════
  function renderSync(msg = null, kind = 'ok') {
    const btn = document.getElementById('arch-sync-btn');
    btn.disabled = state.syncing;
    btn.classList.toggle('loading', state.syncing);
    btn.querySelector('span').textContent = state.syncing ? 'Sincronizando…' : 'Sincronizar con Drive';
    document.getElementById('arch-sync-dot').className = `gp-dot ${state.syncing ? 'busy' : kind}`;
    if (msg) {
      document.getElementById('arch-sync-text').innerHTML = msg;
      return;
    }
    const gen = state.index?.generated;
    const nuevos = all.filter(f => f.nuevo).length;
    const auto = '<span class="muted">· se sincroniza solo todos los días a las 07:00 (Lima)</span>';
    document.getElementById('arch-sync-text').innerHTML = gen
      ? `<b>Índice de Drive al ${esc(fechaHora(gen))}</b>` +
        (nuevos ? ` · ${nuevos} ${nuevos === 1 ? 'archivo nuevo' : 'archivos nuevos'} sin ficha` : '') + ` ${auto}`
      : `<b>Aún no sincronizado con Drive</b> <span class="muted">· se muestra el índice guardado en el tablero</span>`;
  }

  // Reemplaza el índice y vuelve a pintar todo conservando filtros y orden.
  function setIndex(index) {
    state.index = index;
    all = buildFiles(index);
    renderKpis();
    fillSelects();
    renderList();
    renderSync();
  }

  async function syncNow() {
    if (state.syncing) return;
    state.syncing = true;
    renderSync('Lanzando la sincronización con Drive…');
    const before = state.index?.generated || null;
    try {
      await global.Sheets.runWorkflow(SYNC_WORKFLOW, {
        onStatus: s => renderSync(s === 'queued' ? 'En cola en GitHub Actions…' : 'Leyendo la carpeta de reportes y el Excel en Drive…'),
      });
      // Lee el índice recién commiteado, sin esperar el deploy de Pages
      const index = await global.Sheets.fetchRepoJson(INDEX_FILE);
      state.syncing = false;
      setIndex(index);
      if (index.generated === before) {
        renderSync(`<b>Sin cambios en Drive</b> <span class="muted">· verificado ${esc(fechaHora(new Date().toISOString()))}; el índice sigue al ${esc(fechaHora(before))}</span>`);
      }
    } catch (err) {
      console.error('[archivo] sync failed', err);
      state.syncing = false;
      renderSync(`<b>No se pudo sincronizar:</b> ${/<a /.test(err.message) ? err.message : esc(err.message)}`, 'warn');
    }
  }

  function wire() {
    document.getElementById('arch-folder-link').href = R.folderUrl;
    document.getElementById('arch-sync-btn').addEventListener('click', () => global.Sheets.withPat(syncNow));

    const bind = (id, ev, fn) => document.getElementById(id).addEventListener(ev, e => { fn(e.target); renderList(); });
    bind('arch-search',  'input',  el => { state.q = el.value; });
    bind('arch-type',    'change', el => { state.type = el.value; });
    bind('arch-period',  'change', el => { state.period = el.value; });
    bind('arch-sort',    'change', el => { state.sort = el.value; });
    bind('arch-current', 'change', el => { state.current = el.checked; });

    document.getElementById('arch-list').addEventListener('click', e => {
      const btn = e.target.closest('[data-preview]');
      if (!btn) return;
      const f = all.find(x => x.id === btn.dataset.preview);
      if (f) openPreview(f);
    });

    const modal = document.getElementById('modal-arch-preview');
    modal.addEventListener('click', e => {
      if (e.target === modal || e.target.closest('[data-action="close"]')) closePreview();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePreview(); });
  }

  let inited = false;
  async function init() {
    if (inited || !R) return;
    inited = true;
    wire();
    setIndex(await loadIndex());
  }

  global.Archivo = { init };
})(window);
