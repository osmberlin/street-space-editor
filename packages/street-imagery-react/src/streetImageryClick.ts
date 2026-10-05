import {
  featureLayerId,
  photoLayerId,
  photoTargetLayerId,
  viewfieldLayerId,
  type ProviderId,
} from '@osm-editor-kit/street-imagery'
import type { MapGeoJSONFeature } from 'maplibre-gl'

export type StreetImageryClickFeature = {
  providerId: ProviderId
  kind: 'photo' | 'mapFeature'
  photoId?: string
  featureId?: string
  sequenceId?: string
}

/**
 * Layers to pass as `interactiveLayerIds`. A click returns the features of all layers it hits, the
 * top one first: the photo dot itself, then view shapes, then the larger invisible targets.
 */
export const streetImageryInteractiveLayerIds = (providers: ProviderId[]): string[] => [
  ...providers.map((providerId) => photoLayerId(providerId)),
  ...providers.map((providerId) => photoTargetLayerId(providerId)),
  ...providers.map((providerId) => viewfieldLayerId(providerId)),
  ...providers.map((providerId) => featureLayerId(providerId)),
]

const parseProviderIdFromLayerId = (layerId: string): ProviderId | null => {
  const photoMatch = layerId.match(/^photos-(.+)$/)
  if (photoMatch) {
    return photoMatch[1] as ProviderId
  }
  const targetMatch = layerId.match(/^photo-targets-(.+)$/)
  if (targetMatch) {
    return targetMatch[1] as ProviderId
  }
  const viewfieldMatch = layerId.match(/^viewfields-(.+)$/)
  if (viewfieldMatch) {
    return viewfieldMatch[1] as ProviderId
  }
  const featureMatch = layerId.match(/^features-(.+)$/)
  if (featureMatch) {
    return featureMatch[1] as ProviderId
  }
  return null
}

export const queryStreetImageryFeatures = (event: {
  features?: MapGeoJSONFeature[] | null
}): StreetImageryClickFeature[] => {
  const features = event.features ?? []
  const results: StreetImageryClickFeature[] = []
  const seenPhotoKeys = new Set<string>()

  for (const feature of features) {
    const layerId = feature.layer?.id
    if (!layerId) {
      continue
    }

    const providerId = parseProviderIdFromLayerId(layerId)
    if (!providerId) {
      continue
    }

    const props = feature.properties ?? {}

    if (
      layerId.startsWith('photos-') ||
      layerId.startsWith('photo-targets-') ||
      layerId.startsWith('viewfields-')
    ) {
      const photoId = props.photoId
      if (photoId == null) {
        continue
      }
      const photoIdStr = String(photoId)
      const dedupeKey = `${providerId}:${photoIdStr}`
      if (seenPhotoKeys.has(dedupeKey)) {
        continue
      }
      seenPhotoKeys.add(dedupeKey)
      results.push({
        providerId,
        kind: 'photo',
        photoId: photoIdStr,
        sequenceId: props.sequenceId != null ? String(props.sequenceId) : undefined,
      })
      continue
    }

    if (layerId.startsWith('features-')) {
      const featureId = props.featureId
      if (featureId == null) {
        continue
      }
      results.push({
        providerId,
        kind: 'mapFeature',
        featureId: String(featureId),
      })
    }
  }

  return results
}
