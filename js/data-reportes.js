/* ============================================================
   data-reportes.js — datos del módulo Reportes.
   Fuente: carpeta de Drive "Reportes Casiopia" (Lima Retail).
   Los KPIs se transcriben de los PDFs mensuales de Ads; la
   biblioteca lista todos los archivos de la carpeta.
   Para agregar un mes: sumar un objeto a `monthly` y el archivo
   a `library` (kind 'pdf' | 'slides', id = fileId de Drive).
   Expone window.ReportesData.
   ============================================================ */

(function (global) {
  const FOLDER_ID = '15Juqtuk1r8QVYiaaxySMLC0biSBcPlaJ';

  // ── Reportes mensuales de Ads (Meta + Google + tienda) ──
  // web.ventas = facturación real de la tienda (null si el reporte no la trae).
  const monthly = [
    {
      key: 'jul-2026',
      label: 'Julio 2026',
      short: 'Jul',
      periodo: '1 – 31 jul 2026',
      parcial: false,
      fileId: '1FtFNX3Z4NtxMsPDbugbGO0G5zyLJ6g8r',
      inversion: 9377.21,
      meta:   { inv: 7802.14, compras: 94, valor: 36073, roas: 4.62, alcance: 428381 },
      google: { inv: 1575.07, compras: 17, valor: null, roas: 3.24, impresiones: 186242, clics: 3196 },
      web: { ventas: 30534.25, objetivo: 35000, roasReal: 3.26, plataforma: 'WooCommerce', vsComparado: 37.3, ticket: 324.33 },
      campanas: [
        { name: 'Catálogo E-Commerce',   gasto: 5742.54, compras: 59, roas: 4.38 },
        { name: 'Evergreen 2 - Manchas', gasto: 1183.74, compras: 22, roas: 5.54 },
        { name: 'WARM Liquidación',      gasto: 302.22,  compras: 3,  roas: 3.95 },
        { name: 'WARM LEADS BFJulio',    gasto: 275.82,  compras: 10, roas: 11.55 },
        { name: 'Tráfico + Interacción', gasto: 297.82,  compras: 0,  roas: null },
      ],
      anuncios: [
        { name: 'Ter inkacola',                compras: 17, gasto: 898.92,  roas: 4.39, top: true },
        { name: 'Nuevos productos en tienda',  compras: 14, gasto: 1281.05, roas: 6.41 },
        { name: 'Nueva colección - imagen',    compras: 14, gasto: 892.46,  roas: 6.39 },
        { name: 'Video agencia',               compras: 9,  gasto: 267.16,  roas: 10.99 },
        { name: 'Limones - nueva colección',   compras: 7,  gasto: 501.93,  roas: 4.31 },
      ],
      publico: [
        ['Mejor público', 'Mujeres (55 de 59 compras)'],
        ['Edad promedio', '44,9 años'],
        ['Menor CPA', '25-34 años (S/. 56,60)'],
        ['Dispositivo', 'Mobile (88%)'],
      ],
      destacado: 'La tienda facturó S/. 30.534 (+37,3% vs. periodo comparado) y llegó al 87,2% de la meta con ROAS web real de 3,26x. Quedó una brecha de S/. 4.466.',
      acciones: [
        'Escalar catálogo y formatos de video: "Video agencia" logra el mejor ROAS (10,99x).',
        'Reforzar remarketing y campañas de intención de compra para cerrar la brecha de S/. 4.466.',
        'Optimizar Search Manteles para capturar conversiones directas; PMax rinde 4,47x.',
        'Orientar la segmentación a mujeres, mobile, 25-44 y reforzar la línea Vistalegre.',
      ],
    },
    {
      key: 'ago-2026',
      label: 'Agosto 2026',
      short: 'Ago',
      periodo: '1 – 30 ago 2026',
      parcial: false,
      fileId: '17gZkSNLqT97YARvWUYeuKmp9K6O_NMH8',
      inversion: 11341.75,
      meta:   { inv: 9861.37, compras: 101, valor: 39924.81, roas: 4.05, cpa: 97.64 },
      google: { inv: 1480.38, compras: 16, valor: 4921.60, roas: 3.32, impresiones: 175318, clics: 4189 },
      web: { ventas: 29800, objetivo: 35000, roasReal: 2.63, plataforma: 'Shopify' },
      reparto: { agencia: 5702.74, cliente: 5639.01 },
      campanas: [
        { name: 'Evergreen 2 - Manchas', gasto: 4341.67, compras: 34, roas: 4.39 },
        { name: 'Ventas E-Commerce',     gasto: 3930.98, compras: 52, roas: 4.32 },
        { name: 'WARM Varios',           gasto: 731.76,  compras: 5,  roas: 3.76 },
        { name: 'Catálogo Warm Nuevos',  gasto: 565.58,  compras: 5,  roas: 1.99 },
        { name: 'Tráfico al Perfil',     gasto: 145.98,  compras: 0,  roas: null },
        { name: 'Interacción',           gasto: 145.40,  compras: 0,  roas: null },
      ],
      anuncios: [
        { name: 'Carrusel Abuela',                   compras: 25, gasto: 2130.15, roas: 7.64, top: true },
        { name: 'Confesión',                         compras: 23, gasto: 1352.35, roas: 6.21 },
        { name: 'POV: empiezas a combinar tu mesa',  compras: 14, gasto: 1082.21, roas: 4.63 },
        { name: 'Si sobrevivieron a estas 5 manchas', compras: 8, gasto: 758.84,  roas: 2.76 },
      ],
      publico: [
        ['Remarketing (Evergreen)', '34 compras · ROAS 4,39'],
        ['Catálogo público nuevo', '52 compras · ROAS 4,32'],
        ['Warm / tibio', '5 compras · ROAS 3,76'],
        ['Reparto inversión', 'Agencia 50,3% · Cliente 49,7%'],
      ],
      destacado: 'La tienda facturó S/. 29.800, el 85,1% del objetivo de S/. 35.000, con ROAS web real de 2,63x. El storytelling emocional ("Carrusel Abuela", "Confesión") lidera la conversión.',
      acciones: [
        'Escalar el storytelling emocional y producir variaciones del ángulo familia y mesa.',
        'Priorizar remarketing (Evergreen) y audiencias warm, las de mejor retorno.',
        'Reforzar remarketing sobre carritos y checkouts y mantener Google Shopping.',
        'Centralizar las campañas en "Ventas E-Commerce" (ver propuesta de presupuesto).',
      ],
    },
    {
      key: 'sep-2026',
      label: 'Septiembre 2026',
      short: 'Sep',
      periodo: '1 – 27 sep 2026',
      parcial: true,
      fileId: '1Meh8xJR85Q_JqsxQfQcTy8wm_jMPx0KX',
      inversion: 6741.41,
      meta:   { inv: 5140.07, compras: 61, valor: 22455.47, roas: 4.37, alcance: 303654, cpa: 80.53 },
      google: { inv: 1601.34, compras: 45, valor: 13982.80, roas: 8.73, impresiones: 121593, clics: 2600 },
      web: null,
      semanas: [
        { label: 'Sem 1 (1-7)',   compras: 15, valor: 3890, roas: 4.18, nota: 'Buen arranque' },
        { label: 'Sem 2 (8-14)',  compras: 17, valor: 5687, roas: 4.26, nota: 'Mayor volumen' },
        { label: 'Sem 3 (15-21)', compras: 13, valor: 4980, roas: 3.82, nota: 'Punto bajo' },
        { label: 'Sem 4 (22-27)', compras: 16, valor: 7899, roas: 5.03, nota: 'Mejor ROAS' },
      ],
      campanas: [
        { name: 'Ventas E-Commerce',    gasto: 4093, compras: 52, roas: 4.64 },
        { name: 'Evergreen Manchas',    gasto: 599,  compras: 5,  roas: 4.66 },
        { name: 'Catálogo Warm',        gasto: 221,  compras: 4,  roas: 2.99 },
        { name: 'Tráfico / Interacción', gasto: 228, compras: 0,  roas: null },
      ],
      anuncios: [
        { name: 'POV: empiezas a combinar tu mesa', compras: 16, gasto: 616,  roas: 8.86, top: true },
        { name: 'Confesión',                        compras: 15, gasto: 1576, roas: 4.07 },
        { name: 'Tres mesas, tres combinaciones',   compras: 6,  gasto: 361,  roas: 6.02 },
        { name: 'Tu mesa también habla de ti',      compras: 4,  gasto: 253,  roas: 7.68 },
      ],
      publico: [
        ['Mejor público', 'Mujeres (95% de compras)'],
        ['Rango más rentable', '35-44 años (26 compras)'],
        ['Menor CPA', '35-44 años (S/. 59,92)'],
        ['Carritos sin cerrar', '378 carritos · 139 pagos iniciados'],
      ],
      destacado: 'Google (Performance Max) es el canal más eficiente: 45 compras con ROAS 8,73. En Meta, "POV: combinar tu mesa" lidera con 16 compras y ROAS 8,86.',
      acciones: [
        'Escalar Google: liberar primero el feed de Merchant Center (19% de productos rechazados).',
        'Producir variaciones del formato POV de combinación de mesa (ROAS 8,86).',
        'Orientar creativos y segmentación a mujeres 35-44, el público de menor CPA.',
        'Recuperar 378 carritos y 139 pagos iniciados con mailing, remarketing y WhatsApp.',
        'Rotar los creativos de menor ROAS (Confesión, 4,07) por variaciones de los ganadores.',
      ],
    },
  ];

  // ── Biblioteca: todos los archivos de la carpeta ──
  // cat: Mensual | Semanal | Avance | Cierre | Presupuesto | Dashboard | Ejecutivo
  // dup: copia o versión anterior de otro archivo. size: bytes en Drive.
  const library = [
    // Reportes Ads 2026 (PDF)
    { id: '1Meh8xJR85Q_JqsxQfQcTy8wm_jMPx0KX', kind: 'pdf', size: 204673, cat: 'Mensual', name: 'Reporte Ads · Septiembre 2026', periodo: '1 – 27 sep 2026', fecha: '2026-09-28', file: 'Reporte_Casiopia_1-27Sep2026.pdf' },
    { id: '1FtFNX3Z4NtxMsPDbugbGO0G5zyLJ6g8r', kind: 'pdf', size: 189630, cat: 'Mensual', name: 'Reporte Ads · Julio 2026', periodo: '1 – 31 jul 2026', fecha: '2026-09-28', file: 'Casiopia_Julio2026.pdf' },
    { id: '17gZkSNLqT97YARvWUYeuKmp9K6O_NMH8', kind: 'pdf', size: 312441, cat: 'Mensual', name: 'Reporte Ads · Agosto 2026', periodo: '1 – 30 ago 2026', fecha: '2026-09-08', file: 'Reporte_Ads_Casiopia_Agosto2026 (3) (1).pdf' },
    { id: '18nKSyqrfL9fIVd8uMPEx9c-AiDTBT_lO', kind: 'pdf', size: 212385, cat: 'Avance', name: 'Avance Ads · Septiembre 2026', periodo: '1 – 6 sep 2026', fecha: '2026-09-07', file: 'Reporte_Casiopia_Septiembre2026.pdf' },
    { id: '1TPSCB63WS9uOZc-KkZN-xsIDTHVaSxWl', kind: 'pdf', size: 312441, cat: 'Mensual', name: 'Reporte Ads · Agosto 2026 (copia)', periodo: '1 – 30 ago 2026', fecha: '2026-09-03', file: 'Reporte_Ads_Casiopia_Agosto2026 (3).pdf', dup: true },
    { id: '19nUhesY1UFQmlPpJI0mvUr_ILj-G3sNm', kind: 'pdf', size: 312441, cat: 'Mensual', name: 'Reporte Ads · Agosto 2026 (copia)', periodo: '1 – 30 ago 2026', fecha: '2026-09-01', file: 'Reporte_Ads_Casiopia_Agosto2026 (2).pdf', dup: true },
    { id: '1KosRvTJc19as8EELzRVywFhYpZeLzVGi', kind: 'pdf', size: 25817, cat: 'Presupuesto', name: 'Propuesta de presupuesto · Centralización Ventas E-Commerce', periodo: 'Agosto 2026', fecha: '2026-08-31', file: 'Propuesta_Presupuesto_Casiopia (2) (1).pdf' },
    { id: '1ROcCJmZAidX3Mqj6HYhrVOB7BKlrPdHV', kind: 'pdf', size: 263321, cat: 'Mensual', name: 'Reporte Ads · Agosto 2026 (versión previa)', periodo: '1 – 30 ago 2026', fecha: '2026-08-31', file: 'Reporte_Ads_Casiopia_Agosto2026 (1).pdf', dup: true },
    { id: '1L5aGhJlW7kGpObfiE91axj_2nuivSjdI', kind: 'pdf', size: 263321, cat: 'Mensual', name: 'Reporte Ads · Agosto 2026 (versión previa)', periodo: '1 – 30 ago 2026', fecha: '2026-08-31', file: 'Reporte_Ads_Casiopia_Agosto2026 (4).pdf', dup: true },
    { id: '1fuN3tPfHriQpZPs2N2S9bmaeFLuPRhXo', kind: 'pdf', size: 10066697, cat: 'Dashboard', name: 'Dashboard Lima Retail · Casiopia', periodo: 'Agosto 2026', fecha: '2026-08-24', file: 'Casiopia_-_Dashboard_Lima_Retail (4).pdf' },
    { id: '1H8CSV0tSzNJT4IHUDprMTk2CYikfxCC8', kind: 'pdf', size: 25817, cat: 'Presupuesto', name: 'Propuesta de presupuesto (versión previa)', periodo: 'Agosto 2026', fecha: '2026-08-20', file: 'Propuesta_Presupuesto_Casiopia (2).pdf', dup: true },
    { id: '1RsXP2C65Mbnd6lr51_-ts07Vpn9Nw8GU', kind: 'pdf', size: 25817, cat: 'Presupuesto', name: 'Propuesta de presupuesto (versión previa)', periodo: 'Agosto 2026', fecha: '2026-08-20', file: 'Propuesta_Presupuesto_Casiopia (1).pdf', dup: true },
    { id: '17v1TXOooWf16qfQt5tY1ZMMy9ZfaOJTC', kind: 'pdf', size: 23481, cat: 'Presupuesto', name: 'Propuesta de presupuesto (versión previa)', periodo: 'Agosto 2026', fecha: '2026-08-20', file: 'Propuesta_Presupuesto_Casiopia.pdf', dup: true },
    { id: '1R-s3ZTTIvQiUfoQzwdzxFQdqCBP5B3Z2', kind: 'pdf', size: 238822, cat: 'Avance', name: 'Avance Ads · Agosto 2026 (2da quincena)', periodo: 'Agosto 2026', fecha: '2026-08-17', file: 'Reporte_Casiopia_Agosto2026 (1).pdf' },
    { id: '1afHtwYrEY3TYBfdXtmMe1KYzdofs9cNR', kind: 'pdf', size: 186820, cat: 'Avance', name: 'Avance Ads · Agosto 2026 (1ra quincena)', periodo: 'Agosto 2026', fecha: '2026-08-11', file: 'Reporte_Casiopia_Agosto2026.pdf' },
    { id: '1r7SAVE_W5jN-6axJSxxfGAmh4um0QfGg', kind: 'pdf', size: 10851, cat: 'Cierre', name: 'Reporte de cierre · Julio 2026', periodo: '1 – 31 jul 2026', fecha: '2026-07-31', file: 'Reporte_Casiopia_Julio_2026_CIERRE_CLIENTE_FINAL.pdf' },
    { id: '1hhWraOkLHQCAh8oLsOasp8Hg5zqNKjtK', kind: 'pdf', size: 110858, cat: 'Avance', name: 'Avance Ads · Julio 2026 (fin de mes)', periodo: 'Julio 2026', fecha: '2026-07-31', file: 'Reporte_Casiopia_Julio_2026.pdf' },
    { id: '1olXGBAJ3TQBpH32PhJDhisGobYgTuPI6', kind: 'pdf', size: 198388, cat: 'Avance', name: 'Avance Ads · Julio 2026', periodo: 'Julio 2026', fecha: '2026-07-27', file: 'Reporte_Casiopia_Julio2026.pdf' },
    { id: '1SAnCz5UBoh1C-QS88BduCTLHoGIkKch_', kind: 'pdf', size: 10095001, cat: 'Dashboard', name: 'Dashboard Lima Retail · Casiopia (versión previa)', periodo: 'Julio 2026', fecha: '2026-07-27', file: 'Casiopia_-_Dashboard_Lima_Retail (2).pdf', dup: true },
    { id: '1WwCzIL5KL3Gw4TLWXrUHKJD9D2sRs4l_', kind: 'pdf', size: 229298, cat: 'Avance', name: 'Avance Ads · 1 – 19 julio 2026', periodo: '1 – 19 jul 2026', fecha: '2026-07-20', file: 'Casiopia_1-19Julio2026.pdf' },
    { id: '18EdrxNLa8K9OD76JBQGUPV6PaLHcdpWZ', kind: 'pdf', size: 10076348, cat: 'Dashboard', name: 'Dashboard Lima Retail · Casiopia (versión previa)', periodo: 'Julio 2026', fecha: '2026-07-20', file: 'Casiopia_-_Dashboard_Lima_Retail (1).pdf', dup: true },
    { id: '1nkq_CG-fxmIht8dfrlc7p2FfXONFzjI5', kind: 'pdf', size: 964469, cat: 'Avance', name: 'Avance Ads · Inicio de julio 2026', periodo: 'Julio 2026', fecha: '2026-07-08', file: 'Reporte_Casiopia_Julio2026 (2).pdf.pdf' },

    // Presentaciones (Google Slides) sep 2025 – feb 2026
    { id: '1Aidn-2Yt7auXo6Zb9TrXkhRm1_AnHUs_BQLKFSlQJ0s', kind: 'slides', size: 5363171, cat: 'Semanal', name: 'Semanal · 02-08 vs 09-15 feb', periodo: '02 – 15 feb 2026', fecha: '2026-02-16', file: 'Reporte Casiopia | Reporte 02 - 08 vs 09 - 15 Febrero' },
    { id: '1mN9qWOIa4Dc2xFgn1-7UNRy2uvtNlAUOCHsILcRW1Uw', kind: 'slides', size: 4114493, cat: 'Semanal', name: 'Semanal · 26-01 vs 02-08 feb', periodo: '26 ene – 08 feb 2026', fecha: '2026-02-09', file: 'Reporte Casiopia | Reporte 26 - 01 vs 2 - 8 Febrero' },
    { id: '12Kqwx5Dx7cwZIISUxXU9jfi-iMg-Vs8jym26OSLJPMY', kind: 'slides', size: 4846336, cat: 'Mensual', name: 'Reporte mensual · Enero 2026', periodo: 'Enero 2026', fecha: '2026-02-02', file: 'Reporte Casiopia | Reporte Enero 2026' },
    { id: '1Km5NmcSgFwsgf2yi15bWq5m_zZV1ojuQNr4XLLgdRXM', kind: 'slides', size: 4838687, cat: 'Semanal', name: 'Semanal · 12-18 vs 19-25 ene', periodo: '12 – 25 ene 2026', fecha: '2026-01-26', file: 'Reporte Casiopia | Reporte diciembre 12 - 18 vs 19 - 25 de enero' },
    { id: '1jwgtLfZLVOdLw2JAkJASO3rnj5zO7YoKFd0aFDkq58c', kind: 'slides', size: 3278668, cat: 'Semanal', name: 'Semanal · 05-11 vs 12-18 ene', periodo: '05 – 18 ene 2026', fecha: '2026-01-20', file: 'Reporte Casiopia | Reporte diciembre 05 - 11 vs 12 - 18 de enero' },
    { id: '1YwB2tK-X90LbifEFsQ4UMlvt34edUugIXa4P5c1eSSM', kind: 'slides', size: 3669688, cat: 'Mensual', name: 'Reporte mensual · Diciembre 2025', periodo: 'Diciembre 2025', fecha: '2026-01-17', file: 'Reporte Casiopia | Reporte diciembre 2025' },
    { id: '1ORVx8QhWc2DRF4nbvlhPejPf3pYnxTNQzMZgCMOI4rw', kind: 'slides', size: 3282532, cat: 'Semanal', name: 'Semanal · 29-04 vs 05-11 ene', periodo: '29 dic – 11 ene 2026', fecha: '2026-01-12', file: 'Reporte Casiopia | Reporte diciembre 29 - 04 vs 05 - 11 de enero' },
    { id: '1QWu1DQ7YedERsKZqJLEynuLhTU9J81imGqrPHrTGbwY', kind: 'slides', size: 4079252, cat: 'Mensual', name: 'Reporte mensual · Diciembre 2025 (versión previa)', periodo: 'Diciembre 2025', fecha: '2026-01-07', file: 'Reporte Casiopia | Reporte diciembre', dup: true },
    { id: '1veruh-Fo_rO4vypx7iPl1CqCMLZLBMmPsvad1a5lVl8', kind: 'slides', size: 3549151, cat: 'Semanal', name: 'Semanal · 15-21 vs 22-28 dic', periodo: '15 – 28 dic 2025', fecha: '2025-12-29', file: 'Reporte Casiopia | Reporte 15 - 21 vs 22 - 28 diciembre' },
    { id: '1yHi2H2OYIV1iwXooekTTwu-nIGJQMVh24TeAXMBEEtI', kind: 'slides', size: 3606040, cat: 'Semanal', name: 'Semanal · 08-14 vs 15-21 dic', periodo: '08 – 21 dic 2025', fecha: '2025-12-22', file: 'Reporte Casiopia | Reporte 8 - 14 vs 15 - 21 diciembre' },
    { id: '1050C-BBJfZi-lvDz-rdYHxHiMVpWGSDnrcdJFAd4cCM', kind: 'slides', size: 3468568, cat: 'Semanal', name: 'Semanal · 01-07 vs 08-14 dic', periodo: '01 – 14 dic 2025', fecha: '2025-12-15', file: 'Reporte Casiopia | Reporte 1 - 7 vs 8 - 14 diciembre' },
    { id: '1OfB4K872OX4fDELIpAM06W2VBFyZLyk6c13poQb0SwA', kind: 'slides', size: 3195560, cat: 'Semanal', name: 'Semanal · Inicio de diciembre', periodo: 'Dic 2025', fecha: '2025-12-08', file: 'Reporte Casiopia | Reporte diciembre' },
    { id: '1MVZK_vQpLZSRwZzTnK0tPA-Gn07mqM-MTJQPRXFvT-4', kind: 'slides', size: 4232009, cat: 'Mensual', name: 'Reporte mensual · Noviembre 2025', periodo: 'Noviembre 2025', fecha: '2025-12-01', file: 'Reporte Casiopia | Reporte Noviembre' },
    { id: '1WRWSxN5iWeGk3hJsA67Y4WuaRozxamvTwigq6G3NvKg', kind: 'slides', size: 3090621, cat: 'Semanal', name: 'Semanal · 10-16 vs 17-23 nov', periodo: '10 – 23 nov 2025', fecha: '2025-11-24', file: 'Reporte Casiopia | Reporte 10 - 16 vs 17 - 23 de noviembre' },
    { id: '1ay2l09NVrKjamK3Uqvbix6wMS_Ak4rBrW99v7WunN7Y', kind: 'slides', size: 3110155, cat: 'Semanal', name: 'Semanal · 03-09 vs 10-16 nov', periodo: '03 – 16 nov 2025', fecha: '2025-11-18', file: 'Reporte Casiopia | Reporte 03 - 09 vs 10 - 16 de noviembre' },
    { id: '13M9bVZZZxKr8Oj069klotGkknqswP0h97E4v7R_CaUQ', kind: 'slides', size: 2628049, cat: 'Ejecutivo', name: 'Reporte ejecutivo · Próximas semanas', periodo: 'Nov 2025', fecha: '2025-11-13', file: 'Reporte Casiopia | Reporte Ejecutivo - Próximas semanas' },
    { id: '13SXcuvg6uo4QKcVWL9DUzrGd8oIZ1x7VWdluDZM15LY', kind: 'slides', size: 3080653, cat: 'Semanal', name: 'Semanal · 27-02 vs 03-09 nov', periodo: '27 oct – 09 nov 2025', fecha: '2025-11-10', file: 'Reporte Casiopia | Reporte octubre 27 - 02 vs 03 - 09 de noviembre' },
    { id: '1oapNc6rHif2v2UAnAcOOqPjR-glzs9bLKxz8y5qa3pw', kind: 'slides', size: 2896806, cat: 'Semanal', name: 'Semanal · 20-26 oct vs 27-02 nov', periodo: '20 oct – 02 nov 2025', fecha: '2025-11-03', file: 'Reporte Casiopia | Reporte 20 - 26 octubre vs 27 - 02 de noviembre' },
    { id: '17VBW9EuaWnTA79EBiwyeAZ15TIahA1hVKHg4-IPDnrs', kind: 'slides', size: 3035719, cat: 'Semanal', name: 'Semanal · 13-19 vs 20-26 oct', periodo: '13 – 26 oct 2025', fecha: '2025-10-28', file: 'Reporte Casiopia | Reporte 13 - 19 vs 20 - 26 octubre' },
    { id: '14hBB7XRU3c55ZwYxGuOsCQk8eZM6vFlW5e52DmCF3aQ', kind: 'slides', size: 2806792, cat: 'Semanal', name: 'Semanal · 06-12 vs 13-19 oct', periodo: '06 – 19 oct 2025', fecha: '2025-10-20', file: 'Reporte Casiopia | Reporte 06 - 12 vs 13 - 19 octubre' },
    { id: '1TODke363o4A5AcNWSV7fv297mIHvqExDAR0i9BGn9Gk', kind: 'slides', size: 3011047, cat: 'Semanal', name: 'Semanal · 29 sep – 12 oct', periodo: '29 sep – 12 oct 2025', fecha: '2025-10-14', file: 'Reporte Casiopia | Reporte septiembre 29 -12 octubre' },
    { id: '1jAcceceY1zAl7x9csqfgTMEmMjcC8oOirz-EKLGi7vU', kind: 'slides', size: 3179956, cat: 'Semanal', name: 'Semanal · 15 – 28 sep', periodo: '15 – 28 sep 2025', fecha: '2025-10-02', file: 'Reporte Casiopia | Sem 15 al 28 setiembre' },
    { id: '1TNAPDlSf-YsZVkQ6obSeRdaUoytLlUW8hhydmQ8oqyw', kind: 'slides', size: 2805662, cat: 'Semanal', name: 'Semanal · 08 – 21 sep', periodo: '08 – 21 sep 2025', fecha: '2025-09-23', file: 'Reporte Casiopia | Sem 08 al 21 setiembre' },
    { id: '1sZ17oIWolqB4OkinVjpkZLIn4t_sGZmjtlO3uD08bbM', kind: 'slides', size: 2806123, cat: 'Semanal', name: 'Semanal · 01 – 14 sep', periodo: '01 – 14 sep 2025', fecha: '2025-09-15', file: 'Reporte Casiopia | Sem 01 al 14 setiembre' },
    { id: '1lLHq8kMPT4Q2kc28jFs5qi0OA-OjcykCbo8AWVzundY', kind: 'slides', size: 2821044, cat: 'Semanal', name: 'Semanal · 25 ago – 07 sep', periodo: '25 ago – 07 sep 2025', fecha: '2025-09-09', file: 'Reporte Casiopia | Sem 25 al 07 agosto' },
    { id: '1TTIp_3Q2nHd2WCQPZPu7T4r9nGDLvis7ll5_505lPjc', kind: 'slides', size: 2785498, cat: 'Semanal', name: 'Semanal · 18 – 31 ago', periodo: '18 – 31 ago 2025', fecha: '2025-09-03', file: 'Reporte Casiopia | Sem 18 al 31 agosto' },
  ];

  function fileUrl(kind, id) {
    return kind === 'slides'
      ? `https://docs.google.com/presentation/d/${id}/edit`
      : `https://drive.google.com/file/d/${id}/view`;
  }

  global.ReportesData = {
    folderId: FOLDER_ID,
    folderUrl: `https://drive.google.com/drive/folders/${FOLDER_ID}`,
    monthly,
    library,
    fileUrl,
  };
})(window);
