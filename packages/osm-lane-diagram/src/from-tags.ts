import {
  effectiveTagsForParse,
  getDrivingSideFromTags,
  parseWayLanes,
  type LaneKind,
  type LaneSlot,
} from '@osm-editor-kit/osm-lanes'
import {
  expandSidepaths,
  type SidepathPrefix,
  type SidepathRef,
  type SidepathSide,
} from '@osm-editor-kit/osm-sidepath-tags'
import { DEFAULT_MEDIAN_GAP_M, DEFAULT_WIDTHS_M } from './defaults'
import {
  centrelineOffsetM,
  centrelineOffsetMDriving,
  drivingLaneCount,
  parsePlacement,
  resolvePlacement,
} from './placement'
import { formatEdgeSlotId, formatLaneSlotId } from './slot-ids'
import type {
  RoadSpaceDirection,
  RoadSpaceProvenance,
  RoadSpaceSegment,
  RoadSpaceSegmentRole,
  RoadSpaceSlot,
  RoadSpaceSlotKind,
  RoadSpaceZone,
  SeparatelyMappedSidepath,
} from './types'

const ON_CARRIAGEWAY_CYCLE = new Set([
  'lane',
  'share_busway',
  'shared_lane',
  'opposite_lane',
  'opposite_share_busway',
])

/** On-way edge cycle geometries that occupy metres in this way's cross-section. */
const EDGE_CYCLE = new Set(['track', 'opposite_track', 'sidepath', 'crossing'])

/**
 * Values that must not become sidepath slots on this way:
 * - `no` / `none` — feature absent
 * - `separate` — mapped as its own OSM way (hint only)
 * - `use_sidepath` — routing hint on foot=/bicycle=, not geometry here
 */
const ABSENT_OR_SEPARATELY_MAPPED = new Set(['no', 'none', 'separate', 'use_sidepath'])

const EPS = 0.01

/**
 * True when a sidewalk:/cycleway: value should produce an on-way sidepath slot.
 * Positive values (`yes`, `lane`, `track`, `both`, `left`, `right`, …) return true;
 * absent / separately-mapped values return false.
 */
export function createsOnWaySidepathSlot(value: string | undefined): boolean {
  if (value == null || value === '') return false
  return !ABSENT_OR_SEPARATELY_MAPPED.has(value.toLowerCase())
}

function isSeparatelyMappedValue(value: string | undefined): boolean {
  return value != null && value.toLowerCase() === 'separate'
}

function mapLaneKind(kind: LaneKind): RoadSpaceSlotKind {
  if (kind === 'bus') return 'bus'
  if (kind === 'bicycle') return 'cycle'
  if (kind === 'both_ways_turn') return 'both_ways'
  return 'motor'
}

function parseWidthToken(value: string | undefined): number | undefined {
  if (value == null || value === '') return undefined
  const match = /^(\d+(?:\.\d+)?)\s*m?$/i.exec(value.trim())
  if (!match) return undefined
  const n = Number.parseFloat(match[1]!)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function parsePositiveIntToken(value: string | undefined): number | undefined {
  if (value == null || value === '') return undefined
  const n = Number.parseInt(value.trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function widthForKind(
  kind: RoadSpaceSlotKind,
  tagged: number | undefined,
): { widthM: number; widthProvenance: RoadSpaceProvenance } {
  if (tagged != null && tagged > 0) {
    return { widthM: tagged, widthProvenance: 'tagged' }
  }
  return { widthM: DEFAULT_WIDTHS_M[kind], widthProvenance: 'default' }
}

function carriagewaySlotFromLane(wayId: number, slot: LaneSlot): RoadSpaceSlot {
  const kind = mapLaneKind(slot.kind)
  const taggedWidth =
    slot.widthMeters != null && slot.widthMeters > 0 ? slot.widthMeters : undefined
  const resolved = widthForKind(kind, taggedWidth)

  return {
    id: formatLaneSlotId(wayId, slot.direction, slot.index),
    kind,
    zone: 'carriageway',
    direction: slot.direction,
    widthM: resolved.widthM,
    widthProvenance: resolved.widthProvenance,
    turn: slot.turn,
    access: {
      vehicle: slot.vehicleAccess,
      bicycle: slot.bicycleAccess,
      bus: slot.busAccess,
    },
    label: slot.turn,
  }
}

function sideCycleWidth(tags: Record<string, string>, side: SidepathSide): number | undefined {
  return (
    parseWidthToken(tags[`cycleway:${side}:width`]) ??
    parseWidthToken(tags['cycleway:both:width']) ??
    parseWidthToken(tags['cycleway:width'])
  )
}

function sideSidewalkWidth(tags: Record<string, string>, side: SidepathSide): number | undefined {
  return (
    parseWidthToken(tags[`sidewalk:${side}:width`]) ??
    parseWidthToken(tags['sidewalk:both:width']) ??
    parseWidthToken(tags['sidewalk:width'])
  )
}

function isOnCarriagewayCycleValue(value: string | undefined): boolean {
  return value != null && ON_CARRIAGEWAY_CYCLE.has(value.toLowerCase())
}

function isEdgeCycleValue(value: string | undefined): boolean {
  return value != null && EDGE_CYCLE.has(value.toLowerCase())
}

function makeCycleSlot(
  wayId: number,
  direction: RoadSpaceDirection,
  index: number,
  widthTagged: number | undefined,
  label: string,
  zone: RoadSpaceZone = 'carriageway',
  side?: 'left' | 'right',
): RoadSpaceSlot {
  const resolved = widthForKind('cycle', widthTagged)
  const idDirection = direction === 'none' ? 'forward' : direction
  return {
    id: formatLaneSlotId(wayId, idDirection, index),
    kind: 'cycle',
    zone,
    direction,
    side,
    widthM: resolved.widthM,
    widthProvenance: resolved.widthProvenance,
    access: { bicycle: 'designated', vehicle: 'no' },
    label,
  }
}

function isMotorOneway(tags: Record<string, string>): boolean {
  const v = tags.oneway?.toLowerCase()
  return v === 'yes' || v === 'true' || v === '1' || v === '-1' || v === 'reverse'
}

function isContraflowCycleValue(value: string): boolean {
  const v = value.toLowerCase()
  return v === 'opposite_lane' || v === 'opposite_track' || v === 'opposite_share_busway'
}

function readCyclewayOneway(tags: Record<string, string>, side: SidepathSide): string | undefined {
  return tags[`cycleway:${side}:oneway`] ?? tags['cycleway:both:oneway']
}

/**
 * Travel direction for an on-carriageway cycle slot on `side`.
 *
 * `cycleway:*:oneway=yes` means the CW is **oneway**, not “OSM-forward”.
 * Direction still follows motor traffic on that side (same as cars). See
 * research/lane-editor-tags/tags/cycleway-oneway.md.
 *
 * `oneway=-1` / `reverse` = contraflow relative to the OSM way (backward).
 * `oneway=no` = both-ways.
 */
function deriveCarriagewayCycleDirection(
  tags: Record<string, string>,
  side: SidepathSide,
  cycleValue: string,
): RoadSpaceDirection {
  const cycleOneway = readCyclewayOneway(tags, side)?.toLowerCase()

  if (cycleOneway === 'no') return 'both_ways'
  if (cycleOneway === '-1' || cycleOneway === 'reverse') {
    return 'backward'
  }

  // `yes` / absent / opposite_* / motor oneway: travel with cars on this side.
  if (isContraflowCycleValue(cycleValue)) {
    return isMotorOneway(tags) ? 'backward' : withTrafficDirection(tags, side)
  }

  if (isMotorOneway(tags)) {
    const bicycleOneway = tags['oneway:bicycle']?.toLowerCase()
    if (bicycleOneway === 'no' && side === 'left') return 'backward'
    return 'forward'
  }

  return withTrafficDirection(tags, side)
}

/** RHT: left←backward, right←forward. LHT flips. */
function withTrafficDirection(
  tags: Record<string, string>,
  side: SidepathSide,
): RoadSpaceDirection {
  const drivingSide = getDrivingSideFromTags(tags)
  if (drivingSide === 'left') {
    return side === 'left' ? 'forward' : 'backward'
  }
  return side === 'left' ? 'backward' : 'forward'
}

/** `cycleway:lanes` (+ directional) pipe when present — LTR positions are authoritative. */
function cyclewayLanesPipe(tags: Record<string, string>): string | undefined {
  return (
    tags['cycleway:lanes'] ??
    tags['cycleway:lanes:forward'] ??
    (tags.oneway === 'yes' ? tags['cycleway:lanes'] : undefined)
  )
}

function isCyclewayLanesCycleToken(token: string): boolean {
  return token === 'lane' || token === 'share_busway' || token === 'shared_lane'
}

/**
 * Declared motor/bus/both_ways count for `cycleway:lanes` rebuild.
 * Prefer `lanes=*` so `width:lanes` pipe length (which includes bike strips) does not
 * inflate the motor stack.
 */
function declaredMotorLaneCount(tags: Record<string, string>, motorishLength: number): number {
  const lanes = parsePositiveIntToken(tags.lanes)
  if (lanes != null) return lanes
  const fwd = parsePositiveIntToken(tags['lanes:forward']) ?? 0
  const back = parsePositiveIntToken(tags['lanes:backward']) ?? 0
  const both = parsePositiveIntToken(tags['lanes:both_ways']) ?? 0
  const sum = fwd + back + both
  if (sum > 0) return sum
  return motorishLength
}

/**
 * Expand on-carriageway cycle tags into cycle slots inside the carriageway stack.
 * Never invents existence — only expands when tags are present.
 *
 * Returns `{ slots, fromPipe }` — when `fromPipe`, LTR order is already final
 * (do not edge-sort cycle slots).
 */
function expandOnCarriagewayCycleSlots(
  wayId: number,
  tags: Record<string, string>,
  carriageway: RoadSpaceSlot[],
): { slots: RoadSpaceSlot[]; fromPipe: boolean } {
  let nextIndex = 10_000

  const pipe = cyclewayLanesPipe(tags)

  if (pipe) {
    const tokens = pipe.split('|')
    const motorishAll = carriageway.filter(
      (s) => s.kind === 'motor' || s.kind === 'bus' || s.kind === 'both_ways',
    )
    // Cap to lanes=* — leftover slots are bike-width pipes that parseWayLanes inflated.
    const motorCap = declaredMotorLaneCount(tags, motorishAll.length)
    const motorish = motorishAll.slice(0, motorCap)
    const widthPipe = tags['width:lanes'] ?? tags['width:lanes:forward']
    const widthTokens = widthPipe ? widthPipe.split('|') : []
    const rebuilt: RoadSpaceSlot[] = []
    let motorIdx = 0

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!.trim().toLowerCase()
      const pipeWidth = parseWidthToken(widthTokens[i])
      if (isCyclewayLanesCycleToken(token)) {
        rebuilt.push(makeCycleSlot(wayId, 'forward', nextIndex++, pipeWidth, token))
      } else {
        const src = motorish[motorIdx++]
        if (!src) continue
        // Width at this pipe index is authoritative (motorish may carry misaligned widths
        // from a longer width:lanes list that included the bike strip).
        if (pipeWidth != null) {
          rebuilt.push({ ...src, widthM: pipeWidth, widthProvenance: 'tagged' })
        } else {
          rebuilt.push(src)
        }
      }
    }
    // Do not append leftover motors — they were the bike-width inflation.
    return { slots: rebuilt, fromPipe: true }
  }

  const result = [...carriageway]
  const addSide = (side: SidepathSide, value: string) => {
    if (!isOnCarriagewayCycleValue(value)) return
    // Avoid duplicating when bicycle:lanes already produced a cycle slot at that edge
    const hasBike = result.some((s) => s.kind === 'cycle')
    if (hasBike && value === 'share_busway') return

    const direction = deriveCarriagewayCycleDirection(tags, side, value)
    const slot = makeCycleSlot(
      wayId,
      direction,
      nextIndex++,
      sideCycleWidth(tags, side),
      value,
      'carriageway',
      side,
    )
    if (side === 'left') result.unshift(slot)
    else result.push(slot)
  }

  const left = tags['cycleway:left']
  const right = tags['cycleway:right']
  const both = tags['cycleway:both']
  const bare = tags.cycleway

  if (left) addSide('left', left)
  if (right) addSide('right', right)
  if (!left && !right && both) {
    addSide('left', both)
    addSide('right', both)
  }
  if (!left && !right && !both && bare) {
    addSide('left', bare)
    addSide('right', bare)
  }

  return { slots: result, fromPipe: false }
}

type SideEdgeDraft = {
  sidewalk?: { ref: SidepathRef; tags: Record<string, string> }
  cycle?: { ref: SidepathRef; tags: Record<string, string> }
}

function sidepathValueFor(
  tags: Record<string, string>,
  entry: { ref: SidepathRef; tags: Record<string, string> },
): string | undefined {
  const { prefix, side } = entry.ref
  if (prefix === 'sidewalk') {
    return entry.tags.sidewalk ?? tags[`sidewalk:${side}`] ?? tags['sidewalk:both'] ?? tags.sidewalk
  }
  return entry.tags.cycleway ?? tags[`cycleway:${side}`] ?? tags['cycleway:both'] ?? tags.cycleway
}

/**
 * Whether parent tags declare an on-way sidepath on this side.
 * Guards against expandSidepaths inventing the opposite side for `sidewalk=right`/`left`.
 */
function sidepathSideDeclared(
  tags: Record<string, string>,
  prefix: SidepathPrefix,
  side: SidepathSide,
): boolean {
  const left = tags[`${prefix}:left`]
  const right = tags[`${prefix}:right`]
  const both = tags[`${prefix}:both`]
  const bare = tags[prefix]

  if (left != null || right != null || both != null) {
    const sided = side === 'left' ? left : right
    if (sided != null) return createsOnWaySidepathSlot(sided)
    if (both != null) return createsOnWaySidepathSlot(both)
    return false
  }
  if (bare == null) return false
  const v = bare.toLowerCase()
  if (!createsOnWaySidepathSlot(v)) return false
  if (v === 'left') return side === 'left'
  if (v === 'right') return side === 'right'
  // `both` / `yes` / track / lane / … — both sides (or whichever expand emits)
  return true
}

/**
 * Collect `separate` hints from parent tags (not from expandSidepaths alone —
 * bare `sidewalk=separate` / sided keys both count).
 */
function collectSeparatelyMapped(tags: Record<string, string>): SeparatelyMappedSidepath[] {
  const out: SeparatelyMappedSidepath[] = []
  const seen = new Set<string>()
  const add = (prefix: SeparatelyMappedSidepath['prefix'], side: SidepathSide) => {
    const key = `${prefix}:${side}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ prefix, side })
  }

  for (const prefix of ['sidewalk', 'cycleway'] as const) {
    const left = tags[`${prefix}:left`]
    const right = tags[`${prefix}:right`]
    const both = tags[`${prefix}:both`]
    const bare = tags[prefix]

    if (isSeparatelyMappedValue(left)) add(prefix, 'left')
    if (isSeparatelyMappedValue(right)) add(prefix, 'right')
    if (isSeparatelyMappedValue(both) || isSeparatelyMappedValue(bare)) {
      add(prefix, 'left')
      add(prefix, 'right')
    }
  }
  return out
}

function buildEdgeSlots(
  wayId: number,
  tags: Record<string, string>,
): { left: RoadSpaceSlot[]; right: RoadSpaceSlot[] } {
  const expanded = expandSidepaths(wayId, tags)
  const bySide: Record<SidepathSide, SideEdgeDraft> = {
    left: {},
    right: {},
  }

  for (const entry of expanded) {
    const value = sidepathValueFor(tags, entry)
    // expandSidepaths emits entries for no/none/separate — never turn those into slots.
    if (!createsOnWaySidepathSlot(value)) continue
    // Also drop opposite-side inventions (e.g. sidewalk=right → left entry).
    if (!sidepathSideDeclared(tags, entry.ref.prefix, entry.ref.side)) continue

    const draft = bySide[entry.ref.side]
    if (entry.ref.prefix === 'sidewalk') {
      draft.sidewalk = entry
      continue
    }
    if (isOnCarriagewayCycleValue(value)) continue
    if (isEdgeCycleValue(value) || entry.tags.highway === 'cycleway') {
      draft.cycle = entry
    }
  }

  const left: RoadSpaceSlot[] = []
  const right: RoadSpaceSlot[] = []
  const segregatedRaw = tags.segregated?.toLowerCase()
  const hasSegregated = segregatedRaw === 'yes' || segregatedRaw === 'no'

  for (const side of ['left', 'right'] as const) {
    const draft = bySide[side]
    const target = side === 'left' ? left : right

    if (draft.sidewalk && draft.cycle && hasSegregated) {
      const sharedWidth =
        sideCycleWidth(tags, side) ??
        sideSidewalkWidth(tags, side) ??
        parseWidthToken(draft.cycle.tags.width) ??
        parseWidthToken(draft.sidewalk.tags.width)
      const resolved = widthForKind('shared_path', sharedWidth)
      target.push({
        id: formatEdgeSlotId(draft.cycle.ref),
        kind: 'shared_path',
        zone: 'sidepath',
        direction: 'none',
        widthM: resolved.widthM,
        widthProvenance: resolved.widthProvenance,
        segregated: segregatedRaw === 'yes',
        label: segregatedRaw === 'yes' ? 'segregated' : 'shared',
      })
      continue
    }

    // Outer → inner on left: sidewalk then cycle; on right we reverse later
    if (side === 'left') {
      if (draft.sidewalk) {
        const resolved = widthForKind(
          'sidewalk',
          sideSidewalkWidth(tags, side) ?? parseWidthToken(draft.sidewalk.tags.width),
        )
        target.push({
          id: formatEdgeSlotId(draft.sidewalk.ref),
          kind: 'sidewalk',
          zone: 'sidepath',
          direction: 'none',
          widthM: resolved.widthM,
          widthProvenance: resolved.widthProvenance,
          label: 'sidewalk',
        })
      }
      if (draft.cycle) {
        const resolved = widthForKind(
          'cycle',
          sideCycleWidth(tags, side) ?? parseWidthToken(draft.cycle.tags.width),
        )
        target.push({
          id: formatEdgeSlotId(draft.cycle.ref),
          kind: 'cycle',
          zone: 'sidepath',
          direction: 'none',
          widthM: resolved.widthM,
          widthProvenance: resolved.widthProvenance,
          access: { bicycle: 'designated' },
          label: draft.cycle.tags.cycleway,
        })
      }
    } else {
      if (draft.cycle) {
        const resolved = widthForKind(
          'cycle',
          sideCycleWidth(tags, side) ?? parseWidthToken(draft.cycle.tags.width),
        )
        target.push({
          id: formatEdgeSlotId(draft.cycle.ref),
          kind: 'cycle',
          zone: 'sidepath',
          direction: 'none',
          widthM: resolved.widthM,
          widthProvenance: resolved.widthProvenance,
          access: { bicycle: 'designated' },
          label: draft.cycle.tags.cycleway,
        })
      }
      if (draft.sidewalk) {
        const resolved = widthForKind(
          'sidewalk',
          sideSidewalkWidth(tags, side) ?? parseWidthToken(draft.sidewalk.tags.width),
        )
        target.push({
          id: formatEdgeSlotId(draft.sidewalk.ref),
          kind: 'sidewalk',
          zone: 'sidepath',
          direction: 'none',
          widthM: resolved.widthM,
          widthProvenance: resolved.widthProvenance,
          label: 'sidewalk',
        })
      }
    }
  }

  return { left, right }
}

/**
 * LTR in way direction: left-edge cycle → backward (reversed) → both_ways → forward → right-edge cycle.
 * Only for sided `cycleway:left|right=lane` (and similar). Pipe-derived `cycleway:lanes`
 * stacks must keep pipe order — do not call this on them.
 */
function orderCarriagewayLtr(slots: RoadSpaceSlot[]): RoadSpaceSlot[] {
  const leftCycle: RoadSpaceSlot[] = []
  const rightCycle: RoadSpaceSlot[] = []
  const backward: RoadSpaceSlot[] = []
  const both: RoadSpaceSlot[] = []
  const forward: RoadSpaceSlot[] = []

  for (const slot of slots) {
    if (slot.kind === 'cycle') {
      if (slot.side === 'left') leftCycle.push(slot)
      else if (slot.side === 'right') rightCycle.push(slot)
      else if (slot.direction === 'backward') leftCycle.push(slot)
      else rightCycle.push(slot)
      continue
    }
    if (slot.direction === 'backward') backward.push(slot)
    else if (slot.direction === 'both_ways') both.push(slot)
    else forward.push(slot)
  }

  backward.reverse()
  return [...leftCycle, ...backward, ...both, ...forward, ...rightCycle]
}

function carriagewayWidthM(slots: RoadSpaceSlot[]): number {
  return slots.filter((s) => s.zone === 'carriageway').reduce((sum, s) => sum + s.widthM, 0)
}

/**
 * When `width=*` / `est_width` is present but slots lack per-lane widths, split the
 * remaining metres across default carriageway slots and mark them `inferred`
 * (purple labels). Explicit `width:lanes` / `:width` stay `tagged` (black).
 * Pure fallback defaults stay `default` (no metre label).
 */
function applyCarriagewayWidthInference(
  tags: Record<string, string>,
  slots: RoadSpaceSlot[],
): RoadSpaceSlot[] {
  const wayWidth = parseWidthToken(tags.width) ?? parseWidthToken(tags.est_width)
  if (wayWidth == null || wayWidth <= 0) return slots

  const needsInfer = slots.filter(
    (s) => s.zone === 'carriageway' && s.widthProvenance === 'default',
  )
  if (needsInfer.length === 0) return slots

  const taggedSum = slots
    .filter((s) => s.zone === 'carriageway' && s.widthProvenance === 'tagged')
    .reduce((sum, s) => sum + s.widthM, 0)
  const remainder = wayWidth - taggedSum
  if (remainder <= EPS) return slots

  const each = Math.round((remainder / needsInfer.length) * 100) / 100
  if (each <= 0) return slots

  return slots.map((s) => {
    if (s.zone !== 'carriageway' || s.widthProvenance !== 'default') return s
    return { ...s, widthM: each, widthProvenance: 'inferred' }
  })
}

function isOnewayTag(tags: Record<string, string>): boolean {
  const v = tags.oneway?.toLowerCase()
  return v === 'yes' || v === 'true' || v === '1'
}

function flipDirection(direction: RoadSpaceSlot['direction']): RoadSpaceSlot['direction'] {
  if (direction === 'forward') return 'backward'
  if (direction === 'backward') return 'forward'
  return direction
}

/**
 * Prepare the opposite dual branch for the dimmed side of a fork: mirror LTR so
 * its outer edge faces outward, and flip travel directions to oppose the selected
 * oneway (diagram up = selected forward).
 */
export function prepareDualSiblingSlots(slots: RoadSpaceSlot[]): RoadSpaceSlot[] {
  return [...slots].reverse().map((slot) => ({
    ...slot,
    direction: flipDirection(slot.direction),
  }))
}

function siblingStackWidthM(fork: NonNullable<RoadSpaceSegment['fork']>): number {
  if (fork.siblingSlots && fork.siblingSlots.length > 0) {
    return fork.siblingSlots.reduce((sum, s) => sum + s.widthM, 0)
  }
  return 0
}

function gapBetweenCarriagewaysM(
  perpendicularDistanceM: number | undefined,
  selectedWidthM: number,
  siblingWidthM: number,
): number {
  if (
    perpendicularDistanceM != null &&
    Number.isFinite(perpendicularDistanceM) &&
    perpendicularDistanceM > 0
  ) {
    return Math.max(0, perpendicularDistanceM - selectedWidthM / 2 - siblingWidthM / 2)
  }
  return DEFAULT_MEDIAN_GAP_M
}

function buildDualCarriagewayFork(
  tags: Record<string, string>,
  carriageway: RoadSpaceSlot[],
  dualSibling?: { wayId: number; slots: RoadSpaceSlot[]; perpendicularDistanceM?: number },
  medianHint: 'verge' | 'crossing' = 'verge',
): RoadSpaceSegment['fork'] | undefined {
  if (tags.dual_carriageway?.toLowerCase() !== 'yes') return undefined

  const selectedWidth = carriagewayWidthM(carriageway)

  if (isOnewayTag(tags)) {
    if (dualSibling && dualSibling.slots.length > 0) {
      const siblingSlots = prepareDualSiblingSlots(dualSibling.slots)
      const siblingWidth = carriagewayWidthM(siblingSlots)
      return {
        gapM: gapBetweenCarriagewaysM(
          dualSibling.perpendicularDistanceM,
          selectedWidth,
          siblingWidth,
        ),
        leftSlotIds: siblingSlots.map((s) => s.id),
        rightSlotIds: carriageway.map((s) => s.id),
        dimmedSide: 'left',
        siblingSlots,
        siblingWayId: dualSibling.wayId,
        medianHint,
      }
    }
    return {
      gapM: DEFAULT_MEDIAN_GAP_M,
      leftSlotIds: [],
      rightSlotIds: carriageway.map((s) => s.id),
      dimmedSide: 'left',
      unresolvedSibling: true,
      medianHint,
    }
  }

  const leftSlotIds = carriageway.filter((s) => s.direction === 'backward').map((s) => s.id)
  const rightSlotIds = carriageway
    .filter((s) => s.direction === 'forward' || s.direction === 'both_ways')
    .map((s) => s.id)

  const mid = Math.ceil(carriageway.length / 2)
  return {
    gapM: DEFAULT_MEDIAN_GAP_M,
    leftSlotIds: leftSlotIds.length > 0 ? leftSlotIds : carriageway.slice(0, mid).map((s) => s.id),
    rightSlotIds: rightSlotIds.length > 0 ? rightSlotIds : carriageway.slice(mid).map((s) => s.id),
    medianHint,
  }
}

export function buildRoadSpaceSegment(
  tags: Record<string, string>,
  options: {
    wayId: number
    role: RoadSpaceSegmentRole
    /** Opposite dual-carriageway branch (parallel oneway) when known. */
    dualSibling?: {
      wayId: number
      tags: Record<string, string>
      /** Perpendicular centreline distance (m) when resolved geometrically. */
      perpendicularDistanceM?: number
    }
    /** Median gap meaning when this way is dual (default verge). */
    medianHint?: 'verge' | 'crossing'
  },
): RoadSpaceSegment {
  const { wayId, role, dualSibling, medianHint = 'verge' } = options
  const effectiveTags = effectiveTagsForParse(tags)
  const model = parseWayLanes(tags)

  let carriageway = model.slots.map((slot) => carriagewaySlotFromLane(wayId, slot))
  const expanded = expandOnCarriagewayCycleSlots(wayId, effectiveTags, carriageway)
  // Pipe positions are LTR truth; only sided cycle lanes need edge sorting.
  carriageway = expanded.fromPipe ? expanded.slots : orderCarriagewayLtr(expanded.slots)
  carriageway = applyCarriagewayWidthInference(effectiveTags, carriageway)

  const edges = buildEdgeSlots(wayId, effectiveTags)
  const slots = [...edges.left, ...carriageway, ...edges.right]
  const separatelyMapped = collectSeparatelyMapped(effectiveTags)

  // Explicit placement=* on an expanded pipe stack (cycleway:lanes / extra width:lanes
  // pipes) indexes the full LTR carriageway — so middle_of:2 with motor|cycle|motor
  // lands on the cycle strip. Defaults and motor-only stacks still use driving-lane
  // indices (SRK: lanes=* / lanes:forward|backward), ignoring on-carriageway cycle edges.
  const explicitPlacement = parsePlacement(effectiveTags.placement)
  const driveN = drivingLaneCount(carriageway)
  const isDriving = (s: RoadSpaceSlot) =>
    s.kind === 'motor' || s.kind === 'bus' || s.kind === 'both_ways'
  const placement = resolvePlacement(effectiveTags, driveN, {
    backward: carriageway.filter((s) => isDriving(s) && s.direction === 'backward').length,
    bothWays: carriageway.filter((s) => isDriving(s) && s.direction === 'both_ways').length,
  })
  const expandedPipes = carriageway.length > driveN
  const usePipePlacement =
    explicitPlacement != null && explicitPlacement.kind !== 'transition' && expandedPipes
  const carriagewayOffset = usePipePlacement
    ? centrelineOffsetM(carriageway, placement)
    : centrelineOffsetMDriving(carriageway, placement)
  const leftEdgeWidth = edges.left.reduce((sum, s) => sum + s.widthM, 0)

  let siblingForFork:
    | { wayId: number; slots: RoadSpaceSlot[]; perpendicularDistanceM?: number }
    | undefined
  if (
    dualSibling &&
    isOnewayTag(effectiveTags) &&
    effectiveTags.dual_carriageway?.toLowerCase() === 'yes'
  ) {
    // Build sibling slots without recursing into *its* dual sibling.
    const siblingSeg = buildRoadSpaceSegment(dualSibling.tags, {
      wayId: dualSibling.wayId,
      role,
    })
    siblingForFork = {
      wayId: dualSibling.wayId,
      slots: siblingSeg.slots,
      perpendicularDistanceM: dualSibling.perpendicularDistanceM,
    }
  }

  const fork = buildDualCarriagewayFork(effectiveTags, carriageway, siblingForFork, medianHint)
  const unresolvedSiblingHint =
    fork?.unresolvedSibling === true && fork.siblingSlots == null ? true : undefined

  let centrelineOffset = leftEdgeWidth + carriagewayOffset
  if (fork?.dimmedSide === 'left') {
    const leftExtra = siblingStackWidthM(fork)
    if (leftExtra > 0) centrelineOffset += leftExtra + fork.gapM
  }

  return {
    wayId,
    role,
    slots,
    centrelineOffsetM: centrelineOffset,
    placement,
    ...(effectiveTags.placement != null && effectiveTags.placement !== ''
      ? { placementTag: effectiveTags.placement }
      : {}),
    laneMarkings: model.laneMarkings !== 'no',
    ...(separatelyMapped.length > 0 ? { separatelyMapped } : {}),
    ...(unresolvedSiblingHint ? { unresolvedSiblingHint: true } : {}),
    fork,
  }
}
