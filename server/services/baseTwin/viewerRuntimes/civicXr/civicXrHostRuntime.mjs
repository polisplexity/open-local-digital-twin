export function renderCivicXrHostRuntime() {
  return `
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

        function bindHostMessages() {
          window.addEventListener('message', async (event) => {
            const message = event.data || {}
            if (!message || !['twin-host', 'twin-dashboard'].includes(message.source)) return

            if (message.type === 'twin:set-visible-layers') {
              Object.entries(message.layers || {}).forEach(([key, visible]) => setLayerVisibility(key, visible))
            }

            if (message.type === 'twin:set-fidelity') {
              applyFidelity(Number(message.fidelity))
            }

            if (message.type === 'twin:apply-visual-state') {
              const visualState = message.visualState || {}
              Object.entries(visualState.layers || {}).forEach(([key, visible]) => setLayerVisibility(key, visible))
              const mode = visualState.xrMode || visualState.mode
              if (mode) applyExperienceMode(mode, visualState.xrFragments || [])
              applyXrSessionState(visualState.xrSession || visualState.xrSessionState || {})
              applyCivicCameraState(visualState.camera)
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
        }
  `
}
