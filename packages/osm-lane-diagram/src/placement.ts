import type { RoadSpaceSlot } from './types'

export type PlacementKind = 'left_of' | 'right_of' | 'middle_of' | 'transition'

export type Placement =
  | { kind: 'left_of' | 'right_of' | 'middle_of'; lane: number }
  | { kind: 'transition' }

const PLACEMENT_RE = /^(left_of|right_of|middle_of):(\d+)$/i

export function parsePlacement(value: string | undefined): Placement | null {
  if (value == null || value === '') return null
  const trimmed = value.trim().toLowerCase()
  if (trimmed === 'transition') return { kind: 'transition' }
  const match = PLACEMENT_RE.exec(trimmed)
  if (!match) return null
  const lane = Number.parseInt(match[2]!, 10)
  if (!Number.isInteger(lane) || lane < 1) return null
  return { kind: match[1] as 'left_of' | 'right_of' | 'middle_of', lane }
}

/**
 * SRK defaults when placement is absent:
 * odd lane count → middle_of:ceil(n/2); even → left_of:(n/2 + 1).
 * When `lanes:forward` + `lanes:backward` are both set, default to the boundary
 * between opposing directions (`left_of:backward+1`) so the centreline sits in
 * the median of traffic flow — not inside a turn lane.
 * `transition` falls back to the same default anchor when neighbours are unknown.
 */
export function resolvePlacement(tags: Record<string, string>, laneCount: number): Placement {
  const parsed = parsePlacement(tags.placement)
  if (parsed && parsed.kind !== 'transition') return parsed

  const backward = Number.parseInt(tags['lanes:backward'] ?? '', 10)
  const forward = Number.parseInt(tags['lanes:forward'] ?? '', 10)
  if (
    Number.isInteger(backward) &&
    Number.isInteger(forward) &&
    backward > 0 &&
    forward > 0 &&
    backward + forward === laneCount
  ) {
    return { kind: 'left_of', lane: backward + 1 }
  }

  if (laneCount <= 0) return { kind: 'middle_of', lane: 1 }
  if (laneCount % 2 === 1) {
    return { kind: 'middle_of', lane: Math.ceil(laneCount / 2) }
  }
  return { kind: 'left_of', lane: laneCount / 2 + 1 }
}

/**
 * Distance from the left edge of the LTR carriageway stack to the OSM centreline.
 * Lane numbering is 1-based left-to-right over `slots` (typically carriageway only).
 */
export function centrelineOffsetM(slots: RoadSpaceSlot[], placement: Placement): number {
  if (slots.length === 0) return 0

  const total = slots.reduce((sum, s) => sum + s.widthM, 0)
  if (placement.kind === 'transition') {
    return total / 2
  }

  const lane = Math.min(Math.max(1, placement.lane), slots.length)
  let offset = 0
  for (let i = 0; i < lane - 1; i++) {
    offset += slots[i]!.widthM
  }
  const laneWidth = slots[lane - 1]!.widthM
  if (placement.kind === 'left_of') return offset
  if (placement.kind === 'right_of') return offset + laneWidth
  return offset + laneWidth / 2
}

function isDrivingSlot(slot: RoadSpaceSlot): boolean {
  return slot.kind === 'motor' || slot.kind === 'bus' || slot.kind === 'both_ways'
}

/**
 * Like `centrelineOffsetM`, but placement lane indices refer to driving lanes only
 * (motor/bus/both_ways). Used for SRK defaults and motor-only stacks. When `placement=*`
 * is explicit on an expanded pipe list (`cycleway:lanes` / extra `width:lanes` pipes),
 * `from-tags` uses `centrelineOffsetM` on the full carriageway instead so the purple
 * guide hits the referenced pipe (e.g. mid-road cycle = `middle_of:2`).
 */
export function centrelineOffsetMDriving(slots: RoadSpaceSlot[], placement: Placement): number {
  const driving = slots.filter(isDrivingSlot)
  if (driving.length === 0) return centrelineOffsetM(slots, placement)

  const targetInDriving = centrelineOffsetM(driving, placement)
  if (placement.kind === 'transition') {
    return slots.reduce((sum, s) => sum + s.widthM, 0) / 2
  }

  let drivingAcc = 0
  let fullAcc = 0
  for (const slot of slots) {
    if (isDrivingSlot(slot)) {
      const nextDriving = drivingAcc + slot.widthM
      if (targetInDriving <= nextDriving + 1e-9) {
        return fullAcc + (targetInDriving - drivingAcc)
      }
      drivingAcc = nextDriving
    }
    fullAcc += slot.widthM
  }
  return fullAcc
}

/** Driving-lane count for `resolvePlacement` (excludes on-carriageway cycle slots). */
export function drivingLaneCount(slots: RoadSpaceSlot[]): number {
  const n = slots.filter(isDrivingSlot).length
  return n > 0 ? n : slots.length
}

function carriagewaySlots(slots: RoadSpaceSlot[]): RoadSpaceSlot[] {
  return slots.filter((s) => s.zone === 'carriageway')
}

function slotKindAtLane(carriageway: RoadSpaceSlot[], lane: number): string | null {
  if (carriageway.length === 0) return null
  const idx = Math.min(Math.max(1, lane), carriageway.length) - 1
  return carriageway[idx]?.kind ?? null
}

/**
 * Validate that consecutive segments' `placement=*` steps are compatible with a
 * shared purple centreline: the lane a placement points at must be the same kind on
 * both sides (e.g. `middle_of:2` on a cycle lane vs on a motor lane cannot align).
 * The same `placement` with a different lane count is fine — lanes count from the left.
 */
export function collectPlacementIssues(
  segments: Array<{
    wayId: number
    slots: RoadSpaceSlot[]
    placement: Placement
    placementTag?: string
    synthetic?: boolean
  }>,
): string[] {
  const issues: string[] = []
  const real = segments.filter((s) => !s.synthetic)

  for (const seg of real) {
    const cw = carriagewaySlots(seg.slots)
    const parsed = parsePlacement(seg.placementTag)
    if (parsed && parsed.kind !== 'transition' && parsed.lane > cw.length) {
      issues.push(
        `way ${seg.wayId}: placement=${seg.placementTag} indexes lane ${parsed.lane} but carriageway has only ${cw.length} pipe(s)`,
      )
    }
    if (parsed?.kind === 'transition') {
      issues.push(
        `way ${seg.wayId}: placement=transition falls back to a default anchor (neighbour lerp not modelled) — corridor shear may be wrong`,
      )
    }
  }

  for (let i = 0; i < real.length - 1; i++) {
    const a = real[i]!
    const b = real[i + 1]!
    const aParsed = parsePlacement(a.placementTag)
    const bParsed = parsePlacement(b.placementTag)
    if (
      aParsed == null ||
      bParsed == null ||
      aParsed.kind === 'transition' ||
      bParsed.kind === 'transition'
    ) {
      continue
    }

    const aCw = carriagewaySlots(a.slots)
    const bCw = carriagewaySlots(b.slots)
    const aKind = slotKindAtLane(aCw, aParsed.lane)
    const bKind = slotKindAtLane(bCw, bParsed.lane)

    if (aKind != null && bKind != null && aKind !== bKind) {
      issues.push(
        `ways ${a.wayId}→${b.wayId}: placement steps ${a.placementTag} → ${b.placementTag} put different slot kinds on the shared centreline (${aKind} vs ${bKind}) — ribbons must shear`,
      )
    }
  }

  return issues
}
