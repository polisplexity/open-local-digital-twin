export function renderCivicXrSelectionRuntime() {
  return `
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
  `
}
