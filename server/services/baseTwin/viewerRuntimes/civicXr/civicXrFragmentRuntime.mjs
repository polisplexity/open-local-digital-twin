export function renderCivicXrFragmentRuntime() {
  return `
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
          broadcastCivicVisualState({
            xrFragments: activeFragmentWorkspace,
            xrFragmentCount: activeFragmentWorkspace.length,
            renderPolicy: renderPolicyForMode(activeExperienceMode),
          })
        }
  `
}
