import { getStreetImageryConfig } from '../config'
import { fetchMvt, pointLngLat, type MvtLayers } from './fetchMvt'
import type { Bbox, TileCoord } from './model'
import { collectSettledTiles, fetchTileCached, getTileCacheKey } from './tileCache'
import { tilesForBbox } from './tileMath'

export { pointLngLat }

export const MAPILLARY_TILE_ZOOM = 14

export const mapillaryTileUrl = (path: string, tile: TileCoord) => {
  const token = getStreetImageryConfig().mapillaryToken
  return `https://tiles.mapillary.com/maps/vtp/${path}/2/${tile.z}/${tile.x}/${tile.y}?access_token=${token}`
}

/** Tile URL template (`{z}`, `{x}`, `{y}`) for a MapLibre `vector` source. */
export const mapillaryTileUrlTemplate = (path: string) => {
  const token = getStreetImageryConfig().mapillaryToken
  return `https://tiles.mapillary.com/maps/vtp/${path}/2/{z}/{x}/{y}?access_token=${token}`
}

const countMvtFeatures = (layers: MvtLayers) =>
  Object.values(layers).reduce((sum, features) => sum + features.length, 0)

export const fetchMapillaryMvtTiles = async (
  cachePrefix: string,
  path: string,
  bbox: Bbox,
  signal: AbortSignal,
  /** Decode only these layers; each set gets its own cache entry. */
  layerNames?: string[],
) => {
  const tiles = tilesForBbox(bbox, MAPILLARY_TILE_ZOOM, { skipNullIsland: true })
  return collectSettledTiles(
    tiles.map((tile) => {
      const prefix = layerNames ? `${cachePrefix}:${layerNames.join(',')}` : cachePrefix
      const key = getTileCacheKey(prefix, tile)
      return fetchTileCached(
        key,
        (innerSignal) => fetchMvt(mapillaryTileUrl(path, tile), tile, innerSignal, layerNames),
        signal,
        countMvtFeatures,
      )
    }),
  )
}
