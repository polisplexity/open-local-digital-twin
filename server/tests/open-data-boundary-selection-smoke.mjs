import assert from 'node:assert/strict'
import { selectNominatimBoundaryCandidate } from '../services/baseTwin/openDataFetchers.mjs'

const gaziantepLikeResults = [
  {
    osm_type: 'node',
    osm_id: 26487670,
    category: 'place',
    type: 'city',
    display_name: 'Gaziantep, Sahinbey, Gaziantep, Turkey',
    importance: 0.59,
    geojson: { type: 'Point', coordinates: [37.3792617, 37.0628317] },
  },
  {
    osm_type: 'relation',
    osm_id: 223139,
    category: 'boundary',
    type: 'administrative',
    display_name: 'Gaziantep, Southeastern Anatolia Region, Turkey',
    importance: 0.57,
    geojson: {
      type: 'Polygon',
      coordinates: [
        [
          [37.1, 37.0],
          [37.2, 37.0],
          [37.2, 37.1],
          [37.1, 37.1],
          [37.1, 37.0],
        ],
      ],
    },
  },
]

const selected = selectNominatimBoundaryCandidate(gaziantepLikeResults)

assert.equal(selected?.osm_type, 'relation')
assert.equal(selected?.osm_id, 223139)
assert.equal(selected?.geojson?.type, 'Polygon')

console.log(JSON.stringify({
  ok: true,
  selectedOsmType: selected.osm_type,
  selectedOsmId: selected.osm_id,
  selectedGeojsonType: selected.geojson.type,
}))
