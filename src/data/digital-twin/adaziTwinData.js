export const twinModuleNav = [
  { label: 'Workspace', href: '/cockpit' },
  { label: 'Map', href: '/analytical-map' },
  { label: 'City 3D', href: '/city-3d' },
  { label: 'Civic XR', href: '/civic-xr' },
  { label: 'Theory', href: '/theory' },
  { label: 'Docs', href: '/docs' },
  { label: 'Admin', href: '/admin' },
]

export const twinOverview = {
  city: 'Ādaži',
  country: 'Latvia',
  region: 'Riga planning region',
  tagline:
    'Public-data base twin, lightweight logical twin, inferred semantic seeds, and a separate interoperability path.',
  summary:
    'The current product starts with public territorial geometry, organizes it into a logical twin, exposes inferred semantic seeds honestly, and keeps data transport and interoperability as a separate architecture track.',
}

export const twinHeroMetrics = [
  {
    label: 'Territorial scope',
    value: '10.3 km²',
    note: 'Administrative boundary, place names, and settlement footprint already define the base territorial canvas.',
  },
  {
    label: 'Named streets',
    value: '178',
    note: 'Street geometry is part of the base twin and already supports map, 3D, and routing views.',
  },
  {
    label: 'Built fabric',
    value: '3,848',
    note: 'Building footprints and approximate volumes are already visible as public baseline geometry.',
  },
  {
    label: 'Inferred semantic seeds',
    value: '240',
    note: 'Civic, mobility, daily-economy, and waste classifications are inferred from public data and kept separate from the base layer.',
  },
]

export const twinLayerRegister = [
  {
    id: 'boundary',
    label: 'Municipal boundary',
    type: 'Base layer',
    count: 1,
    source: 'Nominatim + OpenStreetMap polygon reference',
    status: 'Active in the current public base twin',
    note: 'Administrative scope and municipal footprint.',
  },
  {
    id: 'roads',
    label: 'Road network',
    type: 'Base layer',
    count: 2961,
    source: 'OpenStreetMap / Overpass highway geometry',
    status: 'Active in the current public base twin',
    note: 'Ways, named streets, and the first access structure.',
  },
  {
    id: 'buildings',
    label: 'Built fabric',
    type: 'Base layer',
    count: 3848,
    source: 'OpenStreetMap / Overpass building geometry',
    status: 'Active in the current public base twin',
    note: 'Footprints and lightweight volumetric reading.',
  },
  {
    id: 'greenBlue',
    label: 'Green-blue systems',
    type: 'Base layer',
    count: 610,
    source: 'OpenStreetMap / Overpass leisure, landuse, natural, and water features',
    status: 'Active in the current public base twin',
    note: 'Parks, woods, water, recreation, and landscape context.',
  },
  {
    id: 'places',
    label: 'Settlements and places',
    type: 'Base layer',
    count: 16,
    source: 'OpenStreetMap place points',
    status: 'Active in the current public base twin',
    note: 'Named places and locality markers for territorial orientation.',
  },
  {
    id: 'civic',
    label: 'Civic anchors',
    type: 'Inferred semantic seed',
    count: 10,
    source: 'Public OSM feature classification',
    status: 'Visible as inferred meaning, not authority-grade semantics',
    note: 'Town hall, schools, healthcare, library, and public-service anchors.',
  },
  {
    id: 'mobility',
    label: 'Mobility anchors',
    type: 'Inferred semantic seed',
    count: 59,
    source: 'Public OSM feature classification',
    status: 'Visible as inferred meaning, not operational transport data',
    note: 'Stops, parking, charging, and access-supporting points.',
  },
  {
    id: 'commerce',
    label: 'Daily economy',
    type: 'Inferred semantic seed',
    count: 122,
    source: 'Public OSM feature classification',
    status: 'Visible as inferred meaning, not commercial operations data',
    note: 'Shops and activity points that reveal everyday urban demand.',
  },
  {
    id: 'waste',
    label: 'Waste and street seeds',
    type: 'Inferred semantic seed',
    count: 49,
    source: 'Public OSM feature classification',
    status: 'Seed only; not yet a formal waste semantic pack',
    note: 'Recycling and cleanliness points that bridge toward the first service layer.',
  },
]

export const cockpitFocusBundles = [
  {
    id: 'base-baseline',
    label: 'Base baseline',
    description: 'Boundary, roads, buildings, green-blue systems, and places only.',
    layers: ['boundary', 'roads', 'buildings', 'greenBlue', 'places'],
  },
  {
    id: 'access-seeds',
    label: 'Access seeds',
    description: 'Base geometry plus civic and mobility meaning.',
    layers: ['boundary', 'roads', 'buildings', 'civic', 'mobility'],
  },
  {
    id: 'service-preview',
    label: 'Service preview',
    description: 'Base geometry plus daily-economy and waste semantic seeds.',
    layers: ['roads', 'buildings', 'commerce', 'waste'],
  },
]

export const municipalReadiness = [
  { label: 'Base twin ready', value: 91, theme: '#0d9488' },
  { label: 'Logical twin ready', value: 78, theme: '#2563eb' },
  { label: 'Semantic seeds visible', value: 63, theme: '#7c3aed' },
  { label: 'Interoperability prepared', value: 22, theme: '#ea580c' },
  { label: 'Operational services ready', value: 18, theme: '#ef4444' },
  { label: 'Waste pack readiness', value: 41, theme: '#ca8a04' },
]

export const municipalAssetMix = [
  { label: 'Base geometry', value: 7435, theme: '#60a5fa' },
  { label: 'Semantic seeds', value: 240, theme: '#8b5cf6' },
  { label: 'Future semantic packs', value: 4, theme: '#14b8a6' },
]

export const publicJourney = [
  { label: 'Recognise the place', value: 87, theme: '#0d9488' },
  { label: 'Understand the baseline', value: 79, theme: '#2563eb' },
  { label: 'Recognise semantic hints', value: 58, theme: '#7c3aed' },
  { label: 'Understand what is still missing', value: 66, theme: '#ea580c' },
]

export const publicTouchpoints = [
  { label: 'Base streets', value: 178, theme: '#38bdf8' },
  { label: 'Base buildings', value: 3848, theme: '#60a5fa' },
  { label: 'Base green-blue', value: 610, theme: '#22c55e' },
  { label: 'Civic seeds', value: 10, theme: '#0f766e' },
  { label: 'Mobility seeds', value: 59, theme: '#2563eb' },
  { label: 'Waste seeds', value: 49, theme: '#f59e0b' },
]

export const capabilityJourney = [
  { label: 'Base', value: 92, theme: '#0d9488' },
  { label: 'Logical', value: 74, theme: '#2563eb' },
  { label: 'Semantic', value: 39, theme: '#8b5cf6' },
  { label: 'Interoperable', value: 16, theme: '#eab308' },
  { label: 'Operational', value: 12, theme: '#ef4444' },
]

export const architectureSteps = [
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

export const theoryLenses = [
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

export const viewerSurfaceRegister = [
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

export const pilotRequirements = [
  {
    title: 'Seven-layer management path',
    body: 'The authority should be able to understand what exists now across source systems, acquisition, knowledge, interoperability, services, orchestration, and visualisation without confusing that with domain semantics.',
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
    body: 'The city should see its own instance, its own baseline, and the path for adding its own semantic or operational packs later.',
  },
  {
    title: 'Service growth without rebuild',
    body: 'The base and logical twin should accept later packs such as municipal waste, WEO, SAMI, or EO semantics without replacing the platform.',
  },
]

export const ws2PilotDetailRegister = [
  {
    id: 'rq2-lifecycle',
    Requirement: 'Rq2 data lifecycle',
    'Manual expectation': 'Describe tools, standards, components, and the data lifecycle from collection to use and sharing.',
    'Current platform posture': 'Theory and Docs now separate collection, normalization, semantic interpretation, transport, and reuse.',
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

export const twinModelRegister = [
  {
    id: 'base',
    Layer: 'Base twin',
    'Current status': 'Active',
    'What it contains': 'Boundary, roads, buildings, green-blue systems, places',
    'What it does not contain yet': 'Authority semantics, operational rules, or standardized exchange',
  },
  {
    id: 'logical',
    Layer: 'Logical twin',
    'Current status': 'Active',
    'What it contains': 'Layer definitions, bundles, counts, scene payloads, management logic',
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

export const dataTransportLifecycle = [
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

export const publicSources = [
  {
    source: 'OpenStreetMap / Overpass',
    category: 'Base geometry source',
    scope: 'Roads, buildings, facilities, places, and green-blue geometries.',
    status: 'Feeds the public base twin.',
  },
  {
    source: 'Nominatim',
    category: 'Base administrative reference',
    scope: 'Municipal lookup and territorial anchor.',
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

export const semanticSeedRegister = [
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

export const futureSemanticPacks = [
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

export const interoperabilityRegister = [
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

export const documentPack = [
  {
    title: 'Base twin brief',
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

export const adminMetrics = [
  { label: 'Active viewers', value: '1', note: 'Visible sessions in the last 15 minutes.' },
  { label: 'Unique viewers 24h', value: '4', note: 'Distinct users who opened the digital twin module.' },
  { label: 'Page views 24h', value: '32', note: 'Navigations across cockpit, municipal, public, theory, docs, and admin.' },
  { label: 'Docs reads 24h', value: '11', note: 'Recent reads across architecture and reference materials.' },
]

export const adminActivity = [
  {
    viewer: 'Edgar Antonio Valdes',
    surface: 'Cockpit',
    focus: 'Base and semantic split review',
    lastSeen: '22 Mar 2026, 09:12',
    status: 'Active',
  },
  {
    viewer: 'Twin Studio Admin',
    surface: 'Docs',
    focus: 'Interoperability register',
    lastSeen: '22 Mar 2026, 08:44',
    status: 'Active',
  },
  {
    viewer: 'Municipal Reviewer',
    surface: 'Public',
    focus: 'Participatory XR scene',
    lastSeen: '21 Mar 2026, 18:07',
    status: 'Reviewing',
  },
]

export const twinUserProfile = {
  name: 'Demo City Administrator',
  shortName: 'Demo City Admin',
  email: 'admin@example.org',
  role: 'Platform administrator',
  organization: 'Open Local Digital Twin',
  workspace: 'Ādaži Digital Twin Workspace',
  city: 'Ādaži, Latvia',
  status: 'Active session',
  accessLevel: 'Administrative access',
  lastSeen: '22 Mar 2026, 09:12',
  bio:
    'Responsible for platform administration, municipal reviews, and the delivery path from base twin to future semantic packs.',
  responsibilities: [
    'Keep base, semantic, and interoperability layers clearly separated inside the product.',
    'Review the territorial baseline before municipal enrichment begins.',
    'Manage restricted tools without exposing them to city-facing routes.',
  ],
  permissions: [
    'Open cockpit, Analytical Map, City 3D, Civic XR, theory, docs, and admin routes.',
    'Review live map, 3D, and immersive viewers.',
    'Access restricted Jampack tools from the admin-only menu.',
  ],
  preferences: [
    { label: 'Theme preference', value: 'Adaptive light/dark workspace' },
    { label: 'Primary city', value: 'Ādaži, Latvia' },
    { label: 'Viewer preference', value: 'Municipal operations and cockpit' },
    { label: 'Notification mode', value: 'Critical updates only' },
  ],
  security: [
    { label: 'Sign-in channel', value: 'Workspace credentials' },
    { label: 'Password status', value: 'Managed outside the prototype' },
    { label: 'Restricted tools', value: 'Visible only for admin users' },
    { label: 'Session posture', value: 'Single workspace control session' },
  ],
  recentSurfaces: [
    { surface: 'Cockpit', focus: 'Base vs semantic split', time: '22 Mar 2026, 09:12' },
    { surface: 'Docs', focus: 'Source and transport register', time: '22 Mar 2026, 08:44' },
    { surface: 'Public', focus: 'Participatory XR scene', time: '21 Mar 2026, 18:07' },
  ],
}

export const viewerStops = [
  {
    id: 'town-hall',
    label: 'Town hall',
    summary: 'Institutional anchor in the public base twin.',
  },
  {
    id: 'schools',
    label: 'School cluster',
    summary: 'Public-service concentration and daily movement logic.',
  },
  {
    id: 'green-corridor',
    label: 'Green corridor',
    summary: 'Environmental context from the base twin, not yet a resilience semantic pack.',
  },
  {
    id: 'waste-next',
    label: 'Waste next',
    summary: 'Where the first formal semantic pack can start without replacing the base twin.',
  },
]
