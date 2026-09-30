/* ============================================================
   charts.js — todas las instancias de Chart.js del dashboard.
   Usa window.DataStatic y recibe datos 2026 vivos en runtime.
   Expone window.Charts con builders que pueden re-ejecutarse.
   ============================================================ */

(function (global) {
  const ds = global.DataStatic;
  const { channels, months } = ds;

  // Defaults visuales comunes
  const axisColor = '#94A3B8';
  const gridColor = 'rgba(15,23,42,0.06)';

  // ── Animaciones ──
  // Líneas: trazo de izquierda a derecha, cada segmento sale del punto anterior.
  function lineDraw(totalDuration = 1400) {
    const previousY = ctx => {
      if (ctx.index === 0) return ctx.chart.scales.y.getPixelForValue(0);
      const meta = ctx.chart.getDatasetMeta(ctx.datasetIndex);
      const prev = meta.data[ctx.index - 1];
      return prev ? prev.getProps(['y'], true).y : ctx.chart.scales.y.getPixelForValue(0);
    };
    const segmentFor = ctx => {
      const count = ctx.chart.data.labels?.length || 1;
      return totalDuration / count;
    };
    return {
      duration: totalDuration,
      x: {
        type: 'number',
        easing: 'linear',
        duration: segmentFor,
        from: NaN,
        delay(ctx) {
          if (ctx.type !== 'data' || ctx.xStarted) return 0;
          ctx.xStarted = true;
          return ctx.index * segmentFor(ctx);
        },
      },
      y: {
        type: 'number',
        easing: 'linear',
        duration: segmentFor,
        from: previousY,
        delay(ctx) {
          if (ctx.type !== 'data' || ctx.yStarted) return 0;
          ctx.yStarted = true;
          return ctx.index * segmentFor(ctx);
        },
      },
    };
  }

  const MONTH_SHORT = {
    Enero:'Ene', Febrero:'Feb', Marzo:'Mar', Abril:'Abr',
    Mayo:'May', Junio:'Jun', Julio:'Jul', Agosto:'Ago',
    Septiembre:'Sep', Octubre:'Oct', Noviembre:'Nov', Diciembre:'Dic',
  };

  const instances = new Map();
  function destroy(id) {
    if (instances.has(id)) {
      instances.get(id).destroy();
      instances.delete(id);
    }
  }
  function mount(id, config) {
    destroy(id);
    const el = document.getElementById(id);
    if (!el) return null;
    const chart = new Chart(el, config);
    instances.set(id, chart);
    return chart;
  }

  // Re-ejecuta la animación de entrada de los charts indicados.
  // Útil al cambiar de vista — los charts ocultos no se "ven" animarse.
  function replay(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    list.forEach(id => {
      // Admite prefijos tipo "week-chart-" para grupos.
      if (id.endsWith('*')) {
        const prefix = id.slice(0, -1);
        instances.forEach((chart, key) => {
          if (key.startsWith(prefix)) { chart.reset(); chart.update(); }
        });
        return;
      }
      const chart = instances.get(id);
      if (chart) { chart.reset(); chart.update(); }
    });
  }

  // ── Helpers ──
  const tot = obj => obj ? channels.reduce((s, c) => s + (obj[c] || 0), 0) : 0;
  const fmt = n => Math.round(n).toLocaleString('es-PE');

  // ── Combined weekly — 2025 full year (ref) + 2026 available ──
  // weeklyRef  = 12 meses del año anterior (referencia, gris punteada)
  // weeklyCurrent = meses disponibles del año en curso (azul sólido)
  function combinedWeeklyChart(weeklyRef, weeklyCurrent, channelKey) {
    // channelKey: 'TOTAL' (default) o clave de canal como 'TIENDA', 'WEB', etc.
    const field = channelKey || 'TOTAL';
    // Aplana las semanas del año en una serie continua
    const flatten = (weekMap) => {
      const labels = [];
      const values = [];
      const titles = [];
      months.forEach(m => {
        const weeks = weekMap[m] || [];
        weeks.forEach((w, i) => {
          // Primera semana del mes muestra la abreviatura; las demás solo "S<n>"
          labels.push(i === 0 ? `${MONTH_SHORT[m]} S${w.w}` : `S${w.w}`);
          values.push(w[field] || 0);
          const end = Math.min(w.w * 7, ds.monthDays[m]);
          titles.push(`${m} · semana ${w.w} (${(w.w - 1) * 7 + 1}–${end} ${MONTH_SHORT[m].toLowerCase()})`);
        });
      });
      return { labels, values, titles };
    };

    // La referencia (2025) da la longitud del eje X (año completo)
    const ref = flatten(weeklyRef);
    const cur = flatten(weeklyCurrent);
    const axisLabels = ref.labels.length ? ref.labels : cur.labels;
    const axisTitles = ref.labels.length ? ref.titles : cur.titles;
    const refValues = ref.labels.length ? ref.values : axisLabels.map(() => null);

    // El año en curso se alinea al inicio de la serie (primera semana = Enero)
    const curAligned = axisLabels.map((_, i) =>
      i < cur.values.length && cur.values[i] > 0 ? cur.values[i] : null
    );

    return mount('chart-weekly-combined', {
      type: 'line',
      data: {
        labels: axisLabels,
        datasets: [
          {
            label: '2025 (referencia)',
            data: refValues,
            borderColor: '#94A3B8',
            backgroundColor: 'rgba(148,163,184,0.08)',
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointBackgroundColor: '#94A3B8',
            pointRadius: 2.5,
            pointHoverRadius: 5,
            tension: 0.3,
            fill: false,
          },
          {
            label: '2026',
            data: curAligned,
            borderColor: '#2563EB',
            backgroundColor: 'rgba(37,99,235,0.1)',
            borderWidth: 2.5,
            pointBackgroundColor: '#2563EB',
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.3,
            fill: true,
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: lineDraw(2000),
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              // Semanal: rango de días; Mensual/Acumulado cambian los labels
              // del chart y se muestra el label tal cual.
              title: items => {
                const it = items[0];
                return it && it.chart.data.labels === axisLabels ? axisTitles[it.dataIndex] : it?.label;
              },
              label: ctx => ctx.raw !== null
                ? ` ${ctx.dataset.label} · venta neta sin IGV: S/. ${Math.round(ctx.raw).toLocaleString('es-PE')}`
                : ` ${ctx.dataset.label}: sin datos`,
            },
          },
          datalabels: { display: false },
        },
        scales: {
          x: {
            ticks: {
              color: axisColor,
              font: { size: 10 },
              autoSkip: true,
              maxRotation: 0,
              callback(v, i) {
                const lbl = this.getLabelForValue(v);
                // Solo mostrar los labels que empiezan con abreviatura de mes
                return /^[A-Z][a-z]{2} /.test(lbl) ? lbl.split(' ')[0] : '';
              },
            },
            grid: { display: false },
          },
          y: {
            ticks: { color: axisColor, font: { size: 10 }, callback: v => 'S/. ' + (v / 1000).toFixed(0) + 'k' },
            grid: { color: gridColor },
          },
        },
      },
    });
  }

  global.Charts = {
    combinedWeeklyChart,
    mount, destroy, replay,
    destroyAll: () => { instances.forEach(c => c.destroy()); instances.clear(); },
    getInstance: id => instances.get(id),
    tot, fmt,
  };
})(window);
