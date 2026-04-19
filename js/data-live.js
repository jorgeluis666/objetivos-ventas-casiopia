/* ============================================================
   Datos vivos — cargan data/ventas-2026.json generado por el
   pipeline scripts/fetch-data.js (GitHub Actions / local).
   Expone window.DataLive.load() → { d2026, weeklyData, transactions, generated }
   ============================================================ */

(function (global) {
  const DATA_URL = 'data/ventas-2026.json';

  // Shape de fallback usado cuando no hay JSON disponible (lighthouse / primera carga).
  function emptyShape() {
    const zero = () => ({ Tienda: 0, Web: 0, WhatsApp: 0, Showroom: 0, Instagram: 0, Facebook: 0 });
    const zeroTx = () => ({ TIENDA: 0, WEB: 0, WHATSAPP: 0, SHOWROOM: 0, INSTAGRAM: 0, FACEBOOK: 0 });
    return {
      generated: null,
      d2026: { Enero: zero(), Febrero: zero(), Marzo: zero(), Abril: zero() },
      weeklyData: { Enero: [], Febrero: [], Marzo: [], Abril: [] },
      transactions: { Enero: zeroTx(), Febrero: zeroTx(), Marzo: zeroTx(), Abril: zeroTx() },
    };
  }

  async function load() {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      return {
        generated: json.generated || null,
        d2026: json.d2026,
        weeklyData: json.weeklyData,
        transactions: json.transactions,
        source: 'live',
      };
    } catch (err) {
      console.warn('[data-live] no se pudo cargar', DATA_URL, err);
      return { ...emptyShape(), source: 'fallback', error: err.message };
    }
  }

  global.DataLive = { load, DATA_URL };
})(window);
