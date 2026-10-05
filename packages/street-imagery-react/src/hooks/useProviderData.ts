import type { Bbox } from '@osm-editor-kit/street-imagery'
import {
  adapterById,
  providerById,
  providerCoversBbox,
  type ProviderId,
} from '@osm-editor-kit/street-imagery'
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

/** Host limit on top of the provider's own minimum zooms: below it nothing is requested. */
type ProviderDataOptions = { minZoom?: number }

export const useProviderPhotos = (
  providerId: ProviderId,
  bbox: Bbox | null,
  zoom: number,
  { minZoom = 0 }: ProviderDataOptions = {},
) => {
  // No adapter registered for the provider: nothing to load.
  const adapter = adapterById[providerId]
  const meta = providerById[providerId]
  const enabled =
    meta.kind === 'photo' &&
    bbox != null &&
    providerCoversBbox(providerId, bbox) &&
    zoom >= Math.max(meta.minZoom, minZoom) &&
    adapter?.fetchPhotos != null

  return useQuery({
    queryKey: ['provider-photos', providerId, bboxKey(bbox), zoom],
    queryFn: async ({ signal }) => {
      const photos = await adapter!.fetchPhotos!(bbox as Bbox, zoom, signal)
      return photos.filter(withinBbox(bbox as Bbox))
    },
    enabled,
    placeholderData: (previous) => previous,
  })
}

export const useProviderSequences = (
  providerId: ProviderId,
  bbox: Bbox | null,
  zoom: number,
  { minZoom = 0 }: ProviderDataOptions = {},
) => {
  // No adapter registered for the provider: nothing to load.
  const adapter = adapterById[providerId]
  const meta = providerById[providerId]
  const sequencesMinZoom = meta.sequencesMinZoom
  const enabled =
    meta.kind === 'photo' &&
    bbox != null &&
    providerCoversBbox(providerId, bbox) &&
    zoom >= Math.max(sequencesMinZoom, minZoom) &&
    adapter?.fetchSequences != null

  return useQuery({
    queryKey: ['provider-sequences', providerId, bboxKey(bbox), zoom],
    queryFn: ({ signal }) => adapter?.fetchSequences?.(bbox as Bbox, zoom, signal) ?? [],
    enabled,
    placeholderData: (previous) => previous,
  })
}

export const useProviderMapFeatures = (
  providerId: ProviderId,
  bbox: Bbox | null,
  zoom: number,
  { minZoom = 0 }: ProviderDataOptions = {},
) => {
  // No adapter registered for the provider: nothing to load.
  const adapter = adapterById[providerId]
  const meta = providerById[providerId]
  const enabled =
    meta.kind === 'mapFeature' &&
    bbox != null &&
    providerCoversBbox(providerId, bbox) &&
    zoom >= Math.max(meta.minZoom, minZoom) &&
    adapter?.fetchMapFeatures != null

  return useQuery({
    queryKey: ['provider-map-features', providerId, bboxKey(bbox), zoom],
    queryFn: async ({ signal }) => {
      const features = await adapter!.fetchMapFeatures!(bbox as Bbox, zoom, signal)
      return features.filter(withinBbox(bbox as Bbox))
    },
    enabled,
    placeholderData: (previous) => previous,
  })
}
