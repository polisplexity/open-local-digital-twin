import { pathToFileURL } from 'node:url'

import { writeViewerArtifactsExternalStageResult } from '../services/ldtOps/viewerArtifactsStageRunnerService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function booleanArg(name) {
  return process.argv.includes(`--${name}`) || process.argv.includes(`--${name}=true`)
}

function usage() {
  return [
    'Usage:',
    '  node server/tools/run-viewer-artifacts-data-factory-dispatch.mjs --dispatch=/path/to/dispatch-external-worker.json --out=/path/to/result.json',
    '',
    'Builds the stage-specific viewer-artifacts Data Factory result:',
    '  - 3D Tiles',
    '  - MVT directory',
    '  - PMTiles',
    '  - viewer artifact registry references',
    '',
    'Options:',
    '  --runner-id=<id>',
    '  --submitted-by=<actor>',
    '  --version=<artifact-version>',
    '  --mvt-min-zoom=<z>              Default: 10.',
    '  --mvt-max-zoom=<z>              Default: 14.',
    '  --mvt-max-features-per-tile=<n>',
    '  --tile-partitions=<n>           Default: 16.',
    '  --tile-partition-limit=<n>      Default: 12000.',
    '  --tileset-key=<key>             Default: base-buildings-partitioned.',
    '  --pmtiles-bin=<path>            Default: PMTILES_BIN or pmtiles.',
    '  --skip-mvt',
    '  --skip-pmtiles',
    '  --skip-3d-tiles',
    '  --no-activate                  Generate/register artifacts without activating them.',
  ].join('\n')
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(usage())
    return
  }
  const result = await writeViewerArtifactsExternalStageResult({
    dispatchFile: argValue('dispatch') || argValue('dispatch-file') || argValue('dispatchFile'),
    outputFile: argValue('out') || argValue('output') || argValue('result-file') || argValue('resultFile') || null,
    runnerId: argValue('runner-id') || argValue('runnerId') || 'viewer-artifacts-stage-runner',
    submittedBy: argValue('submitted-by') || argValue('submittedBy') || 'viewer-artifacts-stage-runner',
    version: argValue('version') || null,
    mvtMinZoom: argValue('mvt-min-zoom') || 10,
    mvtMaxZoom: argValue('mvt-max-zoom') || 14,
    mvtMaxFeaturesPerTile: argValue('mvt-max-features-per-tile') || null,
    tilePartitions: argValue('tile-partitions') || 16,
    tilePartitionLimit: argValue('tile-partition-limit') || 12000,
    tilesetKey: argValue('tileset-key') || 'base-buildings-partitioned',
    pmtilesBin: argValue('pmtiles-bin') || process.env.PMTILES_BIN || 'pmtiles',
    skipMvt: booleanArg('skip-mvt'),
    skipPmtiles: booleanArg('skip-pmtiles'),
    skipThreeDTiles: booleanArg('skip-3d-tiles') || booleanArg('skip-three-d-tiles'),
    activateArtifacts: !booleanArg('no-activate'),
  })
  console.log(JSON.stringify({
    ok: true,
    dispatchFile: result.dispatchFile,
    resultFile: result.resultFile,
    dispatchChecksum: result.dispatchChecksum,
    runId: result.resultPackage.runId,
    cityId: result.resultPackage.cityId,
    stageKey: result.resultPackage.stageKey,
    status: result.resultPackage.status,
    viewerArtifacts: result.resultPackage.resultSummary.viewerArtifacts,
  }, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: String(error?.message ?? 'VIEWER_ARTIFACT_STAGE_RUNNER_FAILED'),
      step: error?.step ?? null,
    }, null, 2))
    process.exit(1)
  })
}
