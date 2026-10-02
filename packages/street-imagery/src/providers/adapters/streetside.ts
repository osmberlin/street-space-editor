import { peekStreetImageryConfig } from '../../config'
import type { Bbox, NormalizedPhoto, ProviderAdapter, TileCoord } from '../model'
import { collectSettledTiles, fetchTileCached, getTileCacheKey } from '../tileCache'
import { tileBbox, tilesForBbox } from '../tileMath'

/** The key from `setStreetImageryConfig({ bingMapsKey })`; without it there is no overlay. */
export const getBingMapsKey = (): string | undefined => peekStreetImageryConfig()?.bingMapsKey

const STREETSIDE_API = 'https://dev.virtualearth.net/REST/v1/Imagery/MetaData/Streetside'
const TILE_ZOOM = 16
const MAX_RESULTS = 500

const DEFAULT_SUBDOMAINS = ['t0', 't1', 't2', 't3']

export type StreetsideBubble = {
  id?: string
  imageUrl?: string
  imageUrlSubdomains?: string[]
  lon?: number
  longitude?: number
  lat?: number
  latitude?: number
  he?: number
  heading?: number
  vintageEnd?: string
}

type StreetsideResponse = {
  resourceSets?: Array<{
    resources?: StreetsideBubble[]
  }>
}

export const parseStreetsideDate = (value: unknown): number | null => {
  if (typeof value !== 'string' || value.length === 0) {
    return null
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

export const normalizeStreetsideBubble = (
  bubble: StreetsideBubble,
): Omit<NormalizedPhoto, 'providerId'> | null => {
  const lng = +(bubble.lon ?? bubble.longitude ?? Number.NaN)
  const lat = +(bubble.lat ?? bubble.latitude ?? Number.NaN)
  if (Number.isNaN(lng) || Number.isNaN(lat)) {
    return null
  }

  const photoId = bubble.id ?? bubble.imageUrl
  if (!photoId) {
    return null
  }

  const headingRaw = bubble.he ?? bubble.heading
  const heading = headingRaw == null ? null : +headingRaw

  return {
    photoId,
    sequenceId: null,
    capturedAt: parseStreetsideDate(bubble.vintageEnd),
    isPano: true,
    heading: heading != null && !Number.isNaN(heading) ? heading : null,
    lngLat: [lng, lat],
    thumbUrl: bubble.imageUrl,
    streetside: bubble.imageUrl
      ? {
          urlTemplate: bubble.imageUrl,
          subdomains:
            bubble.imageUrlSubdomains && bubble.imageUrlSubdomains.length > 0
              ? bubble.imageUrlSubdomains
              : DEFAULT_SUBDOMAINS,
        }
      : undefined,
  }
}

const fetchStreetsideTilePhotos = async (
  tile: TileCoord,
  signal: AbortSignal,
): Promise<NormalizedPhoto[]> => {
  const key = getBingMapsKey()
  if (!key) {
    return []
  }
  const [west, south, east, north] = tileBbox(tile)
  const mapArea = `${south},${west},${north},${east}`
  const url = new URL(STREETSIDE_API)
  url.searchParams.set('mapArea', mapArea)
  url.searchParams.set('key', key)
  url.searchParams.set('count', String(MAX_RESULTS))
  url.searchParams.set('uriScheme', 'https')

  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Streetside fetch failed (${response.status})`)
  }

  const data = (await response.json()) as StreetsideResponse
  const bubbles = data.resourceSets?.[0]?.resources ?? []
  const photos: NormalizedPhoto[] = []

  for (const bubble of bubbles) {
    const normalized = normalizeStreetsideBubble(bubble)
    if (normalized) {
      photos.push({ providerId: 'streetside', ...normalized })
    }
  }

  return photos
}

const fetchStreetsideTile = async (tile: TileCoord, signal: AbortSignal) => {
  const key = getTileCacheKey('streetside', tile)
  return fetchTileCached(key, (innerSignal) => fetchStreetsideTilePhotos(tile, innerSignal), signal)
}

const fetchPhotos = async (bbox: Bbox, _zoom: number, signal: AbortSignal) => {
  const tiles = tilesForBbox(bbox, TILE_ZOOM, { skipNullIsland: true })
  const tileResults = await collectSettledTiles(
    tiles.map((tile) => fetchStreetsideTile(tile, signal)),
  )

  const byId = new Map<string, NormalizedPhoto>()
  for (const photos of tileResults) {
    for (const photo of photos) {
      byId.set(photo.photoId, photo)
    }
  }

  return [...byId.values()]
}

export const streetsideAdapter: ProviderAdapter = {
  id: 'streetside',
  kind: 'photo',
  label: 'Bing Streetside',
  color: '#0891B2',
  minZoom: 14,
  fetchPhotos,
}
