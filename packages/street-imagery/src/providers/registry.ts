import { providerById, PROVIDERS } from './meta'
import type { Bbox, ProviderAdapter, ProviderId } from './model'

export { NORWAY_BBOX, providerById, PROVIDERS, type ProviderMeta } from './meta'

/**
 * The adapters the host app registered. An adapter holds the code that fetches a provider's map
 * data; it lives in its own entry (`@osm-editor-kit/street-imagery/providers/mapillary` …), so an
 * app bundles only the providers it registers. A provider without an adapter shows no map data.
 */
export const adapterById: Partial<Record<ProviderId, ProviderAdapter>> = {}

/** Call once at boot, before the first render, with the adapters of the providers you use. */
export const registerProviderAdapters = (adapters: readonly ProviderAdapter[]): void => {
  for (const adapter of adapters) {
    adapterById[adapter.id] = adapter
  }
}

export const DEFAULT_PROVIDER_IDS: ProviderId[] = PROVIDERS.filter(
  (provider) => provider.kind === 'photo' && provider.defaultEnabled !== false,
).map((provider) => provider.id)

export const isClickOnlyPhotoProvider = (providerId: ProviderId): boolean =>
  providerById[providerId].clickOnly === true

/**
 * Whether the provider can have imagery in the map view: `false` only for providers with a
 * `coverage` area (Vegbilder: Norway) that the view does not touch.
 */
export const providerCoversBbox = (providerId: ProviderId, bbox: Bbox): boolean => {
  const coverage = providerById[providerId].coverage?.bbox
  if (!coverage) {
    return true
  }
  const [west, south, east, north] = bbox
  return west <= coverage[2] && east >= coverage[0] && south <= coverage[3] && north >= coverage[1]
}

/**
 * Map zoom from which `fetchSequences` is used. A provider with own line tiles
 * (`sequenceTiles`) draws those until its photos are loaded; the fetched lines take over there.
 */
export const fetchedSequencesMinZoom = (providerId: ProviderId): number => {
  const meta = providerById[providerId]
  return adapterById[providerId]?.sequenceTiles
    ? Math.max(meta.minZoom, meta.sequencesMinZoom)
    : meta.sequencesMinZoom
}

export const isBrowserAvailableProvider = (providerId: ProviderId): boolean =>
  providerById[providerId].browserUnavailableReason == null

export const photoLayerId = (providerId: ProviderId) => `photos-${providerId}`
/** Invisible, larger circles around the photo dots: an easier target for clicks and taps. */
export const photoTargetLayerId = (providerId: ProviderId) => `photo-targets-${providerId}`
export const featureLayerId = (providerId: ProviderId) => `features-${providerId}`
export const sequenceLayerId = (providerId: ProviderId) => `sequences-${providerId}`
export const viewfieldLayerId = (providerId: ProviderId) => `viewfields-${providerId}`
export const viewfieldLineLayerId = (providerId: ProviderId) => `viewfields-line-${providerId}`
export const photoSourceId = (providerId: ProviderId) => `photos-source-${providerId}`
export const featureSourceId = (providerId: ProviderId) => `features-source-${providerId}`
export const sequenceSourceId = (providerId: ProviderId) => `sequences-source-${providerId}`
export const viewfieldSourceId = (providerId: ProviderId) => `viewfields-source-${providerId}`
/** Track lines from the provider's vector tiles, drawn until photos are loaded. */
export const sequenceTilesLayerId = (providerId: ProviderId) => `sequence-tiles-${providerId}`
export const sequenceTilesSourceId = (providerId: ProviderId) =>
  `sequence-tiles-source-${providerId}`
