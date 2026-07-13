import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

const scripts = [
  {
    name: 'register-environmental-extractors',
    file: 'server/db/ldt-register-environmental-extractors.mjs',
    errorCode: 'ENVIRONMENTAL_EXTRACTORS_CITY_REQUIRED',
  },
  {
    name: 'terrain-dem',
    file: 'server/db/ldt-run-terrain-dem-extractor.mjs',
    errorCode: 'TERRAIN_DEM_CITY_REQUIRED',
  },
  {
    name: 'weather-field',
    file: 'server/db/ldt-run-weather-field-extractor.mjs',
    errorCode: 'WEATHER_FIELD_CITY_REQUIRED',
  },
  {
    name: 'hydrology-grid',
    file: 'server/db/ldt-run-hydrology-grid-extractor.mjs',
    errorCode: 'HYDROLOGY_CITY_REQUIRED',
  },
  {
    name: 'surface-runoff',
    file: 'server/db/ldt-run-surface-runoff-scenario.mjs',
    errorCode: 'SURFACE_RUNOFF_CITY_REQUIRED',
  },
]

const results = scripts.map((script) => {
  const result = spawnSync(process.execPath, [script.file], {
    cwd: process.cwd(),
    env: { ...process.env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return {
    ...script,
    status: result.status,
    stderr: result.stderr,
  }
})

for (const result of results) {
  assert.notEqual(result.status, 0, `ENVIRONMENTAL_CITY_REQUIREMENT_NOT_ENFORCED:${result.name}`)
  assert.match(result.stderr, new RegExp(result.errorCode), `ENVIRONMENTAL_CITY_REQUIREMENT_ERROR_MISSING:${result.name}`)
}

console.log(JSON.stringify({
  ok: true,
  results: results.map((result) => ({
    name: result.name,
    status: result.status,
    errorCode: result.errorCode,
  })),
}, null, 2))
