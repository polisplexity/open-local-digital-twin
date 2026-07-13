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
          queryRenderSequence += 1
          if (queryRenderTimer) {
            window.clearTimeout(queryRenderTimer)
            queryRenderTimer = null
          }
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
          const allFeatures = primitiveFeatures.length
            ? primitiveFeatures.map(featureFromPrimitive).filter(Boolean)
            : getFeatures(message.geojson || featureCollection([]))
          const renderBudget = Math.max(0, Number(message.query?.render?.viewerRenderBudget ?? CITY3D_QUERY_INTERACTIVE_FEATURE_BUDGET))
          const features = renderBudget > 0 && allFeatures.length > renderBudget
            ? allFeatures.slice(0, renderBudget)
            : allFeatures
          const referenceOnly = Boolean(message.selectionReference) && !allFeatures.length
          activeQuerySelection = message
          queryRenderSequence += 1
          if (queryRenderTimer) {
            window.clearTimeout(queryRenderTimer)
            queryRenderTimer = null
          }
          const renderSequence = queryRenderSequence
          removeQueryDataSources()
          queryDataSource = new CesiumLib.CustomDataSource('semantic-query')
          viewer.dataSources.add(queryDataSource)

          let rendered = 0
          let cursor = 0
          const returned = Number(message.summary?.returned ?? allFeatures.length ?? features.length ?? rendered)
          const selected = Number(message.summary?.resultCount ?? returned)
          const totalSelected = Number.isFinite(selected) ? selected : returned
          const clippedByBudget = features.length < allFeatures.length
          const finishRender = () => {
            if (renderSequence !== queryRenderSequence) return
            applySceneVisualTheme()
            const truncated = Boolean(message.summary?.truncated || clippedByBudget || (Number.isFinite(selected) && selected > rendered))
            setStatus(referenceOnly
              ? String(totalSelected) + ' selected by reference'
              : String(rendered) + ' rendered / ' + String(totalSelected) + ' selected' + (truncated ? ' +' : ''))
            broadcast('twin:viewport', {
              mode: referenceOnly ? 'semantic-query-reference' : 'semantic-query',
              label: referenceOnly
                ? String(totalSelected) + ' 3D features referenced'
                : String(rendered) + ' 3D features rendered' + (truncated ? ' +' : ''),
              returned,
              rendered,
              resultCount: totalSelected,
              renderBudget,
              truncated,
            })
            fitQuerySelection(message, message.geojson || featureCollection([]))
            if (phenomenaMode !== 'off') queuePhenomenaMode(phenomenaMode)
            viewer.scene.requestRender()
          }
          const renderNextBatch = () => {
            if (renderSequence !== queryRenderSequence) return
            const batchEnd = Math.min(features.length, cursor + CITY3D_QUERY_RENDER_BATCH_SIZE)
            for (; cursor < batchEnd; cursor += 1) {
              const feature = features[cursor]
              const layerKey = layerKeyForFeature(feature)
              rendered += addGeometry(queryDataSource, feature, layerKey)
            }
            if (cursor < features.length) {
              setStatus('Rendering 3D selection', String(rendered.toLocaleString('en-US')) + ' / ' + String(features.length.toLocaleString('en-US')) + ' features')
              viewer.scene.requestRender()
              queryRenderTimer = window.setTimeout(renderNextBatch, 0)
              return
            }
            queryRenderTimer = null
            finishRender()
          }
          if (referenceOnly || !features.length) {
            finishRender()
            return
          }
          setStatus('Rendering 3D selection', 'Preparing ' + String(features.length.toLocaleString('en-US')) + ' visible features')
          renderNextBatch()
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
