import {
  queryStreetImageryFeatures,
  streetImageryInteractiveLayerIds,
} from '@osm-editor-kit/street-imagery-react'
import { useParams, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import type { MapLayerMouseEvent, MapMouseEvent } from 'react-map-gl/maplibre'
import { useBicycleModeHandlers } from '../../modes/bicycle/use-bicycle-mode-handlers'
import { useLanesModeHandlers } from '../../modes/lanes/use-lanes-mode-handlers'
import {
  useParkingLayerClickHandler,
  useParkingMapClickHandler,
} from '../../modes/parking/use-parking-mode-handlers'
import { useActiveStreetSpaceMode } from '../../modes/registry'
import { useSurfaceModeHandlers } from '../../modes/surface/use-surface-mode-handlers'
import { useTableModeHandlers } from '../../modes/table/use-table-mode-handlers'
import type { StreetSpaceModeId } from '../../modes/types'
import { useWidthModeHandlers } from '../../modes/width/use-width-mode-handlers'
import { coverageDebugFetchFillLayerId } from './CoverageDebugLayers'
import { useCoverageDebugHover } from './CoverageDebugOverlay'
import { isEditorPhotoProvider } from './street-imagery-search-params'
import { useModeSearchNavigation } from './use-mode-search-navigation'
import {
  WAY_CUT_MARKERS_HITAREA_LAYER_ID,
  WAY_CUT_PREVIEW_HITAREA_LAYER_ID,
  useWayCutHandler,
} from './use-way-cut'
import { useIsCutActive } from './way-cut-store'

export function useMapPageInteractions() {
  const { debug, photos = [] } = useSearch({ from: '/$mode' })
  const { updateSearch } = useModeSearchNavigation()
  const { mode: modeSlug } = useParams({ from: '/$mode' })
  const resolvedModeId = modeSlug as StreetSpaceModeId
  const mode = useActiveStreetSpaceMode(resolvedModeId)
  const isWidthMode = resolvedModeId === 'width'
  const isBicycleMode = resolvedModeId === 'bicycle'
  const isSurfaceMode = resolvedModeId === 'surface'
  const isLanesMode = resolvedModeId === 'lanes'
  const isTableMode = resolvedModeId === 'table'

  const [cursorStyle, setCursorStyle] = useState('grab')
  const coverageDebug = useCoverageDebugHover()
  const isCutActive = useIsCutActive()
  const { handleCutClick, handleCutMouseMove, clearCutHoverState } = useWayCutHandler()
  const parkingLayerClick = useParkingLayerClickHandler()
  const parkingMapClick = useParkingMapClickHandler()
  const widthHandlers = useWidthModeHandlers()
  const bicycleHandlers = useBicycleModeHandlers()
  const surfaceHandlers = useSurfaceModeHandlers()
  const lanesHandlers = useLanesModeHandlers()
  const tableHandlers = useTableModeHandlers()

  const interactiveLayerIds = [
    ...streetImageryInteractiveLayerIds(photos),
    ...mode.interactiveLayerIds,
    WAY_CUT_MARKERS_HITAREA_LAYER_ID,
    WAY_CUT_PREVIEW_HITAREA_LAYER_ID,
    ...(debug ? [coverageDebugFetchFillLayerId] : []),
  ]

  function handleLayerClick(event: MapLayerMouseEvent) {
    if (isCutActive && handleCutClick(event)) return
    if (isWidthMode) {
      widthHandlers.handleLayerClick(event)
      return
    }
    if (isBicycleMode) {
      bicycleHandlers.handleLayerClick(event)
      return
    }
    if (isSurfaceMode) {
      surfaceHandlers.handleLayerClick(event)
      return
    }
    if (isLanesMode) {
      lanesHandlers.handleLayerClick(event)
      return
    }
    if (isTableMode) {
      tableHandlers.handleLayerClick(event)
      return
    }
    parkingLayerClick(event)
  }

  function handleMapClick(event: MapLayerMouseEvent) {
    if (isCutActive && handleCutClick(event)) return
    if (isWidthMode) {
      widthHandlers.handleMapClick()
      return
    }
    if (isBicycleMode) {
      bicycleHandlers.handleMapClick()
      return
    }
    if (isSurfaceMode) {
      surfaceHandlers.handleMapClick()
      return
    }
    if (isLanesMode) {
      lanesHandlers.handleMapClick()
      return
    }
    if (isTableMode) {
      tableHandlers.handleMapClick()
      return
    }
    parkingMapClick()
  }

  function handleMouseMove(event: MapLayerMouseEvent) {
    if (isWidthMode) {
      widthHandlers.handleMouseMove(event)
    }

    if (isCutActive) {
      const cutMove = handleCutMouseMove(event)
      setCursorStyle(cutMove?.nearCutTarget ? 'pointer' : 'crosshair')
    } else {
      setCursorStyle(event.features?.length ? 'pointer' : 'grab')
    }

    coverageDebug.handleMouseMove(event)
  }

  function handleMouseLeave() {
    // Width drag uses window mouseup listeners — do not end it on canvas leave.
    if (isCutActive) {
      clearCutHoverState()
    }
    setCursorStyle(isCutActive ? 'crosshair' : 'grab')
    coverageDebug.clearHover()
  }

  function handleMouseDown(event: MapLayerMouseEvent) {
    if (!isWidthMode) return
    widthHandlers.handleMouseDown(event)
  }

  function handleMouseUp(_event: MapMouseEvent) {
    if (!isWidthMode) return
    widthHandlers.handleMouseUp()
  }

  function handleClick(event: MapLayerMouseEvent) {
    if (isCutActive && handleCutClick(event)) return

    const hits = queryStreetImageryFeatures(event)
    // A sign: select it; the viewer shows the photos that show it, turned to it.
    const signHit = hits.find((hit) => hit.kind === 'mapFeature' && hit.featureId)
    if (signHit?.featureId) {
      updateSearch({ feature: signHit.featureId, photo: undefined }, { replace: true })
      event.originalEvent.stopPropagation()
      return
    }

    const photoHit = hits.find((hit) => hit.kind === 'photo')
    if (photoHit?.photoId && isEditorPhotoProvider(photoHit.providerId)) {
      updateSearch(
        {
          photo: {
            provider: photoHit.providerId,
            photoId: photoHit.photoId,
            ...(photoHit.sequenceId ? { sequenceId: photoHit.sequenceId } : {}),
          },
          feature: undefined,
        },
        { replace: true },
      )
      event.originalEvent.stopPropagation()
      return
    }

    if (event.features?.length) {
      handleLayerClick(event)
      return
    }
    handleMapClick(event)
  }

  return {
    cursorStyle,
    interactiveLayerIds,
    coverageDebug,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleClick,
  }
}
