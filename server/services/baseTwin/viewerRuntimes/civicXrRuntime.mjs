import { renderViewerShareManifestRuntime } from './viewerShareManifestRuntime.mjs'

export function renderCivicXrRuntime({ cityId = 'current', baseEndpoint }) {
  const endpointJson = JSON.stringify(baseEndpoint)
  const cityIdJson = JSON.stringify(cityId)
  return `
      <script type="module">
        import { Engine } from '/vendor/babylonjs/core/Engines/engine.js'
        import { Scene } from '/vendor/babylonjs/core/scene.js'
        import { ArcRotateCamera } from '/vendor/babylonjs/core/Cameras/arcRotateCamera.js'
        import { UniversalCamera } from '/vendor/babylonjs/core/Cameras/universalCamera.js'
        import { HemisphericLight } from '/vendor/babylonjs/core/Lights/hemisphericLight.js'
        import { MeshBuilder } from '/vendor/babylonjs/core/Meshes/meshBuilder.js'
        import { StandardMaterial } from '/vendor/babylonjs/core/Materials/standardMaterial.js'
        import { PointerEventTypes } from '/vendor/babylonjs/core/Events/pointerEvents.js'
        import { Color3, Color4 } from '/vendor/babylonjs/core/Maths/math.color.js'
        import { Vector3 } from '/vendor/babylonjs/core/Maths/math.vector.js'
        import '/vendor/babylonjs/core/Collisions/collisionCoordinator.js'
        import '/vendor/babylonjs/core/Helpers/sceneHelpers.js'

        const viewerId = 'immersive'
        const productSurface = 'civic-xr'
        const cityId = ${cityIdJson}
        const baseEndpoint = ${endpointJson}
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

        const layerState = {}
        const layerMeshes = new Map()
        const buildingMaterialCache = new Map()
        const semanticMaterialCache = new Map()
        const pickableMeshes = new Set()
        const detailState = { fidelity: 1 }
        let currentPayload = null
        let currentSceneModel = null
        let scene = null
        let engine = null
        let camera = null
        let streetCamera = null
        let xrExperience = null
        let xrSupport = { ar: false, vr: false }
        let activeExperienceMode = 'walk'
        let activeFragmentWorkspace = []
        let groundMesh = null
        let selectedMesh = null
        let selectedHighlightMesh = null

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

        const esc = (value) => String(value ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;')

        function clamp(value, min, max) {
          return Math.min(max, Math.max(min, value))
        }

        function finiteNumber(value, fallback = 0) {
          const parsed = Number(value)
          return Number.isFinite(parsed) ? parsed : fallback
        }

        function broadcast(type, payload = {}) {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              source: 'twin-viewer',
              viewer: viewerId,
              productSurface,
              type,
              ...payload,
            }, '*')
          }
        }

        function setStatus(label, detail = '') {
          const status = document.getElementById('civic-xr-status')
          if (status) status.textContent = label
          const detailEl = document.getElementById('civic-xr-status-detail')
          if (detailEl) detailEl.textContent = detail
        }

        function fillMetrics(metrics = []) {
          const grid = document.getElementById('metric-grid')
          if (!grid) return
          grid.innerHTML = metrics
            .map((item) => '<div class="metric"><span>' + esc(item.label) + '</span><strong>' + esc(item.value) + '</strong><p>' + esc(item.note || '') + '</p></div>')
            .join('')
        }

        function fillInventory(inventory = {}) {
          const list = document.getElementById('civic-xr-inventory')
          if (!list) return
          list.innerHTML = (inventory.sections || []).map((section) => {
            const items = (section.items || [])
              .slice(0, 6)
              .map((item) => '<li class="inventory-item"><span>' + esc(item.label) + '</span><strong>' + esc(item.count) + '</strong></li>')
              .join('')
            return '<section class="inventory-section"><h3>' + esc(section.title) + '</h3><p class="inventory-summary">' + esc(section.summary) + '</p><ul>' + items + '</ul></section>'
          }).join('')
        }

        function fillLayerControls(inventory = {}) {
          const controls = document.getElementById('civic-xr-layer-controls')
          if (!controls) return
          const definitions = (inventory.layerDefinitions || [])
            .filter((definition) => definition.key !== 'center')
            .filter((definition) => ['boundary', 'roads', 'buildings', 'greenBlue', 'civic', 'mobility', 'commerce', 'wasteSeeds', 'places'].includes(definition.key))
          definitions.forEach((definition) => {
            if (layerState[definition.key] == null) layerState[definition.key] = Boolean(definition.visibleByDefault)
          })
          controls.innerHTML = definitions.map((definition) => {
            const checked = layerState[definition.key] ? 'checked' : ''
            const count = Number(definition.count ?? 0).toLocaleString('en-US')
            return '<label class="layer-row"><input type="checkbox" data-layer="' + esc(definition.key) + '" ' + checked + ' /><span><strong>' + esc(definition.label) + '</strong><small>' + count + ' city objects</small></span></label>'
          }).join('')
          controls.querySelectorAll('input[data-layer]').forEach((input) => {
            input.addEventListener('change', () => setLayerVisibility(input.dataset.layer, input.checked))
          })
        }

        function countBy(list = [], resolver) {
          return list.reduce((counts, item) => {
            const key = resolver(item) || 'unknown'
            counts[key] = (counts[key] || 0) + 1
            return counts
          }, {})
        }

        function dominantCount(counts = {}) {
          return Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || ['unknown', 0]
        }

        function updateSemanticOverlayPanel(model = currentSceneModel) {
          const panel = document.getElementById('civic-xr-semantic-overlay')
          const summary = document.getElementById('civic-xr-semantic-summary')
          const legend = document.getElementById('civic-xr-semantic-legend')
          if (!panel || !summary || !legend) return
          const active = activeExperienceMode === 'overlay'
          panel.classList.toggle('is-active', active)
          if (!active) {
            summary.textContent = activeExperienceMode === 'compare' ? 'Compare mode' : 'Walk mode'
            legend.innerHTML = ''
            return
          }
          const buildings = Array.isArray(model?.buildings) ? model.buildings : []
          const profiles = buildings.map((building, index) => buildingVisualProfile(building, index))
          const confidenceCounts = countBy(profiles, (profile) => profile.confidenceBand)
          const sourceCounts = countBy(profiles, (profile) => profile.sourceBand)
          const coverageCounts = countBy(profiles, (profile) => profile.coverageStatus)
          const [confidenceLabel, confidenceCount] = dominantCount(confidenceCounts)
          const [sourceLabel, sourceCount] = dominantCount(sourceCounts)
          const [coverageLabel, coverageCount] = dominantCount(coverageCounts)
          const lowConfidence = confidenceCounts.low || 0
          const gapCoverage = coverageCounts.gap || 0
          summary.textContent = buildings.length.toLocaleString('en-US') + ' buildings coded'
          const chips = [
            { label: 'Confidence', value: confidenceLabel + ' / ' + confidenceCount.toLocaleString('en-US'), color: semanticColorForConfidence(confidenceLabel) },
            { label: 'Source', value: sourceLabel + ' / ' + sourceCount.toLocaleString('en-US'), color: semanticColorForSource(sourceLabel) },
            { label: 'Coverage', value: coverageLabel + ' / ' + coverageCount.toLocaleString('en-US'), color: coverageLabel === 'covered' ? new Color3(0.06, 0.58, 0.32) : coverageLabel === 'gap' ? new Color3(0.84, 0.25, 0.16) : new Color3(0.84, 0.56, 0.18) },
            { label: 'Review flags', value: (lowConfidence + gapCoverage).toLocaleString('en-US') + ' low/gap', color: new Color3(0.84, 0.25, 0.16) },
          ]
          legend.innerHTML = chips.map((chip) =>
            '<div class="civic-xr-semantic-chip"><span class="civic-xr-semantic-swatch" style="background:' + colorToCss(chip.color) + '"></span><span><strong>' + esc(chip.label) + '</strong><br />' + esc(chip.value) + '</span></div>'
          ).join('')
        }

        function updateComparePanel(model = currentSceneModel) {
          const panel = document.getElementById('civic-xr-compare-panel')
          const summary = document.getElementById('civic-xr-compare-summary')
          const list = document.getElementById('civic-xr-compare-list')
          if (!panel || !summary || !list) return
          const platforms = Array.isArray(model?.fragmentPlatforms) ? model.fragmentPlatforms : []
          const active = activeExperienceMode === 'compare' && platforms.length > 0
          panel.classList.toggle('is-active', active)
          if (!active) {
            summary.textContent = 'No comparison active'
            list.innerHTML = ''
            return
          }
          summary.textContent = platforms.length.toLocaleString('en-US') + ' fragments / shared scale'
          list.innerHTML = platforms.map((platform, index) => {
            const tint = comparePlatformTint(index)
            const objects = Number(platform.renderedFeatureCount || 0).toLocaleString('en-US')
            const total = Number(platform.totalFeatureCount || platform.renderedFeatureCount || 0).toLocaleString('en-US')
            const size = Math.round(Number(platform.width || 0)) + 'x' + Math.round(Number(platform.depth || 0))
            return '<div class="civic-xr-compare-chip"><span class="civic-xr-compare-swatch" style="background:' + colorToCss(tint) + '"></span><span><strong>' + esc(platform.title || ('Fragment ' + (index + 1))) + '</strong><br />' + objects + ' rendered / ' + total + ' selected</span><em>' + esc(size) + '</em></div>'
          }).join('')
        }

        function material(name, color, alpha = 1) {
          const mat = new StandardMaterial(name, scene)
          mat.diffuseColor = color
          mat.emissiveColor = new Color3(color.r * 0.08, color.g * 0.08, color.b * 0.08)
          mat.alpha = alpha
          mat.backFaceCulling = false
          return mat
        }

        function layerMaterial(layerKey) {
          const colors = {
            boundary: new Color3(0.82, 0.39, 0.12),
            roads: new Color3(0.18, 0.30, 0.43),
            buildings: new Color3(0.45, 0.55, 0.67),
            greenBlue: new Color3(0.13, 0.66, 0.52),
            civic: new Color3(0.03, 0.57, 0.53),
            mobility: new Color3(0.20, 0.43, 0.86),
            commerce: new Color3(0.55, 0.31, 0.87),
            wasteSeeds: new Color3(0.88, 0.52, 0.13),
            places: new Color3(0.86, 0.38, 0.68),
            features: new Color3(0.35, 0.47, 0.62),
            sceneBase: new Color3(0.83, 0.88, 0.92),
            xrFragments: new Color3(0.03, 0.57, 0.53),
          }
          const alphas = {
            boundary: 0.95,
            roads: 0.9,
            buildings: 0.74,
            greenBlue: 0.38,
            features: 0.7,
            sceneBase: 0.45,
            xrFragments: 0.82,
          }
          return material('civic-xr-' + layerKey, colors[layerKey] || colors.features, alphas[layerKey] ?? 0.8)
        }

        function registerMesh(layerKey, mesh) {
          if (!layerMeshes.has(layerKey)) layerMeshes.set(layerKey, [])
          layerMeshes.get(layerKey).push(mesh)
          mesh.isVisible = layerState[layerKey] !== false
          if (mesh.metadata?.selectable) pickableMeshes.add(mesh)
          return mesh
        }

        function setLayerVisibility(layerKey, visible) {
          layerState[layerKey] = Boolean(visible)
          ;(layerMeshes.get(layerKey) || []).forEach((mesh) => {
            mesh.isVisible = layerState[layerKey]
            if (mesh.metadata?.selectable) {
              if (mesh.isVisible) pickableMeshes.add(mesh)
              else pickableMeshes.delete(mesh)
            }
          })
          const input = document.querySelector('input[data-layer="' + layerKey + '"]')
          if (input) input.checked = layerState[layerKey]
          broadcast('twin:state', { layers: layerState })
        }

        function pointToVector(point, y = 0.08) {
          return new Vector3(finiteNumber(point?.x), y, finiteNumber(point?.z))
        }

        function createLines(layerKey, name, featureLines, mat, y = 0.12) {
          const lines = featureLines
            .map((points) => points
              .filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.z)))
              .map((point) => pointToVector(point, y)))
            .filter((points) => points.length > 1)
          if (!lines.length) return null
          const mesh = MeshBuilder.CreateLineSystem(name, { lines }, scene)
          mesh.color = mat.diffuseColor
          mesh.alpha = mat.alpha
          return registerMesh(layerKey, mesh)
        }



        function createRoadSlabs(layerKey, name, featureLines, mat) {
          if (!scene || !Array.isArray(featureLines)) return null
          const asphalt = material('civic-xr-walk-asphalt', new Color3(0.31, 0.36, 0.37), 0.96)
          const curb = material('civic-xr-walk-curb', new Color3(0.72, 0.76, 0.74), 0.86)
          const sidewalkMat = material('civic-xr-walk-sidewalk', new Color3(0.66, 0.72, 0.70), 0.72)
          const roadWidth = 7.2
          const sidewalkWidth = 2.2
          const curbWidth = 0.28
          let count = 0
          featureLines.forEach((points, roadIndex) => {
            const clean = (Array.isArray(points) ? points : [])
              .filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.z)))
            for (let index = 1; index < clean.length; index += 1) {
              const a = clean[index - 1]
              const b = clean[index]
              const dx = finiteNumber(b.x) - finiteNumber(a.x)
              const dz = finiteNumber(b.z) - finiteNumber(a.z)
              const length = Math.hypot(dx, dz)
              if (!Number.isFinite(length) || length < 0.8) continue
              const midX = (finiteNumber(a.x) + finiteNumber(b.x)) / 2
              const midZ = (finiteNumber(a.z) + finiteNumber(b.z)) / 2
              const angle = Math.atan2(dx, dz)
              const road = MeshBuilder.CreateBox(name + '-slab-' + roadIndex + '-' + index, {
                width: roadWidth,
                depth: length + 0.18,
                height: 0.08,
              }, scene)
              road.position = new Vector3(midX, 0.04, midZ)
              road.rotation.y = angle
              road.material = asphalt || mat
              road.checkCollisions = false
              road.metadata = { layerKey, featureType: 'walk-road-slab', selectable: false }
              registerMesh(layerKey, road)

              const normalX = Math.cos(angle)
              const normalZ = -Math.sin(angle)
              ;[-1, 1].forEach((side) => {
                const sidewalk = MeshBuilder.CreateBox(name + '-sidewalk-' + roadIndex + '-' + index + '-' + side, {
                  width: sidewalkWidth,
                  depth: length + 0.08,
                  height: 0.08,
                }, scene)
                sidewalk.position = new Vector3(midX + normalX * side * (roadWidth / 2 + curbWidth + sidewalkWidth / 2), 0.08, midZ + normalZ * side * (roadWidth / 2 + curbWidth + sidewalkWidth / 2))
                sidewalk.rotation.y = angle
                sidewalk.material = sidewalkMat
                sidewalk.checkCollisions = false
                sidewalk.metadata = { layerKey, featureType: 'walk-sidewalk', selectable: false }
                registerMesh(layerKey, sidewalk)

                const sideCurb = MeshBuilder.CreateBox(name + '-curb-' + roadIndex + '-' + index + '-' + side, {
                  width: curbWidth,
                  depth: length + 0.12,
                  height: 0.18,
                }, scene)
                sideCurb.position = new Vector3(midX + normalX * side * (roadWidth / 2 + curbWidth / 2), 0.11, midZ + normalZ * side * (roadWidth / 2 + curbWidth / 2))
                sideCurb.rotation.y = angle
                sideCurb.material = curb
                sideCurb.checkCollisions = false
                sideCurb.metadata = { layerKey, featureType: 'walk-curb', selectable: false }
                registerMesh(layerKey, sideCurb)
              })
              count += 1
            }
          })
          return count
        }


        function hashString(value = '') {
          let hash = 0
          const text = String(value || '')
          for (let index = 0; index < text.length; index += 1) {
            hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0
          }
          return Math.abs(hash)
        }

        function renderStyleFromBuilding(building = {}) {
          return building.renderStyle && typeof building.renderStyle === 'object' ? building.renderStyle : {}
        }

        function sourceConfidenceBand(value) {
          const parsed = Number(value)
          if (!Number.isFinite(parsed)) return 'unknown'
          if (parsed >= 0.78) return 'high'
          if (parsed >= 0.45) return 'medium'
          return 'low'
        }

        function sourceFamilyBand(style = {}, building = {}) {
          const text = String(style.sourceFamily || style.provider || building.sourceFamily || building.provider || building.source || '').toLowerCase()
          if (/postgis|curated|municipal|cadastre|authority|official/.test(text)) return 'curated'
          if (/osm|openstreetmap|open-data|opendata/.test(text)) return 'open-data'
          if (/derived|inferred|semantic|generated|starter/.test(text)) return 'inferred'
          return 'mixed-source'
        }

        function coverageBand(style = {}, building = {}) {
          const text = String(style.sourceCoverageStatus || building.sourceCoverageStatus || '').toLowerCase()
          if (/complete|confirmed|covered|present|available/.test(text)) return 'covered'
          if (/partial|inferred|starter|estimated/.test(text)) return 'partial'
          if (/missing|gap|absent|unknown/.test(text)) return 'gap'
          return 'partial'
        }

        function colorToCss(color) {
          return 'rgb(' + Math.round(clamp(color.r, 0, 1) * 255) + ', ' + Math.round(clamp(color.g, 0, 1) * 255) + ', ' + Math.round(clamp(color.b, 0, 1) * 255) + ')'
        }

        function semanticColorForConfidence(confidenceBand) {
          if (confidenceBand === 'high') return new Color3(0.02, 0.62, 0.58)
          if (confidenceBand === 'medium') return new Color3(0.84, 0.56, 0.18)
          if (confidenceBand === 'low') return new Color3(0.84, 0.25, 0.16)
          return new Color3(0.42, 0.50, 0.58)
        }

        function semanticColorForSource(sourceBand) {
          if (sourceBand === 'curated') return new Color3(0.16, 0.42, 0.84)
          if (sourceBand === 'open-data') return new Color3(0.04, 0.57, 0.53)
          if (sourceBand === 'inferred') return new Color3(0.61, 0.36, 0.80)
          return new Color3(0.42, 0.50, 0.58)
        }

        function semanticColorForFragment(fragmentId, fallback = new Color3(0.05, 0.64, 0.68)) {
          if (!fragmentId) return fallback
          const hue = hashString(fragmentId) % 4
          return [
            new Color3(0.05, 0.64, 0.68),
            new Color3(0.72, 0.39, 0.16),
            new Color3(0.45, 0.41, 0.84),
            new Color3(0.17, 0.58, 0.34),
          ][hue]
        }

        function comparePlatformTint(index = 0) {
          return index % 2 === 0
            ? new Color3(0.06, 0.48, 0.58)
            : new Color3(0.66, 0.34, 0.10)
        }

        function buildingFamilyFromStyle(style = {}, building = {}) {
          const text = String(style.buildingType || building.buildingType || building.category || '').toLowerCase()
          if (/school|university|hospital|clinic|civic|public|government|municipal/.test(text)) return 'civic'
          if (/industrial|warehouse|factory|railway|transport|station|garage/.test(text)) return 'infrastructure'
          if (/commercial|retail|office|hotel|shop/.test(text)) return 'commercial'
          if (/apartments|residential|house|detached|terrace|dormitory/.test(text)) return 'residential'
          return 'mixed'
        }

        function buildingVisualProfile(building = {}, index = 0) {
          const style = renderStyleFromBuilding(building)
          const policy = renderPolicyForMode()
          const family = buildingFamilyFromStyle(style, building)
          const confidenceBand = sourceConfidenceBand(style.confidence ?? building.confidence)
          const sourceBand = sourceFamilyBand(style, building)
          const coverageStatus = coverageBand(style, building)
          const seed = hashString(style.materialSeed || building.id || building.label || index)
          const familyColors = {
            residential: new Color3(0.48, 0.57, 0.66),
            commercial: new Color3(0.37, 0.52, 0.67),
            civic: new Color3(0.18, 0.58, 0.56),
            infrastructure: new Color3(0.50, 0.49, 0.45),
            mixed: new Color3(0.43, 0.54, 0.64),
          }
          let bodyColor = familyColors[family] || familyColors.mixed
          if (activeExperienceMode === 'compare') {
            bodyColor = building.fragmentId && hashString(building.fragmentId) % 2
              ? new Color3(0.62, 0.44, 0.29)
              : new Color3(0.28, 0.54, 0.60)
          } else if (activeExperienceMode === 'overlay') {
            bodyColor = confidenceBand === 'low'
              ? new Color3(0.84, 0.53, 0.18)
              : new Color3(0.17, 0.62, 0.64)
          }
          const shade = ((seed % 17) - 8) / 100
          bodyColor = new Color3(
            clamp(bodyColor.r + shade, 0.08, 0.92),
            clamp(bodyColor.g + shade, 0.08, 0.92),
            clamp(bodyColor.b + shade, 0.08, 0.92),
          )
          const alpha = activeExperienceMode === 'overlay' ? 0.58 : activeExperienceMode === 'compare' ? 0.72 : 0.84
          return {
            style,
            policy,
            family,
            confidenceBand,
            sourceBand,
            coverageStatus,
            seed,
            bodyColor,
            roofColor: new Color3(clamp(bodyColor.r * 1.15, 0, 1), clamp(bodyColor.g * 1.12, 0, 1), clamp(bodyColor.b * 1.08, 0, 1)),
            accentColor: confidenceBand === 'low' ? new Color3(0.93, 0.57, 0.15) : new Color3(0.03, 0.57, 0.53),
            confidenceColor: semanticColorForConfidence(confidenceBand),
            sourceColor: semanticColorForSource(sourceBand),
            fragmentColor: semanticColorForFragment(building.fragmentId),
            alpha,
            detailed: activeExperienceMode !== 'compare' && index < Math.max(0, Number(policy.buildingDetailLimit || 0)),
            semanticOverlay: activeExperienceMode === 'overlay',
          }
        }

        function buildingMaterial(profile, role = 'body') {
          const color = role === 'roof' ? profile.roofColor : role === 'accent' ? profile.accentColor : profile.bodyColor
          const alpha = role === 'accent' ? 0.78 : profile.alpha
          const key = [activeExperienceMode, role, profile.family, profile.confidenceBand, color.r.toFixed(2), color.g.toFixed(2), color.b.toFixed(2), alpha.toFixed(2)].join(':')
          if (buildingMaterialCache.has(key)) return buildingMaterialCache.get(key)
          const mat = material('civic-building-' + key.replaceAll(':', '-'), color, alpha)
          mat.specularColor = activeExperienceMode === 'compare'
            ? new Color3(0.08, 0.10, 0.12)
            : new Color3(0.20, 0.22, 0.24)
          buildingMaterialCache.set(key, mat)
          return mat
        }

        function semanticOverlayMaterial(profile, role = 'confidence', alpha = 0.82) {
          const color = role === 'source'
            ? profile.sourceColor
            : role === 'fragment'
              ? profile.fragmentColor
              : role === 'coverage'
                ? (profile.coverageStatus === 'gap'
                  ? new Color3(0.84, 0.25, 0.16)
                  : profile.coverageStatus === 'covered'
                    ? new Color3(0.06, 0.58, 0.32)
                    : new Color3(0.84, 0.56, 0.18))
                : profile.confidenceColor
          const key = [activeExperienceMode, 'semantic', role, profile.sourceBand, profile.confidenceBand, profile.coverageStatus, alpha.toFixed(2), color.r.toFixed(2), color.g.toFixed(2), color.b.toFixed(2)].join(':')
          if (semanticMaterialCache.has(key)) return semanticMaterialCache.get(key)
          const mat = material('civic-semantic-' + key.replaceAll(':', '-'), color, alpha)
          mat.emissiveColor = new Color3(color.r * 0.22, color.g * 0.22, color.b * 0.22)
          mat.specularColor = new Color3(0.05, 0.06, 0.07)
          semanticMaterialCache.set(key, mat)
          return mat
        }

        function semanticOverlayMetadata(profile, building = {}, featureType = 'semantic-overlay') {
          return {
            layerKey: 'xrFragments',
            featureType,
            selectable: false,
            fragmentId: building.fragmentId || null,
            fragmentTitle: building.fragmentTitle || null,
            semanticOverlay: {
              confidenceBand: profile.confidenceBand,
              sourceBand: profile.sourceBand,
              coverageStatus: profile.coverageStatus,
              visualFamily: profile.family,
            },
            renderStyle: profile.style,
            renderPolicy: profile.policy,
          }
        }

        function createBuildingSemanticOverlay(building, index, width, depth, height, profile) {
          if (!profile.semanticOverlay) return
          const limit = Math.max(0, Number(profile.policy.semanticOverlayLimit || 0))
          if (index >= limit) return
          const x = finiteNumber(building.x)
          const z = finiteNumber(building.z)
          const rotationY = finiteNumber(building.rotation, 0)
          const footprintDiameter = clamp(Math.max(width, depth) * 1.82, 1.8, 18)
          const baseRing = MeshBuilder.CreateTorus('semantic-confidence-ring-' + index, {
            diameter: footprintDiameter,
            thickness: clamp(footprintDiameter * 0.035, 0.055, 0.20),
            tessellation: 48,
          }, scene)
          baseRing.position = new Vector3(x, 0.24, z)
          baseRing.rotation.x = Math.PI / 2
          baseRing.rotation.z = rotationY
          baseRing.material = semanticOverlayMaterial(profile, 'confidence', profile.confidenceBand === 'low' ? 0.92 : 0.76)
          baseRing.metadata = semanticOverlayMetadata(profile, building, 'semantic-confidence-ring')
          registerMesh('xrFragments', baseRing)

          const sourceBeaconHeight = clamp(height * (profile.coverageStatus === 'covered' ? 0.46 : profile.coverageStatus === 'gap' ? 0.72 : 0.58), 0.9, 7.5)
          const sourceBeacon = MeshBuilder.CreateCylinder('semantic-source-beacon-' + index, {
            diameter: clamp(Math.min(width, depth) * 0.16, 0.12, 0.42),
            height: sourceBeaconHeight,
            tessellation: 12,
          }, scene)
          sourceBeacon.position = new Vector3(x + width / 2 + 0.28, sourceBeaconHeight / 2 + 0.16, z + depth / 2 + 0.28)
          sourceBeacon.material = semanticOverlayMaterial(profile, 'source', 0.86)
          sourceBeacon.metadata = semanticOverlayMetadata(profile, building, 'semantic-source-beacon')
          registerMesh('xrFragments', sourceBeacon)

          const coverageCap = MeshBuilder.CreateTorus('semantic-coverage-cap-' + index, {
            diameter: clamp(Math.min(width, depth) * 0.84, 0.65, 5.8),
            thickness: profile.coverageStatus === 'gap' ? 0.14 : 0.08,
            tessellation: 36,
          }, scene)
          coverageCap.position = new Vector3(x, height + 0.38, z)
          coverageCap.rotation.x = Math.PI / 2
          coverageCap.rotation.z = rotationY
          coverageCap.material = semanticOverlayMaterial(profile, 'coverage', profile.coverageStatus === 'gap' ? 0.94 : 0.74)
          coverageCap.metadata = semanticOverlayMetadata(profile, building, 'semantic-coverage-cap')
          registerMesh('xrFragments', coverageCap)

          if (building.fragmentId) {
            const fragmentRing = MeshBuilder.CreateTorus('semantic-fragment-ring-' + index, {
              diameter: clamp(footprintDiameter * 1.22, 2.2, 22),
              thickness: 0.055,
              tessellation: 48,
            }, scene)
            fragmentRing.position = new Vector3(x, 0.14, z)
            fragmentRing.rotation.x = Math.PI / 2
            fragmentRing.material = semanticOverlayMaterial(profile, 'fragment', 0.42)
            fragmentRing.metadata = semanticOverlayMetadata(profile, building, 'semantic-fragment-ring')
            registerMesh('xrFragments', fragmentRing)
          }
        }

        function createBuildingDetail(building, index, width, depth, height, profile) {
          if (!profile.detailed && !profile.semanticOverlay) return
          const x = finiteNumber(building.x)
          const z = finiteNumber(building.z)
          const rotationY = finiteNumber(building.rotation, 0)
          const roof = MeshBuilder.CreateBox('building-roof-' + index, {
            width: width * 1.03,
            depth: depth * 1.03,
            height: 0.12,
          }, scene)
          roof.position = new Vector3(x, height + 0.19, z)
          roof.rotation.y = rotationY
          roof.material = buildingMaterial(profile, profile.semanticOverlay ? 'accent' : 'roof')
          roof.checkCollisions = Boolean(profile.policy.collisions)
          roof.metadata = {
            layerKey: 'buildings',
            featureType: 'building-roof',
            selectable: false,
            renderStyle: profile.style,
            renderPolicy: profile.policy,
          }
          registerMesh('buildings', roof)

          if (!profile.detailed) return
          const floorCount = clamp(Math.round(finiteNumber(profile.style.floors, Math.max(1, height / 3))), 1, 14)
          const bands = clamp(Math.floor(floorCount / 2), 1, 5)
          const bandMat = buildingMaterial(profile, 'accent')
          for (let band = 1; band <= bands; band += 1) {
            const y = 0.18 + (height * band) / (bands + 1)
            ;[
              { name: 'front', dz: depth / 2 + 0.012, w: width * 0.82, d: 0.035 },
              { name: 'back', dz: -depth / 2 - 0.012, w: width * 0.82, d: 0.035 },
            ].forEach((side) => {
              const strip = MeshBuilder.CreateBox('building-facade-' + index + '-' + band + '-' + side.name, {
                width: side.w,
                depth: side.d,
                height: 0.035,
              }, scene)
              strip.position = new Vector3(x, y, z + side.dz)
              strip.rotation.y = rotationY
              strip.material = bandMat
              strip.metadata = {
                layerKey: 'buildings',
                featureType: 'building-facade-band',
                selectable: false,
                renderStyle: profile.style,
                renderPolicy: profile.policy,
              }
              registerMesh('buildings', strip)
            })
          }
        }

        function createBuilding(building, index, mat) {
          const profile = buildingVisualProfile(building, index)
          const width = clamp(finiteNumber(building.width, 1.4), 0.7, 12)
          const depth = clamp(finiteNumber(building.depth, 1.4), 0.7, 12)
          const height = clamp(finiteNumber(building.height, 5.5 + (index % 5) * 1.3), 1.4, 42)
          const mesh = MeshBuilder.CreateBox('building-' + index, {
            width,
            depth,
            height,
          }, scene)
          mesh.position = new Vector3(finiteNumber(building.x), height / 2 + 0.1, finiteNumber(building.z))
          mesh.rotation.y = finiteNumber(building.rotation, 0)
          mesh.material = buildingMaterial(profile, 'body') || mat
          mesh.metadata = {
            layerKey: 'buildings',
            featureType: 'building',
            selectable: true,
            label: building.label || building.name || ('Building ' + (building.id ?? index)),
            source: building.source || profile.style.provider || 'open-data',
            fragmentId: building.fragmentId || null,
            fragmentTitle: building.fragmentTitle || null,
            renderStyle: profile.style,
            renderPolicy: profile.policy,
            visualFamily: profile.family,
            confidenceBand: profile.confidenceBand,
            sourceBand: profile.sourceBand,
            coverageStatus: profile.coverageStatus,
            properties: {
              id: building.id || profile.style.materialSeed || index,
              kind: 'building',
              label: building.label || building.name || ('Building ' + (building.id ?? index)),
              source: building.source || profile.style.provider || 'open-data',
              heightMeters: profile.style.heightMeters ?? building.heightMeters ?? height,
              floors: profile.style.floors ?? building.floors ?? null,
              footprintAreaM2: profile.style.footprintAreaM2 ?? building.footprintAreaM2 ?? null,
              buildingType: profile.style.buildingType ?? building.buildingType ?? null,
              sourceFamily: profile.style.sourceFamily ?? building.sourceFamily ?? null,
              confidence: profile.style.confidence ?? building.confidence ?? null,
              sourceCoverageStatus: profile.style.sourceCoverageStatus ?? building.sourceCoverageStatus ?? null,
              visualFamily: profile.family,
              confidenceBand: profile.confidenceBand,
              sourceBand: profile.sourceBand,
              coverageStatus: profile.coverageStatus,
              fragmentTitle: building.fragmentTitle || null,
            },
          }
          mesh.checkCollisions = Boolean(profile.policy.collisions)
          registerMesh('buildings', mesh)
          createBuildingDetail(building, index, width, depth, height, profile)
          createBuildingSemanticOverlay(building, index, width, depth, height, profile)
          return mesh
        }

        function createArea(layerKey, feature, index, mat) {
          const width = clamp(finiteNumber(feature.width, 3.5), 1.2, 38)
          const depth = clamp(finiteNumber(feature.depth, 3.5), 1.2, 38)
          const mesh = MeshBuilder.CreateBox(layerKey + '-area-' + index, {
            width,
            depth,
            height: 0.08,
          }, scene)
          mesh.position = new Vector3(finiteNumber(feature.x), 0.05, finiteNumber(feature.z))
          mesh.rotation.y = finiteNumber(feature.rotation, 0)
          mesh.material = mat
          mesh.metadata = {
            layerKey,
            featureType: layerKey,
            selectable: true,
            label: feature.label || feature.name || layerKey,
            source: feature.source || 'open-data',
            properties: {
              kind: layerKey,
              label: feature.label || feature.name || layerKey,
              source: feature.source || 'open-data',
            },
          }
          return registerMesh(layerKey, mesh)
        }

        function selectionDescription(metadata = {}, properties = {}) {
          if (metadata.featureType === 'building') {
            const parts = []
            if (properties.heightMeters != null) parts.push(Number(properties.heightMeters).toFixed(1) + 'm height')
            if (properties.floors != null) parts.push(String(properties.floors) + ' floors')
            if (properties.footprintAreaM2 != null) parts.push(Number(properties.footprintAreaM2).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' m2 footprint')
            return parts.length ? parts.join(' / ') : 'Selected Civic XR building with procedural render metadata.'
          }
          return 'Selected ' + String(metadata.layerKey || metadata.featureType || 'city object') + ' object in Civic XR.'
        }

        function selectionPayloadFromMesh(mesh) {
          const metadata = mesh?.metadata || {}
          const properties = {
            ...(metadata.properties && typeof metadata.properties === 'object' ? metadata.properties : {}),
            label: metadata.label || metadata.properties?.label || metadata.featureType || 'Selected element',
            layerKey: metadata.layerKey || '',
            featureType: metadata.featureType || '',
            source: metadata.source || metadata.properties?.source || 'open-data',
          }
          return {
            properties,
            meta: {
              label: properties.label,
              description: selectionDescription(metadata, properties),
              twinCategory: metadata.featureType === 'building' ? 'Built fabric' : metadata.layerKey || 'Civic object',
              system: activeExperienceMode === 'compare' ? 'Civic XR compare workspace' : activeExperienceMode === 'overlay' ? 'Civic XR semantic overlay' : 'Civic XR walkable fragment',
              ldtLayer: 'Visualisation / Civic XR',
              capability: metadata.renderPolicy?.visualStyle || renderPolicyForMode().visualStyle,
              source: properties.source,
              visualFamily: metadata.visualFamily || '',
              confidenceBand: metadata.confidenceBand || '',
              sourceBand: metadata.sourceBand || properties.sourceBand || '',
              coverageStatus: metadata.coverageStatus || properties.coverageStatus || '',
            },
          }
        }

        function clearSelectionHighlight() {
          if (selectedHighlightMesh) {
            selectedHighlightMesh.dispose()
            selectedHighlightMesh = null
          }
        }

        function highlightSelectedMesh(mesh) {
          clearSelectionHighlight()
          selectedMesh = mesh || null
          if (!scene || !mesh) return
          const bounds = mesh.getBoundingInfo?.().boundingBox
          const center = bounds?.centerWorld || mesh.position
          const extents = bounds?.extendSizeWorld || { x: 1, z: 1 }
          const diameter = clamp(Math.max(finiteNumber(extents.x, 1), finiteNumber(extents.z, 1)) * 3.1, 2.4, 18)
          selectedHighlightMesh = MeshBuilder.CreateTorus('civic-xr-selection-ring', {
            diameter,
            thickness: clamp(diameter * 0.035, 0.08, 0.22),
            tessellation: 64,
          }, scene)
          selectedHighlightMesh.position = new Vector3(center.x, 0.22, center.z)
          selectedHighlightMesh.rotation.x = Math.PI / 2
          selectedHighlightMesh.material = material('civic-xr-selection-ring-mat', new Color3(0.02, 0.72, 0.70), 0.86)
          selectedHighlightMesh.metadata = { layerKey: 'xrFragments', featureType: 'selection-highlight' }
          registerMesh('xrFragments', selectedHighlightMesh)
        }

        function broadcastSelection(mesh) {
          if (!mesh?.metadata?.selectable) {
            clearSelectionHighlight()
            selectedMesh = null
            broadcast('twin:selection', { selection: null })
            return
          }
          const selection = selectionPayloadFromMesh(mesh)
          highlightSelectedMesh(mesh)
          setStatus(selection.properties.label || 'Civic XR selection', selection.meta.description)
          broadcast('twin:selection', { selection })
        }

        function selectableMesh(mesh) {
          return Boolean(mesh?.metadata?.selectable && mesh.isVisible !== false)
        }

        function pickSelectionAt(x, y) {
          if (!scene) return null
          return scene.pick(x, y, selectableMesh)
        }

        function handlePickInfo(pickInfo) {
          if (!pickInfo?.hit || !selectableMesh(pickInfo.pickedMesh)) {
            broadcastSelection(null)
            return
          }
          broadcastSelection(pickInfo.pickedMesh)
        }

        function bindScenePicking(canvas) {
          scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) return
            handlePickInfo(pointerInfo.pickInfo)
          })
          canvas.addEventListener('pointerdown', (event) => {
            const rect = canvas.getBoundingClientRect()
            handlePickInfo(pickSelectionAt(event.clientX - rect.left, event.clientY - rect.top))
          })
          window.__civicXrInspector = {
            selectableCount: () => Array.from(pickableMeshes).filter(selectableMesh).length,
            selectFirstVisible: () => {
              const mesh = Array.from(pickableMeshes).find(selectableMesh)
              if (!mesh) return null
              broadcastSelection(mesh)
              return selectionPayloadFromMesh(mesh)
            },
          }
        }

        function createAnchor(layerKey, feature, index, mat, radius = 1.15) {
          const base = MeshBuilder.CreateCylinder(layerKey + '-pin-base-' + index, {
            diameterTop: radius * 0.76,
            diameterBottom: radius * 1.05,
            height: radius * 0.72,
            tessellation: 12,
          }, scene)
          base.position = new Vector3(finiteNumber(feature.x), radius * 0.36 + 0.14, finiteNumber(feature.z))
          base.material = mat
          base.metadata = {
            layerKey,
            featureType: layerKey,
            selectable: true,
            label: feature.label || feature.name || layerKey,
            source: feature.source || 'open-data',
            properties: {
              kind: layerKey,
              label: feature.label || feature.name || layerKey,
              source: feature.source || 'open-data',
            },
          }
          registerMesh(layerKey, base)

          const cap = MeshBuilder.CreateSphere(layerKey + '-pin-cap-' + index, {
            diameter: radius * 0.7,
            segments: 12,
          }, scene)
          cap.position = new Vector3(base.position.x, radius * 0.92 + 0.14, base.position.z)
          cap.material = mat
          cap.metadata = base.metadata
          return registerMesh(layerKey, cap)
        }

        function clearSceneObjects() {
          for (const meshes of layerMeshes.values()) {
            meshes.forEach((mesh) => mesh.dispose())
          }
          layerMeshes.clear()
          pickableMeshes.clear()
          selectedMesh = null
          clearSelectionHighlight()
        }

        function clearFragmentWorkspaceMarkers() {
          const meshes = layerMeshes.get('xrFragments') || []
          meshes.forEach((mesh) => mesh.dispose())
          layerMeshes.set('xrFragments', [])
        }

        function featureCollection(features = []) {
          return { type: 'FeatureCollection', features: Array.isArray(features) ? features : [] }
        }

        function getFeatures(collection) {
          return Array.isArray(collection?.features) ? collection.features.filter((feature) => feature?.geometry) : []
        }

        function isCoordinate(value) {
          return Array.isArray(value) &&
            value.length >= 2 &&
            Number.isFinite(Number(value[0])) &&
            Number.isFinite(Number(value[1]))
        }

        function walkCoordinates(value, callback) {
          if (!Array.isArray(value)) return
          if (isCoordinate(value)) {
            callback([Number(value[0]), Number(value[1])])
            return
          }
          value.forEach((entry) => walkCoordinates(entry, callback))
        }

        function geometryCoordinates(geometry = {}) {
          const coords = []
          walkCoordinates(geometry.coordinates, (coordinate) => coords.push(coordinate))
          return coords
        }

        function geometryBounds(geometry = {}) {
          const coords = geometryCoordinates(geometry)
          if (!coords.length) return null
          const xs = coords.map((coordinate) => coordinate[0])
          const ys = coords.map((coordinate) => coordinate[1])
          return {
            minLon: Math.min(...xs),
            maxLon: Math.max(...xs),
            minLat: Math.min(...ys),
            maxLat: Math.max(...ys),
            centerLon: (Math.min(...xs) + Math.max(...xs)) / 2,
            centerLat: (Math.min(...ys) + Math.max(...ys)) / 2,
          }
        }

        function boundsFromFeatures(features = []) {
          const coords = []
          features.forEach((feature) => geometryCoordinates(feature.geometry).forEach((coordinate) => coords.push(coordinate)))
          if (!coords.length) return null
          const xs = coords.map((coordinate) => coordinate[0])
          const ys = coords.map((coordinate) => coordinate[1])
          return {
            minLon: Math.min(...xs),
            maxLon: Math.max(...xs),
            minLat: Math.min(...ys),
            maxLat: Math.max(...ys),
            centerLon: (Math.min(...xs) + Math.max(...xs)) / 2,
            centerLat: (Math.min(...ys) + Math.max(...ys)) / 2,
          }
        }

        function createProjector(features = [], fallbackCenter = null) {
          const bounds = boundsFromFeatures(features) || fallbackCenter || { centerLon: 0, centerLat: 0, minLon: 0, maxLon: 0.01, minLat: 0, maxLat: 0.01 }
          const centerLon = finiteNumber(bounds.centerLon)
          const centerLat = finiteNumber(bounds.centerLat)
          const lonScale = Math.max(0.1, Math.cos(centerLat * Math.PI / 180) * 111320)
          const latScale = 110540
          const widthMeters = Math.max(1, Math.abs(finiteNumber(bounds.maxLon) - finiteNumber(bounds.minLon)) * lonScale)
          const depthMeters = Math.max(1, Math.abs(finiteNumber(bounds.maxLat) - finiteNumber(bounds.minLat)) * latScale)
          const sceneSpan = clamp(Math.max(widthMeters, depthMeters), 60, 18000)
          const scale = clamp(118 / sceneSpan, 0.006, 4.2)
          return {
            bounds,
            scale,
            toScene(coordinate) {
              const lon = Number(coordinate?.[0])
              const lat = Number(coordinate?.[1])
              return {
                x: (Number.isFinite(lon) ? (lon - centerLon) * lonScale * scale : 0),
                z: (Number.isFinite(lat) ? -(lat - centerLat) * latScale * scale : 0),
              }
            },
          }
        }

        function featureLayerKey(feature = {}) {
          const properties = feature.properties || feature
          const direct = properties.layerKey || properties.layer_key || properties.queryLayerKey || properties.query_layer_key || properties.displayLayerKey
          if (direct) {
            if (direct === 'facilities') return 'civic'
            if (direct === 'unclassifiedLand') return 'greenBlue'
            return String(direct)
          }
          const semanticClass = String(properties.semanticClass || properties.semantic_class || properties.featureType || properties.type || '').toLowerCase()
          if (semanticClass.includes('building')) return 'buildings'
          if (semanticClass.includes('road') || semanticClass.includes('street')) return 'roads'
          if (semanticClass.includes('green') || semanticClass.includes('blue') || semanticClass.includes('water') || semanticClass.includes('park') || semanticClass.includes('land')) return 'greenBlue'
          if (semanticClass.includes('mobility')) return 'mobility'
          if (semanticClass.includes('commerce')) return 'commerce'
          if (semanticClass.includes('waste')) return 'wasteSeeds'
          if (semanticClass.includes('place')) return 'places'
          if (semanticClass.includes('civic') || semanticClass.includes('facility')) return 'civic'
          return 'features'
        }

        function featureLabel(feature = {}) {
          const properties = feature.properties || {}
          return properties.label || properties.name || properties.objectId || properties.object_id || properties.stableId || properties.stable_id || feature.id || featureLayerKey(feature)
        }

        function featureSource(feature = {}) {
          const properties = feature.properties || {}
          return properties.provider || properties.source || properties.sourceName || properties.source_name || properties.confidence || 'open-data'
        }

        function heightForFeature(feature = {}, index = 0) {
          const properties = feature.properties || {}
          const rawHeight = properties.heightMeters ?? properties.height_meters ?? properties.height_m ?? properties.height ?? properties.renderHeight
          const parsedHeight = Number(String(rawHeight ?? '').replace(/[^0-9.]+/g, ''))
          if (Number.isFinite(parsedHeight) && parsedHeight > 0) return clamp(parsedHeight * 0.32, 1.4, 42)
          const floors = Number(properties.floors ?? properties.levels ?? properties['building:levels'])
          if (Number.isFinite(floors) && floors > 0) return clamp(floors * 1.1, 1.4, 42)
          return clamp(3.2 + (index % 7) * 0.9, 2.6, 12)
        }

        function polygonRings(geometry = {}) {
          if (geometry.type === 'Polygon') return geometry.coordinates || []
          if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flat()
          return []
        }

        function lineStrings(geometry = {}) {
          if (geometry.type === 'LineString') return [geometry.coordinates || []]
          if (geometry.type === 'MultiLineString') return geometry.coordinates || []
          return []
        }

        function pointCoordinates(geometry = {}) {
          if (geometry.type === 'Point') return [geometry.coordinates]
          if (geometry.type === 'MultiPoint') return geometry.coordinates || []
          return []
        }

        function sampleFeatures(features = [], limit = Number.MAX_SAFE_INTEGER) {
          const normalizedLimit = Number(limit)
          if (!Number.isFinite(normalizedLimit) || normalizedLimit <= 0 || features.length <= normalizedLimit) return features
          const stride = Math.max(1, Math.ceil(features.length / normalizedLimit))
          return features.filter((_, index) => index % stride === 0).slice(0, normalizedLimit)
        }

        function sceneModelFromGeojson(geojson, summary = {}, options = {}) {
          const allFeatures = getFeatures(geojson)
          const featuresByLayer = allFeatures.reduce((groups, feature) => {
            const key = featureLayerKey(feature)
            if (!groups[key]) groups[key] = []
            groups[key].push(feature)
            return groups
          }, {})
          const projector = createProjector(allFeatures)
          const limits = options.limits || QUERY_SCENE_LIMITS
          const model = {
            source: options.source || 'query',
            title: options.title || 'TwinQL civic scene',
            detail: options.detail || 'Query selection rendered as an XR tabletop.',
            renderedFeatureCount: 0,
            totalFeatureCount: Number(summary.resultCount ?? summary.total ?? allFeatures.length),
            boundary: [],
            roads: [],
            areas: [],
            buildings: [],
            anchors: {
              civic: [],
              mobility: [],
              commerce: [],
              wasteSeeds: [],
              places: [],
              features: [],
            },
          }

          sampleFeatures(featuresByLayer.boundary || [], limits.boundary).forEach((feature) => {
            polygonRings(feature.geometry).slice(0, 2).forEach((ring) => {
              const projected = ring.map((coordinate) => projector.toScene(coordinate)).filter(Boolean)
              if (projected.length > 1) model.boundary.push([...projected, projected[0]].filter(Boolean))
            })
            model.renderedFeatureCount += 1
          })

          sampleFeatures(featuresByLayer.roads || [], limits.roads).forEach((feature) => {
            lineStrings(feature.geometry).forEach((line) => {
              const projected = line.map((coordinate) => projector.toScene(coordinate)).filter(Boolean)
              if (projected.length > 1) model.roads.push(projected)
            })
            model.renderedFeatureCount += 1
          })

          sampleFeatures(featuresByLayer.buildings || [], limits.buildings).forEach((feature, index) => {
            const bounds = geometryBounds(feature.geometry)
            if (!bounds) return
            const a = projector.toScene([bounds.minLon, bounds.minLat])
            const b = projector.toScene([bounds.maxLon, bounds.maxLat])
            const center = projector.toScene([bounds.centerLon, bounds.centerLat])
            const properties = feature.properties || {}
            model.buildings.push({
              x: center.x,
              z: center.z,
              width: Math.max(0.75, Math.abs(a.x - b.x)),
              depth: Math.max(0.75, Math.abs(a.z - b.z)),
              height: heightForFeature(feature, index),
              label: featureLabel(feature),
              source: featureSource(feature),
              renderStyle: properties.renderStyle && typeof properties.renderStyle === 'object' ? properties.renderStyle : null,
              heightMeters: properties.heightMeters ?? properties.height_meters ?? properties.height_m ?? properties.height ?? null,
              floors: properties.floors ?? properties.levels ?? properties['building:levels'] ?? null,
              footprintAreaM2: properties.footprintAreaM2 ?? properties.footprint_area_m2 ?? null,
              buildingType: properties.buildingType ?? properties.building_type ?? properties.building ?? null,
              provider: properties.provider ?? properties.source ?? properties.sourceName ?? properties.source_name ?? null,
              sourceFamily: properties.sourceFamily ?? properties.source_family ?? properties.source_format ?? properties.sourceFormat ?? null,
              confidence: properties.confidence ?? null,
              sourceCoverageStatus: properties.sourceCoverageStatus ?? properties.source_coverage_status ?? null,
            })
            model.renderedFeatureCount += 1
          })

          sampleFeatures(featuresByLayer.greenBlue || [], limits.greenBlue).forEach((feature) => {
            const bounds = geometryBounds(feature.geometry)
            if (!bounds) return
            const a = projector.toScene([bounds.minLon, bounds.minLat])
            const b = projector.toScene([bounds.maxLon, bounds.maxLat])
            const center = projector.toScene([bounds.centerLon, bounds.centerLat])
            model.areas.push({
              layerKey: 'greenBlue',
              x: center.x,
              z: center.z,
              width: Math.max(1.2, Math.abs(a.x - b.x)),
              depth: Math.max(1.2, Math.abs(a.z - b.z)),
              label: featureLabel(feature),
              source: featureSource(feature),
            })
            polygonRings(feature.geometry).slice(0, 1).forEach((ring) => {
              const projected = ring.map((coordinate) => projector.toScene(coordinate)).filter(Boolean)
              if (projected.length > 1) model.areas.push({ layerKey: 'greenBlueOutline', points: [...projected, projected[0]].filter(Boolean) })
            })
            model.renderedFeatureCount += 1
          })

          ;['civic', 'mobility', 'commerce', 'wasteSeeds', 'places', 'features'].forEach((layerKey) => {
            sampleFeatures(featuresByLayer[layerKey] || [], limits[layerKey]).forEach((feature) => {
              let coordinate = pointCoordinates(feature.geometry)[0]
              if (!coordinate) {
                const bounds = geometryBounds(feature.geometry)
                if (bounds) coordinate = [bounds.centerLon, bounds.centerLat]
              }
              if (!coordinate) return
              const point = projector.toScene(coordinate)
              model.anchors[layerKey].push({
                x: point.x,
                z: point.z,
                label: featureLabel(feature),
                source: featureSource(feature),
              })
              model.renderedFeatureCount += 1
            })
          })

          return model
        }

        function geojsonFromPrimitives(primitives = {}) {
          const features = (primitives.features || []).map((feature) => {
            const geometry = feature.geometry || {}
            const type = {
              point: 'Point',
              multiPoint: 'MultiPoint',
              lineString: 'LineString',
              multiLineString: 'MultiLineString',
              polygon: 'Polygon',
              multiPolygon: 'MultiPolygon',
            }[geometry.kind]
            if (!type || !Array.isArray(geometry.coordinates)) return null
            return {
              type: 'Feature',
              id: feature.id,
              properties: {
                ...(feature.properties || {}),
                layerKey: feature.layerKey,
                semanticClass: feature.semanticClass,
                label: feature.label,
              },
              geometry: {
                type,
                coordinates: geometry.coordinates,
              },
            }
          }).filter(Boolean)
          return featureCollection(features)
        }

        function geojsonFromSceneManifest(sceneManifest = {}) {
          const geometryTypes = {
            point: 'Point',
            multiPoint: 'MultiPoint',
            lineString: 'LineString',
            multiLineString: 'MultiLineString',
            polygon: 'Polygon',
            multiPolygon: 'MultiPolygon',
          }
          const objects = Array.isArray(sceneManifest.objects) ? sceneManifest.objects : []
          const features = objects.map((object) => {
            const geometry = object.geometry || {}
            const type = geometryTypes[geometry.kind]
            if (!type || !Array.isArray(geometry.coordinates)) return null
            return {
              type: 'Feature',
              id: object.objectId || object.id || object.stableId,
              properties: {
                ...(object.properties || {}),
                ...(object.render || {}),
                objectId: object.objectId || object.id,
                stableId: object.stableId || object.objectId || object.id,
                layerKey: object.layerKey,
                semanticClass: object.semanticClass,
                label: object.label,
                authorityStatus: object.authorityStatus,
                sourceCoverageStatus: object.sourceCoverageStatus,
                provider: object.provider,
                clauseId: object.clauseId,
                clauseLabel: object.clauseLabel,
              },
              geometry: {
                type,
                coordinates: geometry.coordinates,
              },
            }
          }).filter(Boolean)
          return featureCollection(features)
        }

        function sceneModelFromSceneManifest(sceneManifest = {}, summary = {}) {
          return sceneModelFromGeojson(geojsonFromSceneManifest(sceneManifest), summary || sceneManifest.summary || {}, {
            source: 'scene-manifest',
            title: 'Civic XR selection scene',
            detail: 'TwinQL scene manifest rendered as an inspectable civic tabletop.',
          })
        }

        function sceneModelFromPayload(payload) {
          const sceneData = payload.scene || {}
          const model = {
            source: 'base-preview',
            title: 'Civic base scene',
            detail: 'Open city inventory arranged as a public tabletop scene.',
            renderedFeatureCount: 0,
            totalFeatureCount: Number(payload?.summary?.inventory ?? 0),
            boundary: (sceneData.boundary || [])
              .slice(0, BASE_SCENE_LIMITS.boundary)
              .map((ring) => [...ring, ring[0]].filter(Boolean)),
            roads: (sceneData.roads || [])
              .slice(0, BASE_SCENE_LIMITS.roads)
              .map((road) => road.points || [])
              .filter((points) => points.length > 1),
            areas: [],
            buildings: (sceneData.buildings || [])
              .slice(0, BASE_SCENE_LIMITS.buildings)
              .map((building) => ({
                ...building,
                height: finiteNumber(building.height, 6),
                width: finiteNumber(building.width, 1.4),
                depth: finiteNumber(building.depth, 1.4),
              })),
            anchors: {
              civic: (sceneData.civic || []).slice(0, BASE_SCENE_LIMITS.civic),
              mobility: (sceneData.mobility || []).slice(0, BASE_SCENE_LIMITS.mobility),
              commerce: (sceneData.commerce || []).slice(0, BASE_SCENE_LIMITS.commerce),
              wasteSeeds: (sceneData.wasteSeeds || []).slice(0, BASE_SCENE_LIMITS.wasteSeeds),
              places: (sceneData.places || []).slice(0, BASE_SCENE_LIMITS.places),
              features: [],
            },
          }
          ;(sceneData.greenBlue || []).slice(0, BASE_SCENE_LIMITS.greenBlue).forEach((feature) => {
            if (Array.isArray(feature.points) && feature.points.length > 1) {
              model.areas.push({ layerKey: 'greenBlueOutline', points: feature.shape === 'line' ? feature.points : [...feature.points, feature.points[0]].filter(Boolean) })
              return
            }
            model.areas.push({ ...feature, layerKey: 'greenBlue' })
          })
          model.renderedFeatureCount =
            model.boundary.length +
            model.roads.length +
            model.areas.length +
            model.buildings.length +
            Object.values(model.anchors).reduce((sum, list) => sum + list.length, 0)
          return model
        }

        function scaleWalkPoint(point, center, factor) {
          return {
            ...point,
            x: center.x + (finiteNumber(point?.x) - center.x) * factor,
            z: center.z + (finiteNumber(point?.z) - center.z) * factor,
          }
        }

        function walkPresenceHeight(building = {}, index = 0) {
          const rawHeight = finiteNumber(building.height, 0)
          const heightMeters = Number(String(building.heightMeters ?? building.renderStyle?.heightMeters ?? '').replace(/[^0-9.]+/g, ''))
          if (Number.isFinite(heightMeters) && heightMeters > 0) return clamp(heightMeters * 0.92, 4.4, 58)
          const floors = Number(building.floors ?? building.renderStyle?.floors)
          if (Number.isFinite(floors) && floors > 0) return clamp(floors * 3.05, 4.4, 58)
          return clamp(Math.max(rawHeight * 1.35, 4.4 + (index % 8) * 1.45), 4.4, 32)
        }

        function walkPresenceModel(model = {}) {
          const extents = sceneExtents(model)
          const factor = clamp(WALK_TARGET_FRAGMENT_SPAN / Math.max(extents.span, 1), 1, 4.2)
          if (factor <= 1.01) return model
          const center = extents.center
          const transformPointList = (points = []) => points.map((point) => scaleWalkPoint(point, center, factor))
          const transformFeature = (feature = {}, index = 0, kind = 'generic') => {
            const scaled = scaleWalkPoint(feature, center, factor)
            if (kind === 'building') {
              return {
                ...feature,
                ...scaled,
                width: clamp(finiteNumber(feature.width, 1.4) * factor, 1.8, 28),
                depth: clamp(finiteNumber(feature.depth, 1.4) * factor, 1.8, 28),
                height: walkPresenceHeight(feature, index),
                walkPresenceScale: factor,
              }
            }
            if (feature.points) return { ...feature, points: transformPointList(feature.points), walkPresenceScale: factor }
            return {
              ...feature,
              ...scaled,
              width: feature.width == null ? feature.width : finiteNumber(feature.width) * factor,
              depth: feature.depth == null ? feature.depth : finiteNumber(feature.depth) * factor,
              walkPresenceScale: factor,
            }
          }
          const anchors = {}
          Object.entries(model.anchors || {}).forEach(([layerKey, features]) => {
            anchors[layerKey] = (features || []).map((feature) => transformFeature(feature))
          })
          return {
            ...model,
            title: model.title || 'Walkable Civic XR fragment',
            detail: model.detail || 'Street-level fragment rendered at pedestrian scale.',
            boundary: (model.boundary || []).map(transformPointList),
            roads: (model.roads || []).map(transformPointList),
            areas: (model.areas || []).map((area, index) => transformFeature(area, index, 'area')),
            buildings: (model.buildings || []).map((building, index) => transformFeature(building, index, 'building')),
            anchors,
            walkPresenceScale: factor,
          }
        }

        function sceneExtents(model) {
          const xs = []
          const zs = []
          const pushPoint = (point) => {
            if (Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.z))) {
              xs.push(Number(point.x))
              zs.push(Number(point.z))
            }
          }
          ;(model.boundary || []).flat().forEach(pushPoint)
          ;(model.roads || []).flat().forEach(pushPoint)
          ;(model.areas || []).forEach((area) => {
            if (area.points) area.points.forEach(pushPoint)
            else {
              pushPoint({ x: finiteNumber(area.x) - finiteNumber(area.width, 1) / 2, z: finiteNumber(area.z) - finiteNumber(area.depth, 1) / 2 })
              pushPoint({ x: finiteNumber(area.x) + finiteNumber(area.width, 1) / 2, z: finiteNumber(area.z) + finiteNumber(area.depth, 1) / 2 })
            }
          })
          ;(model.buildings || []).forEach((building) => {
            pushPoint({ x: finiteNumber(building.x) - finiteNumber(building.width, 1) / 2, z: finiteNumber(building.z) - finiteNumber(building.depth, 1) / 2 })
            pushPoint({ x: finiteNumber(building.x) + finiteNumber(building.width, 1) / 2, z: finiteNumber(building.z) + finiteNumber(building.depth, 1) / 2 })
          })
          Object.values(model.anchors || {}).flat().forEach(pushPoint)
          if (!xs.length) {
            return { minX: -44, maxX: 44, minZ: -32, maxZ: 32, width: 88, depth: 64, center: new Vector3(0, 0, 0), span: 88 }
          }
          const minX = Math.min(...xs)
          const maxX = Math.max(...xs)
          const minZ = Math.min(...zs)
          const maxZ = Math.max(...zs)
          const width = Math.max(20, maxX - minX)
          const depth = Math.max(20, maxZ - minZ)
          return {
            minX,
            maxX,
            minZ,
            maxZ,
            width,
            depth,
            center: new Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2),
            span: Math.max(width, depth),
          }
        }

	        function createSceneBase(extents) {
          const width = clamp(extents.width * 1.16, 44, 160)
          const depth = clamp(extents.depth * 1.16, 34, 140)
          const baseMat = layerMaterial('sceneBase')
          const table = MeshBuilder.CreateBox('civic-table', {
            width,
            depth,
            height: 0.22,
          }, scene)
          table.position = new Vector3(extents.center.x, -0.16, extents.center.z)
          table.material = baseMat
          registerMesh('sceneBase', table)

          const gridLines = []
          const gridMat = material('civic-xr-grid', new Color3(0.56, 0.66, 0.75), 0.34)
          const halfWidth = width / 2
          const halfDepth = depth / 2
          const step = clamp(Math.round(Math.max(width, depth) / 10), 6, 14)
          for (let x = -halfWidth; x <= halfWidth; x += step) {
            gridLines.push([
              new Vector3(extents.center.x + x, 0.02, extents.center.z - halfDepth),
              new Vector3(extents.center.x + x, 0.02, extents.center.z + halfDepth),
            ])
          }
          for (let z = -halfDepth; z <= halfDepth; z += step) {
            gridLines.push([
              new Vector3(extents.center.x - halfWidth, 0.02, extents.center.z + z),
              new Vector3(extents.center.x + halfWidth, 0.02, extents.center.z + z),
            ])
          }
          const grid = MeshBuilder.CreateLineSystem('civic-table-grid', { lines: gridLines }, scene)
          grid.color = gridMat.diffuseColor
          grid.alpha = 0.34
          registerMesh('sceneBase', grid)

          const ring = MeshBuilder.CreateTorus('civic-focus-ring', {
            diameter: clamp(extents.span * 0.42, 18, 58),
            thickness: 0.18,
            tessellation: 72,
          }, scene)
          ring.position = new Vector3(extents.center.x, 0.08, extents.center.z)
          ring.rotation.x = Math.PI / 2
          ring.material = material('civic-focus-ring-mat', new Color3(0.03, 0.57, 0.53), 0.34)
	          registerMesh('sceneBase', ring)
	        }


        function createWalkSceneBase(extents) {
          const width = clamp(extents.width * 1.04, 42, 120)
          const depth = clamp(extents.depth * 1.04, 38, 118)
          const centerX = extents.center.x
          const centerZ = extents.center.z
          const halfWidth = width / 2
          const halfDepth = depth / 2
          const floorMat = material('civic-xr-walk-floor', new Color3(0.78, 0.86, 0.87), 0.58)
          const railMat = material('civic-xr-walk-room-edge', new Color3(0.08, 0.36, 0.38), 0.42)
          const pathMat = material('civic-xr-walk-path', new Color3(0.02, 0.58, 0.55), 0.62)
          const portalMat = material('civic-xr-walk-portal', new Color3(0.02, 0.47, 0.50), 0.84)

          const floor = MeshBuilder.CreateBox('civic-walk-floor', { width, depth, height: 0.14 }, scene)
          floor.position = new Vector3(centerX, -0.1, centerZ)
          floor.material = floorMat
          floor.checkCollisions = true
          floor.metadata = { layerKey: 'sceneBase', featureType: 'walk-floor', selectable: false }
          registerMesh('sceneBase', floor)

          const railHeight = 0.76
          ;[
            { name: 'north', x: centerX, z: centerZ - halfDepth, width, depth: 0.34 },
            { name: 'south', x: centerX, z: centerZ + halfDepth, width, depth: 0.34 },
            { name: 'west', x: centerX - halfWidth, z: centerZ, width: 0.34, depth },
            { name: 'east', x: centerX + halfWidth, z: centerZ, width: 0.34, depth },
          ].forEach((edge) => {
            const rail = MeshBuilder.CreateBox('civic-walk-room-edge-' + edge.name, { width: edge.width, depth: edge.depth, height: railHeight }, scene)
            rail.position = new Vector3(edge.x, railHeight / 2, edge.z)
            rail.material = railMat
            rail.metadata = { layerKey: 'sceneBase', featureType: 'walk-room-edge', selectable: false }
            registerMesh('sceneBase', rail)
          })

          const pathWidth = clamp(width * 0.11, 3.4, 7.5)
          const path = MeshBuilder.CreateBox('civic-walk-path', { width: pathWidth, depth: depth * 0.84, height: 0.08 }, scene)
          path.position = new Vector3(centerX, 0.01, centerZ)
          path.material = pathMat
          path.metadata = { layerKey: 'sceneBase', featureType: 'walk-path', selectable: false }
          registerMesh('sceneBase', path)

          const waypointCount = 4
          for (let index = 0; index < waypointCount; index += 1) {
            const z = centerZ - depth * 0.31 + (depth * 0.62 * index) / Math.max(1, waypointCount - 1)
            const waypoint = MeshBuilder.CreateCylinder('civic-walk-waypoint-' + index, { diameter: clamp(pathWidth * 0.72, 2.1, 4.5), height: 0.1, tessellation: 36 }, scene)
            waypoint.position = new Vector3(centerX, 0.11, z)
            waypoint.material = index === 0 ? portalMat : pathMat
            waypoint.metadata = { layerKey: 'sceneBase', featureType: 'walk-waypoint', selectable: false }
            registerMesh('sceneBase', waypoint)
          }

          const portalZ = centerZ - halfDepth + 1.2
          const postHeight = clamp(extents.span * 0.08, 3.2, 7.2)
          ;[-1, 1].forEach((side) => {
            const post = MeshBuilder.CreateBox('civic-walk-entry-post-' + side, { width: 0.52, depth: 0.52, height: postHeight }, scene)
            post.position = new Vector3(centerX + side * pathWidth * 0.8, postHeight / 2, portalZ)
            post.material = portalMat
            post.metadata = { layerKey: 'sceneBase', featureType: 'walk-entry-post', selectable: false }
            registerMesh('sceneBase', post)
          })
          const lintel = MeshBuilder.CreateBox('civic-walk-entry-lintel', { width: pathWidth * 1.9, depth: 0.42, height: 0.42 }, scene)
          lintel.position = new Vector3(centerX, postHeight + 0.1, portalZ)
          lintel.material = portalMat
          lintel.metadata = { layerKey: 'sceneBase', featureType: 'walk-entry-lintel', selectable: false }
          registerMesh('sceneBase', lintel)
        }

	        function activateModelLayers(model = {}) {
	          if ((model.boundary || []).length) layerState.boundary = true
	          if ((model.roads || []).length) layerState.roads = true
	          if ((model.buildings || []).length) layerState.buildings = true
	          if ((model.areas || []).length) layerState.greenBlue = true
	          Object.entries(model.anchors || {}).forEach(([layerKey, features]) => {
	            if ((features || []).length) layerState[layerKey] = true
	          })
	          layerState.sceneBase = true
	        }

	        function renderCivicScene(model, context = {}) {
          const renderModel = activeExperienceMode === 'walk' ? walkPresenceModel(model) : model
	          currentSceneModel = renderModel
	          activateModelLayers(renderModel)
	          clearSceneObjects()
	          const extents = sceneExtents(renderModel)
          const hasComparePlatforms = activeExperienceMode === 'compare' && Array.isArray(renderModel.fragmentPlatforms) && renderModel.fragmentPlatforms.length
          if (!hasComparePlatforms) {
            if (activeExperienceMode === 'walk') createWalkSceneBase(extents)
            else createSceneBase(extents)
          }

          const boundaryMat = layerMaterial('boundary')
          createLines('boundary', 'civic-boundary-lines', renderModel.boundary || [], boundaryMat, 0.2)

          const roadMat = layerMaterial('roads')
          if (activeExperienceMode === 'walk') {
            createRoadSlabs('roads', 'civic-road', renderModel.roads || [], roadMat)
            createLines('roads', 'civic-road-center-lines', renderModel.roads || [], roadMat, 0.14)
          } else {
            createLines('roads', 'civic-road-lines', renderModel.roads || [], roadMat, 0.25)
          }

          const greenMat = layerMaterial('greenBlue')
          const greenLines = []
          ;(renderModel.areas || []).forEach((area, index) => {
            if (area.points?.length > 1) {
              greenLines.push(area.points)
              return
            }
            createArea('greenBlue', area, index, greenMat)
          })
          createLines('greenBlue', 'civic-green-blue-lines', greenLines, greenMat, 0.18)

          const buildingMat = layerMaterial('buildings')
          ;(renderModel.buildings || []).forEach((building, index) => createBuilding(building, index, buildingMat))

          const anchorDefinitions = [
            ['civic', 1.55],
            ['mobility', 1.35],
            ['commerce', 1.22],
            ['wasteSeeds', 1.22],
            ['places', 1.18],
            ['features', 1.12],
          ]
          anchorDefinitions.forEach(([layerKey, radius]) => {
            const mat = layerMaterial(layerKey)
            ;(renderModel.anchors?.[layerKey] || []).forEach((feature, index) => createAnchor(layerKey, feature, index, mat, radius))
          })

          applyFidelity(detailState.fidelity, { fit: false })
          focusSceneOnModel(renderModel)
          renderFragmentWorkspaceMarkers(activeExperienceMode)
          updateSemanticOverlayPanel(renderModel)
          updateComparePanel(renderModel)
          const visibleCount = visibleSceneCount()
          const summaryText = (context.returned || renderModel.totalFeatureCount || visibleCount)
            ? visibleCount.toLocaleString('en-US') + ' scene objects from ' + Number(context.returned || renderModel.totalFeatureCount || visibleCount).toLocaleString('en-US') + ' selected'
            : visibleCount.toLocaleString('en-US') + ' scene objects'
          setStatus(context.status || renderModel.title || 'Civic XR ready', context.detail || summaryText)
          broadcast('twin:viewport', {
            mode: context.mode || (renderModel.source === 'query' ? 'semantic-query' : 'base-scene'),
            label: context.label || summaryText,
            returned: Number(context.returned ?? renderModel.renderedFeatureCount ?? visibleCount),
            truncated: Boolean(context.truncated),
          })
          broadcast('twin:ready', {
            cityId,
            surface: viewerId,
            productSurface,
            features: visibleCount,
            runtime: 'babylon-webxr',
          })
        }

        function visibleSceneCount() {
          return CIVIC_LAYER_KEYS.reduce((sum, key) => {
            const meshes = layerMeshes.get(key) || []
            return sum + meshes.filter((mesh) => mesh.isVisible).length
          }, 0)
        }

        function buildingClearanceAt(x, z, building = {}) {
          const halfWidth = clamp(finiteNumber(building.width, 1.4), 0.7, 28) / 2
          const halfDepth = clamp(finiteNumber(building.depth, 1.4), 0.7, 28) / 2
          const dx = Math.max(0, Math.abs(x - finiteNumber(building.x)) - halfWidth)
          const dz = Math.max(0, Math.abs(z - finiteNumber(building.z)) - halfDepth)
          return Math.hypot(dx, dz)
        }

        function nearestBuildingClearance(x, z, buildings = []) {
          if (!buildings.length) return Number.POSITIVE_INFINITY
          let clearance = Number.POSITIVE_INFINITY
          buildings.forEach((building) => {
            clearance = Math.min(clearance, buildingClearanceAt(x, z, building))
          })
          return clearance
        }

        function nearbyBuildingCount(x, z, buildings = [], radius = 32) {
          return buildings.reduce((count, building) => {
            const dx = finiteNumber(building.x) - x
            const dz = finiteNumber(building.z) - z
            return count + (Math.hypot(dx, dz) <= radius ? 1 : 0)
          }, 0)
        }

        function walkSpawnForModel(model = {}) {
          const extents = sceneExtents(model)
          const buildings = Array.isArray(model.buildings) ? model.buildings : []
          const roads = Array.isArray(model.roads) ? model.roads : []
          const candidates = []
          roads.forEach((points) => {
            const clean = (Array.isArray(points) ? points : [])
              .filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.z)))
            for (let index = 1; index < clean.length; index += 1) {
              const a = clean[index - 1]
              const b = clean[index]
              const ax = finiteNumber(a.x)
              const az = finiteNumber(a.z)
              const bx = finiteNumber(b.x)
              const bz = finiteNumber(b.z)
              const dx = bx - ax
              const dz = bz - az
              const length = Math.hypot(dx, dz)
              if (!Number.isFinite(length) || length < 1.6) continue
              ;[0.25, 0.5, 0.75].forEach((t) => {
                const x = ax + dx * t
                const z = az + dz * t
                const clearance = nearestBuildingClearance(x, z, buildings)
                const nearBuildings = nearbyBuildingCount(x, z, buildings, 22)
                const districtBuildings = nearbyBuildingCount(x, z, buildings, 48)
                const centerPenalty = Math.hypot(x - extents.center.x, z - extents.center.z) * 0.01
                const clearancePenalty = Math.abs(clamp(clearance, 0, 18) - 4.8) * 0.72
                candidates.push({
                  x,
                  z,
                  targetX: x + (dx / length) * clamp(length * 0.55, 4, 12),
                  targetZ: z + (dz / length) * clamp(length * 0.55, 4, 12),
                  clearance,
                  nearBuildings,
                  districtBuildings,
                  score: nearBuildings * 2.8 + districtBuildings * 0.42 + length * 0.018 - clearancePenalty - centerPenalty,
                })
              })
            }
          })
          const viable = candidates
            .filter((candidate) => candidate.clearance >= WALK_MIN_BUILDING_CLEARANCE && candidate.districtBuildings >= 3)
            .sort((a, b) => b.score - a.score)
          if (viable.length) return viable[0]
          const fallbackX = extents.center.x
          const fallbackZ = clamp(extents.center.z + extents.depth * 0.30, extents.minZ + 3, extents.maxZ - 3)
          return {
            x: fallbackX,
            z: fallbackZ,
            targetX: extents.center.x,
            targetZ: extents.center.z,
            clearance: nearestBuildingClearance(fallbackX, fallbackZ, buildings),
            score: 0,
          }
        }

        function setStreetCameraForModel(model = currentSceneModel) {
          if (!scene || !streetCamera || !model) return
          const spawn = walkSpawnForModel(model)
          camera?.detachControl()
          scene.activeCamera = streetCamera
          streetCamera.position = new Vector3(spawn.x, WALK_EYE_HEIGHT, spawn.z)
          streetCamera.fov = 1.08
          streetCamera.speed = 0.42
          streetCamera.angularSensibility = 3800
          streetCamera.checkCollisions = true
          streetCamera.applyGravity = false
          streetCamera.ellipsoid = new Vector3(WALK_COLLIDER_RADIUS, WALK_COLLIDER_HEIGHT, WALK_COLLIDER_RADIUS)
          streetCamera.setTarget(new Vector3(spawn.targetX, WALK_TARGET_HEIGHT, spawn.targetZ))
          streetCamera.attachControl(scene.getEngine().getRenderingCanvas(), true)
        }

        function setOrbitCameraForModel(model = currentSceneModel) {
          if (!scene || !camera) return
          const mode = EXPERIENCE_MODES[activeExperienceMode] || EXPERIENCE_MODES.walk
          streetCamera?.detachControl()
          scene.activeCamera = camera
          camera.attachControl(scene.getEngine().getRenderingCanvas(), true)
          camera.lowerBetaLimit = 0.22
          camera.upperBetaLimit = activeExperienceMode === 'compare' ? Math.PI / 2.12 : Math.PI / 1.92
          camera.lowerRadiusLimit = activeExperienceMode === 'compare' ? 26 : 16
          camera.upperRadiusLimit = activeExperienceMode === 'compare' ? 520 : 360
          camera.wheelPrecision = activeExperienceMode === 'compare' ? 48 : 36
          camera.panningSensibility = activeExperienceMode === 'compare' ? 46 : 62
          camera.inertia = 0.68
          camera.checkCollisions = false
          camera.applyGravity = false
          if (model) {
            const extents = sceneExtents(model)
            camera.setTarget(new Vector3(extents.center.x, clamp(extents.span * mode.camera.yFactor, 1.5, 10), extents.center.z))
            camera.alpha = activeExperienceMode === 'compare' ? -Math.PI / 2 : -Math.PI / 2.65
            camera.beta = mode.camera.beta
            camera.radius = clamp(extents.span * mode.camera.radiusFactor, camera.lowerRadiusLimit, camera.upperRadiusLimit)
          }
        }

        function updateStreetCameraClamp() {
          if (!scene || scene.activeCamera !== streetCamera || activeExperienceMode !== 'walk' || !currentSceneModel) return
          const extents = sceneExtents(currentSceneModel)
          const margin = 2.4
          streetCamera.position.y = WALK_EYE_HEIGHT
          streetCamera.position.x = clamp(streetCamera.position.x, extents.minX + margin, extents.maxX - margin)
          streetCamera.position.z = clamp(streetCamera.position.z, extents.minZ + margin, extents.maxZ - margin)
        }

        function applyCameraPolicy(model = currentSceneModel) {
          const activeCamera = activeExperienceMode === 'walk' ? streetCamera : camera
          if (!activeCamera) return
          const policy = renderPolicyForMode()
          if (scene) {
            scene.collisionsEnabled = Boolean(policy.collisions)
            scene.gravity = new Vector3(0, 0, 0)
          }
          ;(layerMeshes.get('buildings') || []).forEach((mesh) => {
            mesh.checkCollisions = Boolean(policy.collisions && mesh.metadata?.featureType === 'building')
          })
          if (groundMesh) groundMesh.checkCollisions = Boolean(policy.collisions)
          if (activeExperienceMode === 'walk') setStreetCameraForModel(model)
          else setOrbitCameraForModel(model)
          broadcast('twin:state', {
            xrMode: activeExperienceMode,
            renderPolicy: policy,
            cameraPolicy: {
              cameraType: policy.cameraType,
              collisions: Boolean(policy.collisions),
              activeCamera: activeExperienceMode === 'walk' ? 'UniversalCamera' : 'ArcRotateCamera',
            },
          })
        }

        function focusSceneOnModel(model) {
          applyCameraPolicy(model)
        }

        function normalizeFragmentWorkspace(fragments = []) {
          return (Array.isArray(fragments) ? fragments : [])
            .map((fragment) => ({
              id: String(fragment?.id || fragment?.queryHash || '').slice(0, 96),
              title: String(fragment?.title || 'Civic fragment').slice(0, 160),
              countLabel: String(fragment?.countLabel || '').slice(0, 48),
              source: String(fragment?.source || '').slice(0, 64),
              queryHash: String(fragment?.queryHash || '').slice(0, 96),
              query: fragment?.query && typeof fragment.query === 'object' ? fragment.query : null,
            }))
            .filter((fragment) => fragment.id)
            .slice(0, 8)
        }

        function normalizedQueryScope(scope = null) {
          if (!scope || typeof scope !== 'object') return scope
          const center = scope.center
          if (!center || Array.isArray(center)) return scope
          const lon = center.lon ?? center.lng ?? center.longitude
          const lat = center.lat ?? center.latitude
          if (!Number.isFinite(Number(lon)) || !Number.isFinite(Number(lat))) return scope
          return {
            ...scope,
            center: [Number(lon), Number(lat)],
          }
        }

        function transformPoints(points = [], offset = { x: 0, z: 0 }) {
          return (Array.isArray(points) ? points : []).map((point) => ({
            ...point,
            x: finiteNumber(point?.x) + finiteNumber(offset.x),
            z: finiteNumber(point?.z) + finiteNumber(offset.z),
          }))
        }

        function transformSceneModel(model = {}, offset = { x: 0, z: 0 }, fragment = {}) {
          const transformFeature = (feature = {}) => ({
            ...feature,
            x: finiteNumber(feature.x) + finiteNumber(offset.x),
            z: finiteNumber(feature.z) + finiteNumber(offset.z),
            fragmentId: fragment.id,
            fragmentTitle: fragment.title,
          })
          const anchors = {}
          Object.entries(model.anchors || {}).forEach(([layerKey, features]) => {
            anchors[layerKey] = (features || []).map(transformFeature)
          })
          return {
            ...model,
            fragmentId: fragment.id,
            fragmentTitle: fragment.title,
            title: fragment.title || model.title,
            boundary: (model.boundary || []).map((ring) => transformPoints(ring, offset)),
            roads: (model.roads || []).map((road) => transformPoints(road, offset)),
            areas: (model.areas || []).map((area) => area.points
              ? { ...area, points: transformPoints(area.points, offset), fragmentId: fragment.id, fragmentTitle: fragment.title }
              : transformFeature(area)),
            buildings: (model.buildings || []).map(transformFeature),
            anchors,
          }
        }

        function mergeSceneModels(models = [], modeKey = activeExperienceMode) {
          const combined = {
            source: 'civic-fragment-workspace',
            title: modeKey === 'compare' ? 'Compared Civic XR fragments' : modeKey === 'overlay' ? 'Overlay Civic XR fragments' : 'Walkable Civic XR fragment',
            detail: 'Multiple TwinQL fragments rendered in a shared Civic XR workspace.',
            renderedFeatureCount: 0,
            totalFeatureCount: 0,
            boundary: [],
            roads: [],
            areas: [],
            buildings: [],
            anchors: {
              civic: [],
              mobility: [],
              commerce: [],
              wasteSeeds: [],
              places: [],
              features: [],
            },
            fragmentPlatforms: [],
            renderPolicy: renderPolicyForMode(modeKey),
          }
          models.forEach((model, index) => {
            if (modeKey === 'compare') {
              const extents = sceneExtents(model)
              const platform = model.comparePlatform || {}
              combined.fragmentPlatforms.push({
                id: model.fragmentId || ('fragment-' + index),
                title: model.fragmentTitle || model.title || ('Fragment ' + (index + 1)),
                index,
                center: platform.center || { x: extents.center.x, z: extents.center.z },
                width: clamp(platform.width || extents.width * 1.18, 38, 180),
                depth: clamp(platform.depth || extents.depth * 1.18, 32, 160),
                nativeWidth: extents.width,
                nativeDepth: extents.depth,
                renderedFeatureCount: Number(model.renderedFeatureCount || 0),
                totalFeatureCount: Number(model.totalFeatureCount || model.renderedFeatureCount || 0),
                scaleLabel: platform.scaleLabel || 'Shared platform scale',
              })
            }
            combined.boundary.push(...(model.boundary || []))
            combined.roads.push(...(model.roads || []))
            combined.areas.push(...(model.areas || []))
            combined.buildings.push(...(model.buildings || []))
            Object.keys(combined.anchors).forEach((layerKey) => {
              combined.anchors[layerKey].push(...(model.anchors?.[layerKey] || []))
            })
            combined.renderedFeatureCount += Number(model.renderedFeatureCount || 0)
            combined.totalFeatureCount += Number(model.totalFeatureCount || model.renderedFeatureCount || 0)
          })
          return combined
        }

        async function renderFragmentWorkspaceGeometry(modeKey = activeExperienceMode) {
          const queryFragments = activeFragmentWorkspace.filter((fragment) => fragment.query)
          if (!queryFragments.length) {
            renderFragmentWorkspaceMarkers(modeKey)
            return
          }
          setStatus('Loading Civic XR fragments', queryFragments.length.toLocaleString('en-US') + ' fragment queries are being resolved.')
          const baseModel = currentSceneModel
          const baseExtents = baseModel ? sceneExtents(baseModel) : { span: 88, center: new Vector3(0, 0, 0) }
          const rawModels = []
          for (let index = 0; index < queryFragments.length; index += 1) {
            const fragment = queryFragments[index]
            const result = await loadSceneManifestForQuery(fragment.query, { surface: 'immersive', intent: 'embed' }).catch((error) => {
              console.warn('Civic XR fragment query failed', fragment.id, error)
              return null
            })
            if (!result) continue
            const model = result.sceneManifest
              ? sceneModelFromSceneManifest(result.sceneManifest, result.summary || {})
              : result.geojson
                ? sceneModelFromGeojson(result.geojson, result.summary || {}, { source: 'fragment-query', title: fragment.title })
                : null
            if (!model) continue
            rawModels.push({ fragment, model, extents: sceneExtents(model) })
          }
          if (!rawModels.length) {
            renderFragmentWorkspaceMarkers(modeKey)
            setStatus('Civic fragments unavailable', 'The selected fragments could not be resolved into scene geometry.')
            return
          }

          const loadedModels = []
          const renderPolicy = renderPolicyForMode(modeKey)
          if (modeKey === 'compare') {
            const maxWidth = Math.max(...rawModels.map((entry) => entry.extents.width))
            const maxDepth = Math.max(...rawModels.map((entry) => entry.extents.depth))
            const platformWidth = clamp(maxWidth * 1.18, 46, 180)
            const platformDepth = clamp(maxDepth * 1.18, 36, 160)
            const platformGap = clamp(platformWidth * 0.34, 24, 54)
            const platformStep = platformWidth + platformGap
            rawModels.forEach((entry, index) => {
              const target = {
                x: (index - (rawModels.length - 1) / 2) * platformStep,
                z: 0,
              }
              const offset = {
                x: target.x - entry.extents.center.x,
                z: target.z - entry.extents.center.z,
              }
              const transformed = transformSceneModel(entry.model, offset, entry.fragment)
              transformed.renderPolicy = renderPolicy
              transformed.comparePlatform = {
                center: target,
                width: platformWidth,
                depth: platformDepth,
              }
              loadedModels.push(transformed)
            })
          } else {
            rawModels.forEach((entry) => {
              const offset = modeKey === 'walk'
                ? { x: 0, z: clamp(baseExtents.span * 0.45, 28, 72) }
                : { x: 0, z: 0 }
              const transformed = transformSceneModel(entry.model, offset, entry.fragment)
              transformed.renderPolicy = renderPolicy
              loadedModels.push(transformed)
            })
          }

          const combinedModel = mergeSceneModels(loadedModels, modeKey)
          renderCivicScene(combinedModel, {
            mode: 'civic-fragment-workspace',
            status: combinedModel.title,
            detail: loadedModels.length.toLocaleString('en-US') + ' resolved fragment' + (loadedModels.length === 1 ? '' : 's') + ' rendered as geometry.',
            returned: combinedModel.totalFeatureCount || combinedModel.renderedFeatureCount,
          })
        }

        function renderComparePlatforms() {
          if (!scene || activeExperienceMode !== 'compare') return false
          const platforms = Array.isArray(currentSceneModel?.fragmentPlatforms) ? currentSceneModel.fragmentPlatforms : []
          if (!platforms.length) return false
          layerState.xrFragments = true
          platforms.forEach((platform, index) => {
            const width = clamp(platform.width, 36, 170)
            const depth = clamp(platform.depth, 30, 150)
            const centerX = finiteNumber(platform.center?.x)
            const centerZ = finiteNumber(platform.center?.z)
            const tint = comparePlatformTint(index)
            const platformMat = material('civic-xr-compare-platform-' + index, tint, 0.38)
            const platformMetadata = {
              layerKey: 'xrFragments',
              featureType: 'compare-platform',
              platform,
              mode: 'compare',
              selectable: true,
              label: platform.title || ('Fragment ' + (index + 1)),
              source: 'civic-fragment-workspace',
              properties: {
                kind: 'compare-platform',
                label: platform.title || ('Fragment ' + (index + 1)),
                renderedFeatureCount: platform.renderedFeatureCount || 0,
                totalFeatureCount: platform.totalFeatureCount || 0,
                platformSize: Math.round(width) + 'x' + Math.round(depth),
                scaleLabel: platform.scaleLabel || 'Shared platform scale',
              },
            }
            const deck = MeshBuilder.CreateBox('xr-compare-platform-' + index, {
              width,
              depth,
              height: 0.28,
            }, scene)
            deck.position = new Vector3(centerX, -0.12, centerZ)
            deck.material = platformMat
            deck.metadata = platformMetadata
            registerMesh('xrFragments', deck)

            const gridLines = []
            const halfWidth = width / 2
            const halfDepth = depth / 2
            const step = clamp(Math.round(Math.max(width, depth) / 8), 7, 16)
            for (let x = -halfWidth; x <= halfWidth; x += step) {
              gridLines.push([
                new Vector3(centerX + x, 0.055, centerZ - halfDepth),
                new Vector3(centerX + x, 0.055, centerZ + halfDepth),
              ])
            }
            for (let z = -halfDepth; z <= halfDepth; z += step) {
              gridLines.push([
                new Vector3(centerX - halfWidth, 0.055, centerZ + z),
                new Vector3(centerX + halfWidth, 0.055, centerZ + z),
              ])
            }
            gridLines.push(
              [new Vector3(centerX - halfWidth, 0.075, centerZ - halfDepth), new Vector3(centerX + halfWidth, 0.075, centerZ - halfDepth)],
              [new Vector3(centerX + halfWidth, 0.075, centerZ - halfDepth), new Vector3(centerX + halfWidth, 0.075, centerZ + halfDepth)],
              [new Vector3(centerX + halfWidth, 0.075, centerZ + halfDepth), new Vector3(centerX - halfWidth, 0.075, centerZ + halfDepth)],
              [new Vector3(centerX - halfWidth, 0.075, centerZ + halfDepth), new Vector3(centerX - halfWidth, 0.075, centerZ - halfDepth)],
            )
            const grid = MeshBuilder.CreateLineSystem('xr-compare-platform-grid-' + index, { lines: gridLines }, scene)
            grid.color = tint
            grid.alpha = 0.62
            grid.metadata = { ...platformMetadata, selectable: false, featureType: 'compare-platform-grid' }
            registerMesh('xrFragments', grid)

            const labelPlate = MeshBuilder.CreateBox('xr-compare-platform-label-' + index, {
              width: clamp(width * 0.34, 12, 34),
              depth: 2.2,
              height: 0.34,
            }, scene)
            labelPlate.position = new Vector3(centerX - halfWidth + clamp(width * 0.2, 8, 22), 0.18, centerZ - halfDepth - 2.1)
            labelPlate.material = material('civic-xr-compare-label-' + index, tint, 0.84)
            labelPlate.metadata = { ...platformMetadata, featureType: 'compare-platform-label' }
            registerMesh('xrFragments', labelPlate)

            const indexMarker = MeshBuilder.CreateCylinder('xr-compare-platform-index-' + index, {
              diameter: 2.4,
              height: 0.54,
              tessellation: 24,
            }, scene)
            indexMarker.position = new Vector3(centerX - halfWidth + 2.6, 0.36, centerZ - halfDepth - 2.1)
            indexMarker.material = material('civic-xr-compare-index-' + index, tint, 0.95)
            indexMarker.metadata = { ...platformMetadata, featureType: 'compare-platform-index' }
            registerMesh('xrFragments', indexMarker)

            const objectBarWidth = clamp(width * Math.min(1, Number(platform.renderedFeatureCount || 0) / Math.max(1, Number(platform.totalFeatureCount || platform.renderedFeatureCount || 1))), 2.8, width * 0.32)
            const objectBar = MeshBuilder.CreateBox('xr-compare-feature-bar-' + index, {
              width: objectBarWidth,
              depth: 0.58,
              height: 0.24,
            }, scene)
            objectBar.position = new Vector3(centerX - halfWidth + objectBarWidth / 2 + 1.6, 0.28, centerZ + halfDepth + 1.6)
            objectBar.material = material('civic-xr-compare-feature-bar-' + index, tint, 0.92)
            objectBar.metadata = { ...platformMetadata, featureType: 'compare-feature-bar' }
            registerMesh('xrFragments', objectBar)

            const scaleBarWidth = clamp(width * 0.22, 9, 26)
            const scaleBar = MeshBuilder.CreateBox('xr-compare-scale-bar-' + index, {
              width: scaleBarWidth,
              depth: 0.36,
              height: 0.2,
            }, scene)
            scaleBar.position = new Vector3(centerX + halfWidth - scaleBarWidth / 2 - 1.7, 0.27, centerZ + halfDepth + 1.6)
            scaleBar.material = material('civic-xr-compare-scale-bar-' + index, new Color3(0.12, 0.18, 0.24), 0.78)
            scaleBar.metadata = { ...platformMetadata, featureType: 'compare-scale-bar' }
            registerMesh('xrFragments', scaleBar)

            ;[-1, 1].forEach((side) => {
              const tick = MeshBuilder.CreateBox('xr-compare-scale-tick-' + index + '-' + side, {
                width: 0.34,
                depth: 0.86,
                height: 0.24,
              }, scene)
              tick.position = new Vector3(scaleBar.position.x + side * scaleBarWidth / 2, 0.3, scaleBar.position.z)
              tick.material = scaleBar.material
              tick.metadata = { ...platformMetadata, selectable: false, featureType: 'compare-scale-tick' }
              registerMesh('xrFragments', tick)
            })
          })
          if (platforms.length > 1) {
            const sorted = [...platforms].sort((a, b) => finiteNumber(a.center?.x) - finiteNumber(b.center?.x))
            const left = sorted[0]
            const right = sorted[sorted.length - 1]
            const leftEdge = finiteNumber(left.center?.x) + clamp(left.width, 36, 170) / 2
            const rightEdge = finiteNumber(right.center?.x) - clamp(right.width, 36, 170) / 2
            const midX = (leftEdge + rightEdge) / 2
            const gapWidth = Math.max(2, rightEdge - leftEdge)
            const maxDepth = Math.max(...platforms.map((platform) => clamp(platform.depth, 30, 150)))
            const divider = MeshBuilder.CreateBox('xr-compare-shared-scale-divider', {
              width: clamp(gapWidth * 0.18, 1.2, 4.8),
              depth: clamp(maxDepth * 1.04, 34, 156),
              height: 0.16,
            }, scene)
            divider.position = new Vector3(midX, 0.12, 0)
            divider.material = material('civic-xr-compare-divider', new Color3(0.10, 0.15, 0.20), 0.36)
            divider.metadata = {
              layerKey: 'xrFragments',
              featureType: 'compare-shared-scale-divider',
              selectable: false,
              mode: 'compare',
            }
            registerMesh('xrFragments', divider)
          }
          return true
        }

        function renderFragmentWorkspaceMarkers(modeKey = activeExperienceMode) {
          clearFragmentWorkspaceMarkers()
          if (!scene || !currentSceneModel || !activeFragmentWorkspace.length) return
          layerState.xrFragments = true
          const extents = sceneExtents(currentSceneModel)
          const count = activeFragmentWorkspace.length
          const platformsRendered = renderComparePlatforms()
          if (modeKey === 'compare' && platformsRendered) return
          const markerMat = layerMaterial('xrFragments')
          const baseRadius = clamp(extents.span * 0.032, 1.2, 4.8)
          const spacing = clamp(extents.span * 0.18, 10, 28)
          const centerX = extents.center.x
          const centerZ = extents.center.z

          activeFragmentWorkspace.forEach((fragment, index) => {
            let x = centerX
            let z = centerZ
            let height = baseRadius * 1.15
            if (modeKey === 'compare') {
              x = centerX + (index - (count - 1) / 2) * spacing
              z = centerZ + clamp(extents.depth * 0.42, 14, 36)
              height = baseRadius * (1.05 + index * 0.08)
            } else if (modeKey === 'overlay') {
              x = centerX + Math.cos(index * 1.9) * baseRadius * 1.2
              z = centerZ + Math.sin(index * 1.9) * baseRadius * 1.2
              height = baseRadius * (1 + index * 0.18)
            } else {
              x = centerX
              z = centerZ + clamp(extents.depth * 0.38, 12, 32)
              height = baseRadius * 1.25
            }

            const marker = MeshBuilder.CreateCylinder('xr-fragment-' + index, {
              diameter: baseRadius * 2,
              height,
              tessellation: 36,
            }, scene)
            marker.position = new Vector3(x, height / 2 + 0.25, z)
            marker.material = markerMat
            marker.metadata = {
              layerKey: 'xrFragments',
              fragment,
              mode: modeKey,
            }
            registerMesh('xrFragments', marker)

            const halo = MeshBuilder.CreateTorus('xr-fragment-halo-' + index, {
              diameter: baseRadius * 3.1,
              thickness: 0.12,
              tessellation: 48,
            }, scene)
            halo.position = new Vector3(x, 0.22 + index * 0.04, z)
            halo.rotation.x = Math.PI / 2
            halo.material = markerMat
            halo.metadata = marker.metadata
            registerMesh('xrFragments', halo)
          })
        }

        function applyExperienceMode(modeKey = 'walk', fragments = activeFragmentWorkspace) {
          activeExperienceMode = EXPERIENCE_MODES[modeKey] ? modeKey : 'walk'
          activeFragmentWorkspace = normalizeFragmentWorkspace(fragments)
          const mode = EXPERIENCE_MODES[activeExperienceMode]
          applyCameraPolicy(currentSceneModel)
          renderFragmentWorkspaceMarkers(activeExperienceMode)
          updateSemanticOverlayPanel(currentSceneModel)
          updateComparePanel(currentSceneModel)
          renderFragmentWorkspaceGeometry(activeExperienceMode)
          if (currentSceneModel) focusSceneOnModel(currentSceneModel)
          const fragmentDetail = activeFragmentWorkspace.length
            ? activeFragmentWorkspace.length.toLocaleString('en-US') + ' fragment' + (activeFragmentWorkspace.length === 1 ? '' : 's') + ' in shared Civic XR workspace'
            : mode.detail
          setStatus(mode.title, fragmentDetail)
          broadcast('twin:state', {
            xrMode: activeExperienceMode,
            xrFragments: activeFragmentWorkspace,
            xrFragmentCount: activeFragmentWorkspace.length,
            renderPolicy: renderPolicyForMode(activeExperienceMode),
            runtime: 'babylon-webxr',
          })
        }

        function applyFidelity(nextFidelity = detailState.fidelity, options = {}) {
          detailState.fidelity = clamp(Number(nextFidelity) || detailState.fidelity, 0.1, 1)
          const managedKeys = ['roads', 'buildings', 'greenBlue', 'civic', 'mobility', 'commerce', 'wasteSeeds', 'places', 'features']
          managedKeys.forEach((key) => {
            const meshes = layerMeshes.get(key) || []
            const ratio = key === 'roads' || key === 'buildings'
              ? clamp(detailState.fidelity, 0.1, 1)
              : clamp(0.5 + detailState.fidelity * 0.5, 0.15, 1)
            const visibleLimit = Math.max(1, Math.round(meshes.length * ratio))
            meshes.forEach((mesh, index) => {
              mesh.isVisible = layerState[key] !== false && index < visibleLimit
            })
          })
          if (options.fit !== false && currentSceneModel) focusSceneOnModel(currentSceneModel)
        }

	        async function loadPayload() {
	          const response = await fetch(baseEndpoint, { credentials: 'same-origin' })
	          if (!response.ok) throw new Error('DATA_LOAD_FAILED')
	          return response.json()
	        }

	        async function postTwinQuery(queryPayload, cityPath) {
	          const response = await fetch('/api/live/' + cityPath + '/twin-query', {
	            method: 'POST',
	            credentials: 'same-origin',
	            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
	            body: JSON.stringify(queryPayload),
	          })
	          const result = await response.json()
	          if (!response.ok || !result?.ok) {
	            throw new Error(result?.error || result?.detail || 'CIVIC_XR_SCENE_QUERY_FAILED')
	          }
	          return result
	        }

		        async function loadSceneManifestForQuery(query, message = {}) {
		          if (!query || typeof query !== 'object') return null
		          const cityPath = encodeURIComponent(cityId || message.cityId || 'current')
		          const render = query.render && typeof query.render === 'object' ? query.render : {}
		          const queryPayload = {
		            ...query,
            scope: normalizedQueryScope(query.scope),
            render: {
              ...render,
              mode: render.mode || 'isolate',
              transport: 'scene-manifest',
            },
            surface: message.surface || query.surface || 'immersive',
            intent: query.intent || message.intent || 'embed',
            metadata: {
              ...(query.metadata && typeof query.metadata === 'object' ? query.metadata : {}),
		              source: 'civic-xr-scene-manifest-resolution',
		            },
		          }
		          return postTwinQuery(queryPayload, cityPath)
	        }

	        async function resolveSemanticSceneMessage(message = {}) {
	          const shareResult = await loadViewerShareQueryResult(message).catch(() => null)
	          const candidate = shareResult || message
	          if (candidate.sceneManifest?.objects?.length) return candidate
	          if (candidate.geojson?.features?.length) return candidate
	          if (candidate.primitives?.features?.length) {
	            return {
	              ...candidate,
	              geojson: geojsonFromPrimitives(candidate.primitives),
	            }
	          }
	          const manifestQuery = candidate.sceneManifest?.query || candidate.query
	          const resolved = await loadSceneManifestForQuery(manifestQuery, candidate).catch(() => null)
	          if (resolved?.sceneManifest?.objects?.length) return resolved
	          return candidate
	        }

	        async function applySemanticQuery(message = {}) {
	          const result = await resolveSemanticSceneMessage(message)
	          const sceneManifest = result?.sceneManifest || null
	          const geojson = result?.geojson || (sceneManifest ? geojsonFromSceneManifest(sceneManifest) : featureCollection([]))
		          const summary = result?.summary || message.summary || {}
		          const returned = Number(summary.returned ?? summary.resultCount ?? geojson.features?.length ?? 0)
		          if (!geojson.features?.length) {
	            if (currentPayload) {
	              const fallbackModel = sceneModelFromPayload(currentPayload)
	              renderCivicScene(fallbackModel, {
	                status: returned ? 'TwinQL geometry unavailable' : 'No TwinQL matches',
	                mode: 'base-scene',
	                returned: fallbackModel.renderedFeatureCount,
	                truncated: Boolean(summary.truncated),
	                label: 'Base Civic XR scene shown',
	                detail: returned
	                  ? returned.toLocaleString('en-US') + ' matching objects were reported, but no XR geometry was returned. Showing the base city scene.'
	                  : 'This selection did not return renderable XR geometry. Showing the base city scene.',
	              })
	              return
	            }
	            setStatus('TwinQL selection received', returned ? returned.toLocaleString('en-US') + ' matching objects; scene geometry unavailable' : 'No objects returned for this selection')
	            broadcast('twin:viewport', {
	              mode: 'semantic-query',
	              label: returned ? returned.toLocaleString('en-US') + ' selected objects' : 'Empty TwinQL selection',
              returned,
              truncated: Boolean(summary.truncated),
            })
            return
          }
	          const model = sceneManifest
	            ? sceneModelFromSceneManifest(sceneManifest, summary)
	            : sceneModelFromGeojson(geojson, summary, {
	              source: 'query',
	              title: 'Civic XR selection scene',
	              detail: 'TwinQL selection converted into an inspectable civic tabletop.',
	            })
          renderCivicScene(model, {
            status: 'TwinQL scene ready',
            mode: 'semantic-query',
            returned,
            truncated: Boolean(summary.truncated),
            label: model.renderedFeatureCount.toLocaleString('en-US') + ' XR scene objects',
          })
        }

        async function initXr() {
          const xrStatus = document.getElementById('civic-xr-webxr')
          const xr = navigator.xr
          const vrSupported = Boolean(xr && await xr.isSessionSupported?.('immersive-vr').catch(() => false))
          const arSupported = Boolean(xr && await xr.isSessionSupported?.('immersive-ar').catch(() => false))
          xrSupport = { ar: arSupported, vr: vrSupported }
          if (xrStatus) {
            xrStatus.textContent = arSupported
              ? 'WebXR AR available'
              : vrSupported
                ? 'WebXR VR available'
                : 'Desktop 3D active'
          }
          if (!scene?.createDefaultXRExperienceAsync || (!vrSupported && !arSupported)) return
          xrExperience = await scene.createDefaultXRExperienceAsync({
            floorMeshes: [document.__civicXrGround].filter(Boolean),
            optionalFeatures: ['hit-test', 'anchors', 'hand-tracking'],
            uiOptions: {
              sessionMode: arSupported ? 'immersive-ar' : 'immersive-vr',
              referenceSpaceType: 'local-floor',
            },
          }).catch((error) => {
            console.warn('Civic XR WebXR session bootstrap unavailable', error)
            return null
          })
        }

        async function enterXrSession(modeKey) {
          const sessionMode = modeKey === 'ar' ? 'immersive-ar' : 'immersive-vr'
          document.querySelectorAll('[data-civic-xr-session]').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.civicXrSession === modeKey)
          })
          if (modeKey === 'desktop') {
            setStatus('Desktop 3D active', 'Street-scale desktop inspection is active.')
            return
          }
          const supported = modeKey === 'ar' ? xrSupport.ar : xrSupport.vr
          if (!supported || !xrExperience?.baseExperience?.enterXRAsync) {
            setStatus('XR hardware unavailable', modeKey.toUpperCase() + ' is not available in this browser. Desktop 3D remains active.')
            return
          }
          await xrExperience.baseExperience.enterXRAsync(
            sessionMode,
            'local-floor',
            document.__civicXrGround,
          ).catch((error) => {
            console.warn('Civic XR session unavailable', error)
            setStatus('XR session unavailable', String(error?.message || error))
          })
        }

        function bindPresenceControls() {
          document.querySelectorAll('[data-civic-xr-session]').forEach((button) => {
            button.addEventListener('click', () => enterXrSession(button.dataset.civicXrSession))
          })
          document.querySelector('[data-civic-xr-fullscreen]')?.addEventListener('click', () => {
            document.querySelector('.scene-stage--civic-xr')?.requestFullscreen?.()
          })
        }

        function createBaseScene() {
          const canvas = document.getElementById('civic-xr-canvas')
          if (!canvas) throw new Error('CIVIC_XR_CANVAS_MISSING')
          engine = new Engine(canvas, true, { antialias: true, preserveDrawingBuffer: true, stencil: true })
          scene = new Scene(engine)
          scene.clearColor = new Color4(0.92, 0.96, 0.98, 1)
          camera = new ArcRotateCamera('civic-xr-camera', -Math.PI / 2.65, Math.PI / 3.4, 130, new Vector3(0, 4, 0), scene)
          camera.attachControl(canvas, true)
          streetCamera = new UniversalCamera('civic-xr-street-camera', new Vector3(0, WALK_EYE_HEIGHT, 10), scene)
          streetCamera.minZ = 0.04
          streetCamera.fov = 1.08
          streetCamera.speed = 0.42
          streetCamera.angularSensibility = 3800
          streetCamera.checkCollisions = true
          streetCamera.applyGravity = false
          streetCamera.ellipsoid = new Vector3(WALK_COLLIDER_RADIUS, WALK_COLLIDER_HEIGHT, WALK_COLLIDER_RADIUS)
          streetCamera.keysUp.push(87)
          streetCamera.keysDown.push(83)
          streetCamera.keysLeft.push(65)
          streetCamera.keysRight.push(68)
          streetCamera.inputs.attached.mouse.detachControl()
          bindScenePicking(canvas)
          camera.lowerBetaLimit = 0.24
          camera.upperBetaLimit = Math.PI / 2.08
          camera.lowerRadiusLimit = 18
          camera.upperRadiusLimit = 420
          camera.wheelPrecision = 38
          camera.panningSensibility = 60
          camera.inertia = 0.68
          applyCameraPolicy()

          const light = new HemisphericLight('civic-xr-light', new Vector3(0.2, 1, 0.25), scene)
          light.intensity = 0.96

          const groundMaterial = material('civic-xr-ground-material', new Color3(0.82, 0.88, 0.92), 0.2)
          const ground = MeshBuilder.CreateGround('civic-xr-ground', { width: 360, height: 280 }, scene)
          ground.position = new Vector3(0, -0.22, 0)
          ground.material = groundMaterial
          ground.checkCollisions = true
          groundMesh = ground
          document.__civicXrGround = ground

          scene.onBeforeRenderObservable.add(updateStreetCameraClamp)
          engine.runRenderLoop(() => scene.render())
          window.addEventListener('resize', () => engine.resize())
        }

        ${renderViewerShareManifestRuntime()}

        window.addEventListener('message', async (event) => {
          const message = event.data || {}
          if (!message || !['twin-host', 'twin-dashboard'].includes(message.source)) return

          if (message.type === 'twin:set-visible-layers') {
            Object.entries(message.layers || {}).forEach(([key, visible]) => setLayerVisibility(key, visible))
          }

          if (message.type === 'twin:set-fidelity') {
            applyFidelity(Number(message.fidelity))
          }

          if (message.type === 'twin:set-xr-mode') {
            if (message.mode === 'fullscreen' || message.value === 'fullscreen') {
              document.querySelector('.scene-stage--civic-xr')?.requestFullscreen?.()
            } else if (['desktop', 'vr', 'ar'].includes(message.mode || message.value)) {
              await enterXrSession(message.mode || message.value)
            } else {
              applyExperienceMode(message.mode || message.value || 'walk', message.fragments || message.command?.fragments || [])
            }
          }

          if (message.type === 'twin:set-semantic-query') {
            await applySemanticQuery(message)
          }

          if (message.type === 'twin:clear-semantic-query') {
            if (currentPayload) {
              renderCivicScene(sceneModelFromPayload(currentPayload), {
                status: 'Civic XR ready',
                mode: 'base-scene',
              })
            }
          }
        })

        try {
          setStatus('Preparing Civic XR', 'Loading city inventory')
          bindPresenceControls()
          applyExperienceMode('walk')
          createBaseScene()
          const payload = await loadPayload()
          currentPayload = payload
          fillMetrics(payload.metrics)
          fillInventory(payload.inventory)
          fillLayerControls(payload.inventory)
          renderCivicScene(sceneModelFromPayload(payload), {
            status: 'Civic XR ready',
            mode: 'base-scene',
          })
          await initXr()
        } catch (error) {
          console.error(error)
          setStatus('Civic XR unavailable', String(error?.message || error))
          broadcast('twin:error', {
            message: String(error?.message || error),
            surface: viewerId,
            productSurface,
          })
        }
      </script>`
}
