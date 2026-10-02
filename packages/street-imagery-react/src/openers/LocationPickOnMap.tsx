import {
  findLocationOpener,
  openLocationInNewTab,
  type LocationOpener,
  type OpenTarget,
} from '@osm-editor-kit/street-imagery'
import type { MapMouseEvent } from 'maplibre-gl'
import { useEffect } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import { useArmedLocationOpenerId, useLocationPickActions } from './useLocationPickStore'

export type LocationPickOnMapProps = {
  /** Called after the place was opened, e.g. to mark it on the map. */
  onPick?: (target: OpenTarget, opener: LocationOpener) => void
}

/** 7 decimals are about 1 cm; more only makes the links longer. */
const roundCoordinate = (value: number) => Number(value.toFixed(7))

/**
 * Render inside `<Map>`. While a location opener is armed, the next map click opens the clicked
 * place in a new tab and disarms; Escape disarms. The map's own click handlers still run.
 */
export const LocationPickOnMap = ({ onPick }: LocationPickOnMapProps) => {
  const { current: map } = useMap()
  const armedOpenerId = useArmedLocationOpenerId()
  const { disarm } = useLocationPickActions()

  useEffect(
    function openArmedOpenerOnNextMapClick() {
      if (!map || !armedOpenerId) {
        return
      }
      const opener = findLocationOpener(armedOpenerId)
      if (!opener) {
        return
      }

      const onClick = (event: MapMouseEvent) => {
        const target: OpenTarget = {
          lngLat: [roundCoordinate(event.lngLat.lng), roundCoordinate(event.lngLat.lat)],
          zoom: map.getZoom(),
        }
        // Still inside the click, so the browser lets the new tab through.
        openLocationInNewTab(opener, target)
        disarm()
        onPick?.(target, opener)
      }
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          disarm()
        }
      }

      map.on('click', onClick)
      window.addEventListener('keydown', onKeyDown)
      return function stopListeningForPick() {
        map.off('click', onClick)
        window.removeEventListener('keydown', onKeyDown)
      }
    },
    [armedOpenerId, disarm, map, onPick],
  )

  return null
}
