import { renderCivicXrRuntime } from '../services/baseTwin/viewerRuntimes/civicXrRuntime.mjs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const runtime = renderCivicXrRuntime({
  cityId: 'guanajuato',
  baseEndpoint: '/api/live/guanajuato/viewer/civic-xr',
})

const rayImport = "import '/vendor/babylonjs/core/Culling/ray.js'"
const engineImport = "import { Engine } from '/vendor/babylonjs/core/Engines/engine.js'"
const sceneImport = "import { Scene } from '/vendor/babylonjs/core/scene.js'"

assert(runtime.includes(rayImport), 'CIVIC_XR_BABYLON_RAY_SIDE_EFFECT_MISSING')
assert(runtime.includes(engineImport), 'CIVIC_XR_BABYLON_ENGINE_MISSING')
assert(runtime.includes(sceneImport), 'CIVIC_XR_BABYLON_SCENE_MISSING')
assert(runtime.indexOf(rayImport) < runtime.indexOf(engineImport), 'CIVIC_XR_RAY_IMPORT_MUST_PRECEDE_ENGINE')
assert(runtime.indexOf(rayImport) < runtime.indexOf(sceneImport), 'CIVIC_XR_RAY_IMPORT_MUST_PRECEDE_SCENE')

console.log(JSON.stringify({
  ok: true,
  civicXr: {
    raySideEffectImport: '/vendor/babylonjs/core/Culling/ray.js',
    reason: 'Babylon ESM needs Ray side effects before camera getForwardRay and scene picking paths execute.',
  },
}, null, 2))
