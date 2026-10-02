/** The parts of Photo Sphere Viewer (inside the Panoramax viewer) that limiting the view needs. */
export type PsvForPanLimit = {
  state: {
    hFov: number
    vFov: number
    textureData?: {
      panoData?: {
        baseData?: {
          fullWidth: number
          fullHeight: number
          croppedWidth: number
          croppedHeight: number
          croppedX: number
          croppedY: number
        }
      }
    }
  }
  dataHelper: { fovToZoomLevel(fov: number): number }
  getZoomLevel(): number
  zoom(level: number): void
  getPosition(): { yaw: number; pitch: number }
  rotate(position: { yaw: number; pitch: number }): void
  addEventListener(type: string, listener: (event: Event) => void): void
  removeEventListener(type: string, listener: (event: Event) => void): void
}

type ViewPosition = { yaw: number; pitch: number }

const toRad = (degrees: number) => (degrees * Math.PI) / 180

/** At least this share of the image (or of the view, when that is smaller) stays in view. */
const MIN_VISIBLE_SHARE = 0.3

/** How far out the view may zoom: the image then fills this share of the view. */
const MIN_IMAGE_SHARE_OF_VIEW = 0.8

/**
 * Keep the view centre where at least `MIN_VISIBLE_SHARE` of the image is still in view: the
 * edges and some black beyond them can be seen, but the image cannot be pushed out of sight.
 */
const keepInView = (centre: number, imageMin: number, imageMax: number, halfView: number) => {
  const keep = MIN_VISIBLE_SHARE * Math.min(imageMax - imageMin, 2 * halfView)
  return Math.max(imageMin - halfView + keep, Math.min(imageMax + halfView - keep, centre))
}

/**
 * The view position moved back so the image stays in view. Flat photos are shown as a small
 * patch of a sphere; outside the patch there is only black. 360° photos have no limit.
 */
export const limitToImage = (psv: PsvForPanLimit, position: ViewPosition): ViewPosition => {
  const crop = psv.state.textureData?.panoData?.baseData
  if (!crop || !crop.fullWidth || !crop.fullHeight) {
    return position
  }
  const halfH = toRad(psv.state.hFov) / 2
  const halfV = toRad(psv.state.vFov) / 2
  let { yaw, pitch } = position

  if (crop.croppedWidth < crop.fullWidth) {
    const left = (crop.croppedX / crop.fullWidth) * 2 * Math.PI - Math.PI
    const right = ((crop.croppedX + crop.croppedWidth) / crop.fullWidth) * 2 * Math.PI - Math.PI
    // The viewer counts yaw from 0 to 2π; the image sits around 0.
    const centred = yaw > Math.PI ? yaw - 2 * Math.PI : yaw
    yaw = keepInView(centred, left, right, halfH)
  }
  if (crop.croppedHeight < crop.fullHeight) {
    const top = Math.PI / 2 - (crop.croppedY / crop.fullHeight) * Math.PI
    const bottom = Math.PI / 2 - ((crop.croppedY + crop.croppedHeight) / crop.fullHeight) * Math.PI
    pitch = keepInView(pitch, bottom, top, halfV)
  }
  return { yaw, pitch }
}

const toDeg = (radians: number) => (radians * 180) / Math.PI

/**
 * The widest zoom level for a flat photo: the image with a small margin around it (in the
 * tighter direction). `null` when there is no limit.
 */
export const widestZoomLevel = (psv: PsvForPanLimit): number | null => {
  const crop = psv.state.textureData?.panoData?.baseData
  if (!crop || !crop.fullWidth || !crop.fullHeight) {
    return null
  }
  const flatWide = crop.croppedWidth < crop.fullWidth
  const flatHigh = crop.croppedHeight < crop.fullHeight
  if (!flatWide && !flatHigh) {
    return null
  }
  const imageV = (crop.croppedHeight / crop.fullHeight) * 180
  const imageH = (crop.croppedWidth / crop.fullWidth) * 360
  // The view's width follows from its height and the viewer's shape (aspect ratio).
  const aspect = Math.tan(toRad(psv.state.hFov) / 2) / Math.tan(toRad(psv.state.vFov) / 2)
  const vForImageWidth = toDeg(2 * Math.atan(Math.tan(toRad(Math.min(imageH, 179)) / 2) / aspect))
  const widestV = Math.min(flatHigh ? imageV : 180, flatWide ? vForImageWidth : 180)
  return psv.dataHelper.fovToZoomLevel(Math.min(widestV / MIN_IMAGE_SHARE_OF_VIEW, 179))
}

/**
 * Keep the view inside the image while the user pans and zooms. Returns a function that removes
 * the listeners again.
 */
export const limitPanningToImage = (psv: PsvForPanLimit): (() => void) => {
  const onMove = (event: Event) => {
    const move = event as Event & { position?: ViewPosition }
    if (move.position) {
      move.position = limitToImage(psv, move.position)
    }
  }
  // Zooming out widens the view; pull it back in when it now reaches past the image.
  const onZoomOrLoad = () => {
    const widest = widestZoomLevel(psv)
    if (widest != null && psv.getZoomLevel() < widest - 0.01) {
      // Fires this handler again, which then checks the position.
      psv.zoom(widest)
      return
    }
    const current = psv.getPosition()
    const limited = limitToImage(psv, current)
    if (
      Math.abs(limited.yaw - current.yaw) > 1e-4 ||
      Math.abs(limited.pitch - current.pitch) > 1e-4
    ) {
      psv.rotate(limited)
    }
  }
  psv.addEventListener('before-rotate', onMove)
  psv.addEventListener('before-animate', onMove)
  psv.addEventListener('zoom-updated', onZoomOrLoad)
  psv.addEventListener('panorama-loaded', onZoomOrLoad)
  return () => {
    psv.removeEventListener('before-rotate', onMove)
    psv.removeEventListener('before-animate', onMove)
    psv.removeEventListener('zoom-updated', onZoomOrLoad)
    psv.removeEventListener('panorama-loaded', onZoomOrLoad)
  }
}
