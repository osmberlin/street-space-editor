import type { DrivingSide } from './driving-side'
import { maxPipeLength, padPipe, parsePositiveInt, parseWidthMeters, splitLanesPipe } from './pipe'
import { isOneway, readDirectionalTag } from './tags'
import type { LaneDirection, LaneKind, LaneSlot, LaneSlotProvenance, Provenance } from './types'

function defaultProvenance(): LaneSlotProvenance {
  return {
    count: 'default',
    turn: 'default',
    vehicleAccess: 'default',
    bicycleAccess: 'default',
    busAccess: 'default',
    psvAccess: 'default',
    widthMeters: 'default',
    change: 'default',
    surface: 'default',
    smoothness: 'default',
    kind: 'default',
  }
}

function inferKind(
  bicycle?: string,
  bus?: string,
  psv?: string,
  turn?: string,
  direction?: LaneDirection,
): LaneKind {
  // Only `designated` makes a bus / cycle lane. `yes` just says the lane may be used
  // (real tagging: bus:lanes=yes|yes|yes|designated, bicycle:lanes=no|no|designated|yes).
  if (bicycle?.toLowerCase() === 'designated') return 'bicycle'
  if (bus?.toLowerCase() === 'designated') return 'bus'
  if (psv?.toLowerCase() === 'designated') return 'bus'
  if (direction === 'both_ways') return 'both_ways_turn'
  const turnVal = turn?.toLowerCase() ?? ''
  if (turnVal.includes('both_ways') || turnVal.includes('reverse')) return 'both_ways_turn'
  return 'travel'
}

function applyLanesBusMask(
  busAccess: string[],
  count: number,
  drivingSide: DrivingSide,
  direction: LaneDirection,
): { values: string[]; provenance: Provenance } {
  if (count <= 0 || busAccess.some((v) => v !== '')) {
    return { values: busAccess, provenance: 'tagged' }
  }
  const values = [...busAccess]
  const idx = outerLaneIndex(values.length, drivingSide, direction)
  if (idx >= 0 && idx < values.length) values[idx] = 'designated'
  return { values, provenance: 'inferred' }
}

/** Outermost lane index in OSM pipe order for bus/PSV count tags. */
export function outerLaneIndex(
  pipeLength: number,
  drivingSide: DrivingSide,
  direction: LaneDirection,
): number {
  if (pipeLength <= 0) return -1
  const travelIsBackward = direction === 'backward'
  const drivesOnLeft = drivingSide === 'left'
  const outerOnRight = drivesOnLeft ? travelIsBackward : !travelIsBackward
  return outerOnRight ? pipeLength - 1 : 0
}

export function resolveDirectionCounts(
  tags: Record<string, string>,
  oneway: boolean,
): {
  lanesTotal?: number
  lanesForward?: number
  lanesBackward?: number
  lanesBothWays?: number
} {
  const lanesTotal = parsePositiveInt(tags.lanes)
  const lanesForward = parsePositiveInt(tags['lanes:forward'])
  const lanesBackward = parsePositiveInt(tags['lanes:backward'])
  const lanesBothWays = parsePositiveInt(tags['lanes:both_ways'])

  if (oneway) {
    return {
      lanesTotal,
      lanesForward: lanesForward ?? lanesTotal,
      lanesBackward: 0,
      lanesBothWays: lanesBothWays ?? 0,
    }
  }

  if (lanesForward != null || lanesBackward != null || lanesBothWays != null) {
    const both = lanesBothWays ?? 0
    let forward = lanesForward
    let backward = lanesBackward
    if (lanesTotal != null) {
      if (forward == null && backward != null) {
        forward = Math.max(0, lanesTotal - backward - both)
      }
      if (backward == null && forward != null) {
        backward = Math.max(0, lanesTotal - forward - both)
      }
    }
    return {
      lanesTotal,
      lanesForward: forward,
      lanesBackward: backward,
      lanesBothWays: lanesBothWays ?? undefined,
    }
  }

  if (lanesTotal != null) {
    const both = lanesBothWays ?? 0
    const remaining = Math.max(0, lanesTotal - both)
    const forward = Math.ceil(remaining / 2)
    const backward = remaining - forward
    return {
      lanesTotal,
      lanesForward: forward,
      lanesBackward: backward,
      lanesBothWays: both || undefined,
    }
  }

  return { lanesTotal, lanesForward, lanesBackward, lanesBothWays }
}

const UNDIRECTED_PIPE_BASES = [
  'turn:lanes',
  'vehicle:lanes',
  'bicycle:lanes',
  'bus:lanes',
  'psv:lanes',
  'width:lanes',
  'change:lanes',
  'surface:lanes',
  'smoothness:lanes',
] as const

export function hasUndirectedLanePipes(tags: Record<string, string>): boolean {
  return UNDIRECTED_PIPE_BASES.some((base) => tags[base] != null)
}

export function hasDirectionalLaneCountTags(tags: Record<string, string>): boolean {
  return (
    tags['lanes:forward'] != null ||
    tags['lanes:backward'] != null ||
    tags['lanes:both_ways'] != null
  )
}

export function countForDirection(
  direction: LaneDirection,
  counts: ReturnType<typeof resolveDirectionCounts>,
): number | undefined {
  if (direction === 'forward') return counts.lanesForward
  if (direction === 'backward') return counts.lanesBackward
  return counts.lanesBothWays
}

function directionSuffix(direction: LaneDirection): string {
  if (direction === 'forward') return ':forward'
  if (direction === 'backward') return ':backward'
  return ':both_ways'
}

/** `turn:lanes` first; then SRK-style `turn:forward` / `turn:backward` / bare `turn`. */
function readTurnLanePipe(
  tags: Record<string, string>,
  direction: LaneDirection,
  useDirectional: boolean,
): string | undefined {
  const fromLanes = readDirectionalTag(tags, 'turn:lanes', direction, useDirectional)
  if (fromLanes != null) return fromLanes

  if (!useDirectional) return tags.turn

  const directionalFallback =
    direction === 'forward'
      ? tags['turn:forward']
      : direction === 'backward'
        ? tags['turn:backward']
        : tags['turn:both_ways']
  if (directionalFallback != null) return directionalFallback

  return direction === 'forward' ? tags.turn : undefined
}

export function buildDirectionSlots(
  tags: Record<string, string>,
  direction: LaneDirection,
  useDirectional: boolean,
  declaredCount: number | undefined,
  drivingSide: DrivingSide,
): LaneSlot[] {
  const turnPipe = readTurnLanePipe(tags, direction, useDirectional)
  const vehiclePipe = readDirectionalTag(tags, 'vehicle:lanes', direction, useDirectional)
  const bicyclePipe = readDirectionalTag(tags, 'bicycle:lanes', direction, useDirectional)
  const busPipe = readDirectionalTag(tags, 'bus:lanes', direction, useDirectional)
  const psvPipe = readDirectionalTag(tags, 'psv:lanes', direction, useDirectional)
  const widthPipe = readDirectionalTag(tags, 'width:lanes', direction, useDirectional)
  const changePipe = readDirectionalTag(tags, 'change:lanes', direction, useDirectional)
  const surfacePipe = readDirectionalTag(tags, 'surface:lanes', direction, useDirectional)
  const smoothnessPipe = readDirectionalTag(tags, 'smoothness:lanes', direction, useDirectional)

  const pipeLen = maxPipeLength(
    turnPipe,
    vehiclePipe,
    bicyclePipe,
    busPipe,
    psvPipe,
    widthPipe,
    changePipe,
    surfacePipe,
    smoothnessPipe,
  )
  const slotCount = Math.max(pipeLen, declaredCount ?? 0)

  if (slotCount === 0) return []

  const turn = padPipe(splitLanesPipe(turnPipe), slotCount)
  const vehicle = padPipe(splitLanesPipe(vehiclePipe), slotCount)
  const bicycle = padPipe(splitLanesPipe(bicyclePipe), slotCount)
  let bus = padPipe(splitLanesPipe(busPipe), slotCount)
  const psv = padPipe(splitLanesPipe(psvPipe), slotCount)
  const width = padPipe(splitLanesPipe(widthPipe), slotCount)
  const change = padPipe(splitLanesPipe(changePipe), slotCount)
  const surface = padPipe(splitLanesPipe(surfacePipe), slotCount)
  const smoothness = padPipe(splitLanesPipe(smoothnessPipe), slotCount)

  const dirSuffix = useDirectional ? directionSuffix(direction) : ''
  const lanesBusCount =
    parsePositiveInt(tags[`lanes:bus${dirSuffix}`]) ?? parsePositiveInt(tags['lanes:bus'])
  const lanesPsvCount =
    parsePositiveInt(tags[`lanes:psv${dirSuffix}`]) ?? parsePositiveInt(tags['lanes:psv'])

  const busMask = applyLanesBusMask(
    bus,
    lanesBusCount ?? lanesPsvCount ?? 0,
    drivingSide,
    direction,
  )
  bus = busMask.values

  const slots: LaneSlot[] = []
  for (let i = 0; i < slotCount; i++) {
    const prov = defaultProvenance()
    prov.count =
      pipeLen > 0 && i >= pipeLen ? 'inferred' : declaredCount != null ? 'tagged' : 'default'
    if (turn[i]) prov.turn = 'tagged'
    if (vehicle[i]) prov.vehicleAccess = 'tagged'
    if (bicycle[i]) prov.bicycleAccess = 'tagged'
    if (bus[i]) {
      prov.busAccess = busMask.provenance === 'inferred' && bus[i] ? 'inferred' : 'tagged'
    }
    if (psv[i]) prov.psvAccess = 'tagged'
    if (width[i]) prov.widthMeters = 'tagged'
    if (change[i]) prov.change = 'tagged'
    if (surface[i]) prov.surface = 'tagged'
    if (smoothness[i]) prov.smoothness = 'tagged'

    const kind = inferKind(bicycle[i], bus[i], psv[i], turn[i], direction)
    prov.kind =
      kind === 'travel'
        ? 'default'
        : bicycle[i] || bus[i] || psv[i] || turn[i]
          ? 'tagged'
          : 'inferred'

    slots.push({
      index: i,
      direction,
      kind,
      turn: turn[i] || undefined,
      vehicleAccess: vehicle[i] || undefined,
      bicycleAccess: bicycle[i] || undefined,
      busAccess: bus[i] || undefined,
      psvAccess: psv[i] || undefined,
      widthMeters: parseWidthMeters(width[i]),
      change: change[i] || undefined,
      surface: surface[i] || undefined,
      smoothness: smoothness[i] || undefined,
      provenance: prov,
    })
  }

  return slots
}

export function buildSlotsFromTags(
  tags: Record<string, string>,
  drivingSide: DrivingSide,
): LaneSlot[] {
  const oneway = isOneway(tags)
  const useDirectional = !oneway
  const counts = resolveDirectionCounts(tags, oneway)
  const undirectedPipes =
    !oneway && hasUndirectedLanePipes(tags) && !hasDirectionalLaneCountTags(tags)

  const slots: LaneSlot[] = []

  if (oneway) {
    slots.push(
      ...buildDirectionSlots(
        tags,
        'forward',
        useDirectional,
        counts.lanesForward ?? counts.lanesTotal,
        drivingSide,
      ),
    )
    return slots
  }

  const forwardDeclared = undirectedPipes
    ? (counts.lanesForward ?? counts.lanesTotal)
    : counts.lanesForward
  slots.push(...buildDirectionSlots(tags, 'forward', useDirectional, forwardDeclared, drivingSide))

  if (counts.lanesBothWays != null && counts.lanesBothWays > 0) {
    slots.push(
      ...buildDirectionSlots(tags, 'both_ways', useDirectional, counts.lanesBothWays, drivingSide),
    )
  }

  const backwardDeclared = undirectedPipes
    ? (parsePositiveInt(tags['lanes:backward']) ?? 0)
    : counts.lanesBackward
  if (backwardDeclared != null && backwardDeclared > 0) {
    slots.push(
      ...buildDirectionSlots(tags, 'backward', useDirectional, backwardDeclared, drivingSide),
    )
  }

  return slots
}
