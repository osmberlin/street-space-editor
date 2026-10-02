import type { Bbox } from '@osm-editor-kit/street-imagery'
import { adapterById, providerCoversBbox, type ProviderId } from '@osm-editor-kit/street-imagery'
import { useQuery } from '@tanstack/react-query'

const bboxKey = (bbox: Bbox | null) =>
  bbox ? `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}` : 'none'

// Adapters return whole-tile data (a single dense z14 tile can hold >100k points).
// Clip to the requested viewport so map sources and legend counts stay manageable —
// without this, dense areas freeze the main thread (MapLibre source updates + GC).
const withinBbox = (bbox: Bbox) => (item: { lngLat: [number, number] }) => {
  const [lng, lat] = item.lngLat
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]
}

export const useProviderPhotos = (providerId: ProviderId, bbox: Bbox | null, zoom: number) => {
  const adapter = adapterById[providerId]
  const enabled =
    adapter.kind === 'photo' &&
    bbox != null &&
    providerCoversBbox(providerId, bbox) &&
    zoom >= adapter.minZoom &&
    adapter.fetchPhotos != null

  return useQuery({
    queryKey: ['provider-photos', providerId, bboxKey(bbox), zoom],
    queryFn: async ({ signal }) => {
      const photos = await adapter.fetchPhotos!(bbox as Bbox, zoom, signal)
      return photos.filter(withinBbox(bbox as Bbox))
    },
    enabled,
    placeholderData: (previous) => previous,
  })
}

export const useProviderSequences = (providerId: ProviderId, bbox: Bbox | null, zoom: number) => {
  const adapter = adapterById[providerId]
  const sequencesMinZoom = adapter.sequencesMinZoom ?? adapter.minZoom
  const enabled =
    adapter.kind === 'photo' &&
    bbox != null &&
    providerCoversBbox(providerId, bbox) &&
    zoom >= sequencesMinZoom &&
    adapter.fetchSequences != null

  return useQuery({
    queryKey: ['provider-sequences', providerId, bboxKey(bbox), zoom],
    queryFn: ({ signal }) => adapter.fetchSequences?.(bbox as Bbox, zoom, signal) ?? [],
    enabled,
    placeholderData: (previous) => previous,
  })
}

export const useProviderMapFeatures = (providerId: ProviderId, bbox: Bbox | null, zoom: number) => {
  const adapter = adapterById[providerId]
  const enabled =
    adapter.kind === 'mapFeature' &&
    bbox != null &&
    providerCoversBbox(providerId, bbox) &&
    zoom >= adapter.minZoom &&
    adapter.fetchMapFeatures != null

  return useQuery({
    queryKey: ['provider-map-features', providerId, bboxKey(bbox), zoom],
    queryFn: async ({ signal }) => {
      const features = await adapter.fetchMapFeatures!(bbox as Bbox, zoom, signal)
      return features.filter(withinBbox(bbox as Bbox))
    },
    enabled,
    placeholderData: (previous) => previous,
  })
}
