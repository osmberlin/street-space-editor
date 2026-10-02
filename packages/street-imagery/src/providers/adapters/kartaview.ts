import type { Bbox, NormalizedPhoto, ProviderAdapter, TileCoord } from '../model'
import { fetchTileCached, getTileCacheKey } from '../tileCache'
import { tileBbox, tilesForBbox } from '../tileMath'

const API_URL = 'https://kartaview.org/1.0/list/nearby-photos/'
/**
 * KartaView's server answers in time only for small areas: in central Berlin a 110 m radius takes
 * 10 s and 300 m runs into its 25 s timeout (measured 2026-10-02; the time grows with the number
 * of photos found). So photos load in small tiles (about 150 m) and only when zoomed in.
 */
const TILE_ZOOM = 18
const MIN_ZOOM = 18
const RESULTS_PER_PAGE = 1000
/** A tile this small rarely has more photos; a second page covers dense spots. */
const MAX_PAGES = 2

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
// only the coordinate+radius form still works.
const MAX_RADIUS_METERS = 160

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
  signal: AbortSignal,
): Promise<NormalizedPhoto[]> => {
  const [west, south, east, north] = tileBbox(tile)
  const { lng, lat, radius } = tileCenterAndRadius(tile)
  const photos: NormalizedPhoto[] = []

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const body = new URLSearchParams({
      ipp: String(RESULTS_PER_PAGE),
      page: String(page),
      coordinate: `${lat},${lng}`,
      radius: String(radius),
    })

    // The server often times out on the first request for an area and answers the next one
    // fast, so try twice. A tile that still fails throws: it must not be cached as empty.
    let data: KartaviewResponse | null = null
    for (let attempt = 1; attempt <= 2 && !data; attempt += 1) {
      const response = await fetch(API_URL, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      const json = (await response.json().catch(() => null)) as
        | (KartaviewResponse & { status?: { httpCode?: number } })
        | null
      if (response.ok && json?.status?.httpCode === 200) {
        data = json
      }
    }
    if (!data) {
      if (page === 1) {
        throw new Error('KartaView did not answer for this tile')
      }
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

const fetchKartaviewTile = async (tile: TileCoord, signal: AbortSignal) => {
  const key = getTileCacheKey('kartaview', tile)
  return fetchTileCached(key, (innerSignal) => fetchKartaviewTilePhotos(tile, innerSignal), signal)
}

/**
 * Requests in parallel make the server slow enough to time out (four at once did, one after the
 * other answered in 2 to 10 s each; measured 2026-10-02), so tiles load two at a time.
 */
const CONCURRENT_REQUESTS = 2

const fetchPhotos = async (bbox: Bbox, _zoom: number, signal: AbortSignal) => {
  const tiles = tilesForBbox(bbox, TILE_ZOOM, { skipNullIsland: true })
  const photos: NormalizedPhoto[] = []
  let next = 0
  const worker = async () => {
    while (next < tiles.length && !signal.aborted) {
      const tile = tiles[next]
      next += 1
      if (!tile) continue
      try {
        photos.push(...(await fetchKartaviewTile(tile, signal)))
      } catch {
        // A tile that failed twice is skipped; it is not cached, so the next view retries it.
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENT_REQUESTS }, worker))
  return photos
}

export const kartaviewAdapter: ProviderAdapter = {
  id: 'kartaview',
  kind: 'photo',
  label: 'KartaView',
  color: '#2563EB',
  minZoom: MIN_ZOOM,
  fetchPhotos,
}
