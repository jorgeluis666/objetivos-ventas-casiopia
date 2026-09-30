/* ============================================================
   main.js — entry point. Orquesta: carga de datos, navegación
   sidebar, render de vistas, wire del indicador de sync.
   ============================================================ */

(function () {
  const VIEW_TITLES = {
    'view-obj':  'Objetivos 2026',
    'view-rep':  'Gasto publicitario',
    'view-arch': 'Archivo de Reportes',
    'view-config': 'Usuarios y Claves',
  };

  // Descripción corta para el panel MÓDULO ACTIVO del sidebar
  const VIEW_DESCRIPTIONS = {
    'view-obj':    'Seguimiento de metas mensuales',
    'view-rep':    'Meta Ads y Google Ads',
    'view-arch':   'Documentos en Drive',
    'view-config': 'Gestión de accesos y alertas',
  };

  // Charts que hay que re-animar al mostrar cada vista.
  const VIEW_CHARTS = {
    'view-obj':    ['chart-weekly-combined'],
    'view-rep':    [],  // Gasto.init() re-anima los charts de la pestaña activa
    'view-arch':   [],
    'view-config': [],
  };

  const state = {
    generated: null,
    configInited: false,
  };

  // ── Navegación ──
  function showView(id) {
    if (!VIEW_TITLES[id]) id = 'view-obj';
    document.querySelectorAll('.view').forEach(v => v.classList.remove('visible'));
    document.querySelectorAll('.s-item').forEach(n => n.classList.remove('active'));
    const view = document.getElementById(id);
    const btn  = document.querySelector(`.s-item[data-view="${id}"]`);
    if (view) view.classList.add('visible');
    if (btn)  btn.classList.add('active');
    const title = document.getElementById('topbar-title');
    if (title) title.textContent = VIEW_TITLES[id] || '';
    history.replaceState(null, '', '#' + id);

    // Actualizar panel MÓDULO ACTIVO en el sidebar
    const maName = document.getElementById('s-ma-name');
    const maDesc = document.getElementById('s-ma-desc');
    if (maName) maName.textContent = VIEW_TITLES[id]       || '';
    if (maDesc) maDesc.textContent = VIEW_DESCRIPTIONS[id] || '';

    // Init perezoso del módulo de configuración
    if (id === 'view-config' && !state.configInited) {
      state.configInited = true;
      window.Config?.init();
    }

    // Init perezoso del módulo de reportes (sus charts se crean ya visibles)
    if (id === 'view-rep') window.Gasto?.init();
    if (id === 'view-arch') window.Archivo?.init();

    // Replay de la animación de entrada en los charts de la vista
    // (si estaban ocultos cuando se animaron la primera vez, no se vieron).
    const charts = VIEW_CHARTS[id];
    if (charts && window.Charts?.replay) {
      // Siguiente frame: asegurar que el layout ya es visible antes de medir
      requestAnimationFrame(() => window.Charts.replay(charts));
    }
  }

  function wireNav() {
    document.querySelectorAll('.s-item[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
        showView(btn.dataset.view);
      });
    });
  }

  // ── Sidebar minimizable ──
  // Estado recordado en localStorage ('1' minimizado, '0' abierto). Si el
  // navegador bloquea el storage, el panel arranca expandido sin errores.
  const SIDEBAR_KEY = 'rb-sidebar-collapsed';

  function wireSidebarToggle() {
    const shell   = document.querySelector('.shell');
    const sidebar = document.getElementById('sidebar');
    const toggle  = document.getElementById('sidebar-toggle');
    if (!shell || !sidebar || !toggle) return;

    const items = [...sidebar.querySelectorAll('.s-item')];
    const tip = document.createElement('div');
    tip.className = 's-tip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);

    function apply(collapsed) {
      shell.classList.toggle('sidebar-collapsed', collapsed);
      const label = collapsed ? 'Expandir panel' : 'Minimizar panel';
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
      // Con el texto oculto, el nombre accesible sale del título del módulo
      items.forEach(it => {
        const name = it.querySelector('.s-title-nav')?.textContent.trim();
        if (collapsed && name) it.setAttribute('aria-label', name);
        else it.removeAttribute('aria-label');
      });
      if (!collapsed) tip.classList.remove('show');
    }

    let saved = null;
    try { saved = localStorage.getItem(SIDEBAR_KEY); } catch (e) { /* storage bloqueado */ }
    // Restaurar sin animación para que no "salte" al cargar
    shell.classList.add('no-anim');
    apply(saved === '1');
    requestAnimationFrame(() => requestAnimationFrame(() => shell.classList.remove('no-anim')));

    toggle.addEventListener('click', () => {
      const collapsed = !shell.classList.contains('sidebar-collapsed');
      apply(collapsed);
      try { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); } catch (e) { /* ignore */ }
    });

    function showTip(item) {
      if (!shell.classList.contains('sidebar-collapsed')) return;
      const name = item.querySelector('.s-title-nav')?.textContent.trim();
      if (!name) return;
      tip.textContent = name;
      const r = item.getBoundingClientRect();
      tip.style.left = (sidebar.getBoundingClientRect().right + 10) + 'px';
      tip.style.top  = (r.top + r.height / 2) + 'px';
      tip.classList.add('show');
    }
    const hideTip = () => tip.classList.remove('show');

    items.forEach(it => {
      it.addEventListener('mouseenter', () => showTip(it));
      it.addEventListener('mouseleave', hideTip);
      it.addEventListener('focus', () => showTip(it));
      it.addEventListener('blur', hideTip);
      it.addEventListener('click', hideTip);
    });
    sidebar.addEventListener('scroll', hideTip, { passive: true });
  }

  // ── Render completo con datos live ──
  function renderAll(liveData) {
    state.generated = liveData.generated;
    window.Objectives.render(liveData);
    window.Objectives.wireObjToolbar?.();
    window.Sheets.updateGenerated(state.generated);
  }

  // ── Init ──
  async function init() {
    Chart.register(ChartDataLabels);
    Chart.defaults.plugins.datalabels.display = false;
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif';

    wireNav();
    wireSidebarToggle();
    const hashView = window.location.hash.slice(1);
    showView(Object.keys(VIEW_TITLES).includes(hashView) ? hashView : 'view-obj');

    const live = await window.DataLive.load();
    renderAll(live);

    window.Sheets.init({
      generated: live.generated,
      onUpdate: updated => renderAll(updated),
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
