import { VectorTile } from '@mapbox/vector-tile'
import type { Feature, Point } from 'geojson'
import { PbfReader } from 'pbf'
import type { TileCoord } from './model'

export type MvtLayers = Record<string, Feature[]>

export const pointLngLat = (feature: Feature): [number, number] | null => {
  if (feature.geometry.type !== 'Point') {
    return null
  }
  const [lng, lat] = (feature.geometry as Point).coordinates
  if (lng === undefined || lat === undefined) {
    return null
  }
  return [lng, lat]
}

// Tile coordinates must be passed explicitly: URL parsing is unreliable because
// providers embed other numeric path segments (e.g. Mapillary's `/2/` API version).
export const fetchMvt = async (
  url: string,
  tile: TileCoord,
  signal: AbortSignal,
  /** Decode only these layers. Dense tiles (Mapillary: ~20k images) are expensive to convert. */
  layerNames?: string[],
): Promise<MvtLayers> => {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`MVT fetch failed (${response.status}): ${url}`)
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength === 0) {
    return {}
  }

  const vectorTile = new VectorTile(new PbfReader(buffer))
  const layers: MvtLayers = {}

  for (const layerName of layerNames ?? Object.keys(vectorTile.layers)) {
    const layer = vectorTile.layers[layerName]
    if (!layer) {
      continue
    }

    const features: Feature[] = []
    for (let i = 0; i < layer.length; i += 1) {
      const feature = layer.feature(i)
      features.push(feature.toGeoJSON(tile.x, tile.y, tile.z) as Feature)
    }
    layers[layerName] = features
  }

  return layers
}
