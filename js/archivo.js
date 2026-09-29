/* ============================================================
   archivo.js — vista "Archivo de Reportes".
   Accesos directos a los archivos de la carpeta de Drive
   (window.ReportesData.library): KPIs de la carpeta, filtros,
   tabla y previsualización en modal sin salir del tablero.
   Expone window.Archivo.init() (llamado perezoso desde main.js).
   ============================================================ */

(function (global) {
  const R = global.ReportesData;

  // Etiqueta visible y color de pill por categoría
  const TYPES = {
    Mensual:     { label: 'Reporte mensual',   pill: 'blue' },
    Avance:      { label: 'Reporte parcial',   pill: 'amber' },
    Cierre:      { label: 'Reporte de cierre', pill: 'green' },
    Semanal:     { label: 'Reporte semanal',   pill: 'gray' },
    Ejecutivo:   { label: 'Reporte ejecutivo', pill: 'purple' },
    Presupuesto: { label: 'Propuesta',         pill: 'purple' },
    Dashboard:   { label: 'Dashboard',         pill: 'gray' },
  };
  const CAMPAIGN_TYPES = new Set(['Mensual', 'Avance', 'Cierre', 'Semanal', 'Ejecutivo']);

  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MONTH_RE = /\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\b/gi;

  const state = { q: '', type: '', period: '', sort: 'recent', current: false };

  // ── Helpers ──
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  // Formato propio: es-PE abrevia septiembre como "set".
  const ymd = iso => iso.split('-').map(Number);
  const fecha = iso => { const [y, m, d] = ymd(iso); return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`; };
  const fechaLarga = iso => { const [y, m, d] = ymd(iso); return `${d} de ${MONTHS[m - 1]} de ${y}`; };

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

  const previewUrl  = f => f.kind === 'slides'
    ? `https://docs.google.com/presentation/d/${f.id}/preview`
    : `https://drive.google.com/file/d/${f.id}/preview`;
  const downloadUrl = f => f.kind === 'slides'
    ? `https://docs.google.com/presentation/d/${f.id}/export/pdf`
    : `https://drive.google.com/uc?export=download&id=${f.id}`;

  const files = () => R.library.map(f => ({ ...f, per: periodKey(f) }));

  // ── KPIs de la carpeta ──
  function renderKpis(all) {
    const vigentes = all.filter(f => !f.dup).length;
    const campaign = all.filter(f => CAMPAIGN_TYPES.has(f.cat)).length;
    const latest = [...all].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.per || '').localeCompare(a.per || ''))[0];
    const total = all.reduce((s, f) => s + (f.size || 0), 0);

    document.getElementById('arch-kpis').innerHTML = `
      <div class="kpi-card">
        <div class="kpi-lbl">Archivos en la carpeta</div>
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
        <div class="kpi-val">${esc(fecha(latest.fecha))}</div>
        <div class="kpi-sub">${esc(latest.name)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">Peso del archivo</div>
        <div class="kpi-val">${peso(total)}</div>
        <div class="kpi-sub">Total almacenado en Drive</div>
      </div>`;

    document.getElementById('arch-sub').textContent =
      `${all.length} documentos sincronizados el ${fechaLarga(latest.fecha)}`;
  }

  // ── Filtros ──
  function fillSelects(all) {
    const type = document.getElementById('arch-type');
    const usedTypes = Object.keys(TYPES).filter(k => all.some(f => f.cat === k));
    type.innerHTML = '<option value="">Todos los tipos</option>' +
      usedTypes.map(k => `<option value="${k}">${TYPES[k].label}</option>`).join('');

    const period = document.getElementById('arch-period');
    const keys = [...new Set(all.map(f => f.per).filter(Boolean))].sort().reverse();
    period.innerHTML = '<option value="">Todos los periodos</option>' +
      keys.map(k => `<option value="${k}">${periodLabel(k)}</option>`).join('');
  }

  function filtered(all) {
    const q = state.q.trim().toLowerCase();
    const list = all
      .filter(f => !state.current || !f.dup)
      .filter(f => !state.type || f.cat === state.type)
      .filter(f => !state.period || f.per === state.period)
      .filter(f => !q || [f.name, f.file, f.periodo, TYPES[f.cat]?.label, f.kind === 'pdf' ? 'pdf' : 'slides']
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
  function renderList(all) {
    const list = filtered(all);
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
          return `<tr>
            <td>
              <div class="arch-doc-name">${esc(f.name)}</div>
              <div class="arch-doc-file">${esc(f.file)}</div>
            </td>
            <td><span class="pill ${t.pill}">${esc(t.label)}</span></td>
            <td class="arch-nowrap${f.per ? '' : ' muted'}">${f.per ? periodLabel(f.per) : 'Sin periodo'}</td>
            <td><span class="arch-fmt">${f.kind === 'pdf' ? 'PDF' : 'SLIDES'}</span></td>
            <td class="r arch-nowrap">${f.size ? peso(f.size) : '—'}</td>
            <td class="arch-nowrap">
              ${esc(fecha(f.fecha))}
              <div class="arch-ver ${f.dup ? 'old' : 'ok'}">${f.dup ? 'Versión anterior' : 'Versión vigente'}</div>
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

  function wire(all) {
    document.getElementById('arch-folder-link').href = R.folderUrl;
    const rerender = () => renderList(all);

    const bind = (id, ev, fn) => document.getElementById(id).addEventListener(ev, e => { fn(e.target); rerender(); });
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
  function init() {
    if (inited || !R) return;
    inited = true;
    const all = files();
    renderKpis(all);
    fillSelects(all);
    wire(all);
    renderList(all);
  }

  global.Archivo = { init };
})(window);
