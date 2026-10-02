import { kartaviewAdapter } from './adapters/kartaview'
import { lookaroundAdapter } from './adapters/lookaround'
import { mapilioAdapter } from './adapters/mapilio'
import { mapillaryAdapter } from './adapters/mapillary'
import { mapillaryMapFeaturesAdapter } from './adapters/mapillary-map-features'
import { mapillarySignsAdapter } from './adapters/mapillary-signs'
import { panoramaxAdapter } from './adapters/panoramax'
import { streetsideAdapter } from './adapters/streetside'
import { streetViewAdapter } from './adapters/streetview'
import { vegbilderAdapter } from './adapters/vegbilder'
import type { ProviderAdapter, ProviderId, ProviderKind } from './model'
import { PROVIDER_IDS } from './model'

export type ProviderMeta = {
  id: ProviderId
  kind: ProviderKind
  label: string
  color: string
  minZoom: number
  sequencesMinZoom: number
  homepageUrl?: string
  browserUnavailableReason?: string
}

const PROVIDER_HOMEPAGE_URLS: Partial<Record<ProviderId, string>> = {
  mapillary: 'https://www.mapillary.com',
  panoramax: 'https://panoramax.xyz',
  kartaview: 'https://kartaview.org',
  mapilio: 'https://mapilio.com',
  streetside: 'https://www.bing.com/maps',
  vegbilder: 'https://vegbilder.atlas.vegvesen.no',
  streetview: 'https://www.google.com/maps',
  lookaround: 'https://www.apple.com/maps/',
  'mapillary-signs': 'https://www.mapillary.com',
  'mapillary-map-features': 'https://www.mapillary.com',
}

export const PROVIDER_ADAPTERS: ProviderAdapter[] = [
  mapillaryAdapter,
  panoramaxAdapter,
  kartaviewAdapter,
  mapilioAdapter,
  streetsideAdapter,
  vegbilderAdapter,
  streetViewAdapter,
  lookaroundAdapter,
  mapillarySignsAdapter,
  mapillaryMapFeaturesAdapter,
]

export const adapterById = Object.fromEntries(
  PROVIDER_ADAPTERS.map((adapter) => [adapter.id, adapter]),
) as Record<ProviderId, ProviderAdapter>

export const PROVIDERS: ProviderMeta[] = PROVIDER_ADAPTERS.map((adapter) => ({
  id: adapter.id,
  kind: adapter.kind,
  label: adapter.label,
  color: adapter.color,
  minZoom: adapter.minZoom,
  sequencesMinZoom: adapter.sequencesMinZoom ?? adapter.minZoom,
  homepageUrl: PROVIDER_HOMEPAGE_URLS[adapter.id],
  browserUnavailableReason: adapter.browserUnavailableReason,
}))

export const DEFAULT_PROVIDER_IDS: ProviderId[] = PROVIDER_IDS.filter(
  (id) => adapterById[id].kind === 'photo' && adapterById[id].defaultEnabled !== false,
)

export const isClickOnlyPhotoProvider = (providerId: ProviderId): boolean => {
  const adapter = adapterById[providerId]
  return adapter.kind === 'photo' && adapter.fetchPhotos == null
}

export const isBrowserAvailableProvider = (providerId: ProviderId): boolean =>
  adapterById[providerId].browserUnavailableReason == null

export const providerById = Object.fromEntries(
  PROVIDERS.map((provider) => [provider.id, provider]),
) as Record<ProviderId, ProviderMeta>

export const photoLayerId = (providerId: ProviderId) => `photos-${providerId}`
export const featureLayerId = (providerId: ProviderId) => `features-${providerId}`
export const sequenceLayerId = (providerId: ProviderId) => `sequences-${providerId}`
export const viewfieldLayerId = (providerId: ProviderId) => `viewfields-${providerId}`
export const viewfieldLineLayerId = (providerId: ProviderId) => `viewfields-line-${providerId}`
export const photoSourceId = (providerId: ProviderId) => `photos-source-${providerId}`
export const featureSourceId = (providerId: ProviderId) => `features-source-${providerId}`
export const sequenceSourceId = (providerId: ProviderId) => `sequences-source-${providerId}`
export const viewfieldSourceId = (providerId: ProviderId) => `viewfields-source-${providerId}`
