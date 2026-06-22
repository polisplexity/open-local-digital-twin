import { getCityConfig } from '../../cityRegistry.mjs'
import { liveBaseEndpoint, renderMetricTiles, renderSharedShell } from '../viewerShellRenderer.mjs'
import { renderCity3dPhenomenaButtons } from '../viewerContracts/city3dPhenomenaContract.mjs'
import { buildViewerSurfaceManifest } from '../viewerContracts/viewerSurfaceManifest.mjs'
import { renderCityCesiumRuntime } from '../viewerRuntimes/cityCesiumRuntime.mjs'

export function renderCity3dPage({ cityId = 'current', embed = false } = {}) {
  const city = getCityConfig(cityId)
  const baseEndpoint = liveBaseEndpoint(cityId)
  const surfaceManifest = buildViewerSurfaceManifest({
    cityId,
    surface: 'municipal3d',
    mode: embed ? 'embeddedAnalyst' : 'cockpit',
  })
  return renderSharedShell({
    eyebrow: `${city.name} / City 3D`,
    title: `${city.name} City 3D`,
    note:
      'CesiumJS spatial inspection over the current public-data base twin. Open data stays in PostGIS/TwinQL; provider 3D and BIM assets attach as cataloged evidence.',
    extraHead: `
      <link rel="stylesheet" href="/vendor/cesium/Widgets/widgets.css" />
      <style>
        #scene3d .cesium-widget,
        #scene3d .cesium-widget canvas {
          width: 100%;
          min-height: 74vh;
        }
        #scene3d .cesium-credit-logoContainer,
        #scene3d .cesium-credit-expand-link {
          display: none !important;
        }
        .scene-attribution {
          position: absolute;
          right: 12px;
          bottom: 12px;
          z-index: 2;
          padding: 4px 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.86);
          color: #334155;
          font-size: 0.72rem;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
        }
        .phenomena-switcher {
          position: absolute;
          left: 16px;
          top: 52px;
          z-index: 3;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          max-width: min(92%, 520px);
        }
        .phenomena-switcher button {
          border: 1px solid rgba(15, 118, 110, 0.22);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.84);
          color: #334155;
          font-size: 0.75rem;
          font-weight: 700;
          line-height: 1;
          padding: 8px 10px;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
        }
        .phenomena-switcher button[aria-pressed="true"] {
          background: #00838b;
          border-color: #00838b;
          color: #ffffff;
        }
        .phenomena-legend {
          position: absolute;
          left: 16px;
          bottom: 16px;
          z-index: 3;
          width: min(360px, calc(100% - 32px));
          padding: 10px 12px;
          border: 1px solid rgba(15, 118, 110, 0.2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.88);
          color: #1f2937;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
          backdrop-filter: blur(10px);
        }
        .phenomena-legend[hidden] {
          display: none;
        }
        .phenomena-legend__title {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
          color: #00838b;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .phenomena-legend__ramp {
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(90deg, #06b6d4, #84cc16, #ca8a04, #78350f);
        }
        .phenomena-legend__ramp--temperature {
          background: linear-gradient(90deg, #2563eb, #38bdf8, #22c55e, #facc15, #f97316, #dc2626, #7f1d1d);
        }
        .phenomena-legend__ramp--water {
          background: linear-gradient(90deg, #cffafe, #67e8f9, #06b6d4, #0284c7, #075985);
        }
        .phenomena-legend__ramp--runoff {
          background: linear-gradient(90deg, #a7f3d0, #facc15, #f97316, #be123c, #4c0519);
        }
        .phenomena-legend__range,
        .phenomena-legend__note {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 6px;
          font-size: 0.74rem;
          color: #475569;
        }
        html[data-viewer-theme="dark"] .phenomena-switcher button,
        body[data-viewer-theme="dark"] .phenomena-switcher button {
          background: rgba(15, 23, 42, 0.86);
          color: #e2e8f0;
        }
        html[data-viewer-theme="dark"] .phenomena-switcher button[aria-pressed="true"],
        body[data-viewer-theme="dark"] .phenomena-switcher button[aria-pressed="true"] {
          background: #f8fafc;
          color: #020617;
          border-color: #f8fafc;
        }
        html[data-viewer-theme="dark"] .phenomena-legend,
        body[data-viewer-theme="dark"] .phenomena-legend {
          background: rgba(15, 23, 42, 0.88);
          color: #e2e8f0;
          border-color: rgba(148, 163, 184, 0.3);
        }
        html[data-viewer-theme="dark"] .phenomena-legend__range,
        html[data-viewer-theme="dark"] .phenomena-legend__note,
        body[data-viewer-theme="dark"] .phenomena-legend__range,
        body[data-viewer-theme="dark"] .phenomena-legend__note {
          color: #cbd5e1;
        }
      </style>
    `,
    body: `
      <section class="grid grid--main">
        <article class="panel">
          <div class="canvas-wrap scene-stage scene-stage--digital">
            <div class="stage-topbar">
              <span class="status-pill"><strong>City 3D</strong> Open-data city canvas</span>
              <span class="status-pill status-pill--accent" id="scene-status">Preparing scene</span>
            </div>
            <div class="phenomena-switcher" id="phenomena-switcher" aria-label="3D spatial phenomena">
              ${renderCity3dPhenomenaButtons()}
            </div>
            <div class="phenomena-legend" id="phenomena-legend" hidden></div>
            <div id="scene3d"></div>
            <div class="scene-attribution" id="scene-attribution">CesiumJS</div>
          </div>
        </article>
        <aside class="stack">
          <article class="panel">
            <p class="eyebrow">Base inventory</p>
            <h2>What the 3D view contains</h2>
            ${renderMetricTiles()}
          </article>
          <article class="panel">
            <p class="eyebrow">3D controls</p>
            <h2>Scene visibility and camera</h2>
            <div class="layer-list" id="scene-controls"></div>
            <div class="toolbar toolbar--dense" id="camera-controls"></div>
          </article>
          <article class="panel">
            <p class="eyebrow">Selected object</p>
            <h2>What each thing means</h2>
            <div class="selection-panel" id="scene-selection"></div>
          </article>
          <article class="panel">
            <p class="eyebrow">Detailed counts</p>
            <h2>Rendered and discovered</h2>
            <div class="inventory-list" id="scene-inventory"></div>
          </article>
        </aside>
      </section>
    `,
    embed,
    surfaceManifest,
    scripts: renderCityCesiumRuntime({ cityId, baseEndpoint }),
  })
}
