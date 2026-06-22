import { renderViewerShareManifestRuntime } from './viewerShareManifestRuntime.mjs'

export function renderCity3dRuntime({ cityId, baseEndpoint }) {
  return `
      <script type="module">
        import * as THREE from 'three'
        import { OrbitControls } from '/vendor/three/examples/jsm/controls/OrbitControls.js'

        const esc = (value) => String(value ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;')
        const viewerId = '3d'

        function broadcast(type, payload = {}) {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ source: 'twin-viewer', viewer: viewerId, type, ...payload }, '*')
          }
        }

        async function loadPayload() {
          const response = await fetch('${baseEndpoint}', { credentials: 'same-origin' })
          if (!response.ok) throw new Error('DATA_LOAD_FAILED')
          return response.json()
        }

        function liveFeaturesEndpoint(cityId) {
          return '/api/live/' + encodeURIComponent(cityId || 'current') + '/features'
        }

        async function loadBimLayers(cityId) {
          const response = await fetch('/api/live/' + encodeURIComponent(cityId || 'current') + '/bim-layers', {
            credentials: 'same-origin',
          })
          if (!response.ok) return { layers: [] }
          return response.json()
        }

        ${renderViewerShareManifestRuntime()}

        function fillMetrics(metrics) {
          document.getElementById('metric-grid').innerHTML = metrics
            .map((item) => '<div class="metric"><span>' + esc(item.label) + '</span><strong>' + esc(item.value) + '</strong><p>' + esc(item.note || '') + '</p></div>')
            .join('')
        }

        function fillInventory(inventory) {
          document.getElementById('scene-inventory').innerHTML = inventory.sections.map((section) => {
            const items = section.items
              .map((item) => '<li class="inventory-item"><span>' + esc(item.label) + '</span><strong>' + esc(item.count) + '</strong></li>')
              .join('')
            return '<section class="inventory-section"><h3>' + esc(section.title) + '</h3><p class="inventory-summary">' + esc(section.summary) + '</p><ul>' + items + '</ul></section>'
          }).join('')
        }

        function renderSelection(properties, meta) {
          const panel = document.getElementById('scene-selection')
          const tags = Object.entries(properties || {})
            .filter(([key, value]) => value !== null && value !== '' && key !== 'id')
            .map(([key, value]) => '<span class="selection-tag">' + esc(key) + ': ' + esc(value) + '</span>')
            .join('')

          panel.innerHTML =
            '<div class="card">' +
              '<p class="selection-title">' + esc(properties?.label || meta?.label || 'Selected object') + '</p>' +
              '<p class="selection-meta">' + esc(meta?.description || '3D object inside the current public-data base twin.') + '</p>' +
              '<div class="selection-tags">' +
                '<span class="selection-tag">twin type: ' + esc(meta?.twinCategory || 'Current layer') + '</span>' +
                '<span class="selection-tag">city system: ' + esc(meta?.system || 'Current system') + '</span>' +
                '<span class="selection-tag">ldt layer: ' + esc(meta?.ldtLayer || 'Visualisation') + '</span>' +
                '<span class="selection-tag">capability: ' + esc(meta?.capability || 'Descriptive') + '</span>' +
                '<span class="selection-tag">method phase: ' + esc(meta?.phase || 'Explore') + '</span>' +
              '</div>' +
              '<p class="selection-meta"><strong>Why it matters:</strong> ' + esc(meta?.cityMeaning || '') + '</p>' +
              '<p class="selection-meta"><strong>Current semantic state:</strong> ' + esc(meta?.semanticState || 'Not classified') + '</p>' +
              '<p class="selection-meta"><strong>Transport status:</strong> ' + esc(meta?.transportStatus || 'Not described') + '</p>' +
              '<p class="selection-meta"><strong>Next step:</strong> ' + esc(meta?.nextSemanticStep || '') + '</p>' +
              '<div class="selection-tags">' + tags + '</div>' +
            '</div>'
        }

        function makeLine(points, color, yOffset = 0.05, options = {}) {
          if (!points || points.length < 2) return null
          const vertices = []
          points.forEach((point) => vertices.push(point.x, yOffset, point.z))
          const geometry = new THREE.BufferGeometry()
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
          const material = new THREE.LineBasicMaterial({
            color,
            transparent: options.transparent ?? options.opacity !== undefined,
            opacity: options.opacity ?? 1,
            depthTest: options.depthTest ?? true,
          })
          const line = new THREE.Line(geometry, material)
          if (options.renderOrder !== undefined) line.renderOrder = options.renderOrder
          if (options.frustumCulled === false) line.frustumCulled = false
          return line
        }

        function makePlanningGrid(radius = 1080, step = 60, color = '#d8e1e8') {
          const vertices = []
          for (let x = -radius; x <= radius; x += step) {
            const span = Math.sqrt(Math.max(radius * radius - x * x, 0))
            vertices.push(x, 0.015, -span, x, 0.015, span)
          }
          for (let z = -radius; z <= radius; z += step) {
            const span = Math.sqrt(Math.max(radius * radius - z * z, 0))
            vertices.push(-span, 0.015, z, span, 0.015, z)
          }
          const geometry = new THREE.BufferGeometry()
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
          const material = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.18,
            depthTest: false,
          })
          const grid = new THREE.LineSegments(geometry, material)
          grid.renderOrder = 3
          grid.frustumCulled = false
          return { grid, material }
        }

        function distance2d(x, z, originX, originZ) {
          return Math.hypot((x || 0) - originX, (z || 0) - originZ)
        }

        function trimLineToRadius(points = [], originX, originZ, radius) {
          const trimmed = points.filter((point) => distance2d(point.x, point.z, originX, originZ) <= radius)
          return trimmed.length >= 2 ? trimmed : []
        }

        function midpointForLine(points = []) {
          if (!points.length) return { x: 0, z: 0 }
          const first = points[0]
          const last = points[points.length - 1]
          return {
            x: (first.x + last.x) / 2,
            z: (first.z + last.z) / 2,
          }
        }

        function roadPriority(highway) {
          const ranking = {
            motorway: 0,
            trunk: 1,
            primary: 2,
            secondary: 3,
            tertiary: 4,
            residential: 5,
            living_street: 6,
            service: 7,
          }
          return Object.prototype.hasOwnProperty.call(ranking, highway) ? ranking[highway] : 9
        }

        function makePolygonSurface(points = [], color, opacity, y = 0.01) {
          if (!Array.isArray(points) || points.length < 3) return null
          const shape = new THREE.Shape(points.map((point) => new THREE.Vector2(point.x, point.z)))
          const geometry = new THREE.ShapeGeometry(shape)
          const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
          const mesh = new THREE.Mesh(geometry, material)
          mesh.rotation.x = -Math.PI / 2
          mesh.position.y = y
          return { mesh, material }
        }

        function projectPoint(lon, lat, originLon, originLat) {
          const cosLat = Math.cos((originLat * Math.PI) / 180)
          return {
            x: (Number(lon) - originLon) * 111320 * cosLat,
            z: (Number(lat) - originLat) * 110540,
          }
        }

        function unprojectPoint(x, z, originLon, originLat) {
          const cosLat = Math.cos((originLat * Math.PI) / 180)
          return {
            lon: originLon + Number(x || 0) / (111320 * cosLat),
            lat: originLat + Number(z || 0) / 110540,
          }
        }

        function scenePointsFromCoordinates(coords = [], originLon, originLat) {
          return (coords || [])
            .map(([lon, lat]) => projectPoint(lon, lat, originLon, originLat))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.z))
        }

        function polygonBoxFromPoints(points = [], height = 8) {
          if (!points.length) return null
          let minX = Infinity
          let minZ = Infinity
          let maxX = -Infinity
          let maxZ = -Infinity
          points.forEach((point) => {
            minX = Math.min(minX, point.x)
            minZ = Math.min(minZ, point.z)
            maxX = Math.max(maxX, point.x)
            maxZ = Math.max(maxZ, point.z)
          })
          return {
            x: (minX + maxX) / 2,
            z: (minZ + maxZ) / 2,
            width: Math.max(maxX - minX, 5),
            depth: Math.max(maxZ - minZ, 5),
            height: Math.max(Number(height) || 8, 3),
          }
        }

        function logicalFacilityLayer(feature) {
          const category = String(feature?.properties?.category || '').trim()
          const mobility = new Set(['platform', 'stop_position', 'parking', 'parking_space', 'bicycle_parking', 'charging_station', 'fuel', 'shelter', 'compressed_air'])
          const civic = new Set(['townhall', 'library', 'school', 'kindergarten', 'hospital', 'clinic', 'doctors', 'police', 'fire_station', 'post_office', 'community_centre', 'social_facility', 'childcare', 'theatre', 'marketplace', 'events_venue'])
          const waste = new Set(['recycling', 'waste_basket', 'waste_disposal'])
          if (mobility.has(category)) return 'mobility'
          if (civic.has(category)) return 'civic'
          if (waste.has(category)) return 'wasteSeeds'
          return 'commerce'
        }

        function liveBimAssetHref(cityId, layerKey, bundleId, assetName) {
          return '/api/live/' + encodeURIComponent(cityId || 'current') +
            '/bim-assets/' + encodeURIComponent(layerKey) +
            '/' + encodeURIComponent(bundleId) +
            '/' + encodeURIComponent(assetName)
        }

        function positionAttributeFromWebIfcBuffer(vertexBuffer) {
          const stride = vertexBuffer.length % 6 === 0 ? 6 : 3
          const vertexCount = Math.floor(vertexBuffer.length / stride)
          const positions = new Float32Array(vertexCount * 3)
          for (let index = 0; index < vertexCount; index += 1) {
            positions[index * 3] = vertexBuffer[index * stride]
            positions[index * 3 + 1] = vertexBuffer[index * stride + 1]
            positions[index * 3 + 2] = vertexBuffer[index * stride + 2]
          }
          return positions
        }

        async function buildBimMeshFromAsset(cityId, layerKey, bundleId, element, geometryRef, material) {
          const vertexResponse = await fetch(liveBimAssetHref(cityId, layerKey, bundleId, geometryRef.vertexBuffer.assetName), { credentials: 'same-origin' })
          const indexResponse = await fetch(liveBimAssetHref(cityId, layerKey, bundleId, geometryRef.indexBuffer.assetName), { credentials: 'same-origin' })
          if (!vertexResponse.ok || !indexResponse.ok) return null
          const [vertexPayload, indexPayload] = await Promise.all([
            vertexResponse.arrayBuffer(),
            indexResponse.arrayBuffer(),
          ])
          const vertices = new Float32Array(vertexPayload)
          const indices = new Uint32Array(indexPayload)
          if (!vertices.length || !indices.length) return null
          const geometry = new THREE.BufferGeometry()
          geometry.setAttribute('position', new THREE.BufferAttribute(positionAttributeFromWebIfcBuffer(vertices), 3))
          geometry.setIndex(new THREE.BufferAttribute(indices, 1))
          geometry.computeVertexNormals()
          const mesh = new THREE.Mesh(geometry, material.clone())
          if (Array.isArray(geometryRef.flatTransformation) && geometryRef.flatTransformation.length === 16) {
            mesh.applyMatrix4(new THREE.Matrix4().fromArray(geometryRef.flatTransformation))
          }
          mesh.userData = {
            properties: {
              label: 'IFC element #' + element.expressId,
              ifc_entity_id: '#' + element.expressId,
              geometry_express_id: geometryRef.geometryExpressId,
            },
            meta: {
              key: 'bimAssets',
              label: 'BIM mesh asset',
              description: 'Renderable mesh buffer extracted from provider IFC geometry.',
              twinCategory: 'Provider BIM',
              system: 'Building information model',
              ldtLayer: 'Provider extension layer',
              capability: 'Asset inspection',
              phase: 'Operate',
              cityMeaning: 'This geometry comes from a provider BIM layer attached to the base city twin.',
              semanticState: 'Raw BIM mesh asset',
              transportStatus: 'Served from protected local BIM asset storage.',
              nextSemanticStep: 'Attach room polygons, systems, and viewer-ready metadata.',
            },
          }
          return mesh
        }

        function buildBoxForKeys(groups, keys) {
          const box = new THREE.Box3()
          let hasContent = false
          keys.forEach((key) => {
            const next = new THREE.Box3().setFromObject(groups[key])
            if (!next.isEmpty()) {
              if (!hasContent) {
                box.copy(next)
                hasContent = true
              } else {
                box.union(next)
              }
            }
          })
          return hasContent ? box : null
        }

        function focusCamera(camera, controls, box, variant = 'oblique') {
          if (!box) return
          const size = box.getSize(new THREE.Vector3())
          const center = box.getCenter(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z, 80)
          const distance =
            maxDim *
            (variant === 'scope'
              ? 1.28
              : variant === 'district'
                ? 0.86
                : variant === 'planning'
                  ? 0.92
                  : 0.9)
          if (variant === 'planning') {
            camera.position.set(center.x + distance * 0.12, center.y + distance * 0.96, center.z + distance * 0.2)
          } else if (variant === 'top') {
            camera.position.set(center.x, center.y + distance * 1.28, center.z + 0.1)
          } else if (variant === 'district') {
            camera.position.set(center.x + distance * 0.28, center.y + distance * 0.48, center.z + distance * 0.28)
          } else {
            camera.position.set(center.x + distance * 0.38, center.y + distance * 0.38, center.z + distance * 0.42)
          }
          camera.near = 0.1
          camera.far = distance * 12
          camera.updateProjectionMatrix()
          controls.target.copy(center)
          controls.update()
        }

        loadPayload().then(async (payload) => {
          fillMetrics(payload.metrics)
          fillInventory(payload.inventory)
          const bimLayerPayload = await loadBimLayers(payload.city?.id || '${cityId}')
          const bimLayers = Array.isArray(bimLayerPayload.layers) ? bimLayerPayload.layers : []
          const layerMeta = Object.fromEntries(
            payload.inventory.layerDefinitions.map((definition) => [definition.key, definition]),
          )
          layerMeta.bimAssets = {
            key: 'bimAssets',
            label: 'BIM assets',
            description: 'Provider IFC mesh assets attached to the city twin.',
            color: '#0f766e',
            renderedCount: bimLayers.reduce((sum, layer) => sum + Number(layer.nativeGeometry?.meshAssetBundle?.geometryReferenceCount ?? 0), 0),
            discoveredCount: bimLayers.reduce((sum, layer) => sum + Number(layer.recordCounts?.['model-anchor'] ?? 0), 0),
          }
          const preferredVisibleState = {
            boundary: true,
            roads: true,
            buildings: true,
            bimAssets: false,
            greenBlue: false,
            civic: true,
            mobility: true,
            commerce: true,
            wasteSeeds: true,
            places: false,
          }
          const visibleState = Object.fromEntries(
            payload.inventory.layerDefinitions
              .filter((definition) => definition.key !== 'center')
              .map((definition) => [
                definition.key,
                Object.prototype.hasOwnProperty.call(preferredVisibleState, definition.key)
                  ? Boolean(preferredVisibleState[definition.key])
                  : Boolean(definition.visibleByDefault),
              ]),
          )
          visibleState.bimAssets = false
          const focusOrigin = { x: 0, z: 0 }
          const planningRadius = 1380
          const scopeRadius = 3600
          const contextRoadClasses = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential'])
          const contextRoads = payload.scene.roads
            .map((road) => ({ ...road, points: trimLineToRadius(road.points, focusOrigin.x, focusOrigin.z, scopeRadius) }))
            .filter((road) => road.points.length >= 2)
            .filter((road, index) => {
              const midpoint = midpointForLine(road.points)
              const distance = distance2d(midpoint.x, midpoint.z, focusOrigin.x, focusOrigin.z)
              if (distance <= planningRadius * 0.82) return false
              return contextRoadClasses.has(road.highway) || index % 2 === 0
            })
            .sort((left, right) => {
              const leftMidpoint = midpointForLine(left.points)
              const rightMidpoint = midpointForLine(right.points)
              const classDelta = roadPriority(left.highway) - roadPriority(right.highway)
              if (classDelta !== 0) return classDelta
              return (
                distance2d(leftMidpoint.x, leftMidpoint.z, focusOrigin.x, focusOrigin.z) -
                distance2d(rightMidpoint.x, rightMidpoint.z, focusOrigin.x, focusOrigin.z)
              )
            })
          const contextBuildings = payload.scene.buildings
            .filter((building, index) => {
              const distance = distance2d(building.x, building.z, focusOrigin.x, focusOrigin.z)
              if (distance <= planningRadius * 0.8 || distance > scopeRadius) return false
              const footprint = building.width * building.depth
              return footprint >= 450 || index % 2 === 0
            })
            .sort((left, right) => {
              const footprintDelta = right.width * right.depth - left.width * left.depth
              if (Math.abs(footprintDelta) > 1) return footprintDelta
              return distance2d(left.x, left.z, focusOrigin.x, focusOrigin.z) - distance2d(right.x, right.z, focusOrigin.x, focusOrigin.z)
            })
          const sceneData = {
            boundary: payload.scene.boundary,
            roads: payload.scene.roads
              .map((road) => ({ ...road, points: trimLineToRadius(road.points, focusOrigin.x, focusOrigin.z, planningRadius) }))
              .filter((road) => road.points.length >= 2),
            contextRoads,
            buildings: payload.scene.buildings
              .filter((building) => distance2d(building.x, building.z, focusOrigin.x, focusOrigin.z) <= planningRadius)
              .sort((left, right) => {
                const leftDistance = distance2d(left.x, left.z, focusOrigin.x, focusOrigin.z)
                const rightDistance = distance2d(right.x, right.z, focusOrigin.x, focusOrigin.z)
                if (Math.abs(leftDistance - rightDistance) > 30) return leftDistance - rightDistance
                return right.width * right.depth - left.width * left.depth
              }),
            contextBuildings,
            greenBlue: payload.scene.greenBlue
              .map((feature) => {
                if (feature.shape === 'line') {
                  const points = trimLineToRadius(feature.points, focusOrigin.x, focusOrigin.z, planningRadius)
                  return points.length >= 2 ? { ...feature, points } : null
                }
                return distance2d(feature.x, feature.z, focusOrigin.x, focusOrigin.z) <= planningRadius ? feature : null
              })
              .filter(Boolean),
            places: payload.scene.places.filter((place) => distance2d(place.x, place.z, focusOrigin.x, focusOrigin.z) <= planningRadius + 300),
            mobility: payload.scene.mobility.filter((facility) => distance2d(facility.x, facility.z, focusOrigin.x, focusOrigin.z) <= planningRadius),
            civic: payload.scene.civic.filter((facility) => distance2d(facility.x, facility.z, focusOrigin.x, focusOrigin.z) <= planningRadius),
            commerce: payload.scene.commerce.filter((facility) => distance2d(facility.x, facility.z, focusOrigin.x, focusOrigin.z) <= planningRadius),
            wasteSeeds: payload.scene.wasteSeeds.filter((facility) => distance2d(facility.x, facility.z, focusOrigin.x, focusOrigin.z) <= planningRadius),
          }

          function renderAndBroadcastSelection(properties, meta) {
            renderSelection(properties, meta)
            broadcast('twin:selection', { selection: { properties, meta } })
          }

          renderAndBroadcastSelection(
            {
              label: payload.city?.name ? payload.city.name + ' base twin' : 'Current base twin',
              streets: payload.inventory?.totals?.roadNamesDiscovered ?? 0,
            },
            {
              description: 'Current city-scale base twin anchored by scope, systems, and public data layers.',
              system: 'Municipal operating canvas',
              ldtLayer: 'Knowledge -> Services -> Visualisation',
              capability: 'Descriptive / Prospective',
              phase: 'Validate + Define',
              cityMeaning: 'This is the moment where the city stops being abstract and becomes something the municipality can read and discuss.',
              nextSemanticStep: 'Attach the first service domain, starting with waste and street cleanliness.',
            },
          )

          const container = document.getElementById('scene3d')
          const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
          })
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.15))
          renderer.toneMapping = THREE.ACESFilmicToneMapping
          renderer.toneMappingExposure = 1.22
          renderer.setSize(container.clientWidth || 900, container.clientHeight || 740)
          container.appendChild(renderer.domElement)

          const scene = new THREE.Scene()
          scene.background = new THREE.Color('#f8fbfd')
          scene.fog = new THREE.Fog('#f7fafc', 1250, 4700)

          const camera = new THREE.PerspectiveCamera(55, (container.clientWidth || 900) / (container.clientHeight || 740), 0.1, 5000)
          const controls = new OrbitControls(camera, renderer.domElement)
          controls.enableDamping = true
          controls.dampingFactor = 0.06
          controls.maxPolarAngle = Math.PI / 2.03
          controls.minDistance = 150
          controls.maxDistance = 2350
          controls.screenSpacePanning = true
          if ('zoomToCursor' in controls) controls.zoomToCursor = true
          if (typeof controls.listenToKeyEvents === 'function') controls.listenToKeyEvents(window)

          const ambient = new THREE.HemisphereLight('#ffffff', '#d7e2ea', 2.3)
          scene.add(ambient)
          const sun = new THREE.DirectionalLight('#fff6da', 1.7)
          sun.position.set(220, 280, 120)
          scene.add(sun)
          const fill = new THREE.DirectionalLight('#dcefff', 1.15)
          fill.position.set(-180, 140, -160)
          scene.add(fill)
          const rim = new THREE.PointLight('#b3daf1', 0.72, 1800)
          rim.position.set(0, 180, 0)
          scene.add(rim)

          const tableRadius = 780
          const focusPlate = new THREE.Mesh(
            new THREE.CircleGeometry(tableRadius * 0.78, 84),
            new THREE.MeshBasicMaterial({
              color: '#fbfcfe',
              transparent: true,
              opacity: 0.42,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          )
          focusPlate.rotation.x = -Math.PI / 2
          focusPlate.position.set(focusOrigin.x, 0.005, focusOrigin.z)
          scene.add(focusPlate)

          const { grid, material: gridMaterial } = makePlanningGrid(tableRadius, 52, '#d7e1e8')
          grid.position.set(focusOrigin.x, 0, focusOrigin.z)
          scene.add(grid)
          const halo = new THREE.Mesh(
            new THREE.RingGeometry(160, 420, 96),
            new THREE.MeshBasicMaterial({
              color: '#e5a965',
              transparent: true,
              opacity: 0.02,
              side: THREE.DoubleSide,
            }),
          )
          halo.rotation.x = -Math.PI / 2
          halo.position.set(focusOrigin.x, 0.03, focusOrigin.z)
          scene.add(halo)

          const pickables = []
          const boundarySurfaceMaterials = []
          const boundaryMaterials = []
          const roadMaterials = []
          const greenBlueMaterials = []
          const buildingFillMaterials = []
          const buildingEdgeMaterials = []
          const markerMeshes = []
          const fidelityTargets = []
          const fidelityCollections = {
            roads: [],
            contextRoads: [],
            greenBlue: [],
            buildings: [],
            contextBuildings: [],
            bimAssets: [],
            civic: [],
            mobility: [],
            wasteSeeds: [],
            commerce: [],
            places: [],
          }
          const detailState = {
            fidelity: 0.62,
          }
          const queryFirstScene = true
          const raycaster = new THREE.Raycaster()
          const pointer = new THREE.Vector2()
          let viewportRefreshTimer = null
          let viewportRefreshSeq = 0
          let activeQuerySelection = false
          const groups = {
            boundarySurface: new THREE.Group(),
            boundary: new THREE.Group(),
            roads: new THREE.Group(),
            contextRoads: new THREE.Group(),
            buildings: new THREE.Group(),
            contextBuildings: new THREE.Group(),
            bimAssets: new THREE.Group(),
            greenBlue: new THREE.Group(),
            places: new THREE.Group(),
            mobility: new THREE.Group(),
            civic: new THREE.Group(),
            commerce: new THREE.Group(),
            wasteSeeds: new THREE.Group(),
          }
          Object.values(groups).forEach((group) => scene.add(group))

          function removeFromArray(array, value) {
            const index = array.indexOf(value)
            if (index >= 0) array.splice(index, 1)
          }

          function removeMatching(array, predicate) {
            for (let index = array.length - 1; index >= 0; index -= 1) {
              if (predicate(array[index])) array.splice(index, 1)
            }
          }

          function clearSceneGroup(key) {
            const group = groups[key]
            if (!group) return
            const removedObjects = new Set()
            const removedMaterials = new Set()
            group.traverse((object) => {
              removedObjects.add(object)
              removeFromArray(pickables, object)
              if (object.geometry?.dispose) object.geometry.dispose()
              if (Array.isArray(object.material)) {
                object.material.forEach((material) => {
                  if (!material) return
                  removedMaterials.add(material)
                  material.dispose?.()
                })
              } else {
                if (object.material) {
                  removedMaterials.add(object.material)
                  object.material.dispose?.()
                }
              }
            })
            group.clear()
            if (fidelityCollections[key]) fidelityCollections[key] = []
            removeMatching(fidelityTargets, ({ object }) => removedObjects.has(object))
            removeMatching(markerMeshes, ({ mesh }) => removedObjects.has(mesh))
            ;[roadMaterials, greenBlueMaterials, buildingFillMaterials, buildingEdgeMaterials].forEach((materials) => {
              removeMatching(materials, (material) => removedMaterials.has(material))
            })
          }

          function addPickable(object, properties, meta) {
            object.userData = { properties, meta }
            pickables.push(object)
            return object
          }

          function featureLabel(feature, fallback = 'Viewport object') {
            const properties = feature?.properties || {}
            return properties.label || properties.name || properties.id || properties.stableId || fallback
          }

          function addRoadFeature(feature, index, total, origin) {
            const points = scenePointsFromCoordinates(feature?.geometry?.coordinates || [], origin.lon, origin.lat)
            if (points.length < 2) return
            const line = makeLine(points, '#73889b', 0.08, { opacity: 0.7 })
            if (!line) return
            addPickable(line, {
              ...(feature.properties || {}),
              label: featureLabel(feature, 'Road segment'),
            }, layerMeta.roads)
            roadMaterials.push(line.material)
            groups.roads.add(line)
            registerFidelityEntry('roads', line, index, total, 0.08, 0.88)
          }

          function addGreenBlueFeature(feature, index, total, origin) {
            const properties = feature?.properties || {}
            const isWater = properties.category === 'waterway' || properties.category === 'water'
            if (feature?.geometry?.type === 'LineString') {
              const points = scenePointsFromCoordinates(feature.geometry.coordinates || [], origin.lon, origin.lat)
              const line = makeLine(points, isWater ? '#77b8da' : '#7bad7c', 0.06, { opacity: 0.5 })
              if (!line) return
              greenBlueMaterials.push(line.material)
              groups.greenBlue.add(line)
              registerFidelityEntry('greenBlue', line, index, total, 0.3, 0.95)
              return
            }
            const ring = feature?.geometry?.coordinates?.[0] || []
            const points = scenePointsFromCoordinates(ring, origin.lon, origin.lat)
            if (points.length < 3) return
            const outline = makeLine([...points, points[0]], isWater ? '#8dbad4' : '#9ebf9f', 0.05, {
              opacity: 0.38,
              depthTest: false,
            })
            if (!outline) return
            greenBlueMaterials.push(outline.material)
            groups.greenBlue.add(outline)
            registerFidelityEntry('greenBlue', outline, index, total, 0.3, 0.95)
          }

          function addBuildingFeature(feature, index, total, origin) {
            const ring = feature?.geometry?.coordinates?.[0] || []
            const points = scenePointsFromCoordinates(ring, origin.lon, origin.lat)
            const box = polygonBoxFromPoints(points, feature?.properties?.height || feature?.properties?.height_m || 8)
            if (!box) return
            const geometry = new THREE.BoxGeometry(box.width, box.height, box.depth)
            const mesh = new THREE.Mesh(
              geometry,
              new THREE.MeshStandardMaterial({
                color: '#d9e2ea',
                roughness: 0.78,
                metalness: 0.02,
                transparent: true,
                opacity: 1,
                emissive: '#f4f8fb',
                emissiveIntensity: 0.03,
              }),
            )
            mesh.position.set(box.x, box.height / 2, box.z)
            addPickable(mesh, {
              ...(feature.properties || {}),
              label: featureLabel(feature, 'Building'),
              height_m: box.height,
            }, layerMeta.buildings)
            groups.buildings.add(mesh)
            buildingFillMaterials.push(mesh.material)

            const edges = new THREE.LineSegments(
              new THREE.EdgesGeometry(geometry),
              new THREE.LineBasicMaterial({ color: '#8a9fb2', transparent: true, opacity: 0.94, depthTest: false }),
            )
            edges.position.copy(mesh.position)
            groups.buildings.add(edges)
            buildingEdgeMaterials.push(edges.material)
            registerFidelityEntry('buildings', [mesh, edges], index, total, 0.08, 0.95)
          }

          function addPointFeature(feature, index, total, origin) {
            const [lon, lat] = feature?.geometry?.coordinates || []
            const point = projectPoint(lon, lat, origin.lon, origin.lat)
            if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return
            const key = feature?.properties?.layerKey === 'places' ? 'places' : logicalFacilityLayer(feature)
            const definition = layerMeta[key] || layerMeta.places
            const configs = {
              civic: { geometry: new THREE.SphereGeometry(2.6, 16, 16), color: '#14b8a6', emissive: '#115e59', y: 3.4, maxScale: 2.1 },
              mobility: { geometry: new THREE.CylinderGeometry(1.8, 1.8, 6.4, 12), color: '#3b82f6', emissive: '#1d4ed8', y: 3.2, maxScale: 2.2 },
              wasteSeeds: { geometry: new THREE.BoxGeometry(3.2, 4.2, 3.2), color: '#f97316', emissive: '#92400e', y: 2.1, maxScale: 2.35 },
              commerce: { geometry: new THREE.TorusKnotGeometry(1.4, 0.45, 64, 12), color: '#a855f7', emissive: '#7e22ce', y: 3.8, maxScale: 2.2 },
              places: { geometry: new THREE.OctahedronGeometry(3.1, 0), color: '#ec4899', emissive: '#831843', y: 6, maxScale: 1.9 },
            }
            const config = configs[key] || configs.commerce
            const mesh = new THREE.Mesh(
              config.geometry,
              new THREE.MeshStandardMaterial({
                color: config.color,
                roughness: 0.18,
                metalness: 0.16,
                emissive: config.emissive,
                emissiveIntensity: 0.45,
              }),
            )
            mesh.position.set(point.x, config.y, point.z)
            addPickable(mesh, {
              ...(feature.properties || {}),
              label: featureLabel(feature, definition?.label || 'Feature'),
            }, definition)
            groups[key].add(mesh)
            markerMeshes.push({ mesh, baseScale: 1, minScale: 1, maxScale: config.maxScale })
            registerFidelityEntry(key, mesh, index, total, key === 'places' ? 0.48 : 0.12, key === 'places' ? 1 : 0.86)
          }

          function rebuildSceneFromViewport(geojson, origin) {
            const features = geojson?.features || []
            const buckets = {
              roads: [],
              buildings: [],
              greenBlue: [],
              points: [],
            }
            features.forEach((feature) => {
              const layerKey = feature?.properties?.layerKey || feature?.properties?.queryLayerKey || feature?.properties?.featureType
              const geometryType = feature.geometry?.type
              if (layerKey === 'roads' && (geometryType === 'LineString' || geometryType === 'MultiLineString')) buckets.roads.push(feature)
              else if (layerKey === 'buildings' && (geometryType === 'Polygon' || geometryType === 'MultiPolygon')) buckets.buildings.push(feature)
              else if (layerKey === 'greenBlue') buckets.greenBlue.push(feature)
              else if (layerKey === 'facilities' || layerKey === 'places' || layerKey === 'civic' || layerKey === 'mobility' || layerKey === 'commerce' || layerKey === 'wasteSeeds') buckets.points.push(feature)
            })

            ;['roads', 'contextRoads', 'buildings', 'contextBuildings', 'greenBlue', 'civic', 'mobility', 'commerce', 'wasteSeeds', 'places'].forEach(clearSceneGroup)
            buckets.roads.forEach((feature, index) => addRoadFeature(feature, index, buckets.roads.length, origin))
            buckets.buildings.forEach((feature, index) => addBuildingFeature(feature, index, buckets.buildings.length, origin))
            buckets.greenBlue.forEach((feature, index) => addGreenBlueFeature(feature, index, buckets.greenBlue.length, origin))
            buckets.points.forEach((feature, index) => addPointFeature(feature, index, buckets.points.length, origin))

            Object.entries(visibleState).forEach(([key, visible]) => setLayerVisibility(key, visible))
            updateDetailPresence(detailState.fidelity)
            applyDistanceStyling()
          }

          function applyQuerySelection(geojson, summary = {}) {
            activeQuerySelection = true
            window.clearTimeout(viewportRefreshTimer)
            viewportRefreshSeq += 1
            rebuildSceneFromViewport(geojson, payload.center)
            const queryBox = buildBoxForKeys(
              groups,
              visibleKeysFor(['roads', 'buildings', 'greenBlue', 'civic', 'mobility', 'commerce', 'wasteSeeds', 'places']),
            ) || buildBoxForKeys(groups, ['boundary'])
            focusCamera(camera, controls, queryBox, 'district')
            broadcast('twin:viewport', {
              mode: 'semantic-query',
              label: String(Number(summary?.returned ?? geojson?.features?.length ?? 0).toLocaleString('en-US')) + ' query results',
              returned: Number(summary?.returned ?? geojson?.features?.length ?? 0),
              truncated: Boolean(summary?.truncated),
            })
          }

          async function refreshViewportObjects() {
            if (activeQuerySelection) return
            const center = unprojectPoint(controls.target.x, controls.target.z, payload.center.lon, payload.center.lat)
            const distance = camera.position.distanceTo(controls.target)
            const radiusMeters = clamp(distance * 1.25, 450, 3600)
            const latDelta = radiusMeters / 110540
            const lonDelta = radiusMeters / (111320 * Math.cos((center.lat * Math.PI) / 180))
            const sequence = ++viewportRefreshSeq
            const params = new URLSearchParams()
            params.set('bbox', [
              Math.max(-180, center.lon - lonDelta).toFixed(6),
              Math.max(-90, center.lat - latDelta).toFixed(6),
              Math.min(180, center.lon + lonDelta).toFixed(6),
              Math.min(90, center.lat + latDelta).toFixed(6),
            ].join(','))
            params.set('layers', 'roads,buildings,greenBlue,facilities,places')
            params.set('limit', String(clamp(Math.round(900 + distance * 1.2), 1200, 4200)))
            const response = await fetch(liveFeaturesEndpoint(payload.city?.id || '${cityId}') + '?' + params.toString(), {
              credentials: 'same-origin',
            })
            if (!response.ok) return
            const viewport = await response.json()
            if (sequence !== viewportRefreshSeq || !viewport?.geojson) return
            rebuildSceneFromViewport(viewport.geojson, payload.center)
            broadcast('twin:viewport', {
              cityId: viewport.cityId,
              bbox: viewport.bbox,
              returned: viewport.returned,
              truncated: viewport.truncated,
            })
          }

          function scheduleViewportRefresh(delay = 260, options = {}) {
            if (activeQuerySelection && !options.force) return
            window.clearTimeout(viewportRefreshTimer)
            viewportRefreshTimer = window.setTimeout(() => {
              refreshViewportObjects().catch(() => {})
            }, delay)
          }

          function clearDynamicQueryScene() {
            activeQuerySelection = false
            window.clearTimeout(viewportRefreshTimer)
            viewportRefreshSeq += 1
            ;[
              'roads',
              'contextRoads',
              'buildings',
              'contextBuildings',
              'greenBlue',
              'civic',
              'mobility',
              'commerce',
              'wasteSeeds',
              'places',
            ].forEach(clearSceneGroup)
            updateDetailPresence(detailState.fidelity)
            applyDistanceStyling()
            broadcast('twin:viewport', {
              mode: 'query-idle',
              label: 'No query loaded',
              returned: 0,
              truncated: false,
            })
          }

          function registerFidelityTarget(object, index, total, min = 0.08, max = 1) {
            const threshold =
              total <= 1
                ? min
                : min + (index / Math.max(total - 1, 1)) * Math.max(max - min, 0)
            fidelityTargets.push({ object, threshold })
            object.userData = object.userData || {}
            object.userData.__fidelityAllowed = true
            object.userData.__fidelityThreshold = threshold
            return threshold
          }

          function registerFidelityEntry(collectionKey, objects, index, total, min = 0.08, max = 1) {
            const entry = Array.isArray(objects) ? objects : [objects]
            const anchor = entry[0]
            const threshold = registerFidelityTarget(anchor, index, total, min, max)
            entry.slice(1).forEach((object) => {
              fidelityTargets.push({ object, threshold })
              object.userData = object.userData || {}
              object.userData.__fidelityAllowed = true
              object.userData.__fidelityThreshold = threshold
            })
            if (fidelityCollections[collectionKey]) {
              fidelityCollections[collectionKey].push({ entry, threshold })
            }
          }

          function updateCollectionPresence(collectionKey, options = {}) {
            const entries = fidelityCollections[collectionKey] || []
            if (!entries.length) return
            const start = options.start ?? 0.12
            const floor = options.floor ?? 0
            const curve = options.curve ?? 1
            const span = clamp((detailState.fidelity - start) / Math.max(1 - start, 0.001), 0, 1)
            const ratio = floor + (1 - floor) * Math.pow(span, curve)
            const visibleCount = Math.max(0, Math.min(entries.length, Math.round(entries.length * ratio)))
            entries.forEach(({ entry }, index) => {
              const allowed = index < visibleCount
              entry.forEach((object) => {
                object.userData = object.userData || {}
                object.userData.__fidelityAllowed = allowed
              })
            })
          }

          function updateDetailPresence(nextFidelity) {
            detailState.fidelity = clamp(nextFidelity, 0.12, 1)
            updateCollectionPresence('roads', { start: 0.12, floor: 0.02, curve: 1.15 })
            updateCollectionPresence('buildings', { start: 0.12, floor: 0.02, curve: 1.18 })
            updateCollectionPresence('bimAssets', { start: 0.12, floor: 0.16, curve: 1.05 })
            updateCollectionPresence('greenBlue', { start: 0.26, floor: 0.02, curve: 1.25 })
            updateCollectionPresence('contextRoads', { start: 0.48, floor: 0, curve: 1.4 })
            updateCollectionPresence('contextBuildings', { start: 0.58, floor: 0, curve: 1.55 })
            updateCollectionPresence('civic', { start: 0.12, floor: 0.24, curve: 1 })
            updateCollectionPresence('mobility', { start: 0.12, floor: 0.18, curve: 1.05 })
            updateCollectionPresence('wasteSeeds', { start: 0.12, floor: 0.16, curve: 1.05 })
            updateCollectionPresence('commerce', { start: 0.16, floor: 0.1, curve: 1.1 })
            updateCollectionPresence('places', { start: 0.54, floor: 0.03, curve: 1.3 })
          }

          sceneData.boundary.forEach((ring) => {
            const boundarySurface = makePolygonSurface(ring, '#f4f7fa', 0.12, 0.002)
            if (boundarySurface) {
              boundarySurfaceMaterials.push(boundarySurface.material)
              groups.boundarySurface.add(boundarySurface.mesh)
            }
            const base = makeLine(ring, '#d79a54', 0.18, {
              opacity: 0.92,
              depthTest: false,
              renderOrder: 20,
              frustumCulled: false,
            })
            const haloLine = makeLine(ring, '#fff3d4', 0.24, {
              opacity: 0.76,
              depthTest: false,
              renderOrder: 21,
              frustumCulled: false,
            })
            if (base) {
              boundaryMaterials.push(base.material)
              groups.boundary.add(base)
            }
            if (haloLine) {
              boundaryMaterials.push(haloLine.material)
              groups.boundary.add(haloLine)
            }
          })

          if (!queryFirstScene) {
            sceneData.roads.forEach((road, index) => {
              const line = makeLine(road.points, '#73889b', 0.08, { opacity: 0.7 })
              if (line) {
                roadMaterials.push(line.material)
                groups.roads.add(line)
                registerFidelityEntry('roads', line, index, sceneData.roads.length, 0.08, 0.88)
              }
            })

            sceneData.contextRoads.forEach((road, index) => {
              const line = makeLine(road.points, '#b7c5d2', 0.045, {
                opacity: 0.42,
                depthTest: false,
              })
              if (line) {
                roadMaterials.push(line.material)
                groups.contextRoads.add(line)
                registerFidelityEntry('contextRoads', line, index, sceneData.contextRoads.length, 0.34, 1)
              }
            })

            sceneData.greenBlue.forEach((feature, index) => {
              if (feature.shape === 'line') {
                const line = makeLine(feature.points, feature.category === 'waterway' || feature.category === 'water' ? '#77b8da' : '#7bad7c', 0.06, { opacity: 0.5 })
                if (line) {
                  greenBlueMaterials.push(line.material)
                  groups.greenBlue.add(line)
                  registerFidelityEntry('greenBlue', line, index, sceneData.greenBlue.length, 0.3, 0.95)
                }
                return
              }
              const polygonPoints = Array.isArray(feature.points) && feature.points.length >= 3
                ? [...feature.points, feature.points[0]]
                : (
                    Number.isFinite(feature.width) &&
                    Number.isFinite(feature.depth) &&
                    Number.isFinite(feature.x) &&
                    Number.isFinite(feature.z)
                  )
                    ? [
                        { x: feature.x - feature.width / 2, z: feature.z - feature.depth / 2 },
                        { x: feature.x + feature.width / 2, z: feature.z - feature.depth / 2 },
                        { x: feature.x + feature.width / 2, z: feature.z + feature.depth / 2 },
                        { x: feature.x - feature.width / 2, z: feature.z + feature.depth / 2 },
                        { x: feature.x - feature.width / 2, z: feature.z - feature.depth / 2 },
                      ]
                    : null
              if (!polygonPoints) return
              const polygonOutline = makeLine(
                polygonPoints,
                feature.category === 'waterway' || feature.category === 'water' ? '#8dbad4' : '#9ebf9f',
                0.05,
                { opacity: 0.38, depthTest: false },
              )
              if (polygonOutline) {
                greenBlueMaterials.push(polygonOutline.material)
                groups.greenBlue.add(polygonOutline)
                registerFidelityEntry('greenBlue', polygonOutline, index, sceneData.greenBlue.length, 0.3, 0.95)
              }
            })

            sceneData.buildings.forEach((building, index) => {
              const geometry = new THREE.BoxGeometry(building.width, building.height, building.depth)
              const mesh = new THREE.Mesh(
                geometry,
                new THREE.MeshStandardMaterial({
                  color: '#d9e2ea',
                  roughness: 0.78,
                  metalness: 0.02,
                  transparent: true,
                  opacity: 1,
                  emissive: '#f4f8fb',
                  emissiveIntensity: 0.03,
                }),
              )
              mesh.position.set(building.x, building.height / 2, building.z)
              mesh.userData = {
                properties: {
                  ...(building.properties || {}),
                  label: building.label,
                  building: building.building,
                  height_m: building.height,
                },
                meta: layerMeta.buildings,
              }
              pickables.push(mesh)
              groups.buildings.add(mesh)
              buildingFillMaterials.push(mesh.material)

              const edges = new THREE.LineSegments(
                new THREE.EdgesGeometry(geometry),
                new THREE.LineBasicMaterial({ color: '#8a9fb2', transparent: true, opacity: 0.94, depthTest: false }),
              )
              edges.position.copy(mesh.position)
              groups.buildings.add(edges)
              buildingEdgeMaterials.push(edges.material)
              registerFidelityEntry('buildings', [mesh, edges], index, sceneData.buildings.length, 0.08, 0.95)
            })

            sceneData.contextBuildings.forEach((building, index) => {
              const contextHeight = Math.max(1.8, Math.min(building.height * 0.26, 9))
              const geometry = new THREE.BoxGeometry(building.width, contextHeight, building.depth)
              const mesh = new THREE.Mesh(
                geometry,
                new THREE.MeshStandardMaterial({
                  color: '#edf2f6',
                  roughness: 0.94,
                  metalness: 0,
                  transparent: true,
                  opacity: 0.86,
                }),
              )
              mesh.position.set(building.x, contextHeight / 2, building.z)
              groups.contextBuildings.add(mesh)
              buildingFillMaterials.push(mesh.material)

              const edges = new THREE.LineSegments(
                new THREE.EdgesGeometry(geometry),
                new THREE.LineBasicMaterial({
                  color: '#c5d1db',
                  transparent: true,
                  opacity: 0.6,
                  depthTest: false,
                }),
              )
              edges.position.copy(mesh.position)
              groups.contextBuildings.add(edges)
              buildingEdgeMaterials.push(edges.material)
              registerFidelityEntry('contextBuildings', [mesh, edges], index, sceneData.contextBuildings.length, 0.42, 1)
            })
          }

          const bimMaterial = new THREE.MeshStandardMaterial({
            color: '#0f766e',
            roughness: 0.58,
            metalness: 0.08,
            transparent: true,
            opacity: 0.82,
            emissive: '#064e3b',
            emissiveIntensity: 0.14,
            side: THREE.DoubleSide,
          })

          for (const [layerIndex, bimLayer] of bimLayers.entries()) {
            const bundle = bimLayer.nativeGeometry?.meshAssetBundle
            const layerGroup = new THREE.Group()
            layerGroup.name = 'bim-' + (bimLayer.layer?.key || layerIndex)
            const elements = Array.isArray(bundle?.elements) ? bundle.elements : []
            let renderedMeshes = 0
            for (const element of elements) {
              for (const geometryRef of element.geometries ?? []) {
                const mesh = await buildBimMeshFromAsset(
                  payload.city?.id || '${cityId}',
                  bimLayer.layer?.key || bimLayer.layerKey || 'bim',
                  bundle.bundleId,
                  element,
                  geometryRef,
                  bimMaterial,
                )
                if (!mesh) continue
                layerGroup.add(mesh)
                pickables.push(mesh)
                renderedMeshes += 1
              }
            }

            if (renderedMeshes > 0) {
              const box = new THREE.Box3().setFromObject(layerGroup)
              const center = box.getCenter(new THREE.Vector3())
              const size = box.getSize(new THREE.Vector3())
              const maxDim = Math.max(size.x, size.y, size.z, 1)
              const scale = maxDim > 260 ? 260 / maxDim : 1
              layerGroup.scale.setScalar(scale)
              layerGroup.position.set(
                focusOrigin.x - center.x * scale + layerIndex * 34,
                10 - center.y * scale,
                focusOrigin.z - center.z * scale - 42 - layerIndex * 24,
              )
              registerFidelityEntry('bimAssets', layerGroup, layerIndex, Math.max(bimLayers.length, 1), 0.12, 0.94)
            } else {
              const marker = new THREE.Mesh(
                new THREE.CylinderGeometry(5.6, 7.6, 18, 24),
                new THREE.MeshStandardMaterial({
                  color: '#0d9488',
                  roughness: 0.32,
                  metalness: 0.12,
                  emissive: '#115e59',
                  emissiveIntensity: 0.38,
                  transparent: true,
                  opacity: 0.88,
                }),
              )
              marker.position.set(focusOrigin.x + layerIndex * 22, 9, focusOrigin.z - 34 - layerIndex * 22)
              marker.userData = {
                properties: {
                  label: bimLayer.layer?.name || 'IFC BIM layer',
                  payload_type: bimLayer.payloadType,
                  native_geometry_state: bimLayer.nativeGeometry?.state || 'unknown',
                  mesh_asset_state: bundle?.state || 'missing',
                  geometry_reference_count: bundle?.geometryReferenceCount ?? 0,
                },
                meta: layerMeta.bimAssets,
              }
              layerGroup.add(marker)
              pickables.push(marker)
              markerMeshes.push({ mesh: marker, baseScale: 1, minScale: 1, maxScale: 1.8 })
              registerFidelityEntry('bimAssets', marker, layerIndex, Math.max(bimLayers.length, 1), 0.12, 0.94)
            }
            groups.bimAssets.add(layerGroup)
          }

          if (!queryFirstScene) {
            sceneData.civic.forEach((facility, index) => {
              const mesh = new THREE.Mesh(
                new THREE.SphereGeometry(2.6, 16, 16),
                new THREE.MeshStandardMaterial({
                  color: '#14b8a6',
                  roughness: 0.14,
                  metalness: 0.18,
                  emissive: '#115e59',
                  emissiveIntensity: 0.6,
                }),
              )
              mesh.position.set(facility.x, 3.4, facility.z)
              mesh.userData = {
                properties: { label: facility.label, category: facility.category },
                meta: layerMeta.civic,
              }
              pickables.push(mesh)
              groups.civic.add(mesh)
              markerMeshes.push({ mesh, baseScale: 1, minScale: 1, maxScale: 2.1 })
              registerFidelityEntry('civic', mesh, index, sceneData.civic.length, 0.12, 0.7)
            })

            sceneData.mobility.forEach((facility, index) => {
              const mesh = new THREE.Mesh(
                new THREE.CylinderGeometry(1.8, 1.8, 6.4, 12),
                new THREE.MeshStandardMaterial({
                  color: '#3b82f6',
                  roughness: 0.24,
                  metalness: 0.14,
                  emissive: '#1d4ed8',
                  emissiveIntensity: 0.42,
                }),
              )
              mesh.position.set(facility.x, 3.2, facility.z)
              mesh.userData = {
                properties: { label: facility.label, category: facility.category },
                meta: layerMeta.mobility,
              }
              pickables.push(mesh)
              groups.mobility.add(mesh)
              markerMeshes.push({ mesh, baseScale: 1, minScale: 1, maxScale: 2.2 })
              registerFidelityEntry('mobility', mesh, index, sceneData.mobility.length, 0.12, 0.82)
            })

            sceneData.wasteSeeds.forEach((facility, index) => {
              const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(3.2, 4.2, 3.2),
                new THREE.MeshStandardMaterial({
                  color: '#f97316',
                  roughness: 0.28,
                  metalness: 0.08,
                  emissive: '#92400e',
                  emissiveIntensity: 0.46,
                }),
              )
              mesh.position.set(facility.x, 2.1, facility.z)
              mesh.userData = {
                properties: { label: facility.label, category: facility.category },
                meta: layerMeta.wasteSeeds,
              }
              pickables.push(mesh)
              groups.wasteSeeds.add(mesh)
              markerMeshes.push({ mesh, baseScale: 1, minScale: 1, maxScale: 2.35 })
              registerFidelityEntry('wasteSeeds', mesh, index, sceneData.wasteSeeds.length, 0.14, 0.84)
            })

            sceneData.commerce.forEach((facility, index) => {
              const mesh = new THREE.Mesh(
                new THREE.TorusKnotGeometry(1.4, 0.45, 64, 12),
                new THREE.MeshStandardMaterial({
                  color: '#a855f7',
                  roughness: 0.14,
                  metalness: 0.2,
                  emissive: '#7e22ce',
                  emissiveIntensity: 0.48,
                }),
              )
              mesh.position.set(facility.x, 3.8, facility.z)
              mesh.userData = {
                properties: { label: facility.label, category: facility.category },
                meta: layerMeta.commerce,
              }
              pickables.push(mesh)
              groups.commerce.add(mesh)
              markerMeshes.push({ mesh, baseScale: 1, minScale: 1, maxScale: 2.2 })
              registerFidelityEntry('commerce', mesh, index, sceneData.commerce.length, 0.18, 0.9)
            })

            sceneData.places.forEach((place, index) => {
              const mesh = new THREE.Mesh(
                new THREE.OctahedronGeometry(3.1, 0),
                new THREE.MeshStandardMaterial({
                  color: '#ec4899',
                  roughness: 0.08,
                  metalness: 0.18,
                  emissive: '#831843',
                  emissiveIntensity: 0.42,
                }),
              )
              mesh.position.set(place.x, 6, place.z)
              mesh.userData = {
                properties: { label: place.label, category: place.category },
                meta: layerMeta.places,
              }
              pickables.push(mesh)
              groups.places.add(mesh)
              markerMeshes.push({ mesh, baseScale: 1, minScale: 1, maxScale: 1.9 })
              registerFidelityEntry('places', mesh, index, sceneData.places.length, 0.48, 1)
            })
          }

          const visibilityAlias = {
            contextRoads: 'roads',
            contextBuildings: 'buildings',
          }

          function visibleKeysFor(keys) {
            const preferred = keys.filter((key) => visibleState[visibilityAlias[key] || key] !== false)
            return preferred.length ? preferred : keys
          }

          function applyCameraPreset(mode = 'planning') {
            const scopeKeys = ['boundary', 'roads', 'contextRoads', 'buildings', 'contextBuildings', 'bimAssets', 'greenBlue', 'civic', 'mobility', 'commerce', 'wasteSeeds', 'places']
            const contextKeys = ['roads', 'contextRoads', 'buildings', 'contextBuildings', 'bimAssets', 'greenBlue', 'civic', 'mobility', 'commerce', 'wasteSeeds', 'places']
            const districtKeys = ['buildings', 'bimAssets', 'civic', 'mobility', 'commerce', 'wasteSeeds', 'places']
            if (mode === 'planning') {
              const topBox = buildBoxForKeys(groups, visibleKeysFor(districtKeys)) || buildBoxForKeys(groups, ['boundary'])
              focusCamera(camera, controls, topBox, 'planning')
              return
            }
            if (mode === 'scope') {
              focusCamera(camera, controls, buildBoxForKeys(groups, visibleKeysFor(scopeKeys)) || buildBoxForKeys(groups, ['boundary']), 'scope')
              return
            }
            focusCamera(
              camera,
              controls,
              buildBoxForKeys(groups, visibleKeysFor(mode === 'district' ? contextKeys : districtKeys)) ||
                buildBoxForKeys(groups, visibleKeysFor(contextKeys)) ||
                buildBoxForKeys(groups, ['boundary']),
              mode === 'district' ? 'district' : 'oblique',
            )
          }

          function clamp(value, min, max) {
            return Math.min(max, Math.max(min, value))
          }

          function applyDistanceStyling() {
            const distance = camera.position.distanceTo(controls.target)
            const farBlend = clamp((distance - 520) / 1500, 0, 1)
            const effectiveFidelity = clamp(detailState.fidelity, 0.12, 1)

            boundarySurfaceMaterials.forEach((material) => {
              material.opacity = 0.012 + (1 - farBlend) * 0.012
            })
            focusPlate.material.opacity = 0.024 - farBlend * 0.015
            gridMaterial.opacity = 0.08 - farBlend * 0.05
            halo.material.opacity = 0.004 + (1 - farBlend) * 0.008

            boundaryMaterials.forEach((material, index) => {
              material.opacity = index === 0 ? 0.92 + farBlend * 0.06 : 0.72 + farBlend * 0.14
            })
            roadMaterials.forEach((material) => {
              material.opacity = clamp(0.28 + effectiveFidelity * 0.24 + farBlend * 0.16, 0.24, 0.84)
            })
            greenBlueMaterials.forEach((material) => {
              material.opacity = clamp(0.06 + effectiveFidelity * 0.08 + (1 - farBlend) * 0.08, 0.06, 0.32)
            })
            buildingFillMaterials.forEach((material) => {
              material.opacity = clamp(0.66 + effectiveFidelity * 0.2 - farBlend * 0.1, 0.52, 0.92)
              material.emissiveIntensity = 0.02 + farBlend * 0.02
            })
            buildingEdgeMaterials.forEach((material) => {
              material.opacity = clamp(0.64 + effectiveFidelity * 0.16 + farBlend * 0.08, 0.56, 0.96)
            })
            markerMeshes.forEach(({ mesh, baseScale, minScale, maxScale }) => {
              const scale = clamp(baseScale + farBlend * 0.84 + (effectiveFidelity - 0.5) * 0.9, minScale, maxScale)
              mesh.scale.setScalar(scale)
            })

            fidelityTargets.forEach(({ object, threshold }) => {
              object.visible =
                object.userData?.__fidelityAllowed !== false &&
                effectiveFidelity >= threshold
            })

            groups.places.visible = Boolean(visibleState.places) && distance < 2100
          }

          const controlRoot = document.getElementById('scene-controls')
          const controlDefinitions = [
            ...payload.inventory.layerDefinitions,
            ...(bimLayers.length ? [layerMeta.bimAssets] : []),
          ]
          controlRoot.innerHTML = controlDefinitions
            .filter((definition) => definition.key !== 'center')
            .map((definition) =>
              '<label class="layer-row">' +
                '<input type="checkbox" data-layer="' + esc(definition.key) + '" ' + (visibleState[definition.key] ? 'checked' : '') + ' />' +
                '<div><strong>' + esc(definition.label) + '</strong><small>' + esc(definition.description) + '</small><span class="layer-badge"><span class="swatch" style="background:' + esc(definition.color) + '"></span>' + esc(definition.renderedCount ?? definition.count) + ' rendered / ' + esc(definition.discoveredCount ?? definition.count) + ' discovered</span></div>' +
              '</label>'
            ).join('')

          function setLayerVisibility(key, visible) {
            if (!groups[key]) return
            visibleState[key] = Boolean(visible)
            groups[key].visible = visibleState[key]
            if (key === 'roads' && groups.contextRoads) {
              groups.contextRoads.visible = visibleState[key]
            }
            if (key === 'buildings' && groups.contextBuildings) {
              groups.contextBuildings.visible = visibleState[key]
            }
            const input = controlRoot.querySelector('input[data-layer="' + key + '"]')
            if (input) {
              input.checked = visibleState[key]
            }
          }

          function syncState() {
            broadcast('twin:state', { layers: visibleState })
          }

          controlRoot.querySelectorAll('input[type="checkbox"]').forEach((input) => {
            input.addEventListener('change', (event) => {
              const key = event.target.getAttribute('data-layer')
              setLayerVisibility(key, Boolean(event.target.checked))
              syncState()
            })
          })

          const cameraControls = document.getElementById('camera-controls')
          cameraControls.innerHTML = [
            '<button type="button" data-view="planning" class="is-active">Municipal view</button>',
            '<button type="button" data-view="district">District focus</button>',
            '<button type="button" data-view="scope">Full scope</button>',
            '<button type="button" data-view="oblique">Oblique</button>',
            '<button type="button" data-view="fullscreen">Fullscreen</button>',
          ].join('')

          cameraControls.querySelectorAll('button').forEach((button) => {
            button.addEventListener('click', (event) => {
              cameraControls.querySelectorAll('button').forEach((item) => item.classList.remove('is-active'))
              const mode = event.currentTarget.getAttribute('data-view')
              if (mode === 'fullscreen') {
                document.querySelector('.scene-stage')?.requestFullscreen?.()
                cameraControls.querySelector('[data-view="oblique"]')?.classList.add('is-active')
              } else {
                event.currentTarget.classList.add('is-active')
                applyCameraPreset(mode)
              }
              controls.update()
            })
          })

          renderer.domElement.addEventListener('pointerdown', (event) => {
            const rect = renderer.domElement.getBoundingClientRect()
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
            raycaster.setFromCamera(pointer, camera)
            const hits = raycaster.intersectObjects(pickables, false)
            const hit = hits[0]
            if (!hit?.object?.userData) {
              return
            }
            renderAndBroadcastSelection(hit.object.userData.properties, hit.object.userData.meta)
          })

          window.addEventListener('message', (event) => {
            const message = event.data ?? {}
            if (message.source !== 'twin-dashboard' || message.viewer !== viewerId) return

            if (message.type === 'twin:set-visible-layers') {
              Object.entries(message.layers ?? {}).forEach(([key, visible]) => {
                setLayerVisibility(key, Boolean(visible))
              })
              syncState()
            }

            if (message.type === 'twin:set-fidelity') {
              updateDetailPresence(Number(message.value) || 0.62)
              applyDistanceStyling()
            }

            if (message.type === 'twin:set-semantic-query') {
              if (message.geojson) {
                applyQuerySelection(message.geojson, message.summary)
              }
            }

            if (message.type === 'twin:clear-semantic-query') {
              clearDynamicQueryScene()
            }

            if (message.type === 'twin:command') {
              const command = message.command ?? {}
              if (command.kind === 'cameraPreset') {
                applyCameraPreset(command.value)
              }
            }
          })

          function resize() {
            const width = container.clientWidth || 900
            const height = container.clientHeight || 740
            renderer.setSize(width, height)
            camera.aspect = width / height
            camera.updateProjectionMatrix()
          }

          window.addEventListener('resize', resize)
          resize()
          updateDetailPresence(detailState.fidelity)
          Object.entries(visibleState).forEach(([key, visible]) => {
            setLayerVisibility(key, visible)
          })
          applyCameraPreset('planning')
          applyDistanceStyling()
          loadViewerShareQueryResult({
            cityId: payload.city?.id || '${cityId}',
            surface: 'municipal3d',
            viewerId,
            metadata: { runtime: 'three' },
          }).then((result) => {
            if (result?.geojson) {
              applyQuerySelection(result.geojson, result.summary)
              return
            }
            clearDynamicQueryScene()
          }).catch(() => {
            clearDynamicQueryScene()
          })
          controls.addEventListener?.('end', () => {
            if (!activeQuerySelection) {
              broadcast('twin:viewport', {
                mode: 'query-idle',
                label: 'No query loaded',
                returned: 0,
                truncated: false,
              })
            }
          })
          renderer.render(scene, camera)
          broadcast('twin:ready', { layers: visibleState })
          syncState()

          function animate() {
            requestAnimationFrame(animate)
            controls.update()
            applyDistanceStyling()
            renderer.render(scene, camera)
          }
          animate()
        }).catch((error) => {
          document.querySelector('.canvas-wrap').innerHTML = '<div class="floating-note"><strong>Could not load the live 3D scene.</strong><p class="hint">' + esc(error.message) + '</p></div>'
          broadcast('twin:error', { error: String(error?.message || 'SCENE_3D_LOAD_FAILED') })
        })
      </script>
  `
}
