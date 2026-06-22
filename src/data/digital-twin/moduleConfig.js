export const twinGlobalRoutes = [
  { key: 'cockpit', label: 'Workspace', href: '/cockpit' },
  { key: 'map', label: 'Analytical Map', href: '/analytical-map' },
  { key: 'municipal', label: 'City 3D', href: '/city-3d' },
  { key: 'public', label: 'Civic XR', href: '/civic-xr' },
  { key: 'theory', label: 'Theory', href: '/theory' },
  { key: 'docs', label: 'Docs', href: '/docs' },
]

export const adminToolLinks = [
  { label: 'Admin console', href: '/admin' },
  { label: 'Calendar', href: '/apps/calendar' },
  { label: 'Email', href: '/apps/email' },
  { label: 'Invoices', href: '/apps/invoices/invoice-list' },
  { label: 'Scrumboard', href: '/apps/scrumboard/project-board' },
]

export const viewerBundles = {
  map: [
    {
      id: 'base-baseline',
      label: 'Base geometry',
      note: 'Only physical and territorial baseline geometry: boundary, unclassified municipal land, roads, buildings, land-use/open-land polygons, and places.',
      layers: ['boundary', 'unclassifiedLand', 'roads', 'buildings', 'greenBlue', 'places'],
    },
    {
      id: 'access-seeds',
      label: 'Base + access seeds',
      note: 'Base geometry plus inferred civic and mobility seeds. These are not yet formal authority semantic packs.',
      layers: ['boundary', 'unclassifiedLand', 'roads', 'buildings', 'civic', 'mobility'],
    },
    {
      id: 'building-coverage',
      label: 'Buildings',
      note: 'All open building footprints as one base-twin layer. Source matching and duplicates belong in reports, not the main map toggle.',
      layers: ['boundary', 'buildings'],
    },
    {
      id: 'service-preview',
      label: 'Next semantic pack preview',
      note: 'A preview of how the future waste and street-cleanliness pack can attach without replacing the base twin.',
      layers: ['roads', 'buildings', 'commerce', 'wasteSeeds'],
    },
  ],
  municipal: [
    {
      id: 'base-baseline',
      label: 'Base geometry',
      note: 'Built environment, access geometry, and public-realm geometry without semantic overlays.',
      layers: ['boundary', 'unclassifiedLand', 'roads', 'buildings', 'greenBlue', 'places'],
    },
    {
      id: 'operational-seeds',
      label: 'Inferred semantic seeds',
      note: 'Base geometry plus the inferred seeds that make the city operationally discussable without pretending they are formal domain packs.',
      layers: ['boundary', 'unclassifiedLand', 'roads', 'buildings', 'civic', 'mobility', 'commerce', 'wasteSeeds'],
    },
    {
      id: 'full-city',
      label: 'Base + seeds',
      note: 'A wider municipal reading that combines baseline geometry with the current inferred seeds.',
      layers: ['boundary', 'unclassifiedLand', 'roads', 'buildings', 'greenBlue', 'civic', 'mobility', 'commerce', 'wasteSeeds', 'places'],
    },
  ],
  public: [
    {
      id: 'public-realm',
      label: 'Civic base',
      note: 'Recognisable public city objects prepared for a browser XR session.',
      layers: ['boundary', 'unclassifiedLand', 'greenBlue', 'places', 'roads', 'buildings'],
    },
    {
      id: 'institutional-seeds',
      label: 'XR seeds',
      note: 'Inferred civic, mobility, and access seeds available in the same XR scene graph.',
      layers: ['boundary', 'unclassifiedLand', 'roads', 'buildings', 'civic', 'mobility'],
    },
    {
      id: 'next-pack-preview',
      label: 'Semantic pack preview',
      note: 'Future waste and street-cleanliness seeds attached without replacing the base twin.',
      layers: ['roads', 'buildings', 'commerce', 'wasteSeeds'],
    },
  ],
}

export const twinViewerModules = {
  map: {
    routeKey: 'map',
    routePath: '/analytical-map',
    surfaceRole: 'analytical-map',
    title: 'Analytical Map',
    eyebrow: '',
    summary: 'Base twin, inferred seeds, and open-source coverage for the current city.',
    viewerId: 'map',
    viewerUrl: '/live/current/map',
    defaultBundleId: '',
    defaultCityCoverage: 0,
    queryDriven: true,
    supportsFidelity: false,
    supportsCityScale: true,
    defaultFidelity: 58,
    fidelityLabel: 'Drawing intensity',
    fidelityHint:
      'Low keeps the drawing quiet. High makes visible roads, buildings, systems, and markers stronger.',
    controlTitle: 'Viewer controls',
    controlBody: 'Query city objects and inspect selected elements.',
    sections: [
      { id: 'map-status', label: 'Status' },
      { id: 'map-canvas', label: 'Map' },
      { id: 'map-sources', label: 'Sources' },
      { id: 'map-selection', label: 'Selection' },
    ],
    commands: [],
    content: {
      statusTitle: 'What the current map already proves',
      statusBody:
        'The analytical map separates public baseline geometry, lightweight logical-twin management, inferred semantic seeds, and still-pending transport/interoperability work instead of mixing them into one surface.',
      sources: [
        'OpenStreetMap / Overpass for public geometry, facilities, mobility points, land-use/open-land polygons, and candidate waste points.',
        'Nominatim for the municipal reference and territorial anchor.',
        'No access-line layer is generated in the current public base twin.',
        'Twin derivations for grouped systems, counts, seed registers, and stage-ready inventory. These belong to the logical twin, not to the base geometry.',
      ],
      next: [
        'Confirm the base geometry with the authority first.',
        'Decide which inferred seed becomes the first formal semantic pack.',
        'Add operational municipal data only after the base, logical, and seed story is accepted.',
      ],
    },
  },
  municipal: {
    routeKey: 'municipal',
    routePath: '/city-3d',
    title: 'City 3D',
    eyebrow: 'Spatial inspection surface',
    summary:
      'Inspect query-scoped city objects in 3D, validate the base city canvas, and locate provider or BIM assets without making them the primary city viewer.',
    viewerId: '3d',
    viewerUrl: '/live/current/3d',
    defaultBundleId: 'operational-seeds',
    defaultCityCoverage: 0,
    queryDriven: true,
    supportsFidelity: true,
    supportsCityScale: true,
    defaultFidelity: 42,
    fidelityLabel: '3D fidelity',
    fidelityHint:
      'Low keeps the scene light. High should visibly pull in more roads, buildings, and territorial context.',
    controlTitle: 'Viewer controls',
    controlBody: 'Query city objects and inspect selected elements.',
    sections: [
      { id: 'municipal-readiness', label: 'Readiness' },
      { id: 'municipal-scene', label: 'Spatial scene' },
      { id: 'municipal-decisions', label: 'Decisions' },
    ],
    commands: [
      { id: 'city-view', label: 'City view', kind: 'cameraPreset', value: 'planning' },
      { id: 'district-focus', label: 'District focus', kind: 'cameraPreset', value: 'district' },
      { id: 'full-scope', label: 'Full scope', kind: 'cameraPreset', value: 'scope' },
      { id: 'top-view', label: 'Oblique', kind: 'cameraPreset', value: 'oblique' },
    ],
    content: {
      statusTitle: 'What City 3D validates here',
      statusBody:
        'City 3D reads the same TwinQL selection as the map, keeps BIM/IFC as attached evidence, and shows where semantic packs can attach without becoming a hidden viewer-only dataset.',
      readinessTitle: 'What City 3D validates here',
      readinessBody:
        'The built environment, public-service seeds, and public-realm context become a spatial command surface instead of staying as a flat map only.',
      decisions: [
        'Validate the current municipal footprint and base geometry.',
        'Agree which inferred seed becomes the first formal semantic pack.',
        'Decide which municipal datasets should enrich the base and semantic layers next without overloading the current transport model.',
      ],
    },
  },
  public: {
    routeKey: 'public',
    routePath: '/civic-xr',
    title: 'Civic XR',
    eyebrow: 'Civic XR surface',
    summary:
      'Open browser XR surface over the same city inventory, inferred seeds, and semantic-pack posture used by the analytical and 3D surfaces.',
    viewerId: 'immersive',
    viewerUrl: '/live/current/immersive',
    defaultBundleId: 'public-realm',
    defaultCityCoverage: 0,
    queryDriven: true,
    supportsFidelity: true,
    supportsCityScale: true,
    defaultFidelity: 54,
    fidelityLabel: 'XR scene fidelity',
    fidelityHint:
      'Low keeps the XR scene light. High brings in more buildings, roads, anchors, and labels for a richer civic reading.',
    controlTitle: 'Viewer controls',
    controlBody: 'Query city objects and inspect selected elements.',
    sections: [
      { id: 'public-assurance', label: 'Assurance' },
      { id: 'public-stage', label: 'XR scene' },
      { id: 'public-benefit', label: 'Public benefit' },
    ],
    commands: [
      { id: 'xr-walk-fragment', label: 'Walk', kind: 'xrExperience', value: 'walk' },
      { id: 'xr-compare-fragments', label: 'Compare', kind: 'xrExperience', value: 'compare' },
      { id: 'xr-overlay-fragments', label: 'Overlay', kind: 'xrExperience', value: 'overlay' },
    ],
    content: {
      statusTitle: 'What Civic XR already exposes',
      statusBody:
        'The current XR surface exposes recognisable places, public baseline geometry, and early semantic hints while keeping a clear path toward the next service pack.',
      assuranceTitle: 'What Civic XR should guarantee',
      assuranceBody:
        'The same base twin can become an embeddable public XR scene without pretending that full operational semantics are already available.',
      benefits: [
        'Residents can recognise streets, services, and public space more easily.',
        'Partners can see what is already public baseline and what is only an inferred semantic hint.',
        'The future waste and street-cleanliness pack becomes easier to understand before it arrives.',
      ],
    },
  },
}

export const theoryPageConfig = {
  title: 'Local Digital Twin Theory',
  eyebrow: 'Institutional framing',
  summary:
    'Explain clearly what is base, what is logical, what is already an inferred semantic seed, and what still belongs to interoperability and future service packs.',
  sections: [
    { id: 'theory-lenses', label: 'Lenses' },
    { id: 'theory-capabilities', label: 'Capabilities' },
    { id: 'theory-architecture', label: 'Architecture' },
    { id: 'theory-pilot', label: 'Pilot fit' },
    { id: 'theory-capability-table', label: 'Register' },
    { id: 'theory-transport', label: 'Lifecycle' },
    { id: 'theory-pilot-fit', label: 'WS2 alignment' },
  ],
}

export const docsPageConfig = {
  title: 'Reference Notes and Documentation',
  eyebrow: 'Project references',
  summary:
    'Surface the notes, source posture, semantic-pack roadmap, viewer posture, and interoperability path so the twin can be reviewed as a real institutional product.',
  sections: [
    { id: 'docs-brief', label: 'City brief' },
    { id: 'docs-pack', label: 'Document pack' },
    { id: 'docs-sources', label: 'Sources' },
    { id: 'docs-register', label: 'Register' },
    { id: 'docs-viewers', label: 'Viewer register' },
    { id: 'docs-seeds', label: 'Semantic seeds' },
    { id: 'docs-interoperability', label: 'Transport' },
    { id: 'docs-packs', label: 'Future packs' },
    { id: 'docs-ws2', label: 'WS2 alignment' },
  ],
}

export const capabilitiesPageConfig = {
  title: 'Capability Contract',
  eyebrow: 'Product readiness surface',
  summary:
    'Review what the active city can actually serve today, which standards are covered, and which product promises are still partial or missing.',
  sections: [
    { id: 'capability-readiness', label: 'Readiness' },
    { id: 'capability-modules', label: 'Modules' },
    { id: 'capability-counts', label: 'Counts' },
    { id: 'capability-contract', label: 'Contract' },
    { id: 'capability-gaps', label: 'Gaps' },
  ],
}

export const adminPageConfig = {
  title: 'Access and Activity Control',
  eyebrow: 'Platform administration',
  summary:
    'Review who entered the platform, what part of the twin they opened, and the current operational health of the delivery environment.',
  sections: [
    { id: 'admin-health', label: 'Health' },
    { id: 'admin-access', label: 'Access' },
    { id: 'admin-tools', label: 'Tools' },
    { id: 'admin-activity', label: 'Activity' },
  ],
}
