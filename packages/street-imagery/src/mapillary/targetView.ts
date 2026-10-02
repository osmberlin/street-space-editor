import { bearingDeg, distanceMeters, type LngLat } from '../viewpoints/geometry'

/**
 * Which image shows a target (a traffic sign, a traffic light, a junction) best, and where the
 * target is in it. From the iD Radnetz fork (feature 26), generalized from signs to any target.
 * Pure; image positions are Mapillary JS "basic" coordinates (`[0, 0]` top left, `[1, 1]` bottom
 * right; for 360° images the whole panorama).
 */

export type TargetImage = {
  id: string
  /** Mapillary's computed position (used for the view math; map features are located from it). */
  lngLat: LngLat
  /** The camera's GPS position, where image markers are usually drawn. */
  originalLngLat?: LngLat | null
  /** Capture time in ms. */
  capturedAt: number
  isPano: boolean
  username?: string | null
  /** The target's outline in this image, if Mapillary detected it there. */
  outline?: [number, number][]
}

export type TargetImageDay = {
  /** `YYYY-MM-DD` (UTC). */
  day: string
  images: TargetImage[]
  /** The day's image that shows the target best (`compareTargetImages`). */
  best: TargetImage
}

export type ViewTarget = { center: [number, number]; zoom: number }

export type TargetShape = {
  /** Width of the target in meters; decides the zoom. */
  widthMeters: number
  /** Height of the target's center above the camera in meters (negative: below, e.g. markings). */
  aboveCameraMeters: number
  /** Images about this far away show the target best. */
  goodDistanceMeters: number
  maxZoom: number
}

/** A traffic sign: 65 cm wide, slightly above a 360° camera, best seen from ~10 m. */
export const SIGN_TARGET: TargetShape = {
  widthMeters: 0.65,
  aboveCameraMeters: 0.25,
  goodDistanceMeters: 10,
  maxZoom: 3,
}

/** A junction or another place on the ground: wide, below the camera, best seen from ~20 m. */
export const PLACE_TARGET: TargetShape = {
  widthMeters: 15,
  aboveCameraMeters: -2,
  goodDistanceMeters: 20,
  maxZoom: 1,
}

/** Horizontal field of view of the viewer at zoom 0, and the share of it the target should fill. */
const VIEW_FOV_AT_ZOOM_0 = 115
const TARGET_SHARE = 0.3

/**
 * Better images first: those where Mapillary outlined the target (the view can be aimed exactly),
 * then those nearest to the good distance (an image right below a sign does not show it).
 */
export const compareTargetImages = (
  a: TargetImage,
  b: TargetImage,
  target: LngLat,
  shape: TargetShape = SIGN_TARGET,
): number => {
  if (!!a.outline !== !!b.outline) {
    return a.outline ? -1 : 1
  }
  const score = (image: TargetImage) =>
    Math.abs(
      Math.log(Math.max(distanceMeters(image.lngLat, target), 0.5) / shape.goodDistanceMeters),
    )
  return score(a) - score(b)
}

/** The images grouped by capture day, newest day first, each day's images best first. */
export const targetImagesByDay = (
  images: readonly TargetImage[],
  target: LngLat,
  shape: TargetShape = SIGN_TARGET,
): TargetImageDay[] => {
  const days = new Map<string, TargetImage[]>()
  for (const image of images) {
    const day = new Date(image.capturedAt).toISOString().slice(0, 10)
    const list = days.get(day) ?? []
    list.push(image)
    days.set(day, list)
  }
  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, list]) => {
      const sorted = [...list].sort((a, b) => compareTargetImages(a, b, target, shape))
      return { day, images: sorted, best: sorted[0] as TargetImage }
    })
}

/**
 * The image to show first: the newest day's best image; from `minCapturedAt` on if any image is
 * that recent, else from all.
 */
export const bestTargetImage = (
  images: readonly TargetImage[],
  target: LngLat,
  { shape = SIGN_TARGET, minCapturedAt }: { shape?: TargetShape; minCapturedAt?: number } = {},
): TargetImage | undefined => {
  const recent =
    minCapturedAt == null ? images : images.filter((image) => image.capturedAt >= minCapturedAt)
  return targetImagesByDay(recent.length > 0 ? recent : images, target, shape)[0]?.best
}

const zoomForAngle = (degrees: number, maxZoom: number): number => {
  if (!(degrees > 0)) {
    return 0
  }
  return Math.max(0, Math.min(maxZoom, Math.log2((VIEW_FOV_AT_ZOOM_0 * TARGET_SHARE) / degrees)))
}

/** View on the target from its outline in the image. */
export const viewFromOutline = (
  outline: readonly [number, number][],
  isPano: boolean,
  maxZoom = SIGN_TARGET.maxZoom,
): ViewTarget | undefined => {
  if (outline.length === 0) {
    return undefined
  }
  const xs = outline.map((point) => point[0])
  const ys = outline.map((point) => point[1])
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ]
  const size = Math.max(maxX - minX, maxY - minY)
  // A flat image at zoom 0 shows its whole width.
  const zoom = isPano
    ? zoomForAngle(size * 360, maxZoom)
    : Math.max(0, Math.min(maxZoom, Math.log2(TARGET_SHARE / size)))
  return { center: [(minX + maxX) / 2, (minY + maxY) / 2], zoom }
}

/**
 * Horizontal position of a compass bearing in a 360° image whose center looks along
 * `compassAngle` (a rough estimate; the viewer's own projection is more exact).
 */
export const panoX = (bearing: number, compassAngle: number): number => {
  const x = 0.5 + (bearing - compassAngle) / 360
  return ((x % 1) + 1) % 1
}

/**
 * View on the target in a 360° image: `x` is the target's horizontal position (from the viewer's
 * projection, or `panoX`); height and zoom come from the distance.
 */
export const viewFromLocation = (
  x: number,
  image: Pick<TargetImage, 'lngLat' | 'isPano'>,
  target: LngLat,
  shape: TargetShape = SIGN_TARGET,
): ViewTarget => {
  const distance = Math.max(distanceMeters(image.lngLat, target), 1)
  const elevation = (Math.atan(shape.aboveCameraMeters / distance) * 180) / Math.PI
  const y = image.isPano ? 0.5 - elevation / 180 : 0.45
  const width = (2 * Math.atan(shape.widthMeters / 2 / distance) * 180) / Math.PI
  return { center: [x, y], zoom: zoomForAngle(width, shape.maxZoom) }
}

/** A flat (perspective) camera as Mapillary describes it. */
export type FlatCamera = {
  /** Focal length relative to the larger image side. */
  focal: number
  width: number
  height: number
  /** Compass direction the camera looks at. */
  compassAngle: number
  /** Degrees, negative = looking down. */
  pitch: number
}

/** Flat images are mostly taken lower than 360° ones, so targets are higher above the camera. */
const FLAT_CAMERA_BELOW_PANO_METERS = 1.25
const MAX_FLAT_ZOOM = 2

/**
 * View on the target in a flat image (pinhole model, without lens distortion); `undefined` when
 * the target is outside the image. The zoom stays moderate because locations are a few meters off.
 */
export const viewFromFlatCamera = (
  camera: FlatCamera,
  imageLngLat: LngLat,
  target: LngLat,
  shape: TargetShape = SIGN_TARGET,
): ViewTarget | undefined => {
  const rad = Math.PI / 180
  const size = Math.max(camera.width, camera.height)
  const distance = Math.max(distanceMeters(imageLngLat, target), 1)
  const delta = ((bearingDeg(imageLngLat, target) - camera.compassAngle + 540) % 360) - 180
  if (Math.abs(delta) >= 80) {
    return undefined
  }
  const x = 0.5 + (camera.focal * Math.tan(delta * rad) * size) / camera.width
  if (x < 0 || x > 1) {
    return undefined
  }
  const above = shape.aboveCameraMeters + FLAT_CAMERA_BELOW_PANO_METERS
  const elevation = Math.atan(above / distance) / rad - camera.pitch
  const y = Math.max(
    0,
    Math.min(1, 0.5 - (camera.focal * Math.tan(elevation * rad) * size) / camera.height),
  )
  const fov = (2 * Math.atan((0.5 * camera.width) / size / camera.focal)) / rad
  const width = (2 * Math.atan(shape.widthMeters / 2 / distance)) / rad
  const zoom = Math.max(
    0,
    Math.min(Math.min(MAX_FLAT_ZOOM, shape.maxZoom), Math.log2((fov * TARGET_SHARE) / width)),
  )
  return { center: [x, y], zoom }
}

/**
 * Pitch in degrees of a camera from Mapillary's rotation (axis-angle, world to camera; world z is
 * up, the camera looks along its z axis).
 */
export const cameraPitch = (rotation: readonly number[]): number => {
  const [rx = 0, ry = 0, rz = 0] = rotation
  const angle = Math.hypot(rx, ry, rz)
  if (!angle) {
    return 0
  }
  const kz = rz / angle
  // The vertical part of the viewing direction: matrix entry R33 of Rodrigues' formula.
  const up = Math.cos(angle) + (1 - Math.cos(angle)) * kz * kz
  return (Math.asin(Math.max(-1, Math.min(1, up))) * 180) / Math.PI
}

/**
 * The two lines of a capture day button: month and year ("Aug. 2026") and the age in short
 * ("vor 2 Monaten"): days below 45 days, months below 2 years, then years.
 */
export const dayLabels = (
  day: string,
  now: number,
  locale?: string,
): { month: string; age: string } => {
  const date = new Date(`${day}T12:00:00Z`)
  const month = date.toLocaleDateString(locale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const days = Math.max(0, Math.round((now - date.getTime()) / 86_400_000))
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' })
  const age =
    days < 45
      ? formatter.format(-days, 'day')
      : days < 730
        ? formatter.format(-Math.round(days / 30.44), 'month')
        : formatter.format(-Math.round(days / 365.25), 'year')
  return { month, age }
}
