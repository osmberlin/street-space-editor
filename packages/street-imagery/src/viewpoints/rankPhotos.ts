import type { PhotoTypeFilter } from '../filters/searchFilters'
import type { NormalizedPhoto } from '../providers/model'
import { angleDiffDeg, bearingDeg, distanceMeters } from './geometry'
import { viewDirections, type ViewDirection, type Viewpoint } from './viewpoints'

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000

export type RankPhotosOptions = {
  /** Reference time for age filter + recency score (ms). */
  now: number
  /** Drop photos older than this (ms). */
  maxAgeMs?: number
  /** Drop photos farther than this from the viewpoint. */
  maxDistanceMeters?: number
  /** Flat photos must point within this many degrees of the wanted direction. */
  maxFlatAngleDeg?: number
  /**
   * App photo-type filter. Flat photos are preferred over panos (a flat photo's heading is part of
   * "this photo looks that way") unless only `pano` is allowed.
   */
  photoTypes?: PhotoTypeFilter[]
  /** Candidates kept per direction. */
  limit?: number
}

export type PhotoCandidate = {
  photo: NormalizedPhoto
  /** Lower is better. */
  score: number
  distanceMeters: number
  /** Heading difference to the wanted direction; 0 for panos (the viewer turns to the bearing). */
  angleDiff: number
  ageYears: number | null
}

export type ViewSuggestion = {
  direction: ViewDirection
  viewpoint: Viewpoint
  candidates: PhotoCandidate[]
}

const DEFAULTS = {
  maxDistanceMeters: 50,
  maxFlatAngleDeg: 50,
  limit: 5,
}

/** Photos taken beyond the viewpoint (looking away from it) are penalized from this distance. */
const POSITION_CHECK_MIN_METERS = 8
const PANO_PENALTY = 0.6
const AGE_WEIGHT = 0.35
const POSITION_WEIGHT = 1.5

export const scorePhotoForDirection = (
  photo: NormalizedPhoto,
  viewpoint: Viewpoint,
  direction: ViewDirection,
  options: RankPhotosOptions,
): PhotoCandidate | null => {
  const maxDistance = options.maxDistanceMeters ?? DEFAULTS.maxDistanceMeters
  const maxFlatAngle = options.maxFlatAngleDeg ?? DEFAULTS.maxFlatAngleDeg
  const photoTypes = options.photoTypes
  const isPano = photo.isPano === true

  if (photoTypes && !photoTypes.includes(isPano ? 'pano' : 'flat')) {
    return null
  }

  const distance = distanceMeters(viewpoint.lngLat, photo.lngLat)
  if (distance > maxDistance) {
    return null
  }

  const ageYears = photo.capturedAt == null ? null : (options.now - photo.capturedAt) / YEAR_MS
  if (
    options.maxAgeMs != null &&
    (photo.capturedAt == null || options.now - photo.capturedAt > options.maxAgeMs)
  ) {
    return null
  }

  let angleDiff = 0
  if (!isPano) {
    if (photo.heading == null) {
      return null
    }
    angleDiff = angleDiffDeg(photo.heading, direction.bearing)
    if (angleDiff > maxFlatAngle) {
      return null
    }
  }

  // A good photo stands behind the viewpoint: looking from the photo towards the viewpoint is
  // roughly the wanted direction. Photos taken past the viewpoint see something else.
  let positionPenalty = 0
  if (distance >= POSITION_CHECK_MIN_METERS) {
    const offAxis = angleDiffDeg(bearingDeg(photo.lngLat, viewpoint.lngLat), direction.bearing)
    if (offAxis > 100) {
      return null
    }
    positionPenalty = (offAxis / 100) * POSITION_WEIGHT
  }

  const prefersFlat = !photoTypes || photoTypes.includes('flat')
  const score =
    (isPano ? 0 : angleDiff / maxFlatAngle) +
    distance / maxDistance +
    (ageYears ?? 10) * AGE_WEIGHT +
    (isPano && prefersFlat ? PANO_PENALTY : 0) +
    positionPenalty

  return { photo, score, distanceMeters: distance, angleDiff, ageYears }
}

export const rankPhotosForDirection = (
  photos: NormalizedPhoto[],
  viewpoint: Viewpoint,
  direction: ViewDirection,
  options: RankPhotosOptions,
): PhotoCandidate[] => {
  const seen = new Set<string>()
  const candidates: PhotoCandidate[] = []
  for (const photo of photos) {
    const key = `${photo.providerId}:${photo.photoId}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    const candidate = scorePhotoForDirection(photo, viewpoint, direction, options)
    if (candidate) {
      candidates.push(candidate)
    }
  }
  candidates.sort((a, b) => a.score - b.score)
  return candidates.slice(0, options.limit ?? DEFAULTS.limit)
}

/** One suggestion per viewpoint × direction, in viewpoint order. */
export const buildViewSuggestions = (
  viewpoints: Viewpoint[],
  photosForViewpoint: (viewpoint: Viewpoint) => NormalizedPhoto[],
  options: RankPhotosOptions,
): ViewSuggestion[] =>
  viewpoints.flatMap((viewpoint) => {
    const photos = photosForViewpoint(viewpoint)
    return viewDirections(viewpoint).map((direction) => ({
      direction,
      viewpoint,
      candidates: rankPhotosForDirection(photos, viewpoint, direction, options),
    }))
  })

/** Years → ms, for `maxAgeMs`. */
export const yearsToMs = (years: number): number => years * YEAR_MS
