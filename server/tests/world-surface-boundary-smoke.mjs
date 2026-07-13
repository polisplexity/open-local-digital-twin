import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sidebar = await readFile(new URL('../../src/components/twin-module/TwinControlSidebar.jsx', import.meta.url), 'utf8')
const canvas = await readFile(new URL('../../src/components/twin-module/FragmentVisualizerPage.jsx', import.meta.url), 'utf8')
const passport = await readFile(new URL('../../src/components/twin-module/query/queryPassportModel.js', import.meta.url), 'utf8')

const policyBlock = sidebar.match(/const SIDEBAR_POLICIES = \{([\s\S]*?)\n\}/)?.[1] || ''
const mapPolicy = policyBlock.match(/map:\s*\{([\s\S]*?)\n\s*\},/)?.[1] || ''
const city3dPolicy = policyBlock.match(/'3d':\s*\{([\s\S]*?)\n\s*\},/)?.[1] || ''
const immersivePolicy = policyBlock.match(/immersive:\s*\{([\s\S]*?)\n\s*\},/)?.[1] || ''

assert.match(mapPolicy, /showFragmentLayers:\s*false/, 'WORLD_SURFACE_MAP_COMPARE_MUST_BE_DISABLED')
assert.match(city3dPolicy, /showFragmentLayers:\s*false/, 'WORLD_SURFACE_CITY3D_COMPARE_MUST_BE_DISABLED')
assert.match(immersivePolicy, /showFragmentLayers:\s*false/, 'WORLD_SURFACE_XR_COMPARE_MUST_BE_DISABLED')

assert.match(passport, /\{ key: 'canvas', label: 'Canvas', href: '\/fragment-visualizer' \}/, 'WORLD_SURFACE_CANVAS_PASSPORT_REQUIRED')
assert.match(canvas, /useState\('compare'\)/, 'WORLD_SURFACE_CANVAS_COMPARE_DEFAULT_REQUIRED')
assert.match(canvas, /mode === 'delta'/, 'WORLD_SURFACE_CANVAS_DELTA_REQUIRED')
assert.match(canvas, /const \[deltaMetric, setDeltaMetric\] = useState\(''\)/, 'WORLD_SURFACE_DELTA_METRIC_STATE_REQUIRED')
assert.match(canvas, /buildDeltaWorld\(activeResults, deltaMetric\)/, 'WORLD_SURFACE_DELTA_MUST_USE_NUMERIC_METRIC')
assert.match(canvas, /Selection mask/, 'WORLD_SURFACE_SELECTION_MASK_REQUIRED')
assert.match(canvas, /Simulation output/, 'WORLD_SURFACE_SIMULATION_FILTER_REQUIRED')
assert.match(canvas, /\/simulation-worlds\?limit=40/, 'WORLD_SURFACE_SIMULATION_LIBRARY_REQUIRED')
assert.match(canvas, /applySelectionMask/, 'WORLD_SURFACE_SELECTION_INTERSECTION_REQUIRED')
assert.match(canvas, /buildDeltaWorld/, 'WORLD_SURFACE_DELTA_COMPUTATION_REQUIRED')

console.log(JSON.stringify({
  ok: true,
  primaryViewers: {
    analyticalMap: 'single-world-query',
    city3d: 'single-world-query',
    civicXr: 'single-world-query',
  },
  canvas: ['overlay', 'compare', 'delta', 'selection-mask', 'simulation-output-filter'],
}, null, 2))
