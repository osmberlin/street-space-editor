import '@panoramax/web-viewer'
import { getStreetImageryConfig } from '@osm-editor-kit/street-imagery'
import type { NormalizedPhoto } from '@osm-editor-kit/street-imagery'
import { useEffect, useRef } from 'react'
import type { StreetImageryPhotoSelection } from '../types'
import { useViewerActions } from '../useViewerStore'
import type {
  PnxPhotoViewerElement,
  PnxPictureLoadedEventDetail,
  PnxSelectEventDetail,
  PnxViewRotatedEventDetail,
} from './panoramax-photo-viewer.d'
import { limitPanningToImage } from './panoramaxLimitPanning'

const panoramaxApiEndpoint = () => `${getStreetImageryConfig().panoramaxApiBase}/api`

const normalizeBearing = (degrees: number) => ((degrees % 360) + 360) % 360

type PanoramaxPanelProps = {
  photo: NormalizedPhoto
  groupPhotos: NormalizedPhoto[]
  onPhotoSelected: (selection: StreetImageryPhotoSelection) => void
  onEaseMapToPoint: (lng: number, lat: number) => void
}

type PendingSelect = {
  sequenceId: string | null
  photoId: string
}

export const PanoramaxPanel = ({
  photo,
  onPhotoSelected,
  onEaseMapToPoint,
}: PanoramaxPanelProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<PnxPhotoViewerElement>(null)
  const lastViewerPhotoIdRef = useRef<string | null>(null)
  const readyRef = useRef(false)
  const pendingSelectRef = useRef<PendingSelect | null>(null)
  const photoRef = useRef(photo)
  const bearingRafRef = useRef<number | null>(null)
  const pendingBearingRef = useRef<number | null>(null)
  const pendingHfovRef = useRef<number | null>(null)
  const actions = useViewerActions()

  useEffect(
    function syncPhotoRef() {
      photoRef.current = photo
    },
    [photo],
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
    function mountPanoramaxViewer() {
      const viewer = viewerRef.current
      const container = containerRef.current
      if (!viewer || !container) {
        return
      }

      lastViewerPhotoIdRef.current = photoRef.current.photoId

      const flushBearing = () => {
        bearingRafRef.current = null
        if (pendingBearingRef.current != null) {
          actions.setPov({ bearing: pendingBearingRef.current })
          pendingBearingRef.current = null
        }
        if (pendingHfovRef.current != null) {
          actions.setPov({ hfov: pendingHfovRef.current })
          pendingHfovRef.current = null
        }
      }

      const onSelect = (event: Event) => {
        const { seqId, picId } = (event as CustomEvent<PnxSelectEventDetail>).detail
        if (!picId) {
          return
        }

        lastViewerPhotoIdRef.current = picId

        const currentPhoto = photoRef.current
        const sequenceId =
          seqId ??
          (picId === currentPhoto.photoId && currentPhoto.sequenceId
            ? currentPhoto.sequenceId
            : `photo:${picId}`)

        onPhotoSelected({
          provider: 'panoramax',
          sequenceId,
          photoId: picId,
        })
      }

      const onPictureLoaded = (event: Event) => {
        const detail = (event as CustomEvent<PnxPictureLoadedEventDetail>).detail
        if (detail.lon == null || detail.lat == null) {
          return
        }

        actions.setPov({ lngLat: [detail.lon, detail.lat] })

        if (detail.x != null) {
          actions.setPov({ bearing: normalizeBearing(detail.x) })
        }

        const psv = viewer.psv
        if (psv && detail.z != null) {
          actions.setPov({ hfov: psv.dataHelper.zoomLevelToFov(detail.z) })
        }

        onEaseMapToPoint(detail.lon, detail.lat)
      }

      const onViewRotated = (event: Event) => {
        const detail = (event as CustomEvent<PnxViewRotatedEventDetail>).detail
        pendingBearingRef.current = normalizeBearing(detail.x)

        const psv = viewer.psv
        if (psv && detail.z != null) {
          pendingHfovRef.current = psv.dataHelper.zoomLevelToFov(detail.z)
        }

        if (bearingRafRef.current == null) {
          bearingRafRef.current = requestAnimationFrame(flushBearing)
        }
      }

      viewer.addEventListener('select', onSelect)
      viewer.addEventListener('psv:picture-loaded', onPictureLoaded)
      viewer.addEventListener('psv:view-rotated', onViewRotated)

      const resizeObserver = new ResizeObserver(() => {
        viewer.psv?.resize()
      })
      resizeObserver.observe(container)

      // The viewer builds its Photo Sphere Viewer a moment after mounting.
      let stopLimit: (() => void) | null = null
      const startLimit = () => {
        if (!stopLimit && viewer.psv) {
          stopLimit = limitPanningToImage(viewer.psv)
        }
      }
      startLimit()
      viewer.addEventListener('psv:picture-loaded', startLimit)

      readyRef.current = true

      const pending = pendingSelectRef.current
      if (pending) {
        pendingSelectRef.current = null
        if (typeof viewer.select === 'function') {
          viewer.select(pending.sequenceId ?? null, pending.photoId)
        }
      }

      return () => {
        readyRef.current = false
        if (bearingRafRef.current != null) {
          cancelAnimationFrame(bearingRafRef.current)
          bearingRafRef.current = null
        }
        resizeObserver.disconnect()
        viewer.removeEventListener('select', onSelect)
        viewer.removeEventListener('psv:picture-loaded', onPictureLoaded)
        viewer.removeEventListener('psv:view-rotated', onViewRotated)
        viewer.removeEventListener('psv:picture-loaded', startLimit)
        stopLimit?.()
      }
    },
    [actions, onEaseMapToPoint, onPhotoSelected],
  )

  useEffect(
    function syncExternalPhotoSelection() {
      const viewer = viewerRef.current
      if (!viewer || photo.photoId === lastViewerPhotoIdRef.current) {
        return
      }

      actions.reset()

      lastViewerPhotoIdRef.current = photo.photoId

      if (!readyRef.current) {
        pendingSelectRef.current = { sequenceId: photo.sequenceId, photoId: photo.photoId }
        return
      }

      if (typeof viewer.select === 'function') {
        viewer.select(photo.sequenceId ?? null, photo.photoId)
      }
    },
    [actions, photo.photoId, photo.sequenceId],
  )

  return (
    <div
      ref={containerRef}
      className="min-h-48 overflow-hidden rounded-lg border border-slate-200 bg-slate-900"
      style={{ aspectRatio: '4 / 3' }}
    >
      <pnx-photo-viewer
        ref={viewerRef}
        className="block h-full w-full"
        endpoint={panoramaxApiEndpoint()}
        url-parameters="false"
        picture={photo.photoId}
        sequence={photo.sequenceId ?? undefined}
      />
    </div>
  )
}
