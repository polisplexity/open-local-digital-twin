export function renderMapLibreSelectionRuntime() {
  return `
        function popupHtml(feature) {
          const props = feature?.properties || {}
          const layerKey = props.layerKey || props.layerkey || 'feature'
          const meta = featureMeta(layerKey)
          const label = props.label || meta.label || layerKey
          const category = props.category || props.highway || props.featureType || props.featuretype || layerKey
          const status = props.sourceCoverageStatus || props.authorityStatus || props.authoritystatus || 'open-data'
          return (
            '<div class="map-popup">' +
              '<span class="map-popup__title">' + esc(label) + '</span>' +
              '<div class="map-popup__meta">' + esc(meta.label || layerKey) + '</div>' +
              '<div class="map-popup__meta">' + esc(category) + '</div>' +
              '<div class="map-popup__meta">' + esc(status) + '</div>' +
            '</div>'
          )
        }

        function broadcastSelection(feature) {
          const props = feature?.properties || {}
          const layerKey = props.layerKey || props.layerkey || 'feature'
          broadcast('twin:selection', {
            selection: {
              properties: props,
              meta: featureMeta(layerKey),
            },
          })
        }


  `
}
