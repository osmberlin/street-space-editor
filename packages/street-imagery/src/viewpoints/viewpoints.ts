import {
  bearingDeg,
  distanceMeters,
  lineLengthMeters,
  normalizeBearing,
  pointAlongLine,
  snapToLine,
  type LngLat,
} from './geometry'

/**
 * - `here`: the clicked point (undirected on the map, or snapped onto a clicked line)
 * - `line-start` / `line-end`: ends of a clicked line, bearing = line direction
 * - `into-node`: on a street approaching a junction, looking into the junction
 */
export type ViewpointRole = 'here' | 'line-start' | 'line-end' | 'into-node' | 'custom'

export type Viewpoint = {
  id: string
  lngLat: LngLat
  /** Map bearing in degrees; `null` = undirected (look around in all four directions). */
  bearing: number | null
  role: ViewpointRole
  label?: string
}

/**
 * - `forward` / `back`: along / against the viewpoint bearing
 * - `N` `E` `S` `W`: compass directions for undirected viewpoints
 * - `into`: into a junction (single direction)
 */
export type ViewDirectionKind = 'forward' | 'back' | 'N' | 'E' | 'S' | 'W' | 'into'

export type ViewDirection = {
  /** Stable key `${viewpointId}:${kind}`. */
  key: string
  viewpointId: string
  kind: ViewDirectionKind
  bearing: number
}

const COMPASS: [ViewDirectionKind, number][] = [
  ['N', 0],
  ['E', 90],
  ['S', 180],
  ['W', 270],
]

const direction = (viewpoint: Viewpoint, kind: ViewDirectionKind, bearing: number) => ({
  key: `${viewpoint.id}:${kind}`,
  viewpointId: viewpoint.id,
  kind,
  bearing: normalizeBearing(bearing),
})

export const viewDirections = (viewpoint: Viewpoint): ViewDirection[] => {
  if (viewpoint.bearing == null) {
    return COMPASS.map(([kind, bearing]) => direction(viewpoint, kind, bearing))
  }
  if (viewpoint.role === 'into-node') {
    return [direction(viewpoint, 'into', viewpoint.bearing)]
  }
  return [
    direction(viewpoint, 'forward', viewpoint.bearing),
    direction(viewpoint, 'back', viewpoint.bearing + 180),
  ]
}

export const viewpointFromPoint = (lngLat: LngLat, id = 'here'): Viewpoint => ({
  id,
  lngLat,
  bearing: null,
  role: 'here',
})

export type ViewpointsFromLineOptions = {
  /** Move start/end viewpoints this far into the line so they sit on the street, not the junction. */
  endInsetMeters?: number
  /** Skip the click viewpoint when it is this close to start or end. */
  minSpacingMeters?: number
}

/**
 * Viewpoints for a clicked line: its start, the clicked point snapped onto it, and its end.
 * All share the line direction as bearing, so each offers a forward and a back view.
 */
export const viewpointsFromLine = (
  line: LngLat[],
  click: LngLat,
  { endInsetMeters = 8, minSpacingMeters = 15 }: ViewpointsFromLineOptions = {},
): Viewpoint[] => {
  const length = lineLengthMeters(line)
  if (line.length < 2 || length === 0) {
    return [viewpointFromPoint(click)]
  }

  const inset = Math.min(endInsetMeters, length / 4)
  const start = pointAlongLine(line, inset)
  const end = pointAlongLine(line, length - inset)
  const here = snapToLine(line, click)

  const viewpoints: Viewpoint[] = []
  if (start) {
    viewpoints.push({
      id: 'line-start',
      lngLat: start.point,
      bearing: start.bearing,
      role: 'line-start',
    })
  }
  if (
    here &&
    (!start || distanceMeters(here.point, start.point) >= minSpacingMeters) &&
    (!end || distanceMeters(here.point, end.point) >= minSpacingMeters)
  ) {
    viewpoints.push({ id: 'here', lngLat: here.point, bearing: here.bearing, role: 'here' })
  }
  if (end) {
    viewpoints.push({ id: 'line-end', lngLat: end.point, bearing: end.bearing, role: 'line-end' })
  }
  return viewpoints
}

/**
 * One viewpoint per street approaching `node`, `distanceMeters` up the street, looking into the
 * junction. Each approach is a line with one end at (or near) the node; its direction does not matter.
 */
export const viewpointsIntoNode = (
  node: LngLat,
  approaches: LngLat[][],
  { distanceMeters: offset = 20 }: { distanceMeters?: number } = {},
): Viewpoint[] =>
  approaches.flatMap((approach, index) => {
    if (approach.length < 2) {
      return []
    }
    const first = approach[0] as LngLat
    const last = approach[approach.length - 1] as LngLat
    const fromNode =
      distanceMeters(first, node) <= distanceMeters(last, node) ? approach : [...approach].reverse()
    const length = lineLengthMeters(fromNode)
    const onStreet = pointAlongLine(fromNode, Math.min(offset, length))
    if (!onStreet) {
      return []
    }
    return [
      {
        id: `into-${index}`,
        lngLat: onStreet.point,
        bearing: bearingDeg(onStreet.point, node),
        role: 'into-node' as const,
      },
    ]
  })
