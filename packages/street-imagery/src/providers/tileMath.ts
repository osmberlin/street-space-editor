import type { Bbox, TileCoord } from './model'

export const lonToTileX = (lon: number, z: number): number =>
  Math.floor(((lon + 180) / 360) * 2 ** z)

export const latToTileY = (lat: number, z: number): number => {
  const latRad = (lat * Math.PI) / 180
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * 2 ** z,
  )
}

export const tileToLon = (x: number, z: number): number => (x / 2 ** z) * 360 - 180

export const tileToLat = (y: number, z: number): number => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

export const tileBbox = (tile: TileCoord): Bbox => {
  const west = tileToLon(tile.x, tile.z)
  const east = tileToLon(tile.x + 1, tile.z)
  const north = tileToLat(tile.y, tile.z)
  const south = tileToLat(tile.y + 1, tile.z)
  return [west, south, east, north]
}

export const clampZoom = (zoom: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.floor(zoom)))

type TilesForBboxOptions = {
  skipNullIsland?: boolean
}

/** Null Island guard — skip tiles whose center lies within ~1° of (0, 0). */
export const isNullIslandTile = (tile: TileCoord): boolean => {
  const [west, south, east, north] = tileBbox(tile)
  const centerLon = (west + east) / 2
  const centerLat = (south + north) / 2
  return Math.abs(centerLon) < 1 && Math.abs(centerLat) < 1
}

export const tilesForBbox = (bbox: Bbox, z: number, options?: TilesForBboxOptions): TileCoord[] => {
  const [west, south, east, north] = bbox
  const tileCount = 2 ** z
  let minX = lonToTileX(west, z)
  let maxX = lonToTileX(east, z)
  // MapLibre can report longitudes outside ±180 (wrapped world copies). Wrap x into
  // range; if the span covers the whole world or west > east, use the full x range.
  if (minX > maxX || maxX - minX + 1 >= tileCount) {
    minX = 0
    maxX = tileCount - 1
  }
  const minY = Math.max(0, Math.min(tileCount - 1, latToTileY(north, z)))
  const maxY = Math.max(0, Math.min(tileCount - 1, latToTileY(south, z)))

  const tiles: TileCoord[] = []
  for (let x = minX; x <= maxX; x += 1) {
    const wrappedX = ((x % tileCount) + tileCount) % tileCount
    for (let y = minY; y <= maxY; y += 1) {
      const tile = { z, x: wrappedX, y }
      if (options?.skipNullIsland && isNullIslandTile(tile)) {
        continue
      }
      tiles.push(tile)
    }
  }
  return tiles
}

export const bboxIntersects = (a: Bbox, b: Bbox): boolean =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
