import { DEFAULT_MEDIAN_GAP_M } from './defaults'
import type { RoadSpaceSegment, RoadSpaceSlot } from './types'

const TURN_LEFT = new Set(['left', 'sharp_left', 'slight_left'])
const TURN_RIGHT = new Set(['right', 'sharp_right', 'slight_right'])

function turnTokens(slot: RoadSpaceSlot): string[] {
  if (!slot.turn) return []
  return slot.turn
    .split(';')
    .map((t) => t.trim())
    .filter(Boolean)
}

/** Normalized turn role for correspondence — keeps pockets separate from through lanes. */
export function turnSignature(slot: RoadSpaceSlot): string {
  if (slot == null) return 'none'
  if (!slot.turn) {
    if (slot.direction === 'none') return 'none'
    return 'through'
  }
  const tokens = turnTokens(slot)
  if (tokens.length === 0) return 'through'
  if (tokens.some((t) => TURN_LEFT.has(t))) return 'left'
  if (tokens.some((t) => TURN_RIGHT.has(t))) return 'right'
  if (tokens.includes('through') || tokens.includes('none')) return 'through'
  return tokens.slice().sort().join('+')
}

/**
 * Pure-turn pocket: left/right variants only — no through, merge, or reverse.
 * `through;right` is not pure-turn (shared turn+through lane).
 */
export function isPureTurnSlot(slot: RoadSpaceSlot): boolean {
  const tokens = turnTokens(slot)
  if (tokens.length === 0) return false
  if (tokens.includes('through') || tokens.includes('none')) return false
  if (tokens.some((t) => t === 'reverse' || t.startsWith('merge'))) return false
  return tokens.some((t) => TURN_LEFT.has(t) || TURN_RIGHT.has(t))
}

function slotFromCorrIndex(
  segment: RoadSpaceSegment,
  index: number,
  branch: StackBranch = 'travel',
): RoadSpaceSlot | undefined {
  if (branch === 'sibling') return segment.fork?.siblingSlots?.[index]
  return segment.slots[index]
}

/**
 * Implied junction: a pure-turn carriageway lane disappears in its travel direction.
 * A = above, B = below; forward travels up (B→A), backward travels down (A→B).
 * Appearing pockets (unmatched forward in A / unmatched backward in B) stay tapers.
 */
export function seamIsImpliedJunction(
  segA: RoadSpaceSegment,
  segB: RoadSpaceSegment,
  corr: StackCorrespondence,
): boolean {
  for (const u of corr.unmatchedB) {
    const slot = slotFromCorrIndex(segB, u.index, u.branch ?? 'travel')
    if (!slot || slot.zone !== 'carriageway') continue
    if (slot.direction !== 'forward' && slot.direction !== 'both_ways') continue
    if (isPureTurnSlot(slot)) return true
  }
  for (const u of corr.unmatchedA) {
    const slot = slotFromCorrIndex(segA, u.index, u.branch ?? 'travel')
    if (!slot || slot.zone !== 'carriageway') continue
    if (slot.direction !== 'backward') continue
    if (isPureTurnSlot(slot)) return true
  }
  return false
}

const EPS = 0.01
const GAP_PENALTY = 4

export type StackBranch = 'travel' | 'sibling'

export type StackPair = {
  indexA: number
  indexB: number
  branchA?: StackBranch
  branchB?: StackBranch
}

export type StackCorrespondence = {
  pairs: StackPair[]
  unmatchedA: Array<{ index: number; branch?: StackBranch }>
  unmatchedB: Array<{ index: number; branch?: StackBranch }>
}

export type SegmentStack = {
  slots: RoadSpaceSlot[]
  siblingSlots?: RoadSpaceSlot[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function siblingStackWidthM(slots: RoadSpaceSlot[] | undefined): number {
  if (!slots || slots.length === 0) return 0
  return slots.reduce((sum, s) => sum + s.widthM, 0)
}

function forkGapM(fork: RoadSpaceSegment['fork'] | undefined): number {
  if (!fork) return 0
  return fork.gapM > 0 ? fork.gapM : DEFAULT_MEDIAN_GAP_M
}

/** Metric left edge of each travel slot within the full LTR stack (sibling + gap included). */
export function slotStartsM(segment: RoadSpaceSegment): number[] {
  const { slots, fork } = segment
  const starts: number[] = []
  let x = 0

  if (fork?.dimmedSide === 'left' && siblingStackWidthM(fork.siblingSlots) > 0) {
    x = siblingStackWidthM(fork.siblingSlots) + forkGapM(fork)
  }

  const leftSet = new Set(fork?.leftSlotIds ?? [])
  const rightSet = new Set(fork?.rightSlotIds ?? [])
  const gapM = forkGapM(fork)
  let gapInserted = fork?.dimmedSide === 'left' && siblingStackWidthM(fork.siblingSlots) > 0

  for (const slot of slots) {
    if (fork && !gapInserted && leftSet.size > 0 && rightSet.has(slot.id) && starts.length > 0) {
      const prevSlot = slots[starts.length - 1]!
      if (leftSet.has(prevSlot.id)) {
        x += gapM
        gapInserted = true
      }
    }
    starts.push(x)
    x += slot.widthM
  }

  return starts
}

/** Metric left edge of each sibling slot (dual opposite branch). */
export function siblingSlotStartsM(segment: RoadSpaceSegment): number[] {
  const fork = segment.fork
  const siblingSlots = fork?.siblingSlots
  if (!siblingSlots || siblingSlots.length === 0) return []

  const travelStarts = slotStartsM(segment)

  const gapM = forkGapM(fork)
  const starts: number[] = []

  if (fork?.dimmedSide === 'left') {
    let x = 0
    for (const slot of siblingSlots) {
      starts.push(x)
      x += slot.widthM
    }
    return starts
  }

  if (fork?.dimmedSide === 'right') {
    let x =
      (travelStarts[travelStarts.length - 1] ?? 0) + (segment.slots.at(-1)?.widthM ?? 0) + gapM
    for (const slot of siblingSlots) {
      starts.push(x)
      x += slot.widthM
    }
    return starts
  }

  return starts
}

export function slotCenterM(
  segment: RoadSpaceSegment,
  index: number,
  branch: StackBranch = 'travel',
): number {
  if (branch === 'sibling') {
    const starts = siblingSlotStartsM(segment)
    const slot = segment.fork?.siblingSlots?.[index]
    if (!slot || starts[index] == null) return 0
    return starts[index]! + slot.widthM / 2
  }
  const starts = slotStartsM(segment)
  const slot = segment.slots[index]
  if (!slot || starts[index] == null) return 0
  return starts[index]! + slot.widthM / 2
}

function matchScore(a: RoadSpaceSlot, b: RoadSpaceSlot): number {
  let score = 0
  if (a.zone === b.zone) score += 5
  else score -= 10
  if (a.kind === b.kind) score += 5
  else score -= 10
  if (a.direction === b.direction) score += 4
  else score -= 8
  if (turnSignature(a) === turnSignature(b)) score += 4
  else score -= 8
  score -= Math.abs(a.widthM - b.widthM) * 0.75
  return score
}

function splitByDirection(slots: RoadSpaceSlot[]): {
  backward: Array<{ slot: RoadSpaceSlot; index: number }>
  forward: Array<{ slot: RoadSpaceSlot; index: number }>
  other: Array<{ slot: RoadSpaceSlot; index: number }>
} {
  const backward: Array<{ slot: RoadSpaceSlot; index: number }> = []
  const forward: Array<{ slot: RoadSpaceSlot; index: number }> = []
  const other: Array<{ slot: RoadSpaceSlot; index: number }> = []
  slots.forEach((slot, index) => {
    if (slot.direction === 'backward') backward.push({ slot, index })
    else if (slot.direction === 'forward' || slot.direction === 'both_ways') {
      forward.push({ slot, index })
    } else {
      other.push({ slot, index })
    }
  })
  return { backward, forward, other }
}

/**
 * Split a bidirectional stack where the directions meet: everything up to the last
 * backward lane (with the left sidewalk / track) goes with the opposite branch of a
 * dual carriageway, the rest (with the right sidewalk / track) with the travel branch.
 */
function splitAtDirectionChange(slots: RoadSpaceSlot[]): ReturnType<typeof splitByDirection> {
  let lastBackward = -1
  slots.forEach((slot, index) => {
    if (slot.direction === 'backward') lastBackward = index
  })
  const indexed = slots.map((slot, index) => ({ slot, index }))
  return {
    backward: indexed.slice(0, lastBackward + 1),
    forward: indexed.slice(lastBackward + 1),
    other: [],
  }
}

function nwMatch(
  slotsA: RoadSpaceSlot[],
  slotsB: RoadSpaceSlot[],
  branchA: StackBranch = 'travel',
  branchB: StackBranch = 'travel',
): StackCorrespondence {
  const n = slotsA.length
  const m = slotsB.length
  if (n === 0 && m === 0) {
    return { pairs: [], unmatchedA: [], unmatchedB: [] }
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  const bt: Array<Array<'match' | 'gapA' | 'gapB' | 'start'>> = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill('start'),
  )

  for (let i = 1; i <= n; i++) {
    dp[i]![0] = dp[i - 1]![0]! - GAP_PENALTY
    bt[i]![0] = 'gapA'
  }
  for (let j = 1; j <= m; j++) {
    dp[0]![j] = dp[0]![j - 1]! - GAP_PENALTY
    bt[0]![j] = 'gapB'
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const match = dp[i - 1]![j - 1]! + matchScore(slotsA[i - 1]!, slotsB[j - 1]!)
      const gapA = dp[i - 1]![j]! - GAP_PENALTY
      const gapB = dp[i]![j - 1]! - GAP_PENALTY
      if (match >= gapA && match >= gapB) {
        dp[i]![j] = match
        bt[i]![j] = 'match'
      } else if (gapA >= gapB) {
        dp[i]![j] = gapA
        bt[i]![j] = 'gapA'
      } else {
        dp[i]![j] = gapB
        bt[i]![j] = 'gapB'
      }
    }
  }

  const pairs: StackPair[] = []
  const unmatchedA: Array<{ index: number; branch?: StackBranch }> = []
  const unmatchedB: Array<{ index: number; branch?: StackBranch }> = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    const step = bt[i]![j]!
    if (step === 'match') {
      pairs.unshift({
        indexA: i - 1,
        indexB: j - 1,
        branchA,
        branchB,
      })
      i--
      j--
    } else if (step === 'gapA') {
      unmatchedA.unshift({ index: i - 1, branch: branchA })
      i--
    } else {
      unmatchedB.unshift({ index: j - 1, branch: branchB })
      j--
    }
  }

  return { pairs, unmatchedA, unmatchedB }
}

/**
 * Needleman–Wunsch over two LTR slot arrays. Gaps model appear/disappear lanes;
 * monotonic DP guarantees matched lanes never cross.
 */
export function matchStacks(a: RoadSpaceSlot[], b: RoadSpaceSlot[]): StackCorrespondence {
  return nwMatch(a, b)
}

function hasResolvableSibling(stack: SegmentStack): boolean {
  return (stack.siblingSlots?.length ?? 0) > 0
}

function isDirectionalBi(stack: SegmentStack): boolean {
  const { backward, forward } = splitByDirection(stack.slots)
  return backward.length > 0 && forward.length > 0 && !hasResolvableSibling(stack)
}

/**
 * Segment-aware matching: bidirectional ↔ dual maps forward half ↔ travel slots and
 * backward half ↔ sibling slots when the dual branch is resolved.
 */
export function matchSegmentStacks(a: SegmentStack, b: SegmentStack): StackCorrespondence {
  const aBi = isDirectionalBi(a)
  const bBi = isDirectionalBi(b)
  const aDual = hasResolvableSibling(a)
  const bDual = hasResolvableSibling(b)

  if (aBi && bDual && b.siblingSlots) {
    const aSplit = splitAtDirectionChange(a.slots)
    const travel = nwMatch(
      aSplit.forward.map((x) => x.slot),
      b.slots,
      'travel',
      'travel',
    )
    const sibling = nwMatch(
      aSplit.backward.map((x) => x.slot),
      b.siblingSlots,
      'travel',
      'sibling',
    )
    const other = nwMatch(
      aSplit.other.map((x) => x.slot),
      [],
      'travel',
      'travel',
    )
    return mergeBiDual(aSplit, travel, sibling, other, b.slots.length, b.siblingSlots.length)
  }

  if (bBi && aDual && a.siblingSlots) {
    const flipped = matchSegmentStacks(b, a)
    return flipCorrespondence(flipped, a.slots.length, a.siblingSlots.length)
  }

  if (aDual && bDual) {
    const travel = nwMatch(a.slots, b.slots, 'travel', 'travel')
    const sibling = nwMatch(a.siblingSlots!, b.siblingSlots!, 'sibling', 'sibling')
    return mergeDualDual(travel, sibling)
  }

  if (aDual && !bDual) {
    const travel = nwMatch(a.slots, b.slots, 'travel', 'travel')
    return travel
  }

  if (bDual && !aDual) {
    const travel = nwMatch(a.slots, b.slots, 'travel', 'travel')
    return travel
  }

  return nwMatch(a.slots, b.slots)
}

function mergeBiDual(
  aSplit: ReturnType<typeof splitByDirection>,
  travel: StackCorrespondence,
  sibling: StackCorrespondence,
  other: StackCorrespondence,
  _bTravelLen: number,
  _bSiblingLen: number,
): StackCorrespondence {
  const pairs: StackPair[] = []
  for (const p of travel.pairs) {
    pairs.push({
      indexA: aSplit.forward[p.indexA]!.index,
      indexB: p.indexB,
      branchA: 'travel',
      branchB: 'travel',
    })
  }
  for (const p of sibling.pairs) {
    pairs.push({
      indexA: aSplit.backward[p.indexA]!.index,
      indexB: p.indexB,
      branchA: 'travel',
      branchB: 'sibling',
    })
  }
  for (const p of other.pairs) {
    pairs.push({
      indexA: aSplit.other[p.indexA]!.index,
      indexB: p.indexB,
      branchA: 'travel',
      branchB: 'travel',
    })
  }

  const matchedA = new Set(pairs.map((p) => p.indexA))
  const matchedBTravel = new Set(
    pairs.filter((p) => (p.branchB ?? 'travel') !== 'sibling').map((p) => p.indexB),
  )
  const matchedBSibling = new Set(pairs.filter((p) => p.branchB === 'sibling').map((p) => p.indexB))

  const unmatchedA: Array<{ index: number; branch?: StackBranch }> = []
  for (const { index } of aSplit.forward) {
    if (!matchedA.has(index)) unmatchedA.push({ index, branch: 'travel' })
  }
  for (const { index } of aSplit.backward) {
    if (!matchedA.has(index)) unmatchedA.push({ index, branch: 'travel' })
  }
  for (const { index } of aSplit.other) {
    if (!matchedA.has(index)) unmatchedA.push({ index, branch: 'travel' })
  }

  const unmatchedB: Array<{ index: number; branch?: StackBranch }> = []
  for (let j = 0; j < _bTravelLen; j++) {
    if (!matchedBTravel.has(j)) unmatchedB.push({ index: j, branch: 'travel' })
  }
  for (let j = 0; j < _bSiblingLen; j++) {
    if (!matchedBSibling.has(j)) unmatchedB.push({ index: j, branch: 'sibling' })
  }

  return { pairs: sortPairs(pairs), unmatchedA, unmatchedB }
}

function sortPairs(pairs: StackPair[]): StackPair[] {
  return [...pairs].sort((a, b) => a.indexA - b.indexA || a.indexB - b.indexB)
}

function mergeDualDual(
  travel: StackCorrespondence,
  sibling: StackCorrespondence,
): StackCorrespondence {
  return {
    pairs: sortPairs([
      ...travel.pairs.map((p) => ({
        ...p,
        branchA: 'travel' as const,
        branchB: 'travel' as const,
      })),
      ...sibling.pairs.map((p) => ({
        ...p,
        branchA: 'sibling' as const,
        branchB: 'sibling' as const,
      })),
    ]),
    unmatchedA: [
      ...travel.unmatchedA.map((u) => ({ ...u, branch: 'travel' as const })),
      ...sibling.unmatchedA.map((u) => ({ ...u, branch: 'sibling' as const })),
    ],
    unmatchedB: [
      ...travel.unmatchedB.map((u) => ({ ...u, branch: 'travel' as const })),
      ...sibling.unmatchedB.map((u) => ({ ...u, branch: 'sibling' as const })),
    ],
  }
}

function flipCorrespondence(
  corr: StackCorrespondence,
  aTravelLen: number,
  aSiblingLen: number,
): StackCorrespondence {
  void aTravelLen
  void aSiblingLen
  return {
    pairs: corr.pairs.map((p) => ({
      indexA: p.indexB,
      indexB: p.indexA,
      branchA: p.branchB,
      branchB: p.branchA,
    })),
    unmatchedA: corr.unmatchedB.map((u) => ({ index: u.index, branch: u.branch })),
    unmatchedB: corr.unmatchedA.map((u) => ({ index: u.index, branch: u.branch })),
  }
}

function segmentStack(segment: RoadSpaceSegment): SegmentStack {
  return {
    slots: segment.slots,
    siblingSlots: segment.fork?.siblingSlots,
  }
}

function preferredDeltaM(
  segA: RoadSpaceSegment,
  segB: RoadSpaceSegment,
  corr: StackCorrespondence,
): number | null {
  if (corr.pairs.length === 0) return null
  let weightSum = 0
  let deltaSum = 0
  for (const pair of corr.pairs) {
    const centerA = slotCenterM(segA, pair.indexA, pair.branchA ?? 'travel')
    const centerB = slotCenterM(segB, pair.indexB, pair.branchB ?? 'travel')
    const slotA =
      (pair.branchA ?? 'travel') === 'sibling'
        ? segA.fork?.siblingSlots?.[pair.indexA]
        : segA.slots[pair.indexA]
    const slotB =
      (pair.branchB ?? 'travel') === 'sibling'
        ? segB.fork?.siblingSlots?.[pair.indexB]
        : segB.slots[pair.indexB]
    if (!slotA || !slotB) continue
    if (slotA.zone !== 'carriageway' || slotB.zone !== 'carriageway') continue
    const w = Math.min(slotA.widthM, slotB.widthM)
    const delta = centerA - centerB
    weightSum += w
    deltaSum += w * delta
  }
  if (weightSum <= EPS) return null
  return deltaSum / weightSum
}

function pickAnchorIndex(segments: RoadSpaceSegment[]): number {
  const tagged = segments.findIndex((s) => s.placementTag != null && s.placementTag !== '')
  if (tagged >= 0) return tagged
  return Math.floor((segments.length - 1) / 2)
}

export type ChainOffsetSolution = {
  /** Left edge of each segment's LTR stack in metres (anchor-relative, then absolute). */
  stackLeftM: number[]
  /** Correspondence for each adjacent pair segments[i] ↔ segments[i+1]. */
  correspondences: StackCorrespondence[]
  anchorIndex: number
}

/**
 * Width-weighted least-squares chain of horizontal offsets so matched lane centres align.
 * Anchor: first segment with an explicit `placementTag`, else the middle segment.
 */
export function solveChainOffsets(segments: RoadSpaceSegment[]): ChainOffsetSolution {
  const n = segments.length
  if (n === 0) {
    return { stackLeftM: [], correspondences: [], anchorIndex: 0 }
  }

  const correspondences: StackCorrespondence[] = []
  const relative: number[] = Array(n).fill(0)

  for (let i = 0; i < n - 1; i++) {
    const corr = matchSegmentStacks(segmentStack(segments[i]!), segmentStack(segments[i + 1]!))
    correspondences.push(corr)
    const delta = preferredDeltaM(segments[i]!, segments[i + 1]!, corr)
    if (delta != null) {
      relative[i + 1] = relative[i]! + delta
    } else if (i > 0) {
      relative[i + 1] = relative[i]!
    }
  }

  const anchorIndex = pickAnchorIndex(segments)
  const anchorOffset = relative[anchorIndex] ?? 0
  const stackLeftM = relative.map((r) => round2(r - anchorOffset))

  return { stackLeftM, correspondences, anchorIndex }
}

/** Whether two slot slices correspond across adjacent bands. */
export function slicesCorrespond(
  corr: StackCorrespondence,
  aIndex: number,
  aSibling: boolean,
  bIndex: number,
  bSibling: boolean,
): boolean {
  const branchA: StackBranch = aSibling ? 'sibling' : 'travel'
  const branchB: StackBranch = bSibling ? 'sibling' : 'travel'
  return corr.pairs.some(
    (p) =>
      p.indexA === aIndex &&
      p.indexB === bIndex &&
      (p.branchA ?? 'travel') === branchA &&
      (p.branchB ?? 'travel') === branchB,
  )
}

/** Magnitude of layout change across a seam (metres) — drives glue band height. */
export function seamChangeMagnitude(
  segA: RoadSpaceSegment,
  segB: RoadSpaceSegment,
  corr: StackCorrespondence,
): number {
  let change = 0
  const travelWidthA = segA.slots.reduce((s, slot) => s + slot.widthM, 0)
  const travelWidthB = segB.slots.reduce((s, slot) => s + slot.widthM, 0)
  change = Math.max(change, Math.abs(travelWidthA - travelWidthB))

  const cwA = segA.slots.filter((s) => s.zone === 'carriageway')
  const cwB = segB.slots.filter((s) => s.zone === 'carriageway')
  change = Math.max(change, Math.abs(cwA.length - cwB.length))

  for (const pair of corr.pairs) {
    const slotA =
      (pair.branchA ?? 'travel') === 'sibling'
        ? segA.fork?.siblingSlots?.[pair.indexA]
        : segA.slots[pair.indexA]
    const slotB =
      (pair.branchB ?? 'travel') === 'sibling'
        ? segB.fork?.siblingSlots?.[pair.indexB]
        : segB.slots[pair.indexB]
    if (slotA && slotB) {
      change = Math.max(change, Math.abs(slotA.widthM - slotB.widthM))
    }
  }

  if (corr.unmatchedA.length > 0 || corr.unmatchedB.length > 0) {
    change = Math.max(change, 0.5)
  }

  // A dual split spreads the road by the opposite branch + median: give the glue band
  // room for that sideways move.
  if ((segA.fork != null) !== (segB.fork != null)) {
    const spreadM = (seg: RoadSpaceSegment) =>
      seg.fork ? siblingStackWidthM(seg.fork.siblingSlots) + forkGapM(seg.fork) : 0
    change = Math.max(change, Math.abs(spreadM(segA) - spreadM(segB)) / 2)
  }

  return change
}
