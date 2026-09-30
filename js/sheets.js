/* ============================================================
   sheets.js — indicador de sync + botón "Actualizar".
   Muestra cuándo fue la última generación del JSON y permite
   disparar el workflow de GitHub Actions on-demand si el usuario
   guardó un Personal Access Token en localStorage.
   También expone helpers de GitHub que reutilizan gasto.js y
   archivo.js para sus botones de sincronización (workflow
   sync-casiopia.yml).
   Expone window.Sheets.
   ============================================================ */

(function (global) {
  const REPO_OWNER    = 'jorgeluis666';
  const REPO_NAME     = 'objetivos-ventas-casiopia';
  // Objetivos 2026 lee data/casiopia-ventas.json, que genera este workflow
  // desde el Excel "Ventas 2026 Dashboard" (ver .github/workflows/).
  const WORKFLOW_FILE = 'sync-casiopia.yml';
  const PAT_STORAGE   = 'ghPatReadWrite';     // token opcional
  const API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

  const state = {
    generated: null,
    loading: false,
    afterSave: null,   // acción pendiente cuando se pide el token
  };

  // ── Formatters ──
  function formatRelative(iso) {
    if (!iso) return 'sin datos';
    // Sin zona horaria explícita se asume hora de Lima
    const then = new Date(/(Z|[+-]\d{2}:\d{2})$/.test(iso) ? iso : iso + '-05:00');
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

  // Dispara el workflow y espera a que termine bien; si falla, el error trae
  // un enlace (HTML) al run en GitHub.
  async function runWorkflow(workflowFile, { onStatus } = {}) {
    const startedAt = Date.now();
    await dispatch(workflowFile);
    const run = await waitForRun(workflowFile, startedAt, { onStatus });
    if (run.conclusion !== 'success') {
      throw new Error(`el workflow terminó con estado "${run.conclusion}". <a href="${run.html_url}" target="_blank" rel="noopener">Ver detalle ↗</a>`);
    }
    return run;
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
  // Corre la sincronización y vuelve a pintar con el JSON recién commiteado,
  // sin esperar el deploy de Pages.
  function triggerWorkflow() {
    withPat(async () => {
      setLoading(true);
      try {
        await runWorkflow(WORKFLOW_FILE);
        const json = await fetchRepoJson(global.DataLive.DATA_URL);
        state.generated = json.generated || state.generated;
        if (typeof state.onUpdate === 'function') state.onUpdate(global.DataLive.fromJson(json));
      } catch (err) {
        console.error('[sheets] sync failed', err);
        alert('No se pudo sincronizar:\n' + err.message.replace(/<[^>]+>/g, ''));
      } finally {
        setLoading(false);
      }
    });
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
    withPat, dispatch, waitForRun, runWorkflow, fetchRepoJson, formatRelative,
  };
})(window);
