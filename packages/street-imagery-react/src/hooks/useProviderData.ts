import type { Bbox } from '@osm-editor-kit/street-imagery'
import {
  adapterById,
  fetchedSequencesMinZoom,
  providerById,
  providerCoversBbox,
  type ProviderId,
} from '@osm-editor-kit/street-imagery'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

const bboxKey = (bbox: Bbox | null) =>
  bbox ? `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}` : 'none'

// Adapters return whole-tile data (a single dense z14 tile can hold >100k points).
// Clip to the requested viewport so map sources and legend counts stay manageable —
// without this, dense areas freeze the main thread (MapLibre source updates + GC).
const withinBbox = (bbox: Bbox) => (item: { lngLat: [number, number] }) => {
  const [lng, lat] = item.lngLat
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]
}

/**
 * Keeps the last result on screen while the next viewport loads. Only while the query is on:
 * a query that is off (provider turned off, zoomed out too far) would show that result forever.
 */
export const previousDataWhile = (enabled: boolean) => (enabled ? keepPreviousData : undefined)

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
    placeholderData: previousDataWhile(enabled),
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
  const sequencesMinZoom = fetchedSequencesMinZoom(providerId)
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
    placeholderData: previousDataWhile(enabled),
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
    placeholderData: previousDataWhile(enabled),
  })
}
