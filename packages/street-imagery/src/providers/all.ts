import { kartaviewAdapter } from './adapters/kartaview'
import { mapilioAdapter } from './adapters/mapilio'
import { mapillaryAdapter } from './adapters/mapillary'
import { mapillaryMapFeaturesAdapter } from './adapters/mapillary-map-features'
import { mapillarySignsAdapter } from './adapters/mapillary-signs'
import { panoramaxAdapter } from './adapters/panoramax'
import { streetsideAdapter } from './adapters/streetside'
import { vegbilderAdapter } from './adapters/vegbilder'
import type { ProviderAdapter } from './model'

/**
 * Every adapter, for apps that show all providers. Apps that use a few import those from their
 * own entries instead (`@osm-editor-kit/street-imagery/providers/mapillary` …).
 */
export const ALL_PROVIDER_ADAPTERS: ProviderAdapter[] = [
  mapillaryAdapter,
  panoramaxAdapter,
  kartaviewAdapter,
  mapilioAdapter,
  streetsideAdapter,
  vegbilderAdapter,
  mapillarySignsAdapter,
  mapillaryMapFeaturesAdapter,
]
