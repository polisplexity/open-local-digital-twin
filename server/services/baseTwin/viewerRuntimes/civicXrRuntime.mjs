import { renderViewerShareManifestRuntime } from './viewerShareManifestRuntime.mjs'
import { renderCivicXrRuntimePolicy } from './civicXr/civicXrRuntimePolicy.mjs'
import { renderCivicXrSessionRuntime } from './civicXr/civicXrSessionRuntime.mjs'
import { renderCivicXrSelectionRuntime } from './civicXr/civicXrSelectionRuntime.mjs'
import { renderCivicXrGeometryRuntime } from './civicXr/civicXrGeometryRuntime.mjs'
import { renderCivicXrFragmentRuntime } from './civicXr/civicXrFragmentRuntime.mjs'
import { renderCivicXrCameraRuntime } from './civicXr/civicXrCameraRuntime.mjs'
import { renderCivicXrWebXrRuntime } from './civicXr/civicXrWebXrRuntime.mjs'
import { renderCivicXrSceneBootstrapRuntime } from './civicXr/civicXrSceneBootstrapRuntime.mjs'
import { renderCivicXrHostRuntime } from './civicXr/civicXrHostRuntime.mjs'

export function renderCivicXrRuntime({ cityId = 'current', baseEndpoint }) {
  const endpointJson = JSON.stringify(baseEndpoint)
  const cityIdJson = JSON.stringify(cityId)
  return `
      <script type="module">
        import '/vendor/babylonjs/core/Culling/ray.js'
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
        ${renderCivicXrRuntimePolicy()}

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
        let xrSessionState = { requestedMode: 'desktop', sessionMode: 'inline', active: false, supported: true, requiresUserGesture: false }
        let activeExperienceMode = 'walk'
        let activeFragmentWorkspace = []
        let groundMesh = null
        let selectedMesh = null
        let selectedHighlightMesh = null

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

        ${renderCivicXrSessionRuntime()}

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
          broadcastCivicVisualState({ layers: layerState })
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

        ${renderCivicXrSelectionRuntime()}

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

        ${renderCivicXrGeometryRuntime()}

        function numericBounds(values) {
          let min = Infinity
          let max = -Infinity
          ;(values || []).forEach((value) => {
            const numeric = Number(value)
            if (!Number.isFinite(numeric)) return
            if (numeric < min) min = numeric
            if (numeric > max) max = numeric
          })
          return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null
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
          const xBounds = numericBounds(xs)
          const zBounds = numericBounds(zs)
          if (!xBounds || !zBounds) {
            return { minX: -44, maxX: 44, minZ: -32, maxZ: 32, width: 88, depth: 64, center: new Vector3(0, 0, 0), span: 88 }
          }
          const minX = xBounds.min
          const maxX = xBounds.max
          const minZ = zBounds.min
          const maxZ = zBounds.max
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

        ${renderCivicXrCameraRuntime()}

        ${renderCivicXrFragmentRuntime()}

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

        ${renderCivicXrWebXrRuntime()}

        ${renderCivicXrSceneBootstrapRuntime()}

        ${renderViewerShareManifestRuntime()}

        ${renderCivicXrHostRuntime()}

        bindHostMessages()

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
