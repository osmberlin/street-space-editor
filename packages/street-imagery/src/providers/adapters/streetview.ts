import { peekStreetImageryConfig } from '../../config'
import type { NormalizedPhoto } from '../model'

const STREET_VIEW_METADATA_API = 'https://maps.googleapis.com/maps/api/streetview/metadata'

export type StreetViewMetadataResponse = {
  status: string
  copyright?: string
  date?: string
  location?: {
    lat?: number
    lng?: number
  }
  pano_id?: string
}

/** The key from `setStreetImageryConfig({ googleMapsApiKey })`. The package reads no env vars. */
export const getGoogleMapsApiKey = (): string | undefined =>
  peekStreetImageryConfig()?.googleMapsApiKey

export const parseStreetViewDate = (value: unknown): number | null => {
  if (typeof value !== 'string' || value.length === 0) {
    return null
  }

  const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value
  const parsed = Date.parse(normalized)
  return Number.isNaN(parsed) ? null : parsed
}

export const normalizeStreetViewMetadata = (
  data: StreetViewMetadataResponse,
  clickLng: number,
  clickLat: number,
): Omit<NormalizedPhoto, 'providerId'> | null => {
  if (data.status !== 'OK') {
    return null
  }

  const lng = data.location?.lng ?? clickLng
  const lat = data.location?.lat ?? clickLat
  const photoId = data.pano_id ?? `${lat},${lng}`

  return {
    photoId,
    sequenceId: null,
    capturedAt: parseStreetViewDate(data.date),
    isPano: true,
    heading: null,
    lngLat: [lng, lat],
  }
}

export const fetchStreetViewMetadata = async (
  lat: number,
  lng: number,
  signal: AbortSignal,
): Promise<NormalizedPhoto | null> => {
  const apiKey = getGoogleMapsApiKey()
  if (!apiKey) {
    return null
  }

  const url = new URL(STREET_VIEW_METADATA_API)
  url.searchParams.set('location', `${lat},${lng}`)
  // Street imagery only: without this the nearest panorama can be a photo sphere someone took
  // inside a building or a shop.
  url.searchParams.set('source', 'outdoor')
  url.searchParams.set('key', apiKey)

  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Google Street View metadata failed (${response.status})`)
  }

  const data = (await response.json()) as StreetViewMetadataResponse
  if (data.status === 'ZERO_RESULTS') {
    return null
  }
  if (data.status !== 'OK') {
    throw new Error(`Google Street View metadata: ${data.status}`)
  }

  const normalized = normalizeStreetViewMetadata(data, lng, lat)
  if (!normalized) {
    throw new Error('Google Street View metadata: unexpected empty OK response')
  }

  return { providerId: 'streetview', ...normalized }
}
