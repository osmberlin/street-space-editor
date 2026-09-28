import type { Feature } from 'geojson'
import { pointLngLat } from '../fetchMvt'
import { fetchMapillaryMvtTiles } from '../mapillaryShared'
import type { Bbox, NormalizedPhoto, NormalizedSequence, ProviderAdapter } from '../model'

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

export const mapillaryAdapter: ProviderAdapter = {
  id: 'mapillary',
  kind: 'photo',
  label: 'Mapillary',
  color: '#05CB63',
  // Photo points only when zoomed in: one z14 tile holds up to ~20k images in dense cities.
  minZoom: 15,
  sequencesMinZoom: 12,
  fetchPhotos,
  fetchSequences,
}
