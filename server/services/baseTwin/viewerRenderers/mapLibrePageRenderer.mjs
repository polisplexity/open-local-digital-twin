import { getCityConfig } from '../../cityRegistry.mjs'
import { liveBaseEndpoint, renderSharedShell } from '../viewerShellRenderer.mjs'
import { buildMapSurfaceManifest } from '../viewerContracts/mapSurfaceManifest.mjs'
import { renderMapLibreRuntime } from '../viewerRuntimes/mapLibreRuntime.mjs'

export function renderCityMapLibrePage({ cityId = 'current', embed = false } = {}) {
  const city = getCityConfig(cityId)
  const baseEndpoint = liveBaseEndpoint(cityId)
  const surfaceManifest = buildMapSurfaceManifest({
    cityId,
    mode: embed ? 'embeddedAnalyst' : 'cockpit',
  })
  return renderSharedShell({
    eyebrow: `${city.name} / vector surface`,
    title: `${city.name} Base Twin Map`,
    note:
      `Vector-tile map for large-city review. The cockpit controls the visible radius, layer mix, and feature inspection without loading the whole ${city.name} inventory as one browser object.`,
    extraHead: `
      <link rel="stylesheet" href="/vendor/maplibre-gl/maplibre-gl.css" />
      <style>
        .maplibre-stage {
          position: relative;
          overflow: hidden;
          background: #dfe8f2;
        }
        .maplibre-stage #map {
          min-height: 74vh;
          height: 74vh;
        }
        .tile-status {
          position: absolute;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 5;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.42rem 0.72rem;
          border: 1px solid rgba(15, 118, 110, 0.22);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.88);
          color: #0f766e;
          font-size: 0.78rem;
          font-weight: 700;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
          pointer-events: none;
          opacity: 0;
          transition: opacity 160ms ease;
        }
        .tile-status.is-visible {
          opacity: 1;
        }
        .maplibregl-popup-content {
          border: 1px solid rgba(15, 23, 42, 0.16);
          border-radius: 8px;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.18);
          font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
          max-width: 280px;
        }
        .map-popup__title {
          display: block;
          margin-bottom: 0.22rem;
          font-weight: 800;
          color: #0f172a;
        }
        .map-popup__meta {
          color: #5b6472;
          font-size: 0.8rem;
          line-height: 1.45;
        }
        body.is-embed .maplibre-stage,
        body.is-embed .maplibre-stage #map {
          min-height: 100vh;
          height: 100vh;
        }
      </style>
    `,
    body: `
      <section class="grid grid--main">
        <article class="panel">
          <div class="map-stage maplibre-stage">
            <div id="map"></div>
            <div id="tile-status" class="tile-status">Vector tiles ready</div>
          </div>
        </article>
      </section>
    `,
    embed,
    surfaceManifest,
    scripts: renderMapLibreRuntime({ cityId, baseEndpoint, cityName: city.name, surfaceManifest }),
  })
}
