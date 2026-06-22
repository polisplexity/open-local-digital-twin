import { getCityConfig } from '../../cityRegistry.mjs'
import { liveBaseEndpoint, renderMetricTiles, renderSharedShell } from '../viewerShellRenderer.mjs'
import { buildViewerSurfaceManifest } from '../viewerContracts/viewerSurfaceManifest.mjs'
import { renderCivicXrRuntime } from '../viewerRuntimes/civicXrRuntime.mjs'

export function renderCityImmersivePage({ cityId = 'current', embed = false } = {}) {
  const city = getCityConfig(cityId)
  const baseEndpoint = liveBaseEndpoint(cityId)
  const surfaceManifest = buildViewerSurfaceManifest({
    cityId,
    surface: 'immersive',
    mode: embed ? 'publicShare' : 'cockpit',
  })
  return renderSharedShell({
    eyebrow: `${city.name} / Civic XR`,
    title: `${city.name} Civic XR`,
    note:
      'An AR-ready browser WebXR surface over the same base twin, inferred seeds, and semantic-pack posture used by the analytical map and City 3D.',
    body: `
      <section class="grid grid--main">
        <article class="panel">
          <div class="canvas-wrap scene-stage scene-stage--civic-xr">
            <div class="stage-topbar">
              <span class="status-pill"><strong>Civic XR</strong> Babylon/WebXR AR-ready</span>
              <span class="status-pill status-pill--accent" id="civic-xr-webxr">Checking XR support</span>
              <span class="status-pill" id="civic-xr-status">Preparing Civic XR</span>
            </div>
            <div class="civic-xr-stage" data-civic-xr-runtime="babylon-webxr">
              <canvas id="civic-xr-canvas" class="civic-xr-canvas" aria-label="Civic XR city twin"></canvas>
              <div class="civic-xr-presence-controls" aria-label="Immersive controls">
                <button class="stage-action is-active" type="button" data-civic-xr-session="desktop">Street</button>
                <button class="stage-action" type="button" data-civic-xr-session="vr">VR</button>
                <button class="stage-action" type="button" data-civic-xr-session="ar">AR</button>
                <button class="stage-action" type="button" data-civic-xr-fullscreen>Fullscreen</button>
              </div>
              <div class="civic-xr-semantic-panel" id="civic-xr-semantic-overlay" aria-live="polite">
                <div class="civic-xr-semantic-panel__head">
                  <span>Semantic overlay</span>
                  <strong id="civic-xr-semantic-summary">Walk mode</strong>
                </div>
                <div class="civic-xr-semantic-panel__legend" id="civic-xr-semantic-legend"></div>
              </div>
              <div class="civic-xr-compare-panel" id="civic-xr-compare-panel" aria-live="polite">
                <div class="civic-xr-compare-panel__head">
                  <span>Compare workspace</span>
                  <strong id="civic-xr-compare-summary">No comparison active</strong>
                </div>
                <div class="civic-xr-compare-panel__list" id="civic-xr-compare-list"></div>
              </div>
              <div class="civic-xr-status-strip" id="civic-xr-status-detail">Loading city inventory</div>
            </div>
          </div>
        </article>
        <aside class="stack">
          <article class="panel">
            <p class="eyebrow">Civic inventory</p>
            <h2>AR-ready city objects</h2>
            ${renderMetricTiles()}
          </article>
          <article class="panel">
            <p class="eyebrow">AR layers</p>
            <h2>Visible city objects</h2>
            <div class="layer-list" id="civic-xr-layer-controls"></div>
          </article>
          <article class="panel">
            <p class="eyebrow">Evidence counts</p>
            <h2>Open data used</h2>
            <div class="inventory-list" id="civic-xr-inventory"></div>
          </article>
        </aside>
      </section>
    `,
    embed,
    surfaceManifest,
    scripts: renderCivicXrRuntime({ cityId, baseEndpoint }),
  })
}
