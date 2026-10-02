import type { Feature } from 'geojson'
import { fetchMapillaryMvtTiles, pointLngLat } from '../mapillaryShared'
import type { Bbox, NormalizedMapFeature, ProviderAdapter } from '../model'

const MVT_PATH = 'mly_map_feature_traffic_sign'
const LAYER_NAME = 'traffic_sign'

export const normalizeMapillaryTrafficSignFeature = (
  feature: Feature,
): Omit<NormalizedMapFeature, 'providerId'> | null => {
  const lngLat = pointLngLat(feature)
  if (!lngLat) {
    return null
  }

  const props = feature.properties ?? {}
  const id = props.id
  if (id === undefined || id === null) {
    return null
  }

  const value = props.value
  if (typeof value !== 'string' || value.length === 0) {
    return null
  }

  return {
    featureId: String(id),
    value,
    firstSeenAt: typeof props.first_seen_at === 'number' ? props.first_seen_at : null,
    lastSeenAt: typeof props.last_seen_at === 'number' ? props.last_seen_at : null,
    lngLat,
  }
}

const fetchMapFeatures = async (bbox: Bbox, _zoom: number, signal: AbortSignal) => {
  const tileLayers = await fetchMapillaryMvtTiles('mapillary-signs', MVT_PATH, bbox, signal)
  const features: NormalizedMapFeature[] = []

  for (const layers of tileLayers) {
    const signFeatures = layers[LAYER_NAME] ?? []
    for (const feature of signFeatures) {
      const normalized = normalizeMapillaryTrafficSignFeature(feature)
      if (normalized) {
        features.push({ providerId: 'mapillary-signs', ...normalized })
      }
    }
  }

  return features
}

export const mapillarySignsAdapter: ProviderAdapter = {
  id: 'mapillary-signs',
  fetchMapFeatures,
}
