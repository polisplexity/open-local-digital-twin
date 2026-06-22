import { getCityConfig } from '../../cityRegistry.mjs'
import { liveBaseEndpoint, renderMetricTiles, renderSharedShell } from '../viewerShellRenderer.mjs'
import { renderLeafletMapRuntime } from '../viewerRuntimes/leafletMapRuntime.mjs'

export function renderCityMapPage({ cityId = 'current', embed = false } = {}) {
  const city = getCityConfig(cityId)
  const baseEndpoint = liveBaseEndpoint(cityId)
  return renderSharedShell({
    eyebrow: `${city.name} / perspective`,
    title: `${city.name} Base Twin Map`,
    note:
      `Live public-data map inside Twin Base Studio. The layers are selectable, the features are inspectable, and the inventory exposes how much of the ${city.name} base twin is currently visible.`,
    extraHead: `
      <link
        rel="stylesheet"
        href="/vendor/leaflet/leaflet.css"
      />
    `,
    body: `
      <section class="grid grid--main">
        <article class="panel">
          <div id="map" class="map-stage"></div>
        </article>
        <aside class="stack">
          <article class="panel">
            <p class="eyebrow">Base inventory</p>
            <h2>What is currently inside the twin</h2>
            ${renderMetricTiles()}
          </article>
          <article class="panel">
            <p class="eyebrow">City briefing</p>
            <h2>What ${city.name} is before semantics</h2>
            <div class="stack stack--tight" id="city-briefing"></div>
          </article>
          <article class="panel">
            <p class="eyebrow">Layer controls</p>
            <h2>Select what you want to inspect</h2>
            <div class="layer-list" id="layer-controls"></div>
          </article>
          <article class="panel">
            <p class="eyebrow">Selection</p>
            <h2>What each thing is</h2>
            <div class="selection-panel" id="selection-panel">
              <div class="card">
                <p>Click any road, building, facility, or boundary to inspect its current details.</p>
              </div>
            </div>
          </article>
          <article class="panel">
            <p class="eyebrow">Detailed counts</p>
            <h2>How many of everything</h2>
            <div class="inventory-list" id="inventory-list"></div>
          </article>
        </aside>
      </section>
    `,
    embed,
    scripts: renderLeafletMapRuntime({ baseEndpoint, cityName: city.name, municipalityTitle: city.municipalityTitle }),
  })
}
