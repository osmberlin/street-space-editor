import {
  createStreetImageryConfig,
  registerProviderAdapters,
  setStreetImageryConfig,
} from '@osm-editor-kit/street-imagery'
import { mapillaryAdapter } from '@osm-editor-kit/street-imagery/providers/mapillary'
import { mapillarySignsAdapter } from '@osm-editor-kit/street-imagery/providers/mapillary-signs'
import { panoramaxAdapter } from '@osm-editor-kit/street-imagery/providers/panoramax'

/** Public Mapillary token (same as iD / imagery overview). Override via VITE_MAPILLARY_ACCESS_TOKEN. */
const DEFAULT_MAPILLARY_TOKEN = 'MLY|4100327730013843|5bb78b81720791946a9a7b956c57b7cf'

export function initStreetImageryConfig() {
  const mapillaryToken =
    import.meta.env.VITE_MAPILLARY_ACCESS_TOKEN?.trim() || DEFAULT_MAPILLARY_TOKEN

  setStreetImageryConfig(
    createStreetImageryConfig({
      mapillaryToken,
    }),
  )
  // Only the providers this editor offers get bundled.
  registerProviderAdapters([mapillaryAdapter, panoramaxAdapter, mapillarySignsAdapter])
}

export function getStreetImageryRuntimeConfig() {
  const mapillaryToken =
    import.meta.env.VITE_MAPILLARY_ACCESS_TOKEN?.trim() || DEFAULT_MAPILLARY_TOKEN
  return createStreetImageryConfig({ mapillaryToken })
}
