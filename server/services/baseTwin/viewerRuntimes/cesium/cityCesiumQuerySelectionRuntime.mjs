export function renderCityCesiumQuerySelectionRuntime() {
  return String.raw`        function removeQueryDataSources() {
          if (!viewer?.dataSources) {
            queryDataSource = null
            return
          }
          const staleSources = []
          for (let index = 0; index < viewer.dataSources.length; index += 1) {
            const dataSource = viewer.dataSources.get(index)
            if (dataSource?.name === 'semantic-query') staleSources.push(dataSource)
          }
          staleSources.forEach((dataSource) => viewer.dataSources.remove(dataSource, true))
          queryDataSource = null
        }

        function clearQuerySelection() {
          activeQuerySelection = null
          activeCameraFocusBounds = null
          boundedCameraState = null
          removeQueryDataSources()
          if (phenomenaMode !== 'off') renderPhenomenaLayer({ fit: false })
          setStatus('No query loaded')
          broadcast('twin:viewport', {
            mode: 'idle',
            label: 'No 3D query loaded',
            returned: 0,
            truncated: false,
          })
          viewer.scene.requestRender()
        }

        function applyQuerySelection(message = {}) {
          const primitiveFeatures = getPrimitiveFeatures(message.primitives)
          const features = primitiveFeatures.length
            ? primitiveFeatures.map(featureFromPrimitive).filter(Boolean)
            : getFeatures(message.geojson || featureCollection([]))
          activeQuerySelection = message
          removeQueryDataSources()
          queryDataSource = new CesiumLib.CustomDataSource('semantic-query')
          viewer.dataSources.add(queryDataSource)

          let rendered = 0
          features.forEach((feature) => {
            const layerKey = layerKeyForFeature(feature)
            rendered += addGeometry(queryDataSource, feature, layerKey)
          })
          applySceneVisualTheme()

          const returned = Number(message.summary?.returned ?? features.length ?? rendered)
          const selected = Number(message.summary?.resultCount ?? returned)
          const truncated = Boolean(message.summary?.truncated || (Number.isFinite(selected) && selected > rendered))
          setStatus(String(rendered) + ' rendered / ' + String(Number.isFinite(selected) ? selected : returned) + ' selected' + (truncated ? ' +' : ''))
          broadcast('twin:viewport', {
            mode: 'semantic-query',
            label: String(rendered) + ' 3D features rendered' + (truncated ? ' +' : ''),
            returned,
            rendered,
            resultCount: Number.isFinite(selected) ? selected : rendered,
            truncated,
          })
          fitQuerySelection(message, message.geojson || featureCollection([]))
          if (phenomenaMode !== 'off') queuePhenomenaMode(phenomenaMode)
          viewer.scene.requestRender()
        }

        async function applyInitialSharedQuery() {
          const shareKey = currentViewerShareKey()
          if (!shareKey) {
            broadcast('twin:viewport', {
              mode: 'idle',
              label: 'No 3D query loaded',
              returned: 0,
              truncated: false,
            })
            return
          }

          try {
            setStatus('Loading shared query')
            const result = await loadViewerShareQueryResult({
              cityId,
              surface: 'municipal3d',
              viewerId,
              metadata: { runtime: 'cesium' },
            })
            if (result?.query) {
              applyQuerySelection(result)
              return
            }
            clearQuerySelection()
          } catch (error) {
            broadcast('twin:error', { error: String(error?.message || 'VIEWER_SHARE_QUERY_FAILED') })
            clearQuerySelection()
          }
        }`
}
