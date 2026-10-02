import { fetchStreetViewMetadata, getGoogleMapsApiKey } from '../providers/adapters/streetview'
import type { NormalizedPhoto, ProviderId } from '../providers/model'
import type { LngLat } from './geometry'
import { fetchMapillaryImagesNearPoint } from './mapillaryRadiusSearch'

/**
 * Where suggested views get their photos from: "photos near this point". One source per
 * provider; add your own for providers the package does not ship (e.g. Infra3D).
 */
export type ViewpointPhotoSource = {
  /** Used in cache keys and to tell sources apart. */
  id: ProviderId | (string & {})
  fetchNear: (lngLat: LngLat, signal?: AbortSignal) => Promise<NormalizedPhoto[]>
}

/**
 * Mapillary radius search: up to 50 images within 50 m. In dense places the 50 are not all there
 * is; apps whose map shows Mapillary use `mapillaryTilePhotoSource` (entry
 * `providers/mapillary`) instead.
 */
export const mapillaryPhotoSource: ViewpointPhotoSource = {
  id: 'mapillary',
  fetchNear: (lngLat, signal) => fetchMapillaryImagesNearPoint(lngLat, {}, signal),
}

/**
 * Google Street View: the one panorama Google returns for the point (metadata API, free).
 * Needs `googleMapsApiKey` in the street imagery config; without it the source finds nothing.
 */
export const streetViewPhotoSource: ViewpointPhotoSource = {
  id: 'streetview',
  fetchNear: async ([lng, lat], signal) => {
    if (!getGoogleMapsApiKey()) {
      return []
    }
    const photo = await fetchStreetViewMetadata(lat, lng, signal ?? new AbortController().signal)
    return photo ? [photo] : []
  },
}
