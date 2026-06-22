export function renderMapLibreControlRuntime() {
  return `
        function setLayerVisibility(key, visible) {
          if (!layerAllowed(key)) return
          layerState[key] = Boolean(visible)
        }

        function handleCommand(command) {
          const value = command?.value
          if (command?.kind === 'layerFocus' && value) {
            Object.keys(layerState).forEach((key) => {
              layerState[key] = key === value
            })
            if (value === 'civic' || value === 'mobility' || value === 'commerce' || value === 'wasteSeeds') {
              layerState[value] = true
            }
            updateFixedLayerVisibility()
            scheduleFeatureRebuild('layer focus', 40)
          }
        }

        function visibleRenderedLayerIds() {
          return semanticQueryLayerIds.filter((id) => map.getLayer(id)).concat(
            featureLayerIds.filter((id) => map.getLayer(id)),
            fixedLayerIds.filter((id) => map.getLayer(id)),
          )
        }

        function setupSelection() {
          map.on('click', (event) => {
            const features = map.queryRenderedFeatures(event.point, {
              layers: visibleRenderedLayerIds(),
            })
            const feature = features.find((item) => item?.properties) || null
            if (!feature) {
              broadcast('twin:selection', { selection: null })
              return
            }
            new maplibregl.Popup({ closeButton: true, closeOnClick: true })
              .setLngLat(event.lngLat)
              .setHTML(popupHtml(feature))
              .addTo(map)
            broadcastSelection(feature)
          })
        }

        window.addEventListener('message', (event) => {
          const message = event.data ?? {}
          if (message.source !== 'twin-dashboard' || message.viewer !== viewerId) return

          if (message.type === 'twin:set-visible-layers') {
            const revision = Number(message.revision ?? 0)
            if (revision < layerStateRevision) return
            layerStateRevision = revision
            Object.entries(message.layers ?? {}).forEach(([key, visible]) => {
              setLayerVisibility(key, Boolean(visible))
            })
            updateFixedLayerVisibility()
            scheduleFeatureRebuild('visible layers', 60)
          }

          if (message.type === 'twin:set-layer-controls') {
            Object.entries(message.controls ?? {}).forEach(([key, controls]) => {
              layerControlState[key] = {
                ...(layerControlState[key] ?? {}),
                ...(controls ?? {}),
              }
            })
            scheduleFeatureRebuild('layer controls', 140)
          }

          if (message.type === 'twin:set-city-scale') {
            const scale = message.scale || {}
            const revision = Number(scale.revision ?? 0)
            if (revision < (scaleState.revision ?? 0)) return
            scaleState.revision = revision
            scaleState.coveragePercent = clamp(scale.coveragePercent, 0, 100)
            scaleState.featureLimit = clamp(scale.featureLimit, 0, 300000)
            updateFixedLayerVisibility()
            scheduleFeatureRebuild('city coverage', 80)
          }

          if (message.type === 'twin:set-fidelity') {
            scheduleFeatureRebuild('fidelity', 140)
          }

          if (message.type === 'twin:command') {
            handleCommand(message.command)
          }

          if (message.type === 'twin:set-semantic-query') {
            setSemanticQueryResult(message)
          }

          if (message.type === 'twin:clear-semantic-query') {
            clearSemanticQueryResult()
          }
        })


  `
}
