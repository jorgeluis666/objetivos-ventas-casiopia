/* ============================================================
   sheets.js — indicador de sync + botón "Actualizar".
   Muestra cuándo fue la última generación del JSON y permite
   disparar el workflow de GitHub Actions on-demand si el usuario
   guardó un Personal Access Token en localStorage.
   También expone helpers de GitHub que reutiliza gasto.js para
   su propio botón de sincronización (workflow sync-casiopia.yml).
   Expone window.Sheets.
   ============================================================ */

(function (global) {
  const REPO_OWNER    = 'jorgeluis666';
  const REPO_NAME     = 'objetivos-ventas-casiopia';
  const WORKFLOW_FILE = 'update-data.yml';    // ver .github/workflows/
  const PAT_STORAGE   = 'ghPatReadWrite';     // token opcional
  const POLL_INTERVAL = 8000;                 // polling del run activo
  const API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

  const state = {
    generated: null,
    loading: false,
    polling: null,
    lastCheck: null,
    afterSave: null,   // acción pendiente cuando se pide el token
  };

  // ── Formatters ──
  function formatRelative(iso) {
    if (!iso) return 'sin datos';
    const then = new Date(iso.endsWith('Z') ? iso : iso + '-05:00');
    if (isNaN(then.getTime())) return iso;
    const diffMin = Math.round((Date.now() - then.getTime()) / 60000);
    if (diffMin < 1)   return 'hace segundos';
    if (diffMin < 60)  return `hace ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24)    return `hace ${diffH} h`;
    const diffD = Math.round(diffH / 24);
    return `hace ${diffD} d`;
  }

  function getPat() {
    try { return localStorage.getItem(PAT_STORAGE) || ''; } catch { return ''; }
  }
  function setPat(val) {
    try {
      if (val) localStorage.setItem(PAT_STORAGE, val);
      else     localStorage.removeItem(PAT_STORAGE);
    } catch {}
  }

  // ── Render del indicador ──
  function renderIndicator() {
    const el = document.getElementById('sync-indicator');
    if (!el) return;
    const classes = ['topbar-pill', 'sync'];
    classes.push(state.loading ? 'loading' : 'ok');
    el.className = classes.join(' ');
    const rel = formatRelative(state.generated);
    const label = state.loading
      ? 'Sincronizando…'
      : `Sincronizado · ${rel}`;
    el.innerHTML = `<span class="sync-dot"></span><span>${label}</span>`;
  }

  function renderRefreshButton() {
    const btn = document.getElementById('btn-refresh');
    if (!btn) return;
    btn.classList.toggle('loading', state.loading);
    btn.disabled = state.loading;
  }

  function setLoading(on) {
    state.loading = on;
    renderIndicator();
    renderRefreshButton();
  }

  // ── GitHub API ──
  async function gh(path, opts = {}) {
    const res = await fetch(API + path, {
      ...opts,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${getPat()}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...opts.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub ${res.status}: ${body.slice(0, 140)}`);
    }
    return res;
  }

  // Dispara un workflow (workflow_dispatch) en main.
  async function dispatch(workflowFile) {
    await gh(`/actions/workflows/${workflowFile}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ ref: 'main' }),
    });
  }

  // Espera a que termine el run lanzado a mano después de `sinceMs`.
  // Devuelve el run completado ({ conclusion, html_url, … }).
  async function waitForRun(workflowFile, sinceMs, { timeoutMs = 6 * 60 * 1000, onStatus } = {}) {
    const deadline = Date.now() + timeoutMs;
    // El run tarda unos segundos en aparecer; 30 s de margen por relojes desfasados
    const since = sinceMs - 30 * 1000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 5000));
      const res = await gh(`/actions/workflows/${workflowFile}/runs?event=workflow_dispatch&per_page=5`);
      const run = (await res.json()).workflow_runs.find(r => Date.parse(r.created_at) >= since);
      if (!run) continue;
      onStatus?.(run.status);
      if (run.status === 'completed') return run;
    }
    throw new Error('La sincronización sigue corriendo en GitHub; revisá Actions en unos minutos.');
  }

  // JSON del repo recién commiteado (antes de que termine el deploy de Pages).
  async function fetchRepoJson(path) {
    const res = await gh(`/contents/${path}?ref=main&_=${Date.now()}`, {
      headers: { 'Accept': 'application/vnd.github.raw+json' },
      cache: 'no-store',
    });
    return res.json();
  }

  // Ejecuta `action` si hay token; si no, abre el modal y la ejecuta al guardar.
  function withPat(action) {
    if (getPat()) return action();
    openTokenModal(action);
  }

  // ── Botón "Actualizar" del topbar (datos de Objetivos) ──
  function triggerWorkflow() {
    withPat(async () => {
      setLoading(true);
      try {
        await dispatch(WORKFLOW_FILE);
        // Poll hasta que aparezca un run más reciente que state.generated
        startPolling();
      } catch (err) {
        console.error('[sheets] dispatch failed', err);
        alert('No se pudo lanzar la sincronización:\n' + err.message);
        setLoading(false);
      }
    });
  }

  function startPolling() {
    const startedAt = Date.now();
    if (state.polling) clearInterval(state.polling);
    state.polling = setInterval(async () => {
      try {
        const res = await fetch('data/ventas-2026.json?_=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.generated && json.generated !== state.generated) {
            state.generated = json.generated;
            clearInterval(state.polling); state.polling = null;
            setLoading(false);
            if (typeof state.onUpdate === 'function') state.onUpdate(json);
            return;
          }
        }
      } catch {}
      // Timeout después de 4 minutos
      if (Date.now() - startedAt > 4 * 60 * 1000) {
        clearInterval(state.polling); state.polling = null;
        setLoading(false);
      }
    }, POLL_INTERVAL);
  }

  // ── Modal para guardar el PAT ──
  function openTokenModal(afterSave = null) {
    const modal = document.getElementById('modal-pat');
    if (!modal) return;
    state.afterSave = typeof afterSave === 'function' ? afterSave : null;
    modal.querySelector('input').value = getPat();
    modal.classList.add('visible');
  }
  function closeTokenModal() {
    const modal = document.getElementById('modal-pat');
    if (!modal) return;
    modal.classList.remove('visible');
  }

  function wireModal() {
    const modal = document.getElementById('modal-pat');
    if (!modal) return;
    modal.addEventListener('click', e => { if (e.target === modal) closeTokenModal(); });
    modal.querySelector('[data-action="save"]').addEventListener('click', () => {
      const val = modal.querySelector('input').value.trim();
      setPat(val);
      closeTokenModal();
      const next = state.afterSave;
      state.afterSave = null;
      if (val && next) next();
    });
    modal.querySelector('[data-action="cancel"]').addEventListener('click', closeTokenModal);
    modal.querySelector('[data-action="clear"]').addEventListener('click', () => {
      setPat('');
      modal.querySelector('input').value = '';
    });
  }

  // ── API pública ──
  function init({ generated, onUpdate }) {
    state.generated = generated || null;
    state.onUpdate  = onUpdate;
    wireModal();
    renderIndicator();
    renderRefreshButton();
    const refresh = document.getElementById('btn-refresh');
    if (refresh) refresh.addEventListener('click', triggerWorkflow);
    const settings = document.getElementById('btn-settings');
    if (settings) settings.addEventListener('click', () => openTokenModal());
  }

  function updateGenerated(iso) {
    state.generated = iso;
    renderIndicator();
  }

  global.Sheets = {
    init, triggerWorkflow, updateGenerated, openTokenModal,
    withPat, dispatch, waitForRun, fetchRepoJson, formatRelative,
  };
})(window);
