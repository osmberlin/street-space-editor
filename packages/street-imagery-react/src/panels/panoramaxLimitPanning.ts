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

/** Clamp to `[min, max]`; a range narrower than the view (min > max) gives its centre. */
const clampOrCentre = (value: number, min: number, max: number) =>
  min > max ? (min + max) / 2 : Math.max(min, Math.min(max, value))

/**
 * The view position moved back so the view stays inside the image. Flat photos are shown as a
 * small patch of a sphere; outside the patch there is only black. 360° photos have no limit.
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
    yaw = clampOrCentre(centred, left + halfH, right - halfH)
  }
  if (crop.croppedHeight < crop.fullHeight) {
    const top = Math.PI / 2 - (crop.croppedY / crop.fullHeight) * Math.PI
    const bottom = Math.PI / 2 - ((crop.croppedY + crop.croppedHeight) / crop.fullHeight) * Math.PI
    pitch = clampOrCentre(pitch, bottom + halfV, top - halfV)
  }
  return { yaw, pitch }
}

const toDeg = (radians: number) => (radians * 180) / Math.PI

/**
 * The zoom level at which the view is exactly as large as the image (in the tighter direction),
 * or `null` when there is no limit. Zooming out further shows black around a flat photo.
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
  return psv.dataHelper.fovToZoomLevel(widestV)
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
