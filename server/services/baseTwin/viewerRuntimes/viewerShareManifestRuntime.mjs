export function renderViewerShareManifestRuntime() {
  return `
        const viewerQueryFeatureBudgets = {
          map: 300000,
          '3d': 300000,
          immersive: 300000,
        }

        function currentViewerShareKey() {
          const params = new URLSearchParams(window.location.search)
          return String(params.get('shareKey') || params.get('share') || '').trim()
        }

        function viewerShareIntent(viewer) {
          if (viewer === '3d') return 'operations'
          if (viewer === 'immersive') return 'embed'
          return 'analysis'
        }

        function queryManifestFromViewerShare(share) {
          const manifest = share?.manifest || {}
          const queryManifest = manifest.queryManifest || manifest.share?.queryManifest || manifest
          if (queryManifest?.kind !== 'twin-query-manifest' && queryManifest?.kind !== 'twin-query') return null
          return queryManifest
        }

        async function loadViewerShareQueryResult({ cityId, surface, viewerId, metadata = {} } = {}) {
          const shareKey = currentViewerShareKey()
          if (!shareKey) return null
          const cityPath = encodeURIComponent(cityId || 'current')
          const shareResponse = await fetch(
            '/api/live/' + cityPath + '/viewer-share-manifests/' + encodeURIComponent(shareKey),
            { credentials: 'same-origin' },
          )
          const shareResult = await shareResponse.json()
          if (!shareResponse.ok || !shareResult?.ok) {
            throw new Error(shareResult?.error || shareResult?.detail || 'VIEWER_SHARE_MANIFEST_UNAVAILABLE')
          }
          const share = shareResult.share || null
          const queryManifest = queryManifestFromViewerShare(share)
          if (!queryManifest?.query) throw new Error('VIEWER_SHARE_QUERY_MISSING')
          const transport = viewerId === '3d'
            ? 'cesium-primitives'
            : viewerId === 'immersive'
              ? 'scene-manifest'
              : 'mvt'
          const queryPayload = {
            ...queryManifest.query,
            render: {
              ...(queryManifest.query.render && typeof queryManifest.query.render === 'object'
                ? queryManifest.query.render
                : {}),
              mode: queryManifest.query.render?.mode || 'isolate',
              transport,
              maxFeatures: viewerQueryFeatureBudgets[viewerId] ?? viewerQueryFeatureBudgets.immersive,
            },
            surface: surface || queryManifest.surface || share?.surface || 'map',
            intent: queryManifest.query.intent || viewerShareIntent(viewerId),
            shareKey,
            metadata: {
              ...(queryManifest.query.metadata && typeof queryManifest.query.metadata === 'object'
                ? queryManifest.query.metadata
                : {}),
              ...metadata,
              source: 'published-viewer-share-manifest',
              shareKey,
              viewerId,
            },
          }
          const queryResponse = await fetch('/api/live/' + cityPath + '/twin-query', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(queryPayload),
          })
          const queryResult = await queryResponse.json()
          if (!queryResponse.ok || !queryResult?.ok) {
            throw new Error(queryResult?.error || queryResult?.detail || 'VIEWER_SHARE_QUERY_FAILED')
          }
          return {
            ...queryResult,
            share,
            shareKey,
            queryManifest,
            ...(queryResult.geojson ? { geojson: queryResult.geojson } : {}),
          }
        }
  `
}
