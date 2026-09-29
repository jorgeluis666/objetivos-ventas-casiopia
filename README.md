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
    data-reportes.js      Índice de la carpeta de Drive de reportes
    gasto.js              Vista Gasto publicitario (Meta Ads + Google Ads, botón Sincronizar ahora)
    archivo.js            Vista Archivo de Reportes (accesos directos a Drive, botón Sincronizar con Drive)
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

## Dominio: casiopia.limaretail.com

El dashboard se publica en **https://casiopia.limaretail.com** con GitHub Pages. El dominio lo fija el archivo `CNAME` de la raíz (`build.js` también lo copia a `dist/`). No hay servidor propio: cada push a `main` (manual o de los workflows de datos) se publica solo en el mismo dominio.

Configuración única (ya hecha, solo para referencia o para rehacerla):

1. **DNS** (zona de `limaretail.com` en Banahosting / cPanel → *Zone Editor*): registro `CNAME` · nombre `casiopia` · destino `jorgeluis666.github.io.`
2. **GitHub** → repo → *Settings → Pages*: *Custom domain* = `casiopia.limaretail.com` y marcar **Enforce HTTPS** cuando GitHub termine de emitir el certificado.

La URL anterior (`jorgeluis666.github.io/objetivos-ventas-casiopia/`) redirige sola al dominio. Ojo: el navegador guarda por dominio lo que se configura en ⚙ (token, objetivos), así que hay que volver a ingresarlo una vez en el dominio nuevo.

## Módulos Gasto publicitario y Archivo de Reportes

### Fuentes de Gasto publicitario (una pestaña por fuente)

Gasto publicitario **solo** toma en cuenta las carpetas de pauta en Drive:

| Pestaña | Fuente en Drive | JSON generado |
|---|---|---|
| Meta Ads | Carpeta [*Meta Files - Casiopia*](https://drive.google.com/drive/folders/166vtDwzl4YbqLnyqNpulZI2YltKb2FMm) (un Google Sheet por mes, exportación de Ads Manager) | `data/casiopia-meta.json` |
| Google Ads | Carpeta [*Google Files - Casiopia*](https://drive.google.com/drive/folders/1oN2HxlqXENM0KuAIOM_rtb17zJPCCAhO) (CSV, Excel o Google Sheet) | `data/casiopia-google.json` |

**Sincronización.** El workflow **Sincronizar datos Casiopia** (`.github/workflows/sync-casiopia.yml`) ejecuta `npm run fetch:casiopia`, commitea los JSON si cambiaron y dispara el deploy a GitHub Pages. Corre:

- **Automáticamente todos los días** a las 07:00 de Lima (cron `0 12 * * *` UTC; GitHub puede demorar los cron algunos minutos).
- **A pedido** con el botón **Sincronizar ahora** del módulo: dispara el workflow vía la GitHub API, espera a que termine y recarga los datos sin esperar el deploy. Usa el mismo token que el botón *Actualizar* (se configura en ⚙; permisos *Actions: read and write* + *Contents: read* del repo). También se puede lanzar desde *Actions → Sincronizar datos Casiopia → Run workflow*.

**No usa credenciales de Google**: las carpetas deben estar compartidas como *Cualquier persona con el enlace · Lector*; si alguna deja de estarlo, esa fuente conserva su último JSON y el workflow avisa cuál falló. Para desarrollo offline: `node scripts/fetch-casiopia.js --local=<dir>` con `<dir>/meta/*.csv` y `<dir>/google/*`.

**Archivo de Reportes** lista los archivos de la carpeta de Drive [*Reportes Casiopia*](https://drive.google.com/drive/folders/15Juqtuk1r8QVYiaaxySMLC0biSBcPlaJ) y el Excel vinculado [*Ventas 2026 Dashboard*](https://docs.google.com/spreadsheets/d/1u1tWfos-R5MbN7z72i1X6_BSkzh3L_nF/edit) con filtros, previsualización, enlace a Drive y descarga.

- **Qué archivos aparecen** lo decide el índice `data/casiopia-reportes.json` (id, nombre, tipo, fecha y peso; no copia el contenido), que genera el mismo workflow *Sincronizar datos Casiopia*: todos los días a las 07:00 de Lima y a pedido con el botón **Sincronizar con Drive** del módulo (mismo token que *Sincronizar ahora*). Un archivo borrado de la carpeta desaparece del Archivo; uno nuevo aparece marcado como *Nuevo en Drive* con tipo y periodo deducidos del nombre.
- **Cómo se muestra** cada archivo (nombre legible, tipo, periodo, versión anterior) sale de la ficha curada de `js/data-reportes.js` (`library` para la carpeta, `extras` para archivos sueltos). Para vincular otro archivo suelto: agregar su `fileId` a `SOURCES.reportes.extra` en `scripts/fetch-casiopia.js` y su ficha a `extras`. Tiene que ser un archivo subido (xlsx, pdf…) compartido como *Cualquier persona con el enlace · Lector*.

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
