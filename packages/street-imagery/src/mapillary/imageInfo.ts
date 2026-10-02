import type { LngLat } from '../viewpoints/geometry'
import { MAPILLARY_BATCH_SIZE, mapillaryGraphGet } from './graphApi'

type GraphPoint = { coordinates: [number, number] }

type GraphImage = {
  id: string
  captured_at?: number | string
  is_pano?: boolean
  compass_angle?: number
  computed_compass_angle?: number
  creator?: { id?: string; username?: string }
  geometry?: GraphPoint
  computed_geometry?: GraphPoint
  sequence?: string
}

export type MapillaryImageDetails = {
  id: string
  /** Capture time in ms. */
  capturedAt: number | null
  isPano: boolean
  /** Mapillary's computed position (map features are located from it); falls back to GPS. */
  lngLat: LngLat | null
  /** The camera's GPS position. Computed matches detections better but is sometimes far off. */
  originalLngLat: LngLat | null
  heading: number | null
  username: string | null
  creatorId: string | null
  sequenceId: string | null
}

const IMAGE_FIELDS =
  'id,captured_at,is_pano,compass_angle,computed_compass_angle,creator,geometry,computed_geometry,sequence'

/** `captured_at` is epoch ms, or an ISO string on old data. */
const parseCapturedAt = (value: number | string | undefined): number | null => {
  if (value == null) {
    return null
  }
  const ms = typeof value === 'number' ? value : new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

export const normalizeMapillaryImageDetails = (image: GraphImage): MapillaryImageDetails => ({
  id: String(image.id),
  capturedAt: parseCapturedAt(image.captured_at),
  isPano: image.is_pano === true,
  lngLat: (image.computed_geometry ?? image.geometry)?.coordinates ?? null,
  originalLngLat: image.geometry?.coordinates ?? null,
  heading: image.computed_compass_angle ?? image.compass_angle ?? null,
  username: image.creator?.username ?? null,
  creatorId: image.creator?.id ?? null,
  sequenceId: image.sequence ?? null,
})

/** Details of many images in batches of 50 (`?ids=`); unknown ids are left out. */
export const fetchMapillaryImages = async (
  ids: string[],
  signal?: AbortSignal,
): Promise<MapillaryImageDetails[]> => {
  const unique = [...new Set(ids)]
  const details: MapillaryImageDetails[] = []
  for (let index = 0; index < unique.length; index += MAPILLARY_BATCH_SIZE) {
    const result = await mapillaryGraphGet<Record<string, GraphImage>>(
      '',
      { ids: unique.slice(index, index + MAPILLARY_BATCH_SIZE).join(','), fields: IMAGE_FIELDS },
      signal,
    )
    details.push(...Object.values(result).map(normalizeMapillaryImageDetails))
  }
  return details
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** "3 months ago" in the given locale. */
export const formatRelativeAge = (capturedAt: number, now: number, locale?: string): string => {
  const seconds = (capturedAt - now) / 1000
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) {
      return formatter.format(Math.trunc(seconds / size), unit)
    }
  }
  return formatter.format(0, 'second')
}
