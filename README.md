# Lima Retail · Dashboard de Ventas 2026

Dashboard de ventas por canal (Tienda, Web, WhatsApp, Showroom, Instagram, Facebook) con comparativo YoY, distribución, análisis de productos web y simulador de objetivos.

Los datos de 2026 se sincronizan automáticamente desde un Google Sheet mediante un pipeline que corre en GitHub Actions.

## Estructura

```
/
  index.html              Shell HTML (carga módulos separados)
  css/
    ds.css                Design system (tokens + componentes)
    dashboard.css         Estilos específicos del dashboard
  js/
    data-static.js        Datos 2025, productos web, targets por defecto
    data-live.js          Fetcher de data/ventas-2026.json
    charts.js             Instancias de Chart.js
    objectives.js         Vista de Objetivos (pace tracker, weekly charts)
    data-reportes.js      KPIs de los reportes de Ads + índice de la carpeta de Drive
    reportes.js           Vista Gasto publicitario (KPIs, campañas, tendencia)
    archivo.js            Vista Archivo de Reportes (accesos directos a Drive)
    sheets.js             Indicador de sync + trigger de workflow
    main.js               Orquestación: init, navegación, render
  data/
    ventas-2026.json      Generado por el pipeline (no editar a mano)
  scripts/
    fetch-data.js         Lee Google Sheets → escribe data/ventas-2026.json
    build.js              Inlines css+js en dist/index.html para deploy
  .github/workflows/
    update-data.yml       Sync horario del sheet + workflow_dispatch
    deploy.yml            Build + deploy a GitHub Pages en cada push a main
```

## Módulos Gasto publicitario y Archivo de Reportes

### Fuentes de Gasto publicitario (una pestaña por fuente)

| Pestaña | Fuente en Drive | JSON generado |
|---|---|---|
| Ventas | Excel `Ventas 2026.xlsx` (hojas *Ventas* y *EERR*) | `data/casiopia-ventas.json` |
| Meta Ads | Carpeta *Datos de Meta Ads* (un Google Sheet por mes, exportación de Ads Manager) | `data/casiopia-meta.json` |
| Google Ads | Carpeta *Google Files - Casiopia* (CSV, Excel o Google Sheet) | `data/casiopia-google.json` |
| Reportes de agencia | PDF transcritos en `js/data-reportes.js` | — |

`npm run fetch:casiopia` los genera con la Drive API (scope `drive.readonly`). La service account debe tener acceso de lector al Excel y a las dos carpetas, y el proyecto de Google Cloud debe tener habilitada la **Drive API**. Para desarrollo sin credenciales: `node scripts/fetch-casiopia.js --local=<dir>` con `<dir>/ventas-2026.xlsx`, `<dir>/meta/*.csv` y `<dir>/google/*`. Los JSON solo contienen totales por mes y canal: nunca nombres de clientes.

**Gasto publicitario** resume los reportes mensuales de pauta (Meta + Google) de la carpeta de Drive *Reportes Casiopia*. **Archivo de Reportes** lista todos los archivos de esa carpeta con filtros, previsualización, enlace a Drive y descarga. Ambos leen `js/data-reportes.js`: para sumar un mes nuevo, agregá un objeto a `monthly` (KPIs del PDF) y el archivo a `library` (`fileId`, tipo, periodo, fecha y peso en bytes).

## Desarrollo local

```bash
npm install
npm run dev          # live-server en http://localhost:3000
```

Si el navegador no tiene `data/ventas-2026.json`, el dashboard muestra un banner de error. Para generarlo desde un sheet privado (una sola vez):

1. Crear un service account en Google Cloud Console con permiso de lectura de Sheets API.
2. Descargar el JSON y guardarlo en `credentials/service-account.json` (ignorado por git).
3. Compartir el sheet con el email del service account.
4. Ejecutar:

```bash
npm run fetch
```

## Pipeline de datos

El workflow `update-data.yml` corre cada hora y ejecuta `node scripts/fetch-data.js` usando el secreto `SERVICE_ACCOUNT_JSON` (JSON del service account pegado entero como secreto del repo). Si hay cambios en `data/ventas-2026.json`, commitea a `main`, lo que dispara el deploy.

### Forzar una sincronización inmediata

Opción A — desde GitHub: `Actions → Actualizar datos de ventas → Run workflow`.

Opción B — desde el dashboard: el botón **Actualizar** dispara el workflow vía la GitHub API si guardaste un Personal Access Token en el modal de ajustes. El token (scope `workflow`) se guarda sólo en tu `localStorage`.

## Deploy

`deploy.yml` corre en cada push a `main`:

1. `npm run build` → genera `dist/index.html` con todos los `.css` y `.js` inlined.
2. Sube el artifact y publica en GitHub Pages.

La URL pública queda expuesta en la pestaña `Settings → Pages` del repositorio.

## Configuración inicial (una vez)

1. En Google Cloud Console: habilitar **Sheets API** y crear un service account.
2. Descargar el JSON de credenciales y pegar su contenido completo como secret `SERVICE_ACCOUNT_JSON` en `Settings → Secrets → Actions`.
3. Compartir el spreadsheet con el email del service account (permiso lector).
4. En `Settings → Pages`, seleccionar source = `GitHub Actions`.
5. Pushear a main — el primer deploy corre solo.
