import {
  bearingDeg,
  fetchImageDetections,
  cameraPitch,
  panoX,
  SIGN_TARGET,
  viewFromFlatCamera,
  viewFromLocation,
  viewFromOutline,
  type LngLat,
  type MapillaryDetection,
  type TargetShape,
  type ViewTarget,
} from '@osm-editor-kit/street-imagery'
import {
  OutlineTag,
  PolygonGeometry,
  type Image,
  type TagComponent,
  type Viewer,
} from 'mapillary-js'

/** A place the Mapillary viewer should turn to: a sign, a traffic light, a junction … */
export type MapillaryLookAt = {
  lngLat: LngLat
  /** Size and height of the target; decides zoom and vertical position. Default: a traffic sign. */
  shape?: TargetShape
  /** The target's outline in the shown image, if known; it is more exact than the location. */
  outline?: [number, number][]
  /**
   * Mapillary value of the target (`regulatory--bicycles-only--g1`). Without an `outline`, the
   * image's own detection of this value is used: Mapillary links a map feature to few of its
   * images, but almost every image has a detection of it. With several, the one nearest to the
   * computed position wins (the computed position alone can be far off in 360° images).
   */
  value?: string
  /** Label for the outline drawn around the target. */
  label?: string
}

export type MapillaryViewerOutline = {
  id: string
  /** Image ("basic") coordinates, `[0, 0]` top left to `[1, 1]` bottom right. */
  outline: [number, number][]
  label?: string
  /** CSS color number, e.g. `0xffff00`. Default yellow. */
  color?: number
}

const isSpherical = (image: Image) =>
  image.cameraType === 'spherical' || image.cameraType === 'equirectangular'

/**
 * Where the target is in the image: from its outline, else computed from the locations
 * (360°: the viewer's own projection; flat: a pinhole model). `undefined` when a flat image does
 * not show the target.
 */
export const mapillaryViewFor = async (
  viewer: Viewer,
  image: Image,
  { lngLat, shape = SIGN_TARGET, outline }: MapillaryLookAt,
): Promise<ViewTarget | undefined> => {
  const spherical = isSpherical(image)
  if (outline?.length) {
    return viewFromOutline(outline, spherical, shape.maxZoom)
  }
  // Mapillary locates map features from the computed position, so use it for the math.
  const position = image.lngLat ?? image.originalLngLat
  const imageLngLat: LngLat = [position.lng, position.lat]
  const compass = image.computedCompassAngle ?? image.compassAngle

  if (!spherical) {
    const focal = image.cameraParameters?.[0]
    return focal
      ? viewFromFlatCamera(
          {
            focal,
            width: image.width,
            height: image.height,
            compassAngle: compass,
            pitch: cameraPitch(image.rotation),
          },
          imageLngLat,
          lngLat,
          shape,
        )
      : undefined
  }

  // First a rough direction from the compass, then the viewer's own projection of the location.
  let x = panoX(bearingDeg(imageLngLat, lngLat), compass)
  try {
    viewer.setCenter([x, 0.5])
    const pixel = await viewer.project({ lng: lngLat[0], lat: lngLat[1] })
    const basic = pixel ? await viewer.unprojectToBasic(pixel) : null
    const projected = basic?.[0]
    if (projected != null && projected >= 0 && projected <= 1) {
      x = projected
    }
  } catch {
    // Keep the estimate.
  }
  return viewFromLocation(x, { lngLat: imageLngLat, isPano: true }, lngLat, shape)
}

/** Horizontal distance of two image positions; 360° images wrap around. */
const xDistance = (a: number, b: number, spherical: boolean) => {
  const distance = Math.abs(a - b)
  return spherical ? Math.min(distance, 1 - distance) : distance
}

/** The image's own detection of the target's value, nearest to the computed position. */
const findOwnDetection = async (
  image: Image,
  value: string,
  estimate: ViewTarget | undefined,
): Promise<MapillaryDetection | undefined> => {
  const spherical = isSpherical(image)
  const candidates = await fetchImageDetections(image.id, { filter: (v) => v === value }).catch(
    () => [],
  )
  const centerX = (detection: MapillaryDetection) =>
    viewFromOutline(detection.outline, spherical)?.center[0] ?? 0.5
  return candidates.sort((a, b) =>
    estimate
      ? xDistance(centerX(a), estimate.center[0], spherical) -
        xDistance(centerX(b), estimate.center[0], spherical)
      : 0,
  )[0]
}

/**
 * Turns the viewer to the target. Returns the outline it aimed at (given, or the image's own
 * detection of `value`), or `null` when it aimed by location; `false` when the shown (flat) image
 * does not show the target.
 */
export const turnMapillaryViewerTo = async (
  viewer: Viewer,
  image: Image,
  lookAt: MapillaryLookAt,
): Promise<MapillaryViewerOutline | null | false> => {
  let outline = lookAt.outline?.length ? lookAt.outline : undefined
  let outlineId = `look-at-${image.id}`
  let view: ViewTarget | undefined
  if (!outline) {
    view = await mapillaryViewFor(viewer, image, lookAt)
    const own = lookAt.value ? await findOwnDetection(image, lookAt.value, view) : undefined
    if (own) {
      outline = own.outline
      outlineId = own.id
    }
  }
  if (outline) {
    view = viewFromOutline(outline, isSpherical(image), (lookAt.shape ?? SIGN_TARGET).maxZoom)
  }
  if (!view) {
    return false
  }
  viewer.setCenter(view.center)
  viewer.setZoom(view.zoom)
  return outline ? { id: outlineId, outline, label: lookAt.label } : null
}

/** Replaces the outlines drawn in the viewer (needs the viewer's `tag` component). */
export const setMapillaryViewerOutlines = (
  viewer: Viewer,
  outlines: readonly MapillaryViewerOutline[],
) => {
  const tags = viewer.getComponent<TagComponent>('tag')
  tags.removeAll()
  tags.add(
    outlines
      .filter(({ outline }) => outline.length >= 3)
      .map(({ id, outline, label, color = 0xffff00 }) => {
        // Polygons must be closed.
        const first = outline[0] as [number, number]
        const last = outline[outline.length - 1] as [number, number]
        const closed = first[0] === last[0] && first[1] === last[1] ? outline : [...outline, first]
        return new OutlineTag(id, new PolygonGeometry(closed), {
          text: label,
          textColor: color,
          lineColor: color,
          lineWidth: 2,
          fillColor: color,
          fillOpacity: 0.3,
        })
      }),
  )
}
