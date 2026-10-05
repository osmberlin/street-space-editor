import { getStreetImageryConfig, providerExternalLink } from '@osm-editor-kit/street-imagery'
import type { NormalizedPhoto } from '@osm-editor-kit/street-imagery'
import 'mapillary-js/dist/mapillary.css'

import {
  Viewer,
  type ViewerBearingEvent,
  type ViewerImageEvent,
  type ViewerNavigableEvent,
} from 'mapillary-js'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { StreetImageryPhotoSelection } from '../types'
import { useViewerActions } from '../useViewerStore'
import { PanoramaxDataProvider } from './panoramaxDataProvider'
import { panoramaxPhotoFromItem } from './panoramaxItem'

export type PanoramaxPanelProps = {
  photo: NormalizedPhoto
  groupPhotos: NormalizedPhoto[]
  onPhotoSelected: (selection: StreetImageryPhotoSelection) => void
  onEaseMapToPoint: (lng: number, lat: number) => void
  /** The shown picture with creator, licence, local capture time and camera. */
  onViewerPhoto?: (photo: NormalizedPhoto) => void
  /**
   * Hide the line with creator and licence. The host must then show both itself, from
   * `onViewerPhoto`.
   */
  hideAttribution?: boolean
}

/**
 * Panoramax pictures in the Mapillary viewer (`mapillary-js` with a `PanoramaxDataProvider`): no
 * second viewer engine to load, and the same handling as Mapillary photos.
 */
export const PanoramaxPanel = ({
  photo,
  onPhotoSelected,
  onEaseMapToPoint,
  onViewerPhoto,
  hideAttribution = false,
}: PanoramaxPanelProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const navigableRef = useRef(false)
  const pendingImageIdRef = useRef<string | null>(null)
  const lastViewerPhotoIdRef = useRef<string | null>(null)
  const bearingRafRef = useRef<number | null>(null)
  const pendingBearingRef = useRef<number | null>(null)
  const actions = useViewerActions()
  const initialPhotoIdRef = useRef(photo.photoId)
  const [shownPhoto, setShownPhoto] = useState<NormalizedPhoto | null>(null)
  // Callbacks may change identity every render; the viewer must not remount for that.
  const emitPhotoSelected = useEffectEvent(onPhotoSelected)
  const emitEaseMapToPoint = useEffectEvent(onEaseMapToPoint)
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
    function mountViewer() {
      const container = containerRef.current
      if (!container) {
        return
      }

      const dataProvider = new PanoramaxDataProvider({
        endpoint: `${getStreetImageryConfig().panoramaxApiBase}/api`,
      })
      const viewer = new Viewer({
        container,
        dataProvider,
        imageId: initialPhotoIdRef.current,
        component: {
          // The attribution of the viewer links to mapillary.com.
          attribution: false,
          // Load only the direct neighbours ahead.
          cache: { depth: { sequence: 1, spherical: 0, step: 0, turn: 0 } },
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
        const item = dataProvider.getItem(image.id)
        if (!item) {
          return
        }
        const viewerPhoto = panoramaxPhotoFromItem(item)

        emitPhotoSelected({
          provider: 'panoramax',
          sequenceId: viewerPhoto.sequenceId ?? `photo:${image.id}`,
          photoId: image.id,
        })
        setShownPhoto(viewerPhoto)
        emitViewerPhoto(viewerPhoto)

        // A flat photo looks where its camera looked: set that right away, so the map's cone does
        // not show the previous photo's direction until the viewer's first `bearing` event.
        actions.setPov({
          lngLat: viewerPhoto.lngLat,
          ...(!viewerPhoto.isPano && viewerPhoto.heading != null
            ? { bearing: viewerPhoto.heading }
            : {}),
        })
        emitEaseMapToPoint(...viewerPhoto.lngLat)
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

  const attribution = hideAttribution ? null : shownPhoto
  const license = attribution?.details?.license

  return (
    <div
      className="relative min-h-48 overflow-hidden rounded-lg border border-slate-200 bg-slate-900"
      style={{ aspectRatio: '4 / 3' }}
    >
      <div ref={containerRef} className="h-full w-full" />
      {attribution ? (
        <div className="absolute right-0 bottom-0 flex gap-1.5 rounded-tl bg-black/50 px-1.5 py-0.5 text-[11px] leading-4 text-white">
          <a
            className="underline-offset-2 hover:underline"
            href={providerExternalLink(attribution)}
            rel="noreferrer"
            target="_blank"
          >
            {['Panoramax', attribution.creatorName].filter(Boolean).join(' · ')}
          </a>
          {license ? (
            attribution.details?.licenseUrl ? (
              <a
                className="underline-offset-2 hover:underline"
                href={attribution.details.licenseUrl}
                rel="noreferrer"
                target="_blank"
              >
                {license}
              </a>
            ) : (
              <span>{license}</span>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
