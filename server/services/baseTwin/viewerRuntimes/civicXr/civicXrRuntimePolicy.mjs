export function renderCivicXrRuntimePolicy() {
  return `
        const BASE_SCENE_LIMITS = {
          boundary: Number.MAX_SAFE_INTEGER,
          roads: Number.MAX_SAFE_INTEGER,
          buildings: Number.MAX_SAFE_INTEGER,
          greenBlue: Number.MAX_SAFE_INTEGER,
          civic: Number.MAX_SAFE_INTEGER,
          mobility: Number.MAX_SAFE_INTEGER,
          commerce: Number.MAX_SAFE_INTEGER,
          wasteSeeds: Number.MAX_SAFE_INTEGER,
          places: Number.MAX_SAFE_INTEGER,
        }
        const QUERY_SCENE_LIMITS = {
          boundary: Number.MAX_SAFE_INTEGER,
          roads: Number.MAX_SAFE_INTEGER,
          buildings: Number.MAX_SAFE_INTEGER,
          greenBlue: Number.MAX_SAFE_INTEGER,
          civic: Number.MAX_SAFE_INTEGER,
          mobility: Number.MAX_SAFE_INTEGER,
          commerce: Number.MAX_SAFE_INTEGER,
          wasteSeeds: Number.MAX_SAFE_INTEGER,
          places: Number.MAX_SAFE_INTEGER,
          features: Number.MAX_SAFE_INTEGER,
        }
        const CIVIC_LAYER_KEYS = ['boundary', 'roads', 'buildings', 'greenBlue', 'civic', 'mobility', 'commerce', 'wasteSeeds', 'places', 'features', 'sceneBase', 'xrFragments']
        const WALK_EYE_HEIGHT = 1.65
        const WALK_TARGET_HEIGHT = 1.55
        const WALK_COLLIDER_RADIUS = 0.36
        const WALK_COLLIDER_HEIGHT = 0.72
        const WALK_MIN_BUILDING_CLEARANCE = 1.35
        const WALK_TARGET_FRAGMENT_SPAN = 400

        const RENDER_POLICIES = {
          walk: {
            mode: 'walk',
            cameraType: 'street-presence',
            collisions: true,
            visualStyle: 'presence',
            detailRadiusM: 80,
            shadowRadiusM: 120,
            buildingDetailLimit: 48,
            shadowLimit: 72,
            platformMode: 'single-fragment',
          },
          compare: {
            mode: 'compare',
            cameraType: 'inspection',
            collisions: false,
            visualStyle: 'technical',
            detailRadiusM: 0,
            shadowRadiusM: 0,
            buildingDetailLimit: 0,
            shadowLimit: 0,
            platformMode: 'separate-platforms',
          },
          overlay: {
            mode: 'overlay',
            cameraType: 'free-flight',
            collisions: false,
            visualStyle: 'presence-semantic-overlay',
            detailRadiusM: 40,
            shadowRadiusM: 60,
            buildingDetailLimit: 24,
            shadowLimit: 36,
            semanticOverlayLimit: 180,
            platformMode: 'shared-origin-layered',
          },
        }

        function renderPolicyForMode(modeKey = activeExperienceMode) {
          return RENDER_POLICIES[modeKey] || RENDER_POLICIES.walk
        }

        const EXPERIENCE_MODES = {
          walk: {
            eyebrow: 'Walk mode',
            title: 'Walkable Civic XR room',
            detail: 'Move through the selected fragment at pedestrian scale.',
            camera: { beta: Math.PI / 2.42, radiusFactor: 0.68, yFactor: 0.045 },
          },
          compare: {
            eyebrow: 'Compare mode',
            title: 'Two fragments side by side',
            detail: 'Ready for saved-view comparison: the current fragment stays inspectable while a second fragment contract is attached.',
            camera: { beta: Math.PI / 3.25, radiusFactor: 1.55, yFactor: 0.07 },
          },
          overlay: {
            eyebrow: 'Overlay mode',
            title: 'Fragments on the same center',
            detail: 'Use translucent layers to inspect morphology, density, and source differences over one shared origin.',
            camera: { beta: Math.PI / 4.6, radiusFactor: 1.18, yFactor: 0.09 },
          },
        }
  `
}
