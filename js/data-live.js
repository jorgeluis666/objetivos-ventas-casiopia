/* ============================================================
   Datos vivos de Objetivos 2026 — cargan data/casiopia-ventas.json,
   generado por scripts/fetch-casiopia.js desde el Excel
   "Ventas 2026 Dashboard.xlsx" (workflow sync-casiopia.yml).
   Expone window.DataLive.load() y DataLive.fromJson(json) →
     { generated, d2026, weeklyData, transactions, ordersTotal,
       targets, targetTotal, ref2025, undated, source }
   ============================================================ */

(function (global) {
  const DATA_URL = 'data/casiopia-ventas.json';

  // Mismo shape para la carga inicial y para el JSON recién sincronizado.
  function fromJson(json) {
    return {
      generated:    json.generated || null,
      d2026:        json.actuals || {},
      weeklyData:   json.weekly || {},
      transactions: json.orders || {},
      ordersTotal:  json.ordersTotal || {},
      targets:      json.targets || null,
      targetTotal:  json.targetTotal || {},
      ref2025:      json.ref2025 || {},
      undated:      json.undated || {},
      sourceFile:   json.source || null,
      source: 'live',
    };
  }

  async function load() {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return fromJson(await res.json());
    } catch (err) {
      // Sin JSON: objectives.js usa los datos estáticos de data-static.js
      console.warn('[data-live] no se pudo cargar', DATA_URL, err);
      return { generated: null, source: 'fallback', error: err.message };
    }
  }

  global.DataLive = { load, fromJson, DATA_URL };
})(window);
