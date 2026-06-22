export function renderMetricTiles() {
  return '<div class="metric-grid" id="metric-grid"></div>'
}

export function liveBaseEndpoint(cityId = 'current') {
  return cityId === 'current' ? '/api/live/current/base' : `/api/live/${cityId}/base`
}

function serializedSurfaceManifest(surfaceManifest) {
  if (!surfaceManifest) return ''
  return JSON.stringify(surfaceManifest).replaceAll('<', '\\u003c')
}

export function renderSharedShell({
  title,
  eyebrow,
  note,
  body,
  scripts = '',
  extraHead = '',
  embed = false,
  surfaceManifest = null,
}) {
  const manifestJson = serializedSurfaceManifest(surfaceManifest)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    ${extraHead}
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f0e7;
        --paper: rgba(255, 255, 255, 0.92);
        --paper-soft: rgba(255, 255, 255, 0.72);
        --line: rgba(15, 23, 42, 0.14);
        --ink: #0f172a;
        --muted: #5b6472;
        --accent: #c46b2d;
        --good: #0f766e;
        --danger: #b91c1c;
      }
      :root[data-viewer-theme="dark"],
      body[data-viewer-theme="dark"] {
        color-scheme: dark;
        --bg: #020617;
        --paper: rgba(15, 23, 42, 0.92);
        --paper-soft: rgba(15, 23, 42, 0.72);
        --line: rgba(248, 250, 252, 0.18);
        --ink: #f8fafc;
        --muted: #cbd5e1;
        --accent: #f8fafc;
        --good: #e2e8f0;
        --danger: #fecaca;
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        min-height: 100%;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        background: linear-gradient(180deg, rgba(196, 107, 45, 0.06), transparent 18%), var(--bg);
        color: var(--ink);
      }
      a-scene { display: block; width: 100%; height: 74vh; }
      body { padding: 0.9rem; }
      .shell { max-width: 1500px; margin: 0 auto; display: grid; gap: 0.9rem; }
      .hero, .panel {
        border: 1px solid var(--line);
        background: var(--paper);
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
      }
      .hero { padding: 1rem 1.1rem; display: grid; gap: 0.35rem; }
      .eyebrow {
        margin: 0;
        font-size: 0.74rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--accent);
      }
      h1, h2, h3, p, ul { margin: 0; }
      h1, h2 { font-family: "Iowan Old Style", Georgia, serif; line-height: 0.95; }
      h1 { font-size: clamp(2rem, 4vw, 3.1rem); }
      h2 { font-size: clamp(1.4rem, 2.5vw, 2rem); }
      .hero p:last-child { color: var(--muted); max-width: 84ch; line-height: 1.55; }
      .grid { display: grid; gap: 0.9rem; }
      .grid--main { grid-template-columns: minmax(0, 1.55fr) minmax(340px, 0.85fr); }
      .panel { padding: 0.95rem 1rem; min-width: 0; }
      .stack { display: grid; gap: 0.8rem; }
      .stack--tight { gap: 0.55rem; }
      .metric-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.7rem; }
      .metric, .card, .inventory-row, .layer-row {
        border: 1px solid var(--line);
        background: var(--paper-soft);
      }
      .metric, .card, .inventory-row { padding: 0.8rem; }
      .metric span, .inventory-row span {
        display: block;
        font-size: 0.72rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .metric strong, .inventory-row strong {
        display: block;
        margin-top: 0.3rem;
        font-size: 1.28rem;
        font-family: "Iowan Old Style", Georgia, serif;
      }
      .metric p, .card p, .inventory-summary, .hint, .selection-meta, .legend-note {
        color: var(--muted);
        line-height: 1.55;
      }
      .map-stage, .scene-stage {
        min-height: 74vh;
        border: 1px solid var(--line);
        background: #dce7f4;
      }
      body[data-viewer-theme="dark"] .map-stage,
      body[data-viewer-theme="dark"] .scene-stage {
        background: #020617;
      }
      #map, #scene3d { width: 100%; min-height: 74vh; }
      .base-context-tile {
        filter: grayscale(1) saturate(0) contrast(0.9) opacity(0.48);
      }
      .layer-list, .inventory-list { display: grid; gap: 0.6rem; }
      .layer-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 0.7rem;
        align-items: start;
        padding: 0.72rem 0.8rem;
      }
      .layer-row input { margin-top: 0.28rem; }
      .layer-row strong { display: block; margin-bottom: 0.16rem; }
      .layer-row small { color: var(--muted); display: block; line-height: 1.45; }
      .layer-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.22rem 0.5rem;
        border: 1px solid var(--line);
        border-radius: 999px;
        font-size: 0.74rem;
        color: var(--muted);
        margin-top: 0.35rem;
      }
      .swatch {
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 999px;
        display: inline-block;
      }
      .selection-panel {
        min-height: 150px;
        display: grid;
        gap: 0.55rem;
      }
      .selection-title { font-size: 1.08rem; font-weight: 700; }
      .selection-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }
      .selection-tag {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 0.22rem 0.48rem;
        font-size: 0.76rem;
        color: var(--muted);
        background: rgba(255,255,255,0.68);
      }
      .inventory-section {
        border: 1px solid var(--line);
        background: var(--paper-soft);
        padding: 0.8rem;
      }
      .inventory-section h3 { margin-bottom: 0.35rem; font-size: 1.08rem; }
      .inventory-section ul {
        list-style: none;
        padding: 0;
        display: grid;
        gap: 0.35rem;
        margin-top: 0.65rem;
      }
      .inventory-item {
        display: flex;
        justify-content: space-between;
        gap: 0.8rem;
        border-bottom: 1px dashed rgba(15, 23, 42, 0.08);
        padding-bottom: 0.25rem;
      }
      .inventory-item:last-child { border-bottom: 0; padding-bottom: 0; }
      .inventory-item strong {
        font-size: 0.92rem;
        font-family: inherit;
        margin-top: 0;
      }
      .toolbar {
        display: flex;
        gap: 0.55rem;
        flex-wrap: wrap;
        margin-top: 0.75rem;
      }
      .toolbar button {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 0.62rem 0.88rem;
        background: rgba(255,255,255,0.8);
        color: var(--ink);
        cursor: pointer;
      }
      .toolbar button.is-active {
        background: rgba(15,118,110,0.12);
        border-color: rgba(15,118,110,0.32);
      }
      .stage-topbar {
        position: absolute;
        top: 14px;
        left: 14px;
        z-index: 4;
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        max-width: calc(100% - 28px);
        align-items: center;
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.36rem 0.72rem;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255,255,255,0.88);
        color: var(--ink);
        font-size: 0.76rem;
      }
      .status-pill strong { font-size: 0.74rem; }
      .status-pill--accent {
        background: rgba(196, 107, 45, 0.1);
        border-color: rgba(196, 107, 45, 0.22);
        color: #9a4f1f;
      }
      .stage-actions {
        margin-left: auto;
        display: inline-flex;
        gap: 0.45rem;
        align-items: center;
      }
      .stage-action {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 0.42rem 0.72rem;
        background: rgba(255,255,255,0.88);
        color: var(--ink);
        font-size: 0.76rem;
        cursor: pointer;
      }
      .stage-action.is-active {
        background: rgba(15,118,110,0.12);
        border-color: rgba(15,118,110,0.32);
        color: #0f766e;
      }
      .canvas-wrap {
        position: relative;
        min-height: 74vh;
        overflow: hidden;
      }
      .canvas-overlay,
      .stage-panel {
        position: absolute;
        z-index: 4;
        padding: 0.8rem;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.9);
        box-shadow: 0 12px 32px rgba(15,23,42,0.08);
        backdrop-filter: blur(10px);
      }
      .stage-panel p:last-child,
      .canvas-overlay p:last-child {
        margin-top: 0.25rem;
      }
      .stage-panel__eyebrow {
        display: inline-block;
        margin: 0 0 0.3rem;
        font-size: 0.7rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--accent);
      }
      .stage-panel strong {
        display: block;
        margin: 0.1rem 0 0.25rem;
      }
      .stage-panel--info {
        top: 64px;
        right: 14px;
        width: min(300px, calc(100% - 28px));
      }
      .stage-panel--help {
        left: 14px;
        bottom: 14px;
        max-width: 300px;
      }
      .stage-panel--identity {
        display: grid;
        gap: 0.45rem;
      }
      .stage-identity-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }
      .stage-identity-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.28rem 0.56rem;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.78);
        color: var(--muted);
        font-size: 0.72rem;
      }
      .scene-stage--digital {
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.72)),
          linear-gradient(90deg, rgba(110, 140, 165, 0.08) 1px, transparent 1px),
          linear-gradient(rgba(110, 140, 165, 0.08) 1px, transparent 1px),
          linear-gradient(180deg, #f9fbfd, #eef4f8 48%, #e4edf4);
        background-size: auto, 34px 34px, 34px 34px, auto;
      }
      .scene-stage--immersive {
        background:
          radial-gradient(circle at 20% 15%, rgba(34, 211, 238, 0.2), transparent 28%),
          radial-gradient(circle at 80% 18%, rgba(196, 107, 45, 0.16), transparent 26%),
          linear-gradient(180deg, #0a1730, #122541 52%, #10213a);
      }
      .scene-stage--civic-xr {
        background:
          radial-gradient(circle at 34% 26%, rgba(45, 212, 191, 0.14), transparent 28%),
          linear-gradient(180deg, #eaf2f7, #dbe7ef 52%, #cad8e4);
      }
      body[data-viewer-theme="dark"] .scene-stage--civic-xr {
        background:
          radial-gradient(circle at 34% 26%, rgba(45, 212, 191, 0.16), transparent 28%),
          linear-gradient(180deg, #0a1422, #0f1f31 52%, #101c2c);
      }
      .civic-xr-stage {
        position: relative;
        width: 100%;
        min-height: 74vh;
        height: 74vh;
        overflow: hidden;
      }
      .civic-xr-canvas {
        display: block;
        width: 100%;
        height: 100%;
        touch-action: none;
      }
      .civic-xr-status-strip {
        position: absolute;
        left: 14px;
        bottom: 14px;
        z-index: 4;
        max-width: min(420px, calc(100% - 28px));
        padding: 0.5rem 0.66rem;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255,255,255,0.86);
        color: var(--muted);
        font-size: 0.78rem;
        box-shadow: 0 12px 28px rgba(15,23,42,0.08);
      }
      .civic-xr-semantic-panel {
        position: absolute;
        top: 64px;
        right: 14px;
        z-index: 4;
        width: min(310px, calc(100% - 28px));
        display: none;
        gap: 0.6rem;
        padding: 0.72rem;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.88);
        box-shadow: 0 12px 28px rgba(15,23,42,0.08);
        backdrop-filter: blur(10px);
      }
      .civic-xr-semantic-panel.is-active {
        display: grid;
      }
      .civic-xr-compare-panel {
        position: absolute;
        top: 64px;
        right: 14px;
        z-index: 4;
        width: min(330px, calc(100% - 28px));
        display: none;
        gap: 0.6rem;
        padding: 0.72rem;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.9);
        box-shadow: 0 12px 28px rgba(15,23,42,0.08);
        backdrop-filter: blur(10px);
      }
      .civic-xr-compare-panel.is-active {
        display: grid;
      }
      .civic-xr-semantic-panel__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.7rem;
      }
      .civic-xr-compare-panel__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.7rem;
      }
      .civic-xr-semantic-panel__head span {
        color: var(--accent);
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        line-height: 1.25;
        text-transform: uppercase;
      }
      .civic-xr-compare-panel__head span {
        color: var(--accent);
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        line-height: 1.25;
        text-transform: uppercase;
      }
      .civic-xr-semantic-panel__head strong {
        color: var(--ink);
        font-size: 0.78rem;
        line-height: 1.25;
        text-align: right;
      }
      .civic-xr-compare-panel__head strong {
        color: var(--ink);
        font-size: 0.78rem;
        line-height: 1.25;
        text-align: right;
      }
      .civic-xr-semantic-panel__legend {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.42rem;
      }
      .civic-xr-compare-panel__list {
        display: grid;
        gap: 0.42rem;
      }
      .civic-xr-semantic-chip {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 0.42rem;
        align-items: center;
        min-width: 0;
        border: 1px solid var(--line);
        padding: 0.42rem 0.48rem;
        background: rgba(255,255,255,0.62);
        color: var(--muted);
        font-size: 0.72rem;
        line-height: 1.2;
      }
      .civic-xr-compare-chip {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 0.45rem;
        align-items: center;
        min-width: 0;
        border: 1px solid var(--line);
        padding: 0.45rem 0.52rem;
        background: rgba(255,255,255,0.64);
        color: var(--muted);
        font-size: 0.72rem;
        line-height: 1.2;
      }
      .civic-xr-compare-chip strong,
      .civic-xr-semantic-chip strong {
        color: var(--ink);
        font-size: 0.74rem;
      }
      .civic-xr-semantic-swatch {
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 999px;
        box-shadow: inset 0 0 0 1px rgba(15,23,42,0.16);
      }
      .civic-xr-compare-swatch {
        width: 0.78rem;
        height: 0.78rem;
        box-shadow: inset 0 0 0 1px rgba(15,23,42,0.16);
      }
      .civic-xr-presence-controls {
        position: absolute;
        right: 14px;
        bottom: 14px;
        z-index: 5;
        display: inline-flex;
        gap: 0.45rem;
        align-items: center;
        padding: 0.4rem;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255,255,255,0.9);
        box-shadow: 0 12px 28px rgba(15,23,42,0.08);
        backdrop-filter: blur(10px);
      }
      body[data-viewer-theme="dark"] .civic-xr-status-strip,
      body[data-viewer-theme="dark"] .civic-xr-semantic-panel,
      body[data-viewer-theme="dark"] .civic-xr-compare-panel,
      body[data-viewer-theme="dark"] .civic-xr-presence-controls,
      body[data-viewer-theme="dark"] .status-pill,
      body[data-viewer-theme="dark"] .stage-action,
      body[data-viewer-theme="dark"] .toolbar button,
      body[data-viewer-theme="dark"] .tour-grid button {
        background: rgba(15,23,42,0.82);
      }
      .tour-grid {
        display: grid;
        gap: 0.55rem;
        margin-top: 0.75rem;
      }
      .tour-grid button {
        width: 100%;
        text-align: left;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.82);
        padding: 0.62rem 0.78rem;
        cursor: pointer;
      }
      .toolbar--dense button,
      .tour-grid button:hover {
        border-color: rgba(15,118,110,0.34);
      }
      .floating-note {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 5;
        padding: 0.7rem 0.85rem;
        background: rgba(255,255,255,0.92);
        border: 1px solid var(--line);
        box-shadow: 0 12px 32px rgba(15,23,42,0.08);
        max-width: 320px;
      }
      .status { color: var(--good); font-weight: 700; }
      .status--danger { color: var(--danger); }
      .map-popup strong { display: block; margin-bottom: 0.25rem; }
      .dt-map-label {
        border: 1px solid rgba(15, 23, 42, 0.14);
        border-radius: 6px;
        background: rgba(255,255,255,0.86);
        color: #0f172a;
        font-size: 0.72rem;
        font-weight: 700;
        box-shadow: none;
      }
      body.is-embed {
        padding: 0;
        background: #f6f3ee;
      }
      body.is-embed .shell {
        max-width: none;
        gap: 0;
        min-height: 100vh;
      }
      body.is-embed .hero,
      body.is-embed .grid--main > aside {
        display: none;
      }
      body.is-embed .panel {
        padding: 0;
        border: 0;
        box-shadow: none;
        background: transparent;
      }
      body.is-embed .grid--main {
        grid-template-columns: 1fr;
        gap: 0;
      }
      body.is-embed .map-stage,
      body.is-embed .scene-stage,
      body.is-embed #map,
      body.is-embed #scene3d,
      body.is-embed .civic-xr-stage,
      body.is-embed .canvas-wrap,
      body.is-embed a-scene {
        min-height: 100vh;
        height: 100vh;
      }
      body.is-embed .canvas-overlay {
        left: 12px;
        bottom: 12px;
        max-width: 280px;
      }
      body.is-embed .stage-panel--info {
        top: 54px;
        right: 12px;
      }
      body.is-embed .stage-panel--help {
        left: 12px;
        bottom: 12px;
      }
      body.is-embed .floating-note {
        position: absolute;
        right: 12px;
        bottom: 12px;
      }
      @media (max-width: 1080px) {
        body { padding: 0.55rem; }
        .grid--main { grid-template-columns: 1fr; }
        .metric-grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 900px) {
        .stage-topbar {
          gap: 0.42rem;
        }
        .status-pill {
          padding: 0.3rem 0.58rem;
          font-size: 0.72rem;
        }
        .stage-actions {
          margin-left: 0;
          width: 100%;
          justify-content: flex-start;
        }
        .stage-panel {
          display: none;
        }
        .stage-panel.is-open {
          display: block;
        }
        .stage-panel--info,
        .stage-panel--help {
          inset: auto 12px 12px 12px;
          width: auto;
          max-width: none;
          max-height: min(48vh, 360px);
          overflow: auto;
        }
        .civic-xr-semantic-panel {
          top: auto;
          right: 12px;
          bottom: 72px;
          width: min(340px, calc(100% - 24px));
        }
        .civic-xr-compare-panel {
          top: auto;
          right: 12px;
          bottom: 72px;
          width: min(340px, calc(100% - 24px));
        }
        .civic-xr-semantic-panel__legend {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body class="${embed ? 'is-embed' : ''}">
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        <p>${note}</p>
      </section>
      ${body}
    </main>
    ${manifestJson ? `<script type="application/json" id="twin-surface-manifest">${manifestJson}</script>` : ''}
    ${scripts}
    <script>
      function syncStagePanelsForViewport() {
        const compact = window.innerWidth <= 900
        document.querySelectorAll('[data-stage-panel]').forEach((panel) => {
          if (compact) {
            panel.classList.remove('is-open')
          } else {
            panel.classList.add('is-open')
          }
        })
        document.querySelectorAll('[data-stage-toggle]').forEach((toggle) => {
          const key = toggle.getAttribute('data-stage-toggle')
          const panel = document.querySelector('[data-stage-panel="' + key + '"]')
          toggle.classList.toggle('is-active', Boolean(panel?.classList.contains('is-open')))
        })
      }
      syncStagePanelsForViewport()
      window.addEventListener('resize', syncStagePanelsForViewport)
      document.addEventListener('click', (event) => {
        const toggle = event.target.closest('[data-stage-toggle]')
        if (!toggle) return
        const wrap = toggle.closest('.canvas-wrap')
        const key = toggle.getAttribute('data-stage-toggle')
        if (!wrap || !key) return
        const panel = wrap.querySelector('[data-stage-panel="' + key + '"]')
        if (!panel) return
        const isOpen = panel.classList.toggle('is-open')
        toggle.classList.toggle('is-active', isOpen)
      })
    </script>
  </body>
</html>`
}
