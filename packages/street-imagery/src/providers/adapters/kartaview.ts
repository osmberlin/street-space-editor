import type { Bbox, NormalizedPhoto, ProviderAdapter, TileCoord } from '../model'
import { collectSettledTiles, fetchTileCached, getTileCacheKey } from '../tileCache'
import { tileBbox, tilesForBbox } from '../tileMath'

const API_URL = 'https://kartaview.org/1.0/list/nearby-photos/'
const TILE_ZOOM = 14
const RESULTS_PER_PAGE = 1000

export type KartaviewItem = {
  id?: string | number
  sequence_id?: string | number
  sequence_index?: string | number
  name?: string
  lth_name?: string
  heading?: string | number
  shot_date?: string
  date_added?: string
  lat?: string | number
  lng?: string | number
}

// Direct storage URLs (storageN.openstreetcam.org) return 404 nowadays; images are only
// reachable via the KartaView image proxy, which takes the base64-encoded storage URL.
export const kartaviewImageUrl = (imagePath: string): string => {
  const normalizedPath = imagePath.replace(/^\//, '')
  const storageMatch = normalizedPath.match(/^storage(\d+)\/(.*)$/)
  const storageUrl = storageMatch
    ? `https://storage${storageMatch[1]}.openstreetcam.org/${storageMatch[2]}`
    : `https://kartaview.org/${normalizedPath}`
  return `https://cdn.kartaview.org/pr:sharp/${btoa(storageUrl).replace(/=+$/, '')}`
}

type KartaviewResponse = {
  currentPageItems?: KartaviewItem[]
}

export const maxPageAtZoom = (z: number): number => {
  if (z < 15) {
    return 2
  }
  if (z === 15) {
    return 5
  }
  if (z === 16) {
    return 10
  }
  if (z === 17) {
    return 20
  }
  if (z === 18) {
    return 40
  }
  return 80
}

export const parseKartaviewDate = (value: unknown): number | null => {
  if (typeof value !== 'string' || value.length === 0) {
    return null
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

export const normalizeKartaviewItem = (
  item: KartaviewItem,
): Omit<NormalizedPhoto, 'providerId'> | null => {
  const id = item.id
  if (id == null) {
    return null
  }

  const lng = +(item.lng ?? Number.NaN)
  const lat = +(item.lat ?? Number.NaN)
  if (Number.isNaN(lng) || Number.isNaN(lat)) {
    return null
  }

  const headingRaw = item.heading
  const heading =
    headingRaw == null
      ? null
      : typeof headingRaw === 'number'
        ? headingRaw
        : Number.parseFloat(String(headingRaw))

  const sequenceIndexRaw = item.sequence_index
  const sequenceIndex =
    sequenceIndexRaw == null
      ? undefined
      : typeof sequenceIndexRaw === 'number'
        ? sequenceIndexRaw
        : Number.parseInt(String(sequenceIndexRaw), 10)

  // Prefer the large thumbnail (lth) over the full processed image for viewer display.
  const thumbPath = item.lth_name ?? item.name
  const thumbUrl =
    typeof thumbPath === 'string' && thumbPath.length > 0 ? kartaviewImageUrl(thumbPath) : undefined
  const fullUrl =
    typeof item.name === 'string' && item.name.length > 0 ? kartaviewImageUrl(item.name) : undefined

  return {
    photoId: String(id),
    sequenceId: item.sequence_id != null ? String(item.sequence_id) : null,
    sequenceIndex:
      sequenceIndex != null && !Number.isNaN(sequenceIndex) ? sequenceIndex : undefined,
    capturedAt: parseKartaviewDate(item.shot_date ?? item.date_added),
    isPano: null,
    heading: heading != null && !Number.isNaN(heading) ? heading : null,
    lngLat: [lng, lat],
    thumbUrl,
    fullUrl,
  }
}

// The documented bbox params (bbTopLeft/bbBottomRight) now return HTTP 400 from the API;
// only the coordinate+radius form still works, and radius fails above ~1500 m.
const MAX_RADIUS_METERS = 1400

const tileCenterAndRadius = (tile: TileCoord): { lng: number; lat: number; radius: number } => {
  const [west, south, east, north] = tileBbox(tile)
  const lng = (west + east) / 2
  const lat = (south + north) / 2
  const metersPerDegreeLat = 111_320
  const halfHeight = ((north - south) / 2) * metersPerDegreeLat
  const halfWidth = ((east - west) / 2) * metersPerDegreeLat * Math.cos((lat * Math.PI) / 180)
  const radius = Math.ceil(Math.hypot(halfWidth, halfHeight))
  return { lng, lat, radius: Math.min(radius, MAX_RADIUS_METERS) }
}

const fetchKartaviewTilePhotos = async (
  tile: TileCoord,
  maxPages: number,
  signal: AbortSignal,
): Promise<NormalizedPhoto[]> => {
  const [west, south, east, north] = tileBbox(tile)
  const { lng, lat, radius } = tileCenterAndRadius(tile)
  const photos: NormalizedPhoto[] = []

  for (let page = 1; page <= maxPages; page += 1) {
    const body = new URLSearchParams({
      ipp: String(RESULTS_PER_PAGE),
      page: String(page),
      coordinate: `${lat},${lng}`,
      radius: String(radius),
    })

    const response = await fetch(API_URL, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!response.ok) {
      break
    }

    const data = (await response.json()) as KartaviewResponse & {
      status?: { httpCode?: number }
    }
    if (data.status?.httpCode !== 200) {
      break
    }

    const items = data.currentPageItems ?? []

    for (const item of items) {
      const normalized = normalizeKartaviewItem(item)
      if (!normalized) {
        continue
      }
      // The query circle overlaps neighbor tiles; keep only photos inside this tile
      // so aggregating tiles does not duplicate them.
      const [photoLng, photoLat] = normalized.lngLat
      if (photoLng < west || photoLng > east || photoLat < south || photoLat > north) {
        continue
      }
      photos.push({ providerId: 'kartaview', ...normalized })
    }

    if (items.length < RESULTS_PER_PAGE) {
      break
    }
  }

  return photos
}

const fetchKartaviewTile = async (tile: TileCoord, maxPages: number, signal: AbortSignal) => {
  // Page count depends on map zoom, so the cache key must include it — otherwise a
  // tile cached at low zoom (fewer pages) would silently miss photos at high zoom.
  const key = getTileCacheKey(`kartaview:${maxPages}`, tile)
  return fetchTileCached(
    key,
    (innerSignal) => fetchKartaviewTilePhotos(tile, maxPages, innerSignal),
    signal,
  )
}

const fetchPhotos = async (bbox: Bbox, zoom: number, signal: AbortSignal) => {
  const maxPages = Math.min(maxPageAtZoom(zoom), 5) // Politeness cap: iD allows up to 80 pages at high zoom
  const tiles = tilesForBbox(bbox, TILE_ZOOM, { skipNullIsland: true })
  const tileResults = await collectSettledTiles(
    tiles.map((tile) => fetchKartaviewTile(tile, maxPages, signal)),
  )
  return tileResults.flat()
}

export const kartaviewAdapter: ProviderAdapter = {
  id: 'kartaview',
  kind: 'photo',
  label: 'KartaView',
  color: '#2563EB',
  minZoom: 14,
  fetchPhotos,
}
