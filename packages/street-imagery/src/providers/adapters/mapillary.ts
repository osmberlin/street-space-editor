import type { Feature } from 'geojson'
import { peekStreetImageryConfig } from '../../config'
import type { ViewpointPhotoSource } from '../../viewpoints/photoSources'
import { pointLngLat } from '../fetchMvt'
import { fetchMapillaryMvtTiles, mapillaryTileUrlTemplate } from '../mapillaryShared'
import type {
  Bbox,
  NormalizedPhoto,
  NormalizedSequence,
  ProviderAdapter,
  SequenceTiles,
} from '../model'

const MVT_PATH = 'mly1_public'

export const normalizeMapillaryImageFeature = (
  feature: Feature,
): Omit<NormalizedPhoto, 'providerId'> | null => {
  const lngLat = pointLngLat(feature)
  if (!lngLat) {
    return null
  }

  const props = feature.properties ?? {}
  const id = props.id
  if (id === undefined || id === null) {
    return null
  }

  return {
    photoId: String(id),
    sequenceId: props.sequence_id != null ? String(props.sequence_id) : null,
    capturedAt: typeof props.captured_at === 'number' ? props.captured_at : null,
    isPano: typeof props.is_pano === 'boolean' ? props.is_pano : null,
    heading: typeof props.compass_angle === 'number' ? props.compass_angle : null,
    lngLat,
    ...(props.creator_id != null ? { creatorId: String(props.creator_id) } : {}),
    ...(props.organization_id != null ? { organizationId: String(props.organization_id) } : {}),
  }
}

export const normalizeMapillarySequenceFeature = (
  feature: Feature,
): Omit<NormalizedSequence, 'providerId'> | null => {
  const props = feature.properties ?? {}
  const id = props.id
  if (id == null) {
    return null
  }

  const { geometry } = feature
  if (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') {
    return null
  }

  return {
    sequenceId: String(id),
    geometry,
    capturedAt: typeof props.captured_at === 'number' ? props.captured_at : null,
    isPano: typeof props.is_pano === 'boolean' ? props.is_pano : null,
  }
}

const fetchMapillaryTiles = async (bbox: Bbox, signal: AbortSignal, layer: 'image' | 'sequence') =>
  fetchMapillaryMvtTiles('mapillary', MVT_PATH, bbox, signal, [layer])

const fetchPhotos = async (bbox: Bbox, _zoom: number, signal: AbortSignal) => {
  const tileLayers = await fetchMapillaryTiles(bbox, signal, 'image')
  const photos: NormalizedPhoto[] = []

  for (const layers of tileLayers) {
    const imageFeatures = layers.image ?? []
    for (const feature of imageFeatures) {
      const normalized = normalizeMapillaryImageFeature(feature)
      if (normalized) {
        photos.push({ providerId: 'mapillary', ...normalized })
      }
    }
  }

  return photos
}

const fetchSequences = async (bbox: Bbox, _zoom: number, signal: AbortSignal) => {
  const tileLayers = await fetchMapillaryTiles(bbox, signal, 'sequence')
  const sequences: NormalizedSequence[] = []

  for (const layers of tileLayers) {
    const sequenceFeatures = layers.sequence ?? []
    for (const feature of sequenceFeatures) {
      const normalized = normalizeMapillarySequenceFeature(feature)
      if (normalized) {
        sequences.push({ providerId: 'mapillary', ...normalized })
      }
    }
  }

  return sequences
}

// The tiles have the `sequence` layer from zoom 6 (below 6 only a point `overview`). Zoom 14
// tiles also hold every photo (over 10 MB in a city), so the map stays on zoom 13 tiles.
const sequenceTiles = (): SequenceTiles | null =>
  peekStreetImageryConfig()
    ? {
        tiles: [mapillaryTileUrlTemplate(MVT_PATH)],
        sourceLayer: 'sequence',
        minZoom: 6,
        maxZoom: 13,
        properties: { capturedAt: 'captured_at', isPano: 'is_pano', sequenceId: 'id' },
      }
    : null

export const mapillaryAdapter: ProviderAdapter = {
  id: 'mapillary',
  fetchPhotos,
  fetchSequences,
  sequenceTiles,
}

/** Search radius of `mapillaryTilePhotoSource`; the ranking keeps photos within 50 m. */
const TILE_SOURCE_RADIUS_METERS = 60

/**
 * Photos near a point for suggested views, read from the map tiles: every photo that is a dot on
 * the map. Prefer it over `mapillaryPhotoSource` (the API's radius search) when the map shows
 * Mapillary: the API returns at most 50 images, so in dense places nearby photos are missing.
 * The tiles are cached, so this costs no request when the map has loaded them.
 */
export const mapillaryTilePhotoSource: ViewpointPhotoSource = {
  id: 'mapillary',
  fetchNear: async ([lng, lat], signal) => {
    const dLat = TILE_SOURCE_RADIUS_METERS / 111_320
    const dLng = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 1e-6)
    const bbox: Bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat]
    const photos = await fetchPhotos(bbox, 15, signal ?? new AbortController().signal)
    return photos.filter(
      ({ lngLat: [photoLng, photoLat] }) =>
        photoLng >= bbox[0] && photoLng <= bbox[2] && photoLat >= bbox[1] && photoLat <= bbox[3],
    )
  },
}
