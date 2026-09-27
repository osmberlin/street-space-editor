import { getStreetImageryConfig } from '@osm-editor-kit/street-imagery'
import type { NormalizedPhoto } from '@osm-editor-kit/street-imagery'
import 'mapillary-js/dist/mapillary.css'

import {
  Viewer,
  type ViewerBearingEvent,
  type ViewerImageEvent,
  type ViewerNavigableEvent,
} from 'mapillary-js'
import { useEffect, useEffectEvent, useRef } from 'react'
import type { StreetImageryPhotoSelection } from '../types'
import { useViewerActions } from '../useViewerStore'
type MapillaryPanelProps = {
  photo: NormalizedPhoto
  groupPhotos: NormalizedPhoto[]
  onPhotoSelected: (selection: StreetImageryPhotoSelection) => void
  onEaseMapToPoint: (lng: number, lat: number) => void
  /** Full photo data for each image the viewer shows (incl. native prev/next navigation). */
  onViewerPhoto?: (photo: NormalizedPhoto) => void
  /** 360° photos: turn the view to this map bearing when `photo` opens (e.g. a suggested view). */
  lookAtBearing?: number | null
}

/** Mapillary spherical basic x for a map bearing; x = 0.5 is the image compass direction. */
const panoCenterX = (bearing: number, compassAngle: number) =>
  (((0.5 + (bearing - compassAngle) / 360) % 1) + 1) % 1

export const MapillaryPanel = ({
  photo,
  onPhotoSelected,
  onEaseMapToPoint,
  onViewerPhoto,
  lookAtBearing,
}: MapillaryPanelProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const navigableRef = useRef(false)
  const pendingImageIdRef = useRef<string | null>(null)
  const lastViewerPhotoIdRef = useRef<string | null>(null)
  const bearingRafRef = useRef<number | null>(null)
  const pendingBearingRef = useRef<number | null>(null)
  const actions = useViewerActions()
  const initialPhotoIdRef = useRef(photo.photoId)
  // Callbacks may change identity every render; the viewer must not remount for that.
  const emitPhotoSelected = useEffectEvent(onPhotoSelected)
  const emitEaseMapToPoint = useEffectEvent(onEaseMapToPoint)
  const turnToWantedBearing = useEffectEvent((viewer: Viewer, image: ViewerImageEvent['image']) => {
    const spherical = image.cameraType === 'spherical' || image.cameraType === 'equirectangular'
    const compass = image.computedCompassAngle ?? image.compassAngle
    if (image.id === photo.photoId && lookAtBearing != null && spherical && compass != null) {
      viewer.setCenter([panoCenterX(lookAtBearing, compass), 0.5])
    }
  })
  const emitViewerPhoto = useEffectEvent((viewerPhoto: NormalizedPhoto) =>
    onViewerPhoto?.(viewerPhoto),
  )

  useEffect(
    function resetViewerStoreOnProviderChange() {
      return () => {
        actions.reset()
      }
    },
    [actions, photo.providerId],
  )

  useEffect(
    function mountMapillaryViewer() {
      const container = containerRef.current
      if (!container) {
        return
      }

      const viewer = new Viewer({
        accessToken: getStreetImageryConfig().mapillaryToken,
        container,
        imageId: initialPhotoIdRef.current,
        component: {
          cover: false,
          sequence: { visible: true },
        },
      })
      viewerRef.current = viewer
      lastViewerPhotoIdRef.current = initialPhotoIdRef.current

      const flushPendingMove = () => {
        const pendingId = pendingImageIdRef.current
        if (!pendingId) {
          return
        }
        pendingImageIdRef.current = null
        void viewer.moveTo(pendingId).catch(() => {})
      }

      const onNavigable = (event: ViewerNavigableEvent) => {
        navigableRef.current = event.navigable
        if (event.navigable) {
          flushPendingMove()
        }
      }

      const onImage = (event: ViewerImageEvent) => {
        const { image } = event
        lastViewerPhotoIdRef.current = image.id
        turnToWantedBearing(viewer, image)

        emitPhotoSelected({
          provider: 'mapillary',
          sequenceId: image.sequenceId,
          photoId: image.id,
        })

        const position = image.lngLat ?? image.originalLngLat
        if (!position) {
          return
        }

        emitViewerPhoto({
          providerId: 'mapillary',
          photoId: image.id,
          sequenceId: image.sequenceId,
          capturedAt: image.capturedAt,
          isPano: image.cameraType === 'spherical' || image.cameraType === 'equirectangular',
          heading: image.computedCompassAngle ?? image.compassAngle,
          lngLat: [position.lng, position.lat],
        })

        actions.setPov({ lngLat: [position.lng, position.lat] })
        emitEaseMapToPoint(position.lng, position.lat)
      }

      const flushBearing = () => {
        bearingRafRef.current = null
        if (pendingBearingRef.current != null) {
          actions.setPov({ bearing: pendingBearingRef.current })
          pendingBearingRef.current = null
        }
        void viewer
          .getFieldOfView()
          .then((fov) => {
            actions.setPov({ hfov: fov })
          })
          .catch(() => {})
      }

      const onBearing = (event: ViewerBearingEvent) => {
        pendingBearingRef.current = event.bearing
        if (bearingRafRef.current == null) {
          bearingRafRef.current = requestAnimationFrame(flushBearing)
        }
      }

      viewer.on('navigable', onNavigable)
      viewer.on('image', onImage)
      viewer.on('bearing', onBearing)

      const resizeObserver = new ResizeObserver(() => {
        viewer.resize()
      })
      resizeObserver.observe(container)

      return () => {
        if (bearingRafRef.current != null) {
          cancelAnimationFrame(bearingRafRef.current)
          bearingRafRef.current = null
        }
        resizeObserver.disconnect()
        viewer.off('navigable', onNavigable)
        viewer.off('image', onImage)
        viewer.off('bearing', onBearing)
        viewer.remove()
        viewerRef.current = null
      }
    },
    [actions],
  )

  useEffect(
    function syncExternalPhotoSelection() {
      const viewer = viewerRef.current
      if (!viewer || photo.photoId === lastViewerPhotoIdRef.current) {
        return
      }

      actions.reset()

      lastViewerPhotoIdRef.current = photo.photoId

      if (navigableRef.current) {
        void viewer.moveTo(photo.photoId).catch(() => {})
      } else {
        pendingImageIdRef.current = photo.photoId
      }
    },
    [actions, photo.photoId],
  )

  useEffect(
    function turnToBearingOnChange() {
      const viewer = viewerRef.current
      if (!viewer || lookAtBearing == null || lastViewerPhotoIdRef.current !== photo.photoId) {
        return
      }
      void viewer
        .getImage()
        .then((image) => turnToWantedBearing(viewer, image))
        .catch(() => {})
    },
    [lookAtBearing, photo.photoId],
  )

  return (
    <div
      ref={containerRef}
      className="min-h-48 overflow-hidden rounded-lg border border-slate-200 bg-slate-900"
      style={{ aspectRatio: '4 / 3' }}
    />
  )
}
