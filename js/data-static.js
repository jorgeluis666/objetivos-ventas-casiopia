/* ============================================================
   Datos estáticos — no cambian con el pipeline de Sheets.
   Expone window.DataStatic con:
     - channels, palette
     - d2025, defaultTargets, monthDays
     - objetivos por canal de Casiopia
   ============================================================ */

(function (global) {
  const channels = ['Tienda', 'Web', 'WhatsApp', 'Showroom', 'Instagram', 'Facebook'];

  const palette = {
    Tienda:    '#2563EB',
    Web:       '#7C3AED',
    WhatsApp:  '#059669',
    Showroom:  '#D97706',
    Instagram: '#DB2777',
    Facebook:  '#64748B',
  };

  const d2025 = {
    Enero:      { Tienda: 44745.56, Web:  8196.80, WhatsApp: 1219.44, Showroom: 0, Instagram: 227.20, Facebook: 0 },
    Febrero:    { Tienda: 48628.60, Web:  9726.80, WhatsApp: 3510.80, Showroom: 0, Instagram: 0,      Facebook: 0 },
    Marzo:      { Tienda: 63861.93, Web: 13518.50, WhatsApp: 3459.60, Showroom: 0, Instagram: 182.40, Facebook: 0 },
    Abril:      { Tienda: 54762.89, Web:  9316.54, WhatsApp: 5367.70, Showroom: 0, Instagram: 0,      Facebook: 0 },
    Mayo:       { Tienda: 0, Web: 0, WhatsApp: 0, Showroom: 0, Instagram: 0, Facebook: 0 },
    Junio:      { Tienda: 0, Web: 0, WhatsApp: 0, Showroom: 0, Instagram: 0, Facebook: 0 },
    Julio:      { Tienda: 0, Web: 0, WhatsApp: 0, Showroom: 0, Instagram: 0, Facebook: 0 },
    Agosto:     { Tienda: 0, Web: 0, WhatsApp: 0, Showroom: 0, Instagram: 0, Facebook: 0 },
    Septiembre: { Tienda: 0, Web: 0, WhatsApp: 0, Showroom: 0, Instagram: 0, Facebook: 0 },
    Octubre:    { Tienda: 0, Web: 0, WhatsApp: 0, Showroom: 0, Instagram: 0, Facebook: 0 },
    Noviembre:  { Tienda: 0, Web: 0, WhatsApp: 0, Showroom: 0, Instagram: 0, Facebook: 0 },
    Diciembre:  { Tienda: 0, Web: 0, WhatsApp: 0, Showroom: 0, Instagram: 0, Facebook: 0 },
  };

  const defaultTargets = {
    Enero:      { Tienda: 40000, Web: 11000, WhatsApp: 3500, Showroom: 4000, Instagram: 1500, Facebook: 0 },
    Febrero:    { Tienda: 46000, Web: 14000, WhatsApp: 4000, Showroom: 2500, Instagram:  500, Facebook: 0 },
    Marzo:      { Tienda: 62000, Web: 12000, WhatsApp: 4500, Showroom: 3000, Instagram: 1000, Facebook: 0 },
    Abril:      { Tienda: 56000, Web: 10000, WhatsApp: 5000, Showroom: 2500, Instagram:  500, Facebook: 0 },
    Mayo:       { Tienda: 60000, Web: 12000, WhatsApp: 4500, Showroom: 3000, Instagram:  500, Facebook: 0 },
    Junio:      { Tienda: 65000, Web: 13000, WhatsApp: 5000, Showroom: 3000, Instagram:  500, Facebook: 0 },
    Julio:      { Tienda: 65000, Web: 13000, WhatsApp: 5000, Showroom: 3000, Instagram:  500, Facebook: 0 },
    Agosto:     { Tienda: 70000, Web: 14000, WhatsApp: 5000, Showroom: 3000, Instagram:  500, Facebook: 0 },
    Septiembre: { Tienda: 70000, Web: 14000, WhatsApp: 5000, Showroom: 3000, Instagram:  500, Facebook: 0 },
    Octubre:    { Tienda: 75000, Web: 15000, WhatsApp: 5500, Showroom: 3500, Instagram:  500, Facebook: 0 },
    Noviembre:  { Tienda: 85000, Web: 17000, WhatsApp: 6000, Showroom: 4000, Instagram:  500, Facebook: 0 },
    Diciembre:  { Tienda: 90000, Web: 18000, WhatsApp: 6000, Showroom: 4000, Instagram:  500, Facebook: 0 },
  };

  const objectiveChannels = ['Web', 'RRSS', 'La Mar', 'El Polo', 'Falabella', 'Otros'];

  const objectivePalette = {
    Web:       '#7C3AED',
    RRSS:      '#DB2777',
    'La Mar':  '#2563EB',
    'El Polo': '#059669',
    Falabella: '#D97706',
    Otros:     '#64748B',
  };

  const objectiveTargets = {
    Enero:      { Web: 20000, RRSS: 10000, 'La Mar': 20000, 'El Polo': 30000,  Falabella: 0, Otros: 0 },
    Febrero:    { Web: 30000, RRSS: 10000, 'La Mar': 17000, 'El Polo': 43000,  Falabella: 0, Otros: 0 },
    Marzo:      { Web: 35000, RRSS: 10000, 'La Mar': 30000, 'El Polo': 45000,  Falabella: 0, Otros: 0 },
    Abril:      { Web: 35000, RRSS: 10000, 'La Mar': 30000, 'El Polo': 45000,  Falabella: 0, Otros: 0 },
    Mayo:       { Web: 40000, RRSS: 10000, 'La Mar': 25000, 'El Polo': 35000,  Falabella: 0, Otros: 0 },
    Junio:      { Web: 40000, RRSS: 10000, 'La Mar': 25000, 'El Polo': 27000,  Falabella: 0, Otros: 0 },
    Julio:      { Web: 40000, RRSS: 10000, 'La Mar': 20000, 'El Polo': 15000,  Falabella: 0, Otros: 0 },
    Agosto:     { Web: 40000, RRSS: 10000, 'La Mar': 20000, 'El Polo': 26000,  Falabella: 0, Otros: 0 },
    Septiembre: { Web: 0,     RRSS: 0,     'La Mar': 0,     'El Polo': 96000,  Falabella: 0, Otros: 0 },
    Octubre:    { Web: 0,     RRSS: 0,     'La Mar': 0,     'El Polo': 113000, Falabella: 0, Otros: 0 },
    Noviembre:  { Web: 0,     RRSS: 0,     'La Mar': 0,     'El Polo': 183000, Falabella: 0, Otros: 0 },
    Diciembre:  { Web: 0,     RRSS: 0,     'La Mar': 0,     'El Polo': 255000, Falabella: 0, Otros: 0 },
  };

  const objectiveActuals2026 = {
    Enero:      { Web: 26406, RRSS: 10161, 'La Mar': 17866, 'El Polo': 43246, Falabella:  598, Otros: 10848 },
    Febrero:    { Web: 32935, RRSS:  4030, 'La Mar': 21116, 'El Polo': 29354, Falabella: 1053, Otros:  3159 },
    Marzo:      { Web: 38188, RRSS:  7453, 'La Mar': 21389, 'El Polo': 42777, Falabella: 2555, Otros:  4072 },
    Abril:      { Web: 36035, RRSS:  7083, 'La Mar': 17882, 'El Polo': 40293, Falabella: 2211, Otros:   238 },
    Mayo:       { Web: 30741, RRSS:  7915, 'La Mar': 22060, 'El Polo': 38098, Falabella:  342, Otros:   855 },
    Junio:      { Web: 20381, RRSS:  5326, 'La Mar': 19348, 'El Polo': 33597, Falabella:   38, Otros:   454 },
    Julio:      { Web: 28718, RRSS:  8898, 'La Mar': 13455, 'El Polo': 52878, Falabella:  858, Otros:     0 },
    Agosto:     { Web:   966, RRSS:  1076, 'La Mar':    68, 'El Polo':  4177, Falabella:   97, Otros:     0 },
    Septiembre: { Web:     0, RRSS:     0, 'La Mar':     0, 'El Polo':     0, Falabella:    0, Otros:     0 },
    Octubre:    { Web:     0, RRSS:     0, 'La Mar':     0, 'El Polo':     0, Falabella:    0, Otros:     0 },
    Noviembre:  { Web:     0, RRSS:     0, 'La Mar':     0, 'El Polo':     0, Falabella:    0, Otros:     0 },
    Diciembre:  { Web:     0, RRSS:     0, 'La Mar':     0, 'El Polo':     0, Falabella:    0, Otros:     0 },
  };

  const monthDays = {
    Enero: 31, Febrero: 28, Marzo: 31, Abril: 30,
    Mayo: 31, Junio: 30, Julio: 31, Agosto: 31,
    Septiembre: 30, Octubre: 31, Noviembre: 30, Diciembre: 31,
  };
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril',
    'Mayo', 'Junio', 'Julio', 'Agosto',
    'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  // Meses de 2026 que ya tienen datos cerrados/en curso (el pipeline solo
  // lee estos del sheet). Se expanden conforme 2026 avanza.
  const monthsWith2026Data = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto'];

  const STEP = 500;

  // Canal ↔ CHANNEL (upper) mapping del sheet
  const chToUpper = {
    Tienda: 'TIENDA', Web: 'WEB', WhatsApp: 'WHATSAPP',
    Showroom: 'SHOWROOM', Instagram: 'INSTAGRAM', Facebook: 'FACEBOOK',
  };

  const objectiveChToUpper = {
    Web: 'WEB', RRSS: 'RRSS', 'La Mar': 'LA_MAR',
    'El Polo': 'EL_POLO', Falabella: 'FALABELLA', Otros: 'OTROS',
  };

  global.DataStatic = {
    channels, palette,
    d2025, defaultTargets, monthDays, months, monthsWith2026Data,
    objectiveChannels, objectivePalette, objectiveTargets, objectiveActuals2026,
    STEP,
    chToUpper, objectiveChToUpper,
  };
})(window);
