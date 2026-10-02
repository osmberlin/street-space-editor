import { peekStreetImageryConfig } from '../config'
import {
  bestTargetImage,
  panoX,
  PLACE_TARGET,
  viewFromLocation,
  type TargetImage,
} from '../mapillary/targetView'
import { fetchStreetViewMetadata, getGoogleMapsApiKey } from '../providers/adapters/streetview'
import type { NormalizedPhoto, ProviderId } from '../providers/model'
import { providerById } from '../providers/registry'
import { providerLocationLink } from '../viewer/externalLinks'
import { angleDiffDeg, bearingDeg, type LngLat } from '../viewpoints/geometry'
import { fetchMapillaryImagesNearPoint } from '../viewpoints/mapillaryRadiusSearch'
import { buildInfra3dUrl, getInfra3dProjectUid } from './infra3d'

/**
 * "Open this place in another imagery service": one opener per service, with a link that works
 * right away (`locationUrl`) and, where the service can do it, a better one that opens the
 * nearest image already turned to the place (`lookAtUrl`).
 *
 * Unlike `ProviderId`, openers need no coverage data, so services without a public API (infra3D)
 * fit in too.
 */

/** Photo providers that have a viewer of their own to open. */
const PROVIDER_OPENER_IDS = [
  'mapillary',
  'panoramax',
  'kartaview',
  'mapilio',
  'streetside',
  'vegbilder',
  'streetview',
  'lookaround',
] as const satisfies readonly ProviderId[]

export const LOCATION_OPENER_IDS = [...PROVIDER_OPENER_IDS, 'infra3d'] as const

export type LocationOpenerId = (typeof LOCATION_OPENER_IDS)[number]

/** The place to look at (not where the camera stands): a clicked point, a feature's centroid … */
export type OpenTarget = {
  lngLat: LngLat
  /** Map zoom, for services that open on a map. */
  zoom?: number
}

export type LocationOpener = {
  id: LocationOpenerId
  label: string
  color: string
  /** `false` when the host config lacks what the service needs (infra3D: a project). */
  isAvailable: () => boolean
  /** The service at the place. Synchronous, so it works as an `<a href>`. */
  locationUrl: (target: OpenTarget) => string
  /**
   * The image nearest to the place, turned to look at it. Needs a request, so open the tab first
   * (`openLocationInNewTab` does). `null` when there is no such image; use `locationUrl` then.
   */
  lookAtUrl?: (target: OpenTarget, signal?: AbortSignal) => Promise<string | null>
}

/** Flat images must point at the target within this many degrees to show it. */
const MAX_FLAT_ANGLE_DEG = 40

const round = (value: number, digits: number) => Number(value.toFixed(digits))

/**
 * Mapillary web app link to the image that shows the target best, turned to it (360° images:
 * the `x`/`y`/`zoom` view params; flat images are picked by their heading).
 */
export const mapillaryLookAtUrl = (
  photos: readonly NormalizedPhoto[],
  target: LngLat,
): string | null => {
  const headingById = new Map<string, number>()
  const images: TargetImage[] = []
  for (const photo of photos) {
    if (photo.capturedAt == null || photo.heading == null) {
      continue
    }
    const isPano = photo.isPano === true
    if (
      !isPano &&
      angleDiffDeg(photo.heading, bearingDeg(photo.lngLat, target)) > MAX_FLAT_ANGLE_DEG
    ) {
      continue
    }
    headingById.set(photo.photoId, photo.heading)
    images.push({ id: photo.photoId, lngLat: photo.lngLat, capturedAt: photo.capturedAt, isPano })
  }

  const best = bestTargetImage(images, target, { shape: PLACE_TARGET })
  if (!best) {
    return null
  }

  const params = [`pKey=${encodeURIComponent(best.id)}`, 'focus=photo']
  if (best.isPano) {
    const x = panoX(bearingDeg(best.lngLat, target), headingById.get(best.id) ?? 0)
    const view = viewFromLocation(x, best, target, PLACE_TARGET)
    params.push(
      `x=${round(view.center[0], 4)}`,
      `y=${round(view.center[1], 4)}`,
      `zoom=${round(view.zoom, 2)}`,
    )
  }
  return `https://www.mapillary.com/app/?${params.join('&')}`
}

/** Pitch for Google Street View: slightly down, where the street space is. */
const STREET_VIEW_PITCH_DEG = -10

/** Google Maps link to a panorama (from the metadata API), turned to the target. */
export const streetViewLookAtUrl = (pano: NormalizedPhoto, target: LngLat): string => {
  const [lng, lat] = pano.lngLat
  const params = ['api=1', 'map_action=pano']
  // Without a `pano_id` the metadata falls back to "lat,lng" as the photo id.
  if (!pano.photoId.includes(',')) {
    params.push(`pano=${encodeURIComponent(pano.photoId)}`)
  }
  params.push(
    `viewpoint=${lat},${lng}`,
    `heading=${round(bearingDeg(pano.lngLat, target), 1)}`,
    `pitch=${STREET_VIEW_PITCH_DEG}`,
  )
  return `https://www.google.com/maps/@?${params.join('&')}`
}

const providerOpener = (id: (typeof PROVIDER_OPENER_IDS)[number]): LocationOpener => ({
  id,
  label: providerById[id].label,
  color: providerById[id].color,
  isAvailable: () => true,
  locationUrl: ({ lngLat: [lng, lat], zoom }) => providerLocationLink(id, lat, lng, zoom),
})

const mapillaryOpener: LocationOpener = {
  ...providerOpener('mapillary'),
  lookAtUrl: async ({ lngLat }, signal) => {
    if (!peekStreetImageryConfig()?.mapillaryToken) {
      return null
    }
    return mapillaryLookAtUrl(await fetchMapillaryImagesNearPoint(lngLat, {}, signal), lngLat)
  },
}

const streetViewOpener: LocationOpener = {
  ...providerOpener('streetview'),
  lookAtUrl: async ({ lngLat }, signal) => {
    if (!getGoogleMapsApiKey()) {
      return null
    }
    const pano = await fetchStreetViewMetadata(
      lngLat[1],
      lngLat[0],
      signal ?? new AbortController().signal,
    )
    return pano ? streetViewLookAtUrl(pano, lngLat) : null
  },
}

/**
 * infra3D has no public coverage data, so it is an opener only. Its `lookAt` already means "the
 * nearest image, turned to this point", so the plain link is the look-at link.
 */
const infra3dOpener: LocationOpener = {
  id: 'infra3d',
  label: 'infra3D',
  color: '#0F766E',
  isAvailable: () => getInfra3dProjectUid() != null,
  locationUrl: ({ lngLat: [lng, lat] }) => buildInfra3dUrl({ mode: 'lookAt', lng, lat }),
}

export const LOCATION_OPENERS: LocationOpener[] = [
  mapillaryOpener,
  providerOpener('panoramax'),
  providerOpener('kartaview'),
  providerOpener('mapilio'),
  providerOpener('streetside'),
  providerOpener('vegbilder'),
  streetViewOpener,
  providerOpener('lookaround'),
  infra3dOpener,
]

export const locationOpenerById = Object.fromEntries(
  LOCATION_OPENERS.map((opener) => [opener.id, opener]),
) as Record<LocationOpenerId, LocationOpener>

/**
 * Open the place in a new tab. Call it directly in the click handler: the tab is opened before
 * the look-at request, else popup blockers stop it. Falls back to `locationUrl` when there is no
 * image to look from, the request fails, or it takes longer than `timeoutMs`.
 */
export const openLocationInNewTab = (
  opener: LocationOpener,
  target: OpenTarget,
  { timeoutMs = 8000 }: { timeoutMs?: number } = {},
): void => {
  const fallbackUrl = opener.locationUrl(target)
  if (!opener.lookAtUrl) {
    window.open(fallbackUrl, '_blank', 'noopener')
    return
  }

  // `noopener` would hide the tab from us; cut the link back to this page by hand instead.
  const tab = window.open('about:blank', '_blank')
  if (tab) {
    tab.opener = null
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  void opener
    .lookAtUrl(target, controller.signal)
    .catch(() => null)
    .then((url) => {
      clearTimeout(timeout)
      const finalUrl = url ?? fallbackUrl
      if (tab && !tab.closed) {
        tab.location.replace(finalUrl)
      } else if (!tab) {
        window.open(finalUrl, '_blank', 'noopener')
      }
    })
}
