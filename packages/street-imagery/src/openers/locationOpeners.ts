import { peekStreetImageryConfig } from '../config'
import { assertIsoDate, parseIsoDateStartMs } from '../filters/searchFilters'
import {
  bestTargetImage,
  panoX,
  PLACE_TARGET,
  viewFromLocation,
  type TargetImage,
} from '../mapillary/targetView'
import { fetchStreetViewMetadata, getGoogleMapsApiKey } from '../providers/adapters/streetview'
import type { Bbox, NormalizedPhoto, ProviderId } from '../providers/model'
import { providerById } from '../providers/registry'
import { providerLocationLink } from '../viewer/externalLinks'
import { angleDiffDeg, bearingDeg, type LngLat } from '../viewpoints/geometry'
import { fetchMapillaryImagesNearPoint } from '../viewpoints/mapillaryRadiusSearch'
import { buildInfra3dUrl, getInfra3dProjects } from './infra3d'

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

/** Provider ids, plus one id per configured infra3D project (`infra3d:<project uid>`). */
export type LocationOpenerId = (typeof PROVIDER_OPENER_IDS)[number] | `infra3d:${string}`

/** The place to look at (not where the camera stands): a clicked point, a feature's centroid … */
export type OpenTarget = {
  lngLat: LngLat
  /** Map zoom, for services that open on a map. */
  zoom?: number
  /**
   * Show only photos from this day on (`YYYY-MM-DD`). Mapillary only: the other services have no
   * such link param and ignore it. Throws when it is not a real day.
   */
  dateFrom?: string
}

export type LocationOpener = {
  id: LocationOpenerId
  label: string
  color: string
  /** `false` when the host config lacks what the service needs. */
  isAvailable: () => boolean
  /**
   * `false` when the service has no imagery at the place (Vegbilder outside Norway, an infra3D
   * project outside its `bbox`); hide the link then. Services without a known area cover all.
   */
  covers: (lngLat: LngLat) => boolean
  /**
   * `true` when the service shows its images only to people with an account (infra3D): everyone
   * else lands on its login page. Mark such links, e.g. with a lock icon.
   */
  requiresAccount: boolean
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

/** Without a bbox every place is inside. */
const bboxContains = (bbox: Bbox | undefined, [lng, lat]: LngLat): boolean =>
  !bbox || (lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3])

const round = (value: number, digits: number) => Number(value.toFixed(digits))

/**
 * Mapillary web app link to the image that shows the target best, turned to it (360° images:
 * the `x`/`y`/`zoom` view params; flat images are picked by their heading).
 */
export const mapillaryLookAtUrl = (
  photos: readonly NormalizedPhoto[],
  target: LngLat,
  { dateFrom }: { dateFrom?: string } = {},
): string | null => {
  const fromMs = dateFrom == null ? null : parseIsoDateStartMs(assertIsoDate(dateFrom))
  const headingById = new Map<string, number>()
  const images: TargetImage[] = []
  for (const photo of photos) {
    if (photo.capturedAt == null || photo.heading == null) {
      continue
    }
    if (fromMs != null && photo.capturedAt < fromMs) {
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
  if (dateFrom != null) {
    params.push(`dateFrom=${dateFrom}`)
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
  covers: (lngLat) => bboxContains(providerById[id].coverage?.bbox, lngLat),
  requiresAccount: false,
  locationUrl: ({ lngLat: [lng, lat], zoom, dateFrom }) =>
    providerLocationLink(id, lat, lng, zoom, { dateFrom }),
})

const mapillaryOpener: LocationOpener = {
  ...providerOpener('mapillary'),
  lookAtUrl: async ({ lngLat, dateFrom }, signal) => {
    if (!peekStreetImageryConfig()?.mapillaryToken) {
      return null
    }
    return mapillaryLookAtUrl(await fetchMapillaryImagesNearPoint(lngLat, {}, signal), lngLat, {
      dateFrom,
    })
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
export const infra3dOpeners = (): LocationOpener[] =>
  getInfra3dProjects().map(({ uid, label, bbox }) => ({
    id: `infra3d:${uid}`,
    label,
    color: '#0F766E',
    isAvailable: () => true,
    covers: (lngLat) => bboxContains(bbox, lngLat),
    requiresAccount: true,
    locationUrl: ({ lngLat: [lng, lat] }) =>
      buildInfra3dUrl({ mode: 'lookAt', lng, lat, projectUid: uid }),
  }))

/** The photo providers' openers. `getLocationOpeners()` adds the infra3D projects. */
export const LOCATION_OPENERS: LocationOpener[] = [
  mapillaryOpener,
  providerOpener('panoramax'),
  providerOpener('kartaview'),
  providerOpener('mapilio'),
  providerOpener('streetside'),
  providerOpener('vegbilder'),
  streetViewOpener,
  providerOpener('lookaround'),
]

/** All openers: the photo providers, then one per infra3D project of the config. */
export const getLocationOpeners = (): LocationOpener[] => [...LOCATION_OPENERS, ...infra3dOpeners()]

/** The openers that have imagery at the place (`covers`) and all they need (`isAvailable`). */
export const getLocationOpenersAt = (lngLat: LngLat): LocationOpener[] =>
  getLocationOpeners().filter((opener) => opener.isAvailable() && opener.covers(lngLat))

export const findLocationOpener = (id: LocationOpenerId): LocationOpener | undefined =>
  getLocationOpeners().find((opener) => opener.id === id)

/**
 * Open the place in a new tab (or window, see `openExternalUrl`). Call it directly in the click handler: the tab is opened before
 * the look-at request, else popup blockers stop it. Falls back to `locationUrl` when there is no
 * image to look from, the request fails, or it takes longer than `timeoutMs`.
 */
/** Size of the separate window for `openLinksIn: 'window'`; browsers keep it on screen. */
const NEW_WINDOW_FEATURES = 'popup,width=1280,height=860'

/** `window.open` features for the configured `openLinksIn` (tab by default). */
const windowFeatures = (noopener: boolean): string | undefined => {
  const asWindow = peekStreetImageryConfig()?.openLinksIn === 'window'
  const features = [noopener ? 'noopener' : null, asWindow ? NEW_WINDOW_FEATURES : null].filter(
    Boolean,
  )
  return features.length > 0 ? features.join(',') : undefined
}

/**
 * Open a link to another service in a new tab, or in a separate window with
 * `createStreetImageryConfig({ openLinksIn: 'window' })`. Call it in a click handler.
 */
export const openExternalUrl = (url: string): void => {
  window.open(url, '_blank', windowFeatures(true))
}

export const openLocationInNewTab = (
  opener: LocationOpener,
  target: OpenTarget,
  { timeoutMs = 8000 }: { timeoutMs?: number } = {},
): void => {
  const fallbackUrl = opener.locationUrl(target)
  if (!opener.lookAtUrl) {
    openExternalUrl(fallbackUrl)
    return
  }

  // `noopener` would hide the tab from us; cut the link back to this page by hand instead.
  const tab = window.open('about:blank', '_blank', windowFeatures(false))
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
        openExternalUrl(finalUrl)
      }
    })
}
