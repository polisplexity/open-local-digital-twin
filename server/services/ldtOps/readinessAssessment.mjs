function ratio(numerator, denominator) {
  const top = Number(numerator ?? 0)
  const bottom = Number(denominator ?? 0)
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= 0) return 0
  return top / bottom
}

function readinessCheck({
  key,
  label,
  category,
  status,
  summary,
  evidence = {},
  action,
}) {
  return {
    key,
    label,
    category,
    status,
    summary,
    evidence,
    action,
  }
}

export function buildReadinessAssessment({ cityId, counts, entityCounts, sourceLayerCounts, recentWorkflowRuns }) {
  const buildingCount = Number(entityCounts.building ?? 0)
  const roadCount = Number(entityCounts.road ?? 0)
  const facilityCount = Number(entityCounts.facility ?? 0)
  const greenBlueCount = Number(entityCounts.green_blue_system ?? 0)
  const placeCount = Number(entityCounts.place ?? 0)
  const sourceLayerNames = Object.keys(sourceLayerCounts)
  const hasOverture = sourceLayerNames.some((name) => name.includes('overture'))
  const hasOsmLikeBase = sourceLayerNames.some((name) => ['buildings', 'roads', 'facilities', 'greenBlue', 'places'].includes(name))
  const roadToBuildingRatio = ratio(roadCount, buildingCount)
  const approvedOrQueuedRuns = recentWorkflowRuns.filter((run) => ['queued', 'running', 'succeeded'].includes(run.status)).length
  const checkRows = [
    readinessCheck({
      key: 'single-city-demo-posture',
      label: 'Single-city demo posture',
      category: 'product',
      status: cityId === 'kharkiv' ? 'ready' : 'lab',
      summary:
        cityId === 'kharkiv'
          ? 'Kharkiv is the active demo city for the current product path.'
          : 'This city is preserved for lab, comparison, or reconstruction, not the active demo path.',
      evidence: { cityId },
      action: cityId === 'kharkiv' ? null : 'Keep this city reconstructable, but optimize Phase 11 around Kharkiv.',
    }),
    readinessCheck({
      key: 'source-coverage',
      label: 'Open source coverage',
      category: 'sources',
      status: counts.datasets > 0 && counts.sourceFeatures > 0 && hasOsmLikeBase ? 'ready' : 'blocked',
      summary: `${counts.datasets} datasets and ${counts.sourceFeatures} source features are attached to this city.`,
      evidence: {
        datasets: counts.datasets,
        sourceFeatures: counts.sourceFeatures,
        sourceLayers: sourceLayerCounts,
      },
      action: counts.sourceFeatures > 0 ? null : 'Run open-data bootstrap before presenting this city.',
    }),
    readinessCheck({
      key: 'building-inventory',
      label: 'Building inventory',
      category: 'inventory',
      status: buildingCount > 0 && hasOverture ? 'ready' : buildingCount > 0 ? 'partial' : 'blocked',
      summary: `${buildingCount} consolidated building entities are available.`,
      evidence: {
        buildings: buildingCount,
        overtureAvailable: hasOverture,
      },
      action: hasOverture ? null : 'Add open building enrichment such as Overture before making completeness claims.',
    }),
    readinessCheck({
      key: 'road-network-coverage',
      label: 'Road network coverage',
      category: 'inventory',
      status: roadCount <= 0 ? 'blocked' : roadToBuildingRatio < 0.02 ? 'partial' : 'ready',
      summary: `${roadCount} road entities are available. Large-city road coverage is still weak if it is tiny relative to the built fabric.`,
      evidence: {
        roads: roadCount,
        buildings: buildingCount,
        roadToBuildingRatio,
      },
      action: roadToBuildingRatio < 0.02 ? 'Reingest roads with a heavy-city profile or add a stronger open road source.' : null,
    }),
    readinessCheck({
      key: 'service-and-place-anchors',
      label: 'Service and place anchors',
      category: 'inventory',
      status: facilityCount > 0 && placeCount > 0 ? 'ready' : facilityCount > 0 ? 'partial' : 'blocked',
      summary: `${facilityCount} facilities and ${placeCount} places are available as city analyst anchors.`,
      evidence: {
        facilities: facilityCount,
        places: placeCount,
      },
      action: facilityCount > 0 && placeCount > 0 ? null : 'Improve facility/place extraction before service coverage analysis.',
    }),
    readinessCheck({
      key: 'green-blue-coverage',
      label: 'Green-blue coverage',
      category: 'inventory',
      status: greenBlueCount > 0 ? 'partial' : 'blocked',
      summary: `${greenBlueCount} green-blue entities are available. Classification depth is now a Phase 14 source-backed workflow task.`,
      evidence: {
        greenBlueSystems: greenBlueCount,
      },
      action: 'Use Phase 14 open-data workflows and environmental extractors to classify parks, water, forest, reserves, and public realm before environmental claims.',
    }),
    readinessCheck({
      key: 'standards-publication',
      label: 'Standards publication',
      category: 'standards',
      status: counts.ngsiProjections >= counts.entities && counts.ogcCollections > 0 && counts.datasets > 0 ? 'ready' : 'partial',
      summary: `${counts.ngsiProjections} NGSI-LD projections, ${counts.ogcCollections} OGC collections, and ${counts.datasets} DCAT datasets are generated.`,
      evidence: {
        ngsiProjections: counts.ngsiProjections,
        entities: counts.entities,
        ogcCollections: counts.ogcCollections,
        datasets: counts.datasets,
      },
      action: counts.ngsiProjections >= counts.entities && counts.ogcCollections > 0 ? null : 'Regenerate interoperability outputs from consolidated inventory.',
    }),
    readinessCheck({
      key: 'science-society-semantic',
      label: 'Science, society, and semantic reports',
      category: 'analysis',
      status: counts.scienceObservations > 0 && counts.societyObservations > 0 && counts.semanticIndicators > 0 ? 'ready' : 'partial',
      summary: `${counts.scienceObservations} science observations, ${counts.societyObservations} society observations, and ${counts.semanticIndicators} semantic indicators exist.`,
      evidence: {
        scienceObservations: counts.scienceObservations,
        societyObservations: counts.societyObservations,
        semanticIndicators: counts.semanticIndicators,
      },
      action: 'Phase 11 must expose these as analyst modules instead of hiding them in backend reports.',
    }),
    readinessCheck({
      key: 'workflow-readiness',
      label: 'Workflow readiness',
      category: 'operations',
      status: counts.workflowDefinitions >= 3 && counts.pendingWorkflowApprovals === 0 && approvedOrQueuedRuns > 0 ? 'ready' : 'partial',
      summary: `${counts.workflowDefinitions} workflow definitions, ${counts.workflowRuns} runs, and ${counts.pendingWorkflowApprovals} pending approvals are recorded.`,
      evidence: {
        workflowDefinitions: counts.workflowDefinitions,
        workflowRuns: counts.workflowRuns,
        pendingWorkflowApprovals: counts.pendingWorkflowApprovals,
        approvedOrQueuedRuns,
      },
      action: counts.workflowRuns > 0 ? 'Build the lightweight worker only after approval-gated APIs stay stable.' : 'Create at least one approved standards-publication run.',
    }),
    readinessCheck({
      key: 'api-observability',
      label: 'API observability',
      category: 'operations',
      status: counts.apiEvents > 0 ? 'ready' : 'blocked',
      summary: `${counts.apiEvents} API usage events are recorded for this city.`,
      evidence: {
        apiEvents: counts.apiEvents,
      },
      action: 'Add request IDs, route-family metrics, Prometheus/Grafana export, and API usage UI in Phase 12.',
    }),
    readinessCheck({
      key: 'ui-product-surface',
      label: 'UI product surface',
      category: 'ui',
      status: 'ready',
      summary: 'Workspace, Analytical Map, City 3D, and Civic XR are split and accepted as the Phase 13 Kharkiv visual baseline.',
      evidence: {
        capabilitiesPage: true,
        workspaceStatus: 'implemented-baseline',
        mapStatus: 'query-first-baseline',
        municipal3dStatus: 'cesium-baseline',
        civicXrStatus: 'babylon-webxr-baseline',
        phase13Closed: '2026-06-07',
      },
      action: 'Carry signed/public embeds, 3D Tiles LOD, terrain streaming, and visual polish forward as Phase 14/15/16 hardening.',
    }),
  ]

  const gaps = checkRows.filter((check) => !['ready', 'lab'].includes(check.status))
  const blocked = checkRows.filter((check) => check.status === 'blocked')
  const construction = checkRows.filter((check) => check.status === 'construction')
  const partial = checkRows.filter((check) => check.status === 'partial')
  const status = blocked.length ? 'blocked' : construction.length || partial.length ? 'partial' : 'ready'

  return {
    readiness: {
      status,
      warnings: gaps.map((check) => check.summary),
    },
    checks: checkRows,
    gaps,
    summary: {
      ready: checkRows.filter((check) => check.status === 'ready').length,
      partial: partial.length,
      blocked: blocked.length,
      construction: construction.length,
      lab: checkRows.filter((check) => check.status === 'lab').length,
      total: checkRows.length,
    },
  }
}
