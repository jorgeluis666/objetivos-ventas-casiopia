/* ============================================================
   sheets.js — indicador de sync + botón "Actualizar".
   Muestra cuándo fue la última generación del JSON y permite
   disparar el workflow de GitHub Actions on-demand si el usuario
   guardó un Personal Access Token en localStorage.
   Expone window.Sheets.
   ============================================================ */

(function (global) {
  const REPO_OWNER    = 'jorgeluis666';
  const REPO_NAME     = 'objetivo-canales-ventas';
  const WORKFLOW_FILE = 'update-data.yml';    // ver .github/workflows/
  const PAT_STORAGE   = 'ghPatReadWrite';     // token opcional
  const POLL_INTERVAL = 8000;                 // polling del run activo

  const state = {
    generated: null,
    loading: false,
    polling: null,
    lastCheck: null,
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
    const classes = ['sync-indicator'];
    if (state.loading) classes.push('loading');
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

  // ── GitHub API — dispara y hace polling del workflow ──
  async function triggerWorkflow() {
    const pat = getPat();
    if (!pat) {
      openTokenModal();
      return;
    }
    setLoading(true);
    try {
      const branch = 'main';
      const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${pat}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ ref: branch }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`GitHub ${res.status}: ${body.slice(0, 140)}`);
      }
      // Poll hasta que aparezca un run más reciente que state.generated
      startPolling();
    } catch (err) {
      console.error('[sheets] dispatch failed', err);
      alert('No se pudo lanzar la sincronización:\n' + err.message);
      setLoading(false);
    }
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
  function openTokenModal() {
    const modal = document.getElementById('modal-pat');
    if (!modal) return;
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
      if (val) triggerWorkflow();
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
    if (settings) settings.addEventListener('click', openTokenModal);
  }

  function updateGenerated(iso) {
    state.generated = iso;
    renderIndicator();
  }

  global.Sheets = { init, triggerWorkflow, updateGenerated, openTokenModal };
})(window);
