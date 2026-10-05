import type { Bbox, ProviderId, ProviderKind } from './model'

/**
 * What is known about a provider without loading any of its code: name, colour, zoom levels,
 * limits. The code that fetches its data is the provider's adapter, which a host app registers
 * only for the providers it uses (`registerProviderAdapters`).
 */
export type ProviderMeta = {
  id: ProviderId
  kind: ProviderKind
  label: string
  color: string
  /** Minimum map zoom before photo markers are fetched. */
  minZoom: number
  /** Minimum map zoom before sequence lines are fetched. */
  sequencesMinZoom: number
  homepageUrl?: string
  /** When false, the provider is not in the default enabled set. */
  defaultEnabled?: boolean
  /** No data on the map: coverage is only checked where the user clicks (or not at all). */
  clickOnly?: boolean
  /** When set, map layers cannot load in the browser (e.g. upstream CORS). */
  browserUnavailableReason?: string
  /**
   * The only area the provider has imagery in, with a name for it ("Norway"). Outside it nothing
   * is requested and hosts can show "not available here". Unset: worldwide.
   */
  coverage?: { bbox: Bbox; label: string }
  /**
   * Ready-made image tiles of the provider's tracks (`{z}`, `{x}`, `{y}` in the URL). They show
   * where imagery exists at zooms where single photos are not loaded. Not clickable.
   */
  coverageTiles?: { url: string; tileSize: number; minZoom: number }
}

export const NORWAY_BBOX: Bbox = [4, 57, 32, 72]

export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'mapillary',
    kind: 'photo',
    label: 'Mapillary',
    color: '#05CB63',
    // Photo points only when zoomed in: one z14 tile holds up to ~20k images in dense cities.
    minZoom: 15,
    // From the provider's line tiles (`sequenceTiles` of the adapter).
    sequencesMinZoom: 6,
    homepageUrl: 'https://www.mapillary.com',
  },
  {
    id: 'panoramax',
    kind: 'photo',
    label: 'Panoramax',
    color: '#7C3AED',
    minZoom: 15,
    sequencesMinZoom: 10,
    homepageUrl: 'https://panoramax.xyz',
  },
  {
    id: 'kartaview',
    kind: 'photo',
    label: 'KartaView',
    color: '#2563EB',
    // The server answers in time only for small areas; see the adapter.
    minZoom: 18,
    sequencesMinZoom: 18,
    homepageUrl: 'https://kartaview.org',
    // The track lines of kartaview.org's own map. Below zoom 12 the tile server is too slow.
    coverageTiles: {
      url: 'https://api.kartaview.org/2.0/sequence/tiles/{x}/{y}/{z}.png',
      tileSize: 256,
      minZoom: 12,
    },
  },
  {
    id: 'mapilio',
    kind: 'photo',
    label: 'Mapilio',
    color: '#0D9488',
    minZoom: 14,
    sequencesMinZoom: 14,
    homepageUrl: 'https://mapilio.com',
    defaultEnabled: false,
    browserUnavailableReason:
      'Mapilio’s tile server (geo.mapilio.com) does not allow browser requests from other sites (CORS). Coverage dots cannot load until Mapilio fixes this upstream.',
  },
  {
    id: 'streetside',
    kind: 'photo',
    label: 'Bing Streetside',
    color: '#0891B2',
    minZoom: 14,
    sequencesMinZoom: 14,
    homepageUrl: 'https://www.bing.com/maps',
  },
  {
    id: 'vegbilder',
    kind: 'photo',
    label: 'Vegbilder',
    color: '#EA580C',
    minZoom: 14,
    sequencesMinZoom: 14,
    homepageUrl: 'https://vegbilder.atlas.vegvesen.no',
    coverage: { bbox: NORWAY_BBOX, label: 'Norway' },
  },
  {
    id: 'streetview',
    kind: 'photo',
    label: 'Google Street View',
    color: '#EA4335',
    minZoom: 0,
    sequencesMinZoom: 0,
    homepageUrl: 'https://www.google.com/maps',
    defaultEnabled: false,
    clickOnly: true,
  },
  {
    id: 'lookaround',
    kind: 'photo',
    label: 'Apple Look Around',
    color: '#007AFF',
    minZoom: 0,
    sequencesMinZoom: 0,
    homepageUrl: 'https://www.apple.com/maps/',
    defaultEnabled: false,
    clickOnly: true,
  },
  {
    id: 'mapillary-signs',
    kind: 'mapFeature',
    label: 'Mapillary signs',
    color: '#E11D48',
    minZoom: 14,
    sequencesMinZoom: 14,
    homepageUrl: 'https://www.mapillary.com',
  },
  {
    id: 'mapillary-map-features',
    kind: 'mapFeature',
    label: 'Mapillary map features',
    color: '#A855F7',
    minZoom: 14,
    sequencesMinZoom: 14,
    homepageUrl: 'https://www.mapillary.com',
  },
]

export const providerById = Object.fromEntries(
  PROVIDERS.map((provider) => [provider.id, provider]),
) as Record<ProviderId, ProviderMeta>
