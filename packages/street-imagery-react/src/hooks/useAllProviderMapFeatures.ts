import type { DateRange } from '@osm-editor-kit/street-imagery'
import { mapFeatureMatchesDateRange } from '@osm-editor-kit/street-imagery'
import type { Bbox, NormalizedMapFeature } from '@osm-editor-kit/street-imagery'
import { PROVIDER_IDS, type ProviderId } from '@osm-editor-kit/street-imagery'
import { useProviderMapFeatures } from './useProviderData'

const useProviderMapFeaturesMaybe = (
  providerId: ProviderId,
  enabled: boolean,
  bbox: Bbox | null,
  zoom: number,
) => useProviderMapFeatures(providerId, enabled ? bbox : null, zoom)

export const useAllProviderMapFeatures = (
  providerIds: ProviderId[],
  bbox: Bbox | null,
  zoom: number,
  date?: DateRange,
): NormalizedMapFeature[] => {
  const enabled = new Set(providerIds)

  const queries = PROVIDER_IDS.map((providerId) => ({
    providerId,
    query: useProviderMapFeaturesMaybe(providerId, enabled.has(providerId), bbox, zoom),
  }))

  return queries.flatMap(({ query }) => {
    const data = query.data ?? []
    return data.filter((feature) => mapFeatureMatchesDateRange(feature, date))
  })
}
