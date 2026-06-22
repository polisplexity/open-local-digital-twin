import { getCityDisplayName, getCityWorkspaceLabel, getWorkspaceSubline } from './platformBrand'

const twinModuleNav = [
  { label: 'Workspace', href: '/cockpit' },
  { label: 'Analytical Map', href: '/analytical-map' },
  { label: 'City 3D', href: '/city-3d' },
  { label: 'Civic XR', href: '/civic-xr' },
  { label: 'Capabilities', href: '/capabilities' },
  { label: 'Theory', href: '/theory' },
  { label: 'Docs', href: '/docs' },
  { label: 'Admin', href: '/admin' },
]

function getCityContext(city) {
  const cityName = getCityDisplayName(city)
  const workspaceLabel = getCityWorkspaceLabel(city)
  const regionLabel = getWorkspaceSubline(city)
  const countryLabel = city?.country ?? 'Current country'
  const municipalityDescription = city?.municipalityDescription ?? 'Municipal authority territory'
  return {
    cityName,
    workspaceLabel,
    regionLabel,
    countryLabel,
    municipalityDescription,
  }
}

export function getTwinModuleNav() {
  return twinModuleNav
}

export function getTwinOverviewData(city) {
  const { cityName, countryLabel, regionLabel } = getCityContext(city)

  return {
    city: cityName,
    country: countryLabel,
    region: regionLabel,
    tagline:
      `${cityName} public-data base twin, lightweight logical twin, inferred semantic seeds, and a separate interoperability path.`,
    summary:
      `The current ${cityName} workspace starts from public territorial geometry, organizes it into a logical twin, exposes inferred semantic seeds honestly, and keeps data transport and interoperability as a separate architecture track for later growth.`,
  }
}

export function getTwinHeroMetricsFallback(city) {
  const { cityName } = getCityContext(city)

  return [
    {
      label: 'Territorial scope',
      value: 'Live',
      note: `The current ${cityName} area and municipal boundary are loaded from the active public payload.`,
    },
    {
      label: 'Named streets',
      value: 'Live',
      note: `Road counts and street-name coverage are derived from the current ${cityName} geometry feed.`,
    },
    {
      label: 'Built fabric',
      value: 'Live',
      note: `Building counts and volumetric approximations are computed when the ${cityName} twin payload is ready.`,
    },
    {
      label: 'Inferred semantic seeds',
      value: 'Live',
      note: `Civic, mobility, daily-economy, and waste seeds are recalculated for the active ${cityName} workspace.`,
    },
  ]
}

export function getTwinLayerRegisterData(city) {
  const { cityName } = getCityContext(city)

  return [
    {
      id: 'boundary',
      label: 'Municipal boundary',
      type: 'Base layer',
      count: 'Live',
      source: 'Nominatim + OpenStreetMap polygon reference',
      status: `Active in the current ${cityName} public base twin`,
      note: 'Administrative scope and municipal footprint.',
    },
    {
      id: 'roads',
      label: 'Road network',
      type: 'Base layer',
      count: 'Live',
      source: 'OpenStreetMap / Overpass highway geometry',
      status: `Active in the current ${cityName} public base twin`,
      note: 'Ways, named streets, and the first access structure.',
    },
    {
      id: 'buildings',
      label: 'Built fabric',
      type: 'Base layer',
      count: 'Live',
      source: 'OpenStreetMap / Overpass building geometry',
      status: `Active in the current ${cityName} public base twin`,
      note: 'Footprints and lightweight volumetric reading.',
    },
    {
      id: 'greenBlue',
      label: 'Green-blue systems',
      type: 'Base layer',
      count: 'Live',
      source: 'OpenStreetMap / Overpass leisure, landuse, natural, and water features',
      status: `Active in the current ${cityName} public base twin`,
      note: 'Parks, woods, water, recreation, and landscape context.',
    },
    {
      id: 'places',
      label: 'Settlements and places',
      type: 'Base layer',
      count: 'Live',
      source: 'OpenStreetMap place points',
      status: `Active in the current ${cityName} public base twin`,
      note: 'Named places and locality markers for territorial orientation.',
    },
    {
      id: 'civic',
      label: 'Civic anchors',
      type: 'Inferred semantic seed',
      count: 'Live',
      source: 'Public OSM feature classification',
      status: 'Visible as inferred meaning, not authority-grade semantics',
      note: 'Town hall, schools, healthcare, library, and public-service anchors.',
    },
    {
      id: 'mobility',
      label: 'Mobility anchors',
      type: 'Inferred semantic seed',
      count: 'Live',
      source: 'Public OSM feature classification',
      status: 'Visible as inferred meaning, not operational transport data',
      note: 'Stops, parking, charging, and access-supporting points.',
    },
    {
      id: 'commerce',
      label: 'Daily economy',
      type: 'Inferred semantic seed',
      count: 'Live',
      source: 'Public OSM feature classification',
      status: 'Visible as inferred meaning, not commercial operations data',
      note: 'Shops and activity points that reveal everyday urban demand.',
    },
    {
      id: 'waste',
      label: 'Waste and street seeds',
      type: 'Inferred semantic seed',
      count: 'Live',
      source: 'Public OSM feature classification',
      status: 'Seed only; not yet a formal waste semantic pack',
      note: 'Recycling and cleanliness points that bridge toward the first service layer.',
    },
  ]
}

export function getCapabilityJourneyData() {
  return [
    { label: 'Base', value: 92, theme: '#0d9488' },
    { label: 'Logical', value: 74, theme: '#2563eb' },
    { label: 'Semantic', value: 39, theme: '#8b5cf6' },
    { label: 'Interoperable', value: 16, theme: '#eab308' },
    { label: 'Operational', value: 12, theme: '#ef4444' },
  ]
}

export function getArchitectureStepsData() {
  return [
    {
      title: 'Collect and normalize',
      body: 'Bring public geometry, identifiers, and basic attributes into one clean local twin payload.',
    },
    {
      title: 'Structure as a logical twin',
      body: 'Organize the payload into stable layers, bundles, counts, selection logic, and viewer-ready management surfaces.',
    },
    {
      title: 'Expose inferred semantic seeds',
      body: 'Classify public points without pretending they are already authority-grade domain semantics.',
    },
    {
      title: 'Add transport and interoperability',
      body: 'Prepare shared models, cataloging, JSON-LD or NGSI-LD transport, and federation logic before multi-party reuse.',
    },
    {
      title: 'Operate services on top',
      body: 'Attach municipal service logic, analytics, guidance, and future domain packs such as waste, WEO, or SAMI.',
    },
  ]
}

export function getTheoryLensesData() {
  return [
    {
      title: 'Base twin',
      body: 'Geometry, location, public provenance, and observable baseline facts. It answers what exists and where.',
    },
    {
      title: 'Logical twin',
      body: 'Layer definitions, bundles, inventory, counts, and viewer-ready management logic. It makes the baseline usable.',
    },
    {
      title: 'Semantic seeds',
      body: 'Public-data classifications that already mean something for a domain, but are not yet official semantic packs.',
    },
    {
      title: 'Interoperability and transport',
      body: 'Shared models, exchange formats, cataloging, and context handling. This carries meaning across systems without being the meaning itself.',
    },
  ]
}

export function getViewerSurfaceRegisterData() {
  return [
    {
      id: 'map',
      Surface: 'Analytical map',
      'Base twin shown': 'Boundary, roads, buildings, green-blue systems, and places',
      'Logical twin shown': 'Layer bundles, inventory counts, selected-object metadata, fidelity controls, and map state',
      'Semantic seeds shown': 'Civic, mobility, commerce, and waste seeds when the corresponding bundle is enabled',
      'Transport posture': 'Local payload only. No shared catalog or semantic exchange model yet.',
    },
    {
      id: 'municipal',
      Surface: 'Municipal / 3D',
      'Base twin shown': 'Simplified boundary, roads, buildings, green-blue context, and place references',
      'Logical twin shown': 'LOD scene payloads, camera presets, bundle switching, and scene inventory',
      'Semantic seeds shown': 'Civic, mobility, commerce, and waste seeds inside the spatial operations reading',
      'Transport posture': 'Local scene payload only. Not yet brokered or standardized for exchange.',
    },
    {
      id: 'public',
      Surface: 'Civic XR',
      'Base twin shown': 'Recognisable streets, buildings, public realm, and orientation elements',
      'Logical twin shown': 'XR scene state, visible-layer bundles, and fidelity management',
      'Semantic seeds shown': 'Only the simpler explanatory seeds needed for civic storytelling',
      'Transport posture': 'Local XR scene payload only. No external exchange layer yet.',
    },
  ]
}

export function getPilotRequirementsData(city) {
  const { cityName } = getCityContext(city)

  return [
    {
      title: 'Seven-layer management path',
      body: `The ${cityName} authority should be able to understand what exists now across source systems, acquisition, knowledge, interoperability, services, orchestration, and visualisation without confusing that with domain semantics.`,
    },
    {
      title: 'Data lifecycle from collection to sharing',
      body: 'The product should explain how data is collected, normalized, interpreted, exchanged, and reused, not only how it is visualized.',
    },
    {
      title: 'Semantic interoperability posture',
      body: 'Inferred semantics should be separated from their later transport model so the city can see what is already classified and what still needs standardization.',
    },
    {
      title: 'Own-instance control',
      body: `The city should see its own ${cityName} instance, its own baseline, and the path for adding its own semantic or operational packs later.`,
    },
    {
      title: 'Service growth without rebuild',
      body: 'The base and logical twin should accept later packs such as municipal waste, WEO, SAMI, or EO semantics without replacing the platform.',
    },
  ]
}

export function getWs2PilotDetailRegisterData() {
  return [
    {
      id: 'rq2-lifecycle',
      Requirement: 'Rq2 data lifecycle',
      'Manual expectation': 'Describe tools, standards, components, and the data lifecycle from collection to use and sharing.',
      'Current platform posture': 'Theory and Docs separate collection, normalization, semantic interpretation, transport, and reuse.',
    },
    {
      id: 'rq13-seven-layers',
      Requirement: 'Rq13 seven LDT layers',
      'Manual expectation': 'Each authority should control one LDT instance through management interfaces across all seven layers.',
      'Current platform posture': 'The product distinguishes source data, acquisition, knowledge logic, interoperability, services, orchestration, and visualisation even if not all are fully implemented yet.',
    },
    {
      id: 'rq17-semantic-interoperability',
      Requirement: 'Rq17 semantic interoperability',
      'Manual expectation': 'Ensure semantic interoperability of exchanged data through open standards such as NGSI-LD or LDES.',
      'Current platform posture': 'Semantic seeds are explicit, but transport remains local. The interoperability register keeps NGSI-LD, JSON-LD, RDF, LDES, and DCAT as future obligations, not fake current features.',
    },
    {
      id: 'rc7-catalog-broker',
      Requirement: 'Rc7 catalog and broker posture',
      'Manual expectation': 'Prefer DCAT cataloging and a context broker capable of JSON-LD, RDF, or NGSI-LD.',
      'Current platform posture': 'Documented as pending architecture. The product makes this visible instead of mixing it into the base twin.',
    },
  ]
}

export function getTwinModelRegisterData(city) {
  const { cityName } = getCityContext(city)

  return [
    {
      id: 'base',
      Layer: 'Base twin',
      'Current status': 'Active',
      'What it contains': `Boundary, roads, buildings, green-blue systems, and places for ${cityName}`,
      'What it does not contain yet': 'Authority semantics, operational rules, or standardized exchange',
    },
    {
      id: 'logical',
      Layer: 'Logical twin',
      'Current status': 'Active',
      'What it contains': 'Layer definitions, bundles, counts, scene payloads, and management logic',
      'What it does not contain yet': 'Full cross-authority federation or domain-grade semantic contracts',
    },
    {
      id: 'semantic',
      Layer: 'Semantic seeds',
      'Current status': 'Partial / inferred',
      'What it contains': 'Civic, mobility, commerce, and waste meaning inferred from public data',
      'What it does not contain yet': 'Authority-approved packs such as WEO, SAMI, or municipal waste operations',
    },
    {
      id: 'transport',
      Layer: 'Interoperability / transport',
      'Current status': 'Planned',
      'What it contains': 'Current internal JSON payload only',
      'What it does not contain yet': 'NGSI-LD, JSON-LD, DCAT, context broker, LDES, or federation path',
    },
  ]
}

export function getDataTransportLifecycleData() {
  return [
    {
      id: 'collection',
      Stage: 'Collection',
      'Current posture': 'Public geometry and public reference sources only',
      'Next expectation': 'Add authority and partner datasets when the baseline is accepted',
    },
    {
      id: 'normalization',
      Stage: 'Normalization',
      'Current posture': 'Local twin payload and layer inventory',
      'Next expectation': 'Shared identifiers and authority data alignment',
    },
    {
      id: 'classification',
      Stage: 'Semantic interpretation',
      'Current posture': 'Inferred seeds for civic, mobility, commerce, and waste',
      'Next expectation': 'Formal semantic packs and domain ontologies',
    },
    {
      id: 'exchange',
      Stage: 'Transport and exchange',
      'Current posture': 'Internal payload only',
      'Next expectation': 'NGSI-LD / JSON-LD / RDF / DCAT and brokered exchange',
    },
    {
      id: 'reuse',
      Stage: 'Reuse and federation',
      'Current posture': 'Not active yet',
      'Next expectation': 'Cross-city reuse, pilot federation, and service interoperability',
    },
  ]
}

export function getPublicSourcesData(city) {
  const { cityName } = getCityContext(city)

  return [
    {
      source: 'OpenStreetMap / Overpass',
      category: 'Base geometry source',
      scope: `Roads, buildings, facilities, places, and green-blue geometries for ${cityName}.`,
      status: 'Feeds the public base twin.',
    },
    {
      source: 'Nominatim',
      category: 'Base administrative reference',
      scope: `Municipal lookup and territorial anchor for ${cityName}.`,
      status: 'Feeds scope and city reference.',
    },
    {
      source: 'Local classification logic',
      category: 'Semantic seed derivation',
      scope: 'Civic, mobility, commerce, and waste interpretation from public inputs.',
      status: 'Feeds inferred semantic seeds only.',
    },
    {
      source: 'Twin Base payload',
      category: 'Logical twin output',
      scope: 'Inventory, bundles, counts, viewer state, and scene-ready structures.',
      status: 'Feeds the current product surface, not yet the interoperability layer.',
    },
  ]
}

export function getSemanticSeedRegisterData() {
  return [
    {
      id: 'civic',
      Seed: 'Civic anchors',
      'Current basis': 'Public facility classification',
      'Current meaning': 'Public-service baseline',
      'Future enrichment': 'Authority service metadata, demand, quality, incidents',
    },
    {
      id: 'mobility',
      Seed: 'Mobility anchors',
      'Current basis': 'Public mobility point classification',
      'Current meaning': 'Access and reach baseline',
      'Future enrichment': 'Traffic, restrictions, multimodal operations, service times',
    },
    {
      id: 'commerce',
      Seed: 'Daily economy',
      'Current basis': 'Public shop and activity classification',
      'Current meaning': 'Daily urban demand and street-use hints',
      'Future enrichment': 'Intensity, service demand, waste generation, frontage logic',
    },
    {
      id: 'waste',
      Seed: 'Waste and street seeds',
      'Current basis': 'Public waste-related points',
      'Current meaning': 'First waste-service bridge',
      'Future enrichment': 'Collection logic, hotspots, service zones, actions',
    },
  ]
}

export function getFutureSemanticPacksData() {
  return [
    {
      id: 'waste-pack',
      Pack: 'Municipal waste pack',
      'What it adds': 'Waste semantics, economics, service zones, and street-cleanliness logic',
      'Probable inputs': 'Authority operations, field observations, inferred demand, and collection logic',
    },
    {
      id: 'weo-pack',
      Pack: 'WEO pack',
      'What it adds': 'Water and environmental semantics on top of a new physical observation layer',
      'Probable inputs': 'Space or remote observation, environmental models, water semantics',
    },
    {
      id: 'sami-pack',
      Pack: 'SAMI pack',
      'What it adds': 'Additional operational or AI-driven city semantics',
      'Probable inputs': 'Partner domain models, derived intelligence, service workflows',
    },
    {
      id: 'eo-pack',
      Pack: 'EO / satellite pack',
      'What it adds': 'New physical observation layer before further semantics',
      'Probable inputs': 'Satellite imagery, remote sensing, raster-derived products',
    },
  ]
}

export function getInteroperabilityRegisterData() {
  return [
    {
      id: 'model',
      Topic: 'Shared model',
      'Current status': 'Not formalized',
      'What exists now': 'Internal JSON payload and viewer structures',
      'Next step': 'Define the shared data model for the pilot',
    },
    {
      id: 'catalog',
      Topic: 'Catalog and discoverability',
      'Current status': 'Not formalized',
      'What exists now': 'Human-readable docs and source register',
      'Next step': 'Add DCAT-ready metadata and publication posture',
    },
    {
      id: 'exchange',
      Topic: 'Exchange format',
      'Current status': 'Not formalized',
      'What exists now': 'Internal JSON only',
      'Next step': 'Prepare NGSI-LD / JSON-LD / RDF transport path',
    },
    {
      id: 'broker',
      Topic: 'Context and broker layer',
      'Current status': 'Not active',
      'What exists now': 'No context broker in the current prototype',
      'Next step': 'Evaluate a brokered layer when the pilot semantics are agreed',
    },
    {
      id: 'federation',
      Topic: 'Federation path',
      'Current status': 'Not active',
      'What exists now': 'Single-city local twin instance',
      'Next step': 'Define reuse and exchange between pilot members',
    },
  ]
}

export function getDocumentPackData(city) {
  const { cityName } = getCityContext(city)

  return [
    {
      title: `${cityName} base twin brief`,
      type: 'Institutional note',
      description: 'What is geometry, provenance, and baseline fact in the current city twin.',
    },
    {
      title: 'Semantic seed register',
      type: 'Domain note',
      description: 'What is already interpreted semantically from public data and what still needs formal enrichment.',
    },
    {
      title: 'Interoperability posture note',
      type: 'Architecture note',
      description: 'What exists today for transport and what still needs standards, cataloging, and exchange design.',
    },
    {
      title: 'Viewer surface register',
      type: 'Product note',
      description: 'What each viewer shows from the base twin, the logical twin, and the inferred semantic seeds.',
    },
    {
      title: 'WS2 pilot-detail alignment note',
      type: 'Compliance note',
      description: 'How the current product explains data lifecycle, seven-layer management, and semantic interoperability posture.',
    },
    {
      title: 'Semantic pack roadmap',
      type: 'Growth note',
      description: 'Which future packs can attach next without rebuilding the base and logical twin.',
    },
  ]
}
