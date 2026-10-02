import { getStreetImageryConfig } from '../config'
import type { NormalizedPhoto } from '../providers/model'
import type { LngLat } from './geometry'

const GRAPH_IMAGES_URL = 'https://graph.mapillary.com/images'
const FIELDS = [
  'id',
  'captured_at',
  'compass_angle',
  'computed_compass_angle',
  'is_pano',
  'geometry',
  'computed_geometry',
  'sequence',
  'creator',
].join(',')

/** API limits (Mapillary image radius search, 2026). The API returns at most 50 images. */
export const MAPILLARY_RADIUS_MAX_METERS = 50
export const MAPILLARY_RADIUS_MAX_LIMIT = 100

type GraphPoint = { type: 'Point'; coordinates: [number, number] }

export type MapillaryGraphImage = {
  id: string
  captured_at?: number
  compass_angle?: number
  computed_compass_angle?: number
  is_pano?: boolean
  geometry?: GraphPoint
  computed_geometry?: GraphPoint
  sequence?: string
  creator?: { id?: string }
}

export const normalizeMapillaryGraphImage = (
  image: MapillaryGraphImage,
): NormalizedPhoto | null => {
  const point = image.computed_geometry ?? image.geometry
  if (!image.id || !point) {
    return null
  }
  const heading = image.computed_compass_angle ?? image.compass_angle
  return {
    providerId: 'mapillary',
    photoId: String(image.id),
    sequenceId: image.sequence ?? null,
    capturedAt: typeof image.captured_at === 'number' ? image.captured_at : null,
    isPano: typeof image.is_pano === 'boolean' ? image.is_pano : null,
    heading: typeof heading === 'number' ? heading : null,
    lngLat: [point.coordinates[0], point.coordinates[1]],
    ...(image.computed_geometry && image.geometry
      ? { originalLngLat: [image.geometry.coordinates[0], image.geometry.coordinates[1]] }
      : {}),
    ...(image.creator?.id ? { creatorId: String(image.creator.id) } : {}),
  }
}

/**
 * Mapillary images within `radiusMeters` of a point (Graph API radius search).
 * The API ranks by its own "best" (prefers 360°), so request many and rank with
 * `rankPhotosForDirection`. `start_captured_at` is ignored by this endpoint; filter by age locally.
 */
export const fetchMapillaryImagesNearPoint = async (
  lngLat: LngLat,
  { radiusMeters = MAPILLARY_RADIUS_MAX_METERS }: { radiusMeters?: number } = {},
  signal?: AbortSignal,
): Promise<NormalizedPhoto[]> => {
  const url = new URL(GRAPH_IMAGES_URL)
  url.searchParams.set('access_token', getStreetImageryConfig().mapillaryToken)
  url.searchParams.set('lat', lngLat[1].toFixed(7))
  url.searchParams.set('lng', lngLat[0].toFixed(7))
  url.searchParams.set('radius', String(Math.min(radiusMeters, MAPILLARY_RADIUS_MAX_METERS)))
  url.searchParams.set('limit', String(MAPILLARY_RADIUS_MAX_LIMIT))
  url.searchParams.set('fields', FIELDS)

  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Mapillary radius search failed: ${response.status}`)
  }
  const body = (await response.json()) as { data?: MapillaryGraphImage[] }
  return (body.data ?? []).flatMap((image) => normalizeMapillaryGraphImage(image) ?? [])
}
