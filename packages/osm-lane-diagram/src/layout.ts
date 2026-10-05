import {
  seamChangeMagnitude,
  seamIsImpliedJunction,
  slotStartsM,
  solveChainOffsets,
  type StackCorrespondence,
} from './correspondence'
import { appendMorphingVerticalRun, appendSCurve, bandSeamExtent } from './curve'
import {
  DEFAULT_MEDIAN_GAP_M,
  DEFAULT_METERS_TO_PX,
  JUNCTION_BAND_HEIGHT_FRAC,
  SEGMENT_BAND_HEIGHT_PX,
  SEGMENT_GAP_PX,
  TAPER_FRAC,
  TRANSITION_BAND_HEIGHT_FRAC,
  TRANSITION_CURVE_SAMPLES,
} from './defaults'
import { collectPlacementIssues } from './placement'
import { buildCarriagewayPlates, buildCorridorRibbons } from './ribbons'
import type {
  RoadSpaceChain,
  RoadSpaceScene,
  RoadSpaceSceneDebug,
  RoadSpaceSegment,
  RoadSpaceSlot,
  SceneDebugBandOffset,
  SceneDebugCorrespondenceLink,
  SceneJunctionBand,
  ScenePolyline,
  SceneSegmentBand,
  SceneSlotRect,
} from './types'

const PADDING_PX = 16
const EPS = 0.01
/** Soft warning when the way line jumps between two tagged placements (metres). */
const PLACEMENT_OFFSET_WARN_M = 0.35
/** Near-equal X positions merge into one separator run (px). */
const SEPARATOR_X_TOLERANCE_PX = 2
/** Width-change epsilon (metres) — below this, keep transition bands compact. */
const TRANSITION_CHANGE_EPS_M = 0.05

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function bandHasSiblingFork(band: BandGeometry): boolean {
  return (band.segment.fork?.siblingSlots?.length ?? 0) > 0 && band.siblingSlotLeftX != null
}

/** Midpoint of the sibling branch carriageway (kerb–kerb, excluding sidepaths). */
function siblingCarriagewayCentreX(band: BandGeometry, metersToPx: number): number | null {
  const slots = band.segment.fork?.siblingSlots
  const lefts = band.siblingSlotLeftX
  if (!slots || !lefts) return null
  let left: number | null = null
  let right: number | null = null
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!
    if (slot.zone !== 'carriageway') continue
    const lx = lefts[i]
    if (lx == null) continue
    const rx = lx + slot.widthM * metersToPx
    left = left == null ? lx : Math.min(left, lx)
    right = right == null ? rx : Math.max(right, rx)
  }
  if (left == null || right == null) return null
  return round2((left + right) / 2)
}

/**
 * Sibling OSM-forward in scene space from prepared slot directions
 * (`prepareDualSiblingSlots` flips oneway sibling travel to oppose the selected way).
 */
function siblingForwardInScene(
  siblingSlots: RoadSpaceSlot[] | undefined,
): 'up' | 'down' | undefined {
  if (!siblingSlots?.length) return undefined
  let forward = 0
  let backward = 0
  for (const slot of siblingSlots) {
    if (slot.zone !== 'carriageway') continue
    if (slot.direction === 'forward') forward++
    else if (slot.direction === 'backward') backward++
  }
  if (forward === 0 && backward === 0) return undefined
  return backward >= forward ? 'down' : 'up'
}

/**
 * Secondary violet guides over dual-carriageway sibling branches. Contiguous runs of
 * real fork bands (plus intervening synthetic glue) — not plain/merged bands.
 */
function buildSiblingPlacementGuides(bands: BandGeometry[], metersToPx: number): ScenePolyline[] {
  const out: ScenePolyline[] = []
  let i = 0
  let guideIndex = 0
  while (i < bands.length) {
    if (!bandHasSiblingFork(bands[i]!)) {
      i++
      continue
    }
    let j = i
    while (j + 1 < bands.length) {
      const next = bands[j + 1]!
      if (bandHasSiblingFork(next)) {
        j++
        continue
      }
      if (next.segment.synthetic && j + 2 < bands.length && bandHasSiblingFork(bands[j + 2]!)) {
        j += 2
        continue
      }
      break
    }

    const points: Array<{ x: number; y: number }> = []
    let forward: 'up' | 'down' | undefined
    let lastX: number | null = null
    for (let k = i; k <= j; k++) {
      const band = bands[k]!
      let x = siblingCarriagewayCentreX(band, metersToPx)
      if (x == null) {
        // Synthetic glue between duals: reuse neighbouring sibling centreline.
        for (let t = k - 1; t >= i; t--) {
          x = siblingCarriagewayCentreX(bands[t]!, metersToPx)
          if (x != null) break
        }
        if (x == null) {
          for (let t = k + 1; t <= j; t++) {
            x = siblingCarriagewayCentreX(bands[t]!, metersToPx)
            if (x != null) break
          }
        }
      }
      if (x == null) continue
      if (forward == null) {
        forward = siblingForwardInScene(band.segment.fork?.siblingSlots)
      }
      const y0 = round2(band.y)
      const y1 = round2(band.y + band.height)
      if (lastX != null && differs(lastX, x) && points.length > 0) {
        points.push({ x, y: y0 })
      } else if (points.length === 0) {
        points.push({ x, y: y0 })
      } else if (differs(points[points.length - 1]!.x, x)) {
        points.push({ x, y: y0 })
      }
      points.push({ x, y: y1 })
      lastX = x
    }

    if (points.length >= 2) {
      out.push({
        id: `sibling-placement-guide-${guideIndex++}`,
        kind: 'sibling_placement_guide',
        style: 'solid',
        points,
        ...(forward ? { forward } : {}),
      })
    }
    i = j + 1
  }
  return out
}

/**
 * The selected way's centreline through all bands: straight inside a real band at that
 * band's own centreline, S-curve across the glue between two bands that differ
 * (e.g. bidirectional → one branch of a dual carriageway).
 */
function buildPlacementGuidePoints(bands: BandGeometry[]): Array<{ x: number; y: number }> {
  const real = bands.filter((b) => !b.segment.synthetic)
  const points: Array<{ x: number; y: number }> = []
  for (let i = 0; i < real.length; i++) {
    const band = real[i]!
    const top = round2(band.y)
    const bottom = round2(band.y + band.height)
    const prev = real[i - 1]
    if (prev) {
      appendSCurve(
        points,
        prev.centrelineX,
        round2(prev.y + prev.height),
        band.centrelineX,
        top,
        TRANSITION_CURVE_SAMPLES,
      )
    } else {
      points.push({ x: band.centrelineX, y: top })
    }
    points.push({ x: band.centrelineX, y: bottom })
  }
  return dedupePoints(points)
}

function differs(a: number, b: number): boolean {
  return Math.abs(a - b) > EPS
}

type BandGeometry = {
  segment: RoadSpaceSegment
  y: number
  height: number
  /** Left edge of the full LTR stack in px. */
  stackLeftX: number
  /** Left edge x of each real slot (same order as segment.slots). */
  slotLeftX: number[]
  /** Left edge x of each opposite-branch slot (fork.siblingSlots order). */
  siblingSlotLeftX?: number[]
  centrelineX: number
  leftOuterX: number
  rightOuterX: number
  leftKerbX: number
  rightKerbX: number
  /** Left/right envelope including sibling placeholder (dual spreading). */
  leftSpreadOuterX: number
  rightSpreadOuterX: number
  /** Facing edges of the median gap (absent when no fork). */
  medianLeftX?: number
  medianRightX?: number
  /** Opposite-branch footprint (real sibling stack or gray placeholder). */
  placeholder?: { x: number; width: number }
  /** Synthetic implied-junction placeholder — no lane morph across this band. */
  junction?: boolean
}

/** Width of the dimmed opposite branch (real sibling slots only). */
function siblingStackWidthM(fork: NonNullable<RoadSpaceSegment['fork']>): number {
  if (fork.siblingSlots && fork.siblingSlots.length > 0) {
    return fork.siblingSlots.reduce((sum, s) => sum + s.widthM, 0)
  }
  return 0
}

function forkGapM(fork: RoadSpaceSegment['fork'] | undefined): number {
  if (!fork) return 0
  return fork.gapM > 0 ? fork.gapM : DEFAULT_MEDIAN_GAP_M
}

function stackWidthM(slots: RoadSpaceSlot[], fork?: RoadSpaceSegment['fork']): number {
  const sum = slots.reduce((s, slot) => s + slot.widthM, 0)
  if (!fork) return sum
  return sum + forkGapM(fork) + siblingStackWidthM(fork)
}

function buildBandGeometry(
  segment: RoadSpaceSegment,
  y: number,
  height: number,
  stackLeftX: number,
  metersToPx: number,
): BandGeometry {
  const starts = slotStartsM(segment)
  const centrelineX = round2(stackLeftX + segment.centrelineOffsetM * metersToPx)
  const slotLeftX = starts.map((s) => round2(stackLeftX + s * metersToPx))

  const fork = segment.fork
  let placeholder: BandGeometry['placeholder']
  let siblingSlotLeftX: number[] | undefined
  let medianLeftX: number | undefined
  let medianRightX: number | undefined

  if (fork && siblingStackWidthM(fork) > 0 && fork.dimmedSide === 'left') {
    const pw = siblingStackWidthM(fork) * metersToPx
    const gap = forkGapM(fork) * metersToPx
    placeholder = { x: stackLeftX, width: round2(pw) }
    medianLeftX = round2(stackLeftX + pw)
    medianRightX = round2(stackLeftX + pw + gap)
    if (fork.siblingSlots && fork.siblingSlots.length > 0) {
      siblingSlotLeftX = []
      let sx = stackLeftX
      for (const slot of fork.siblingSlots) {
        siblingSlotLeftX.push(round2(sx))
        sx += slot.widthM * metersToPx
      }
    }
  } else if (fork && siblingStackWidthM(fork) > 0 && fork.dimmedSide === 'right') {
    const slotsWidthM = segment.slots.reduce((s, slot) => s + slot.widthM, 0)
    const pw = siblingStackWidthM(fork) * metersToPx
    const gap = forkGapM(fork) * metersToPx
    const gapLeft = round2(stackLeftX + slotsWidthM * metersToPx)
    medianLeftX = gapLeft
    medianRightX = round2(gapLeft + gap)
    placeholder = { x: medianRightX, width: round2(pw) }
    if (fork.siblingSlots && fork.siblingSlots.length > 0) {
      siblingSlotLeftX = []
      let sx = medianRightX
      for (const slot of fork.siblingSlots) {
        siblingSlotLeftX.push(round2(sx))
        sx += slot.widthM * metersToPx
      }
    }
  } else if (fork && fork.leftSlotIds.length > 0 && fork.rightSlotIds.length > 0) {
    const leftSet = new Set(fork.leftSlotIds)
    const rightSet = new Set(fork.rightSlotIds)
    let leftRightM = 0
    for (let i = 0; i < segment.slots.length; i++) {
      const slot = segment.slots[i]!
      if (leftSet.has(slot.id)) {
        leftRightM = Math.max(leftRightM, starts[i]! + slot.widthM)
      }
    }
    let rightLeftM = Infinity
    for (let i = 0; i < segment.slots.length; i++) {
      const slot = segment.slots[i]!
      if (rightSet.has(slot.id)) {
        rightLeftM = Math.min(rightLeftM, starts[i]!)
      }
    }
    if (Number.isFinite(rightLeftM)) {
      medianLeftX = round2(stackLeftX + leftRightM * metersToPx)
      medianRightX = round2(stackLeftX + rightLeftM * metersToPx)
    }
  }

  // Outer edges: full stack including sidepaths + placeholder
  const totalM = stackWidthM(segment.slots, fork)
  const leftOuterX = stackLeftX
  const rightOuterX = round2(stackLeftX + totalM * metersToPx)

  // Kerbs: carriageway boundaries (exclude sidepaths). For dual forks, kerbs bound
  // the *travel* carriageway only — placeholder is a sibling block, not the left kerb.
  let leftKerbX = leftOuterX
  let rightKerbX = rightOuterX

  const carriagewayIndices = segment.slots
    .map((slot, i) => (slot.zone === 'carriageway' ? i : -1))
    .filter((i) => i >= 0)

  if (carriagewayIndices.length > 0) {
    const firstCw = carriagewayIndices[0]!
    const lastCw = carriagewayIndices[carriagewayIndices.length - 1]!
    const cwLeft = slotLeftX[firstCw]!
    const cwRight = round2(slotLeftX[lastCw]! + segment.slots[lastCw]!.widthM * metersToPx)
    leftKerbX = cwLeft
    rightKerbX = cwRight
  } else if (placeholder) {
    leftKerbX = placeholder.x
    rightKerbX = round2(placeholder.x + placeholder.width)
  }

  if (fork?.unresolvedSibling && siblingStackWidthM(fork) === 0 && fork.dimmedSide === 'left') {
    medianLeftX = leftKerbX
    medianRightX = leftKerbX
  }

  // Spreading footprint (sibling outer) — used for outer-edge runs that must
  // not be merged across dual ↔ non-dual boundaries.
  let leftSpreadOuterX = leftOuterX
  let rightSpreadOuterX = rightOuterX
  if (placeholder && fork?.dimmedSide === 'left') {
    leftSpreadOuterX = placeholder.x
  } else if (placeholder && fork?.dimmedSide === 'right') {
    rightSpreadOuterX = round2(placeholder.x + placeholder.width)
  }

  return {
    segment,
    y,
    height,
    stackLeftX: round2(stackLeftX),
    slotLeftX,
    siblingSlotLeftX,
    centrelineX,
    leftOuterX,
    rightOuterX,
    leftKerbX,
    rightKerbX,
    leftSpreadOuterX,
    rightSpreadOuterX,
    medianLeftX,
    medianRightX,
    placeholder,
  }
}

function rectVerticalExtent(
  bandIndex: number,
  bandCount: number,
  y: number,
  height: number,
): { y: number; height: number } {
  return bandSeamExtent(bandIndex, bandCount, y, height)
}

function dedupePoints(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = []
  for (const p of points) {
    const prev = out[out.length - 1]
    if (prev && Math.abs(prev.x - p.x) < EPS && Math.abs(prev.y - p.y) < EPS) continue
    out.push(p)
  }
  return out
}

/**
 * One continuous vertical run across contiguous bands.
 * Delegates to shared morphing so kerbs match the carriageway plate.
 */
function appendContinuousVerticalRun(
  points: Array<{ x: number; y: number }>,
  bandXs: Array<{
    y: number
    height: number
    x: number
    width?: number
    synthetic?: boolean
  }>,
  side: 'left' | 'right',
): void {
  appendMorphingVerticalRun(points, bandXs, side)
}

/** Leftmost / rightmost travel-or-sidepath slot of a band (excludes placeholder/median). */
function outermostSlot(
  band: BandGeometry,
  side: 'left' | 'right',
): RoadSpaceSegment['slots'][number] | undefined {
  const slots = band.segment.slots
  if (slots.length === 0) return undefined
  return side === 'left' ? slots[0] : slots[slots.length - 1]
}

function sameForkPresence(a: BandGeometry, b: BandGeometry): boolean {
  return (a.segment.fork != null) === (b.segment.fork != null)
}

function bandOuterX(band: BandGeometry, side: 'left' | 'right'): number {
  return side === 'left' ? band.leftOuterX : band.rightOuterX
}

function bandOuterWidth(band: BandGeometry): number {
  return round2(band.rightOuterX - band.leftOuterX)
}

function transitionBandHeightPx(
  _a: BandGeometry,
  _b: BandGeometry,
  bandHeight: number,
  metersToPx: number,
  changeM: number,
): number {
  const compactPx = round2(bandHeight * TRANSITION_BAND_HEIGHT_FRAC * 0.08)
  if (changeM < TRANSITION_CHANGE_EPS_M) return compactPx
  const widthDeltaPx = changeM * metersToPx
  const minPx = 24
  const maxPx = TRANSITION_BAND_HEIGHT_FRAC * bandHeight
  return round2(Math.min(maxPx, Math.max(minPx, widthDeltaPx * 0.9)))
}

function buildSyntheticTransitionBand(
  above: BandGeometry,
  below: BandGeometry,
  y: number,
  height: number,
  centrelineX: number,
  junction = false,
): BandGeometry {
  const segment: RoadSpaceSegment = {
    wayId: 0,
    role: above.segment.role,
    synthetic: true,
    slots: [],
    centrelineOffsetM: below.segment.centrelineOffsetM,
    placement: below.segment.placement,
    laneMarkings: false,
  }
  return {
    segment,
    y: round2(y),
    height: round2(height),
    stackLeftX: below.stackLeftX,
    slotLeftX: [],
    centrelineX,
    leftOuterX: below.leftOuterX,
    rightOuterX: below.rightOuterX,
    leftKerbX: below.leftKerbX,
    rightKerbX: below.rightKerbX,
    leftSpreadOuterX: below.leftSpreadOuterX,
    rightSpreadOuterX: below.rightSpreadOuterX,
    medianLeftX: below.medianLeftX,
    medianRightX: below.medianRightX,
    placeholder: below.placeholder,
    ...(junction ? { junction: true } : {}),
  }
}

function insertTransitionBands(
  bands: BandGeometry[],
  bandHeight: number,
  correspondences: StackCorrespondence[],
  metersToPx: number,
  gap: number,
): BandGeometry[] {
  if (bands.length === 0) return bands
  const result: BandGeometry[] = []
  let y = bands[0]!.y
  let realIndex = 0
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i]!
    if (i > 0) {
      const prev = result[result.length - 1]!
      if (!prev.segment.synthetic && !band.segment.synthetic) {
        const corr = correspondences[realIndex - 1]!
        const isJunction = seamIsImpliedJunction(prev.segment, band.segment, corr)
        const tHeight = isJunction
          ? round2(bandHeight * JUNCTION_BAND_HEIGHT_FRAC)
          : transitionBandHeightPx(
              prev,
              band,
              bandHeight,
              metersToPx,
              seamChangeMagnitude(prev.segment, band.segment, corr),
            )
        result.push(
          buildSyntheticTransitionBand(prev, band, y, tHeight, band.centrelineX, isJunction),
        )
        y += tHeight + gap
      }
    }
    result.push({ ...band, y: round2(y) })
    if (!band.segment.synthetic) realIndex++
    y += band.height + gap
  }
  return result
}

/**
 * Reshape slots along a taper so coloured pavement follows the kerb/outer edge:
 * - carriageway slot against the kerb (e.g. new turn pocket) becomes a triangle/trapezoid
 * - outermost sidepath, when outside the kerb, tapers on the outer face
 * Pure placement shifts (same total width) are left as rectangles.
 */
function reshapeOuterSlotsForTapers(slotRects: SceneSlotRect[], bands: BandGeometry[]): void {
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i]!
    if (band.segment.synthetic) continue
    const prev = bands[i - 1]
    const next = bands[i + 1]
    const bandW = bandOuterWidth(band)

    for (const side of ['left', 'right'] as const) {
      const kerbX = side === 'left' ? band.leftKerbX : band.rightKerbX
      const outerX = bandOuterX(band, side)

      type EdgeSpec = {
        slot: RoadSpaceSegment['slots'][number]
        fullOuter: number
        topFrom?: number
        bottomTo?: number
      }
      const specs: EdgeSpec[] = []

      const cwIdxs = band.segment.slots
        .map((s, idx) => (s.zone === 'carriageway' ? idx : -1))
        .filter((idx) => idx >= 0)
      if (cwIdxs.length > 0) {
        const cwEdgeIdx = side === 'right' ? cwIdxs[cwIdxs.length - 1]! : cwIdxs[0]!
        const cwSlot = band.segment.slots[cwEdgeIdx]!
        let topFrom: number | undefined
        let bottomTo: number | undefined
        if (
          prev &&
          !prev.segment.synthetic &&
          !prev.junction &&
          sameForkPresence(prev, band) &&
          differs(bandOuterWidth(prev), bandW)
        ) {
          const prevKerb = side === 'left' ? prev.leftKerbX : prev.rightKerbX
          if (differs(prevKerb, kerbX)) {
            const grew = side === 'right' ? kerbX > prevKerb + EPS : kerbX < prevKerb - EPS
            if (grew) topFrom = prevKerb
          }
        }
        if (
          next &&
          !next.segment.synthetic &&
          !next.junction &&
          sameForkPresence(band, next) &&
          differs(bandW, bandOuterWidth(next))
        ) {
          const nextKerb = side === 'left' ? next.leftKerbX : next.rightKerbX
          if (differs(nextKerb, kerbX)) {
            const widerThanNext = side === 'right' ? kerbX > nextKerb + EPS : kerbX < nextKerb - EPS
            if (widerThanNext) bottomTo = nextKerb
          }
        }
        if (topFrom != null || bottomTo != null) {
          specs.push({ slot: cwSlot, fullOuter: kerbX, topFrom, bottomTo })
        }
      }

      const outerSlot = outermostSlot(band, side)
      if (outerSlot && (!specs[0] || specs[0].slot.id !== outerSlot.id)) {
        let topFrom: number | undefined
        let bottomTo: number | undefined
        if (
          prev &&
          !prev.segment.synthetic &&
          !prev.junction &&
          sameForkPresence(prev, band) &&
          differs(bandOuterWidth(prev), bandW)
        ) {
          const prevOuter = bandOuterX(prev, side)
          if (differs(prevOuter, outerX)) {
            const grew = side === 'right' ? outerX > prevOuter + EPS : outerX < prevOuter - EPS
            if (grew) topFrom = prevOuter
          }
        }
        if (
          next &&
          !next.segment.synthetic &&
          !next.junction &&
          sameForkPresence(band, next) &&
          differs(bandW, bandOuterWidth(next))
        ) {
          const nextOuter = bandOuterX(next, side)
          if (differs(nextOuter, outerX)) {
            const widerThanNext =
              side === 'right' ? outerX > nextOuter + EPS : outerX < nextOuter - EPS
            if (widerThanNext) bottomTo = nextOuter
          }
        }
        if (topFrom != null || bottomTo != null) {
          specs.push({ slot: outerSlot, fullOuter: outerX, topFrom, bottomTo })
        }
      }

      for (const spec of specs) {
        const rect = slotRects.find(
          (r) => r.slotId === spec.slot.id && r.role === band.segment.role,
        )
        if (!rect || rect.label === 'step_fill') continue

        const innerX = side === 'right' ? rect.x : rect.x + rect.width
        const fullOuterX = spec.fullOuter
        const clampOuter = (o: number) =>
          side === 'right' ? Math.max(o, innerX) : Math.min(o, innerX)

        const topY = round2(band.y)
        const botY = round2(band.y + band.height)
        const topTaperY = round2(band.y + band.height * TAPER_FRAC)
        const botTaperY = round2(band.y + band.height * (1 - TAPER_FRAC))

        const points: Array<{ x: number; y: number }> = []
        points.push({ x: round2(innerX), y: topY })
        if (spec.topFrom != null) {
          points.push({ x: round2(clampOuter(spec.topFrom)), y: topY })
          appendSCurve(
            points,
            clampOuter(spec.topFrom),
            topY,
            fullOuterX,
            topTaperY,
            TRANSITION_CURVE_SAMPLES,
          )
        } else {
          points.push({ x: round2(fullOuterX), y: topY })
        }
        if (spec.bottomTo != null) {
          points.push({ x: round2(fullOuterX), y: botTaperY })
          appendSCurve(
            points,
            fullOuterX,
            botTaperY,
            clampOuter(spec.bottomTo),
            botY,
            TRANSITION_CURVE_SAMPLES,
          )
        } else {
          points.push({ x: round2(fullOuterX), y: botY })
        }
        points.push({ x: round2(innerX), y: botY })
        rect.points = dedupePoints(points)
      }
    }
  }
}

/**
 * When a kerb grows into the arriving band, the trapezoid pocket sits *inside*
 * the diagonal; the small exterior wedge under the top edge (old sidepath /
 * shoulder) would otherwise stay white. Fill it with the departing outer slot.
 */
function appendExteriorTaperWedges(slotRects: SceneSlotRect[], bands: BandGeometry[]): void {
  for (let i = 0; i < bands.length - 1; i++) {
    const a = bands[i]!
    const b = bands[i + 1]!
    if (a.segment.synthetic || b.segment.synthetic) continue
    if (!sameForkPresence(a, b)) continue
    if (!differs(bandOuterWidth(a), bandOuterWidth(b))) continue

    for (const side of ['left', 'right'] as const) {
      const aKerb = side === 'left' ? a.leftKerbX : a.rightKerbX
      const bKerb = side === 'left' ? b.leftKerbX : b.rightKerbX
      if (!differs(aKerb, bKerb)) continue

      const bGrew = side === 'right' ? bKerb > aKerb + EPS : bKerb < aKerb - EPS
      if (bGrew) {
        const source = outermostSlot(a, side)
        if (!source) continue
        const topY = round2(b.y)
        const taperY = round2(b.y + b.height * TAPER_FRAC)
        const points: Array<{ x: number; y: number }> = [
          { x: round2(aKerb), y: topY },
          { x: round2(bKerb), y: topY },
        ]
        appendSCurve(points, bKerb, topY, bKerb, taperY, 2)
        appendSCurve(points, bKerb, taperY, aKerb, topY, TRANSITION_CURVE_SAMPLES)
        pushWedge(slotRects, b, source, side, i, points)
        continue
      }

      const aWider = side === 'right' ? aKerb > bKerb + EPS : aKerb < bKerb - EPS
      if (!aWider) continue
      const source = outermostSlot(a, side)
      if (!source) continue
      // Departing wider — exterior wedge in departing band's bottom taper zone.
      const botY = round2(a.y + a.height)
      const taperY = round2(a.y + a.height * (1 - TAPER_FRAC))
      const points: Array<{ x: number; y: number }> = []
      appendSCurve(points, aKerb, taperY, bKerb, botY, TRANSITION_CURVE_SAMPLES)
      points.push({ x: round2(aKerb), y: botY })
      pushWedge(slotRects, a, source, side, i, points)
    }
  }
}

function pushWedge(
  slotRects: SceneSlotRect[],
  band: BandGeometry,
  source: RoadSpaceSegment['slots'][number],
  side: 'left' | 'right',
  seamIndex: number,
  points: Array<{ x: number; y: number }>,
): void {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  slotRects.push({
    slotId: `way/${band.segment.wayId}/step-fill/${side}/${seamIndex}`,
    wayId: band.segment.wayId,
    role: band.segment.role,
    kind: source.kind,
    zone: source.zone,
    direction: 'none',
    x: round2(Math.min(...xs)),
    y: round2(Math.min(...ys)),
    width: round2(Math.max(...xs) - Math.min(...xs)),
    height: round2(Math.max(...ys) - Math.min(...ys)),
    widthProvenance: 'inferred',
    label: 'step_fill',
    dimmed: band.segment.role !== 'current' || undefined,
    points,
  })
}

/**
 * When a dual oneway (left dimmed / median) meets a wider non-dual neighbour,
 * forward pockets that sit over the median (e.g. left-turn) taper to the dual
 * travel hinge so the single dual lane visually splits into turn + through.
 */
function reshapeMedianPocketTapers(
  slotRects: SceneSlotRect[],
  bands: BandGeometry[],
): MedianPocketSeam[] {
  const seams: MedianPocketSeam[] = []
  for (let i = 0; i < bands.length - 1; i++) {
    const a = bands[i]!
    const b = bands[i + 1]!
    const aFork = a.segment.fork != null
    const bFork = b.segment.fork != null
    if (aFork === bFork) continue

    const dual = aFork ? a : b
    const plain = aFork ? b : a
    if (dual.segment.fork?.dimmedSide !== 'left') continue
    if (dual.medianLeftX == null || dual.medianRightX == null) continue

    const hingeX = dual.leftKerbX
    const medianLeft = dual.medianLeftX ?? hingeX
    const plainIsAbove = plain === a

    const pockets = slotRects.filter((r) => {
      if (r.role !== plain.segment.role || r.wayId !== plain.segment.wayId) return false
      if (r.zone !== 'carriageway' || r.kind === 'median') return false
      if (r.label === 'sibling' || r.label === 'step_fill') return false
      // Dual travel is oneway forward — only forward/both_ways (or tagged turn)
      // pockets grow into the median, not opposing traffic.
      if (r.direction !== 'forward' && r.direction !== 'both_ways' && r.turn == null) {
        return false
      }
      const right = r.x + r.width
      if (r.x >= hingeX - EPS) return false
      const abutsHinge = Math.abs(right - hingeX) <= 4
      const overlap = Math.min(right, hingeX) - Math.max(r.x, medianLeft)
      const overlapsMedian = overlap > Math.max(8, r.width * 0.15)
      return abutsHinge || overlapsMedian
    })
    if (pockets.length === 0) continue

    const pocketLeft = Math.min(...pockets.map((r) => r.x))
    // Always taper to the dual travel hinge (continuing carriageway face).
    const tipX = hingeX

    for (const rect of pockets) {
      const left = round2(rect.x)
      const right = round2(rect.x + rect.width)
      const topY = round2(plain.y)
      const botY = round2(plain.y + plain.height)
      if (plainIsAbove) {
        // Wide at top, tapers to hinge at bottom — trapezoid, not sharp tip.
        const taperY = round2(plain.y + plain.height * (1 - TAPER_FRAC))
        rect.points = dedupePoints([
          { x: left, y: topY },
          { x: right, y: topY },
          { x: tipX, y: taperY },
          { x: tipX, y: botY },
        ])
      } else {
        const taperY = round2(plain.y + plain.height * TAPER_FRAC)
        rect.points = dedupePoints([
          { x: tipX, y: topY },
          { x: tipX, y: taperY },
          { x: right, y: botY },
          { x: left, y: botY },
        ])
      }
    }

    // Pavement wedge into the dual median so the split reads across the gap.
    const sourceKind = pockets[0]!.kind
    const sourceZone = pockets[0]!.zone
    const dualTop = round2(dual.y)
    const dualBot = round2(dual.y + dual.height)
    const wedgePoints = plainIsAbove
      ? [
          { x: round2(pocketLeft), y: dualTop },
          { x: round2(tipX), y: dualTop },
          { x: round2(tipX), y: round2(dual.y + dual.height * TAPER_FRAC) },
          { x: round2(pocketLeft), y: round2(dual.y + dual.height * TAPER_FRAC) },
        ]
      : [
          { x: round2(pocketLeft), y: round2(dual.y + dual.height * (1 - TAPER_FRAC)) },
          { x: round2(tipX), y: round2(dual.y + dual.height * (1 - TAPER_FRAC)) },
          { x: round2(tipX), y: dualBot },
          { x: round2(pocketLeft), y: dualBot },
        ]
    slotRects.push({
      slotId: `way/${dual.segment.wayId}/median-pocket-fill/${i}`,
      wayId: dual.segment.wayId,
      role: dual.segment.role,
      kind: sourceKind,
      zone: sourceZone,
      direction: 'none',
      x: round2(Math.min(pocketLeft, tipX)),
      y: round2(Math.min(...wedgePoints.map((p) => p.y))),
      width: round2(Math.abs(tipX - pocketLeft)),
      height: round2(
        Math.max(...wedgePoints.map((p) => p.y)) - Math.min(...wedgePoints.map((p) => p.y)),
      ),
      widthProvenance: 'inferred',
      label: 'step_fill',
      dimmed: dual.segment.role !== 'current' || undefined,
      points: wedgePoints,
    })

    seams.push({
      seamIndex: i,
      plainIsAbove,
      dual,
      plain,
      pocketLeft: round2(pocketLeft),
      tipX: round2(tipX),
    })
  }
  return seams
}

type MedianPocketSeam = {
  seamIndex: number
  plainIsAbove: boolean
  dual: BandGeometry
  plain: BandGeometry
  pocketLeft: number
  tipX: number
}

function buildBandCorrespondences(
  layoutBands: BandGeometry[],
  segmentCorrespondences: StackCorrespondence[],
): StackCorrespondence[] {
  const segForBand: number[] = []
  let seg = 0
  for (const band of layoutBands) {
    if (band.segment.synthetic) segForBand.push(-1)
    else {
      segForBand.push(seg)
      seg++
    }
  }

  const out: StackCorrespondence[] = []
  for (let i = 0; i < layoutBands.length - 1; i++) {
    const segA = segForBand[i]!
    const segB = segForBand[i + 1]!
    let corrIndex = -1
    if (segA >= 0 && segB >= 0) corrIndex = segA
    else if (segA >= 0) corrIndex = segA
    else if (segB >= 0) corrIndex = segB - 1

    out.push(
      corrIndex >= 0
        ? segmentCorrespondences[corrIndex]!
        : { pairs: [], unmatchedA: [], unmatchedB: [] },
    )
  }
  return out
}

/**
 * Two neighbours that both tag an explicit `placement` say where the way line is in
 * each; when the matched lanes put those two spots apart, the line has to jump.
 */
function collectSolvedPlacementIssues(layoutBands: BandGeometry[], metersToPx: number): string[] {
  const issues: string[] = []
  const real = layoutBands.filter((b) => !b.segment.synthetic)
  for (let i = 0; i < real.length - 1; i++) {
    const a = real[i]!
    const b = real[i + 1]!
    const aTag = a.segment.placementTag
    const bTag = b.segment.placementTag
    if (!aTag || !bTag) continue
    if (a.segment.placement.kind === 'transition' || b.segment.placement.kind === 'transition') {
      continue
    }
    const deltaM = Math.abs(a.centrelineX - b.centrelineX) / metersToPx
    if (deltaM > PLACEMENT_OFFSET_WARN_M) {
      issues.push(
        `ways ${a.segment.wayId}→${b.segment.wayId}: the way line jumps ${deltaM.toFixed(2)} m between placement=${aTag} and placement=${bTag} — one of them does not fit the matched lanes`,
      )
    }
  }
  return issues
}

function slotCenterOnBand(
  band: BandGeometry,
  index: number,
  branch: 'travel' | 'sibling',
  metersToPx: number,
): { x: number; y: number } | null {
  const y = round2(band.y + band.height / 2)
  if (branch === 'sibling') {
    const leftX = band.siblingSlotLeftX?.[index]
    const slot = band.segment.fork?.siblingSlots?.[index]
    if (leftX == null || !slot) return null
    return { x: round2(leftX + (slot.widthM * metersToPx) / 2), y }
  }
  const leftX = band.slotLeftX[index]
  const slot = band.segment.slots[index]
  if (leftX == null || !slot) return null
  return { x: round2(leftX + (slot.widthM * metersToPx) / 2), y }
}

function buildSceneDebug(
  segments: RoadSpaceSegment[],
  layoutBands: BandGeometry[],
  correspondences: StackCorrespondence[],
  stackLeftM: number[],
  anchorIndex: number,
  baseCentrelineX: number,
  metersToPx: number,
): RoadSpaceSceneDebug {
  const bandIndexBySeg: number[] = []
  let segIdx = 0
  for (let bi = 0; bi < layoutBands.length; bi++) {
    if (!layoutBands[bi]!.segment.synthetic) {
      bandIndexBySeg[segIdx] = bi
      segIdx++
    }
  }

  const correspondenceLinks: SceneDebugCorrespondenceLink[] = []
  for (let si = 0; si < segments.length - 1; si++) {
    const corr = correspondences[si]
    if (!corr) continue
    const bandAbove = layoutBands[bandIndexBySeg[si]!]
    const bandBelow = layoutBands[bandIndexBySeg[si + 1]!]
    if (!bandAbove || !bandBelow) continue
    const yAbove = round2(bandAbove.y + bandAbove.height / 2)
    const yBelow = round2(bandBelow.y + bandBelow.height / 2)

    for (const pair of corr.pairs) {
      const branchA = pair.branchA ?? 'travel'
      const branchB = pair.branchB ?? 'travel'
      const slotA =
        branchA === 'sibling'
          ? segments[si]!.fork?.siblingSlots?.[pair.indexA]
          : segments[si]!.slots[pair.indexA]
      const slotB =
        branchB === 'sibling'
          ? segments[si + 1]!.fork?.siblingSlots?.[pair.indexB]
          : segments[si + 1]!.slots[pair.indexB]
      if (!slotA || !slotB) continue
      if (slotA.zone !== 'carriageway' || slotB.zone !== 'carriageway') continue
      const above = slotCenterOnBand(bandAbove, pair.indexA, branchA, metersToPx)
      const below = slotCenterOnBand(bandBelow, pair.indexB, branchB, metersToPx)
      if (!above || !below) continue
      correspondenceLinks.push({
        segmentPairIndex: si,
        indexA: pair.indexA,
        indexB: pair.indexB,
        branchA,
        branchB,
        xAbove: above.x,
        yAbove,
        xBelow: below.x,
        yBelow,
      })
    }
  }

  const bandOffsets: SceneDebugBandOffset[] = []
  segIdx = 0
  for (let bi = 0; bi < layoutBands.length; bi++) {
    const band = layoutBands[bi]!
    if (band.segment.synthetic) continue
    const segment = segments[segIdx]!
    const taggedStackLeftX = segment.placementTag
      ? round2(baseCentrelineX - segment.centrelineOffsetM * metersToPx)
      : undefined
    const placementDeltaM =
      taggedStackLeftX != null
        ? round2((band.stackLeftX - taggedStackLeftX) / metersToPx)
        : undefined
    bandOffsets.push({
      bandIndex: bi,
      wayId: segment.wayId,
      role: segment.role,
      stackLeftM: stackLeftM[segIdx] ?? 0,
      stackLeftX: round2(band.stackLeftX),
      provenance: segIdx === anchorIndex ? 'anchor' : 'chained',
      ...(taggedStackLeftX != null ? { taggedStackLeftX, placementDeltaM } : {}),
    })
    segIdx++
  }

  return { correspondenceLinks, bandOffsets }
}

function emitVerticalPolyline(
  polylines: ScenePolyline[],
  id: string,
  kind: ScenePolyline['kind'],
  style: ScenePolyline['style'],
  bandXs: Array<{ y: number; height: number; x: number; width?: number }>,
  side: 'left' | 'right' = 'right',
): void {
  if (bandXs.length === 0) return
  const points: Array<{ x: number; y: number }> = []
  appendContinuousVerticalRun(points, bandXs, side)
  const deduped = dedupePoints(points)
  if (deduped.length < 2) return
  polylines.push({ id, kind, style, points: deduped })
}

/**
 * Merge per-band x positions into contiguous runs, but never across a dual ↔
 * non-dual boundary when `breakOnForkChange` is set (avoids diagonals through
 * placeholder / median).
 */
function emitMergedVerticalRuns(
  polylines: ScenePolyline[],
  idPrefix: string,
  kind: ScenePolyline['kind'],
  style: ScenePolyline['style'],
  perBandXs: number[][],
  bands: BandGeometry[],
  options?: { breakOnForkChange?: boolean },
): void {
  const rounded = perBandXs.map((xs) => xs.map((x) => round2(x)))
  const canonicalXs: number[] = []
  for (const xs of rounded) {
    for (const x of xs) {
      const existing = canonicalXs.find((c) => Math.abs(c - x) < SEPARATOR_X_TOLERANCE_PX)
      if (!existing) canonicalXs.push(x)
    }
  }

  const hasFork = (i: number) => bands[i]!.segment.fork != null
  const isJunction = (i: number) => bands[i]!.junction === true

  let runIdx = 0
  for (const x of canonicalXs.sort((a, b) => a - b)) {
    let i = 0
    while (i < bands.length) {
      if (isJunction(i) || !rounded[i]!.some((v) => Math.abs(v - x) < SEPARATOR_X_TOLERANCE_PX)) {
        i++
        continue
      }
      const start = i
      i++
      while (
        i < bands.length &&
        !isJunction(i) &&
        rounded[i]!.some((v) => Math.abs(v - x) < SEPARATOR_X_TOLERANCE_PX)
      ) {
        if (options?.breakOnForkChange && hasFork(i) !== hasFork(i - 1)) break
        i++
      }
      const slice = bands.slice(start, i).map((b) => ({
        y: b.y,
        height: b.height,
        x: rounded[start]!.find((v) => Math.abs(v - x) < SEPARATOR_X_TOLERANCE_PX) ?? x,
      }))
      emitVerticalPolyline(polylines, `${idPrefix}-${runIdx++}`, kind, style, slice)
    }
  }
}

/**
 * Layout a prev/current/next (or any ordered) chain into a JSON scene.
 * Matched lane centres drive per-band horizontal offsets; placement centreline is derived.
 */
export function layoutRoadSpace(
  chain: RoadSpaceChain,
  options?: { metersToPx?: number; bandHeightPx?: number },
): RoadSpaceScene {
  const metersToPx = options?.metersToPx ?? DEFAULT_METERS_TO_PX
  const bandHeight = options?.bandHeightPx ?? SEGMENT_BAND_HEIGHT_PX
  const gap = SEGMENT_GAP_PX
  const segments = chain.segments

  if (segments.length === 0) {
    return {
      widthPx: PADDING_PX * 2,
      heightPx: PADDING_PX * 2,
      metersToPx,
      bands: [],
      ribbons: [],
      slotRects: [],
      polylines: [],
    }
  }

  const { stackLeftM, correspondences, anchorIndex } = solveChainOffsets(segments)
  const anchor = segments[anchorIndex]!
  const anchorStackLeftM = stackLeftM[anchorIndex] ?? 0
  const anchorCentrelineM = anchor.centrelineOffsetM
  let baseCentrelineX = round2(PADDING_PX + anchorCentrelineM * metersToPx)
  const anchorStackLeftX = round2(baseCentrelineX - anchorCentrelineM * metersToPx)

  const bands: BandGeometry[] = []
  let y = PADDING_PX
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!
    const stackLeftX = round2(
      anchorStackLeftX + ((stackLeftM[i] ?? 0) - anchorStackLeftM) * metersToPx,
    )
    bands.push(buildBandGeometry(segment, y, bandHeight, stackLeftX, metersToPx))
    y += bandHeight + gap
  }
  const layoutBands = insertTransitionBands(bands, bandHeight, correspondences, metersToPx, gap)

  // Crop asymmetric centreline overhang so the road stack sits with equal side padding.
  {
    let minX = Infinity
    let maxX = -Infinity
    for (const b of layoutBands) {
      minX = Math.min(minX, b.leftOuterX, b.leftSpreadOuterX)
      maxX = Math.max(maxX, b.rightOuterX, b.rightSpreadOuterX)
      if (b.placeholder) {
        minX = Math.min(minX, b.placeholder.x)
        maxX = Math.max(maxX, b.placeholder.x + b.placeholder.width)
      }
    }
    if (Number.isFinite(minX) && Number.isFinite(maxX)) {
      const dx = round2(PADDING_PX - minX)
      if (Math.abs(dx) > EPS) {
        baseCentrelineX = round2(baseCentrelineX + dx)
        for (const b of layoutBands) {
          b.stackLeftX = round2(b.stackLeftX + dx)
          b.slotLeftX = b.slotLeftX.map((x) => round2(x + dx))
          if (b.siblingSlotLeftX) {
            b.siblingSlotLeftX = b.siblingSlotLeftX.map((x) => round2(x + dx))
          }
          b.centrelineX = round2(b.centrelineX + dx)
          b.leftOuterX = round2(b.leftOuterX + dx)
          b.rightOuterX = round2(b.rightOuterX + dx)
          b.leftKerbX = round2(b.leftKerbX + dx)
          b.rightKerbX = round2(b.rightKerbX + dx)
          b.leftSpreadOuterX = round2(b.leftSpreadOuterX + dx)
          b.rightSpreadOuterX = round2(b.rightSpreadOuterX + dx)
          if (b.medianLeftX != null) b.medianLeftX = round2(b.medianLeftX + dx)
          if (b.medianRightX != null) b.medianRightX = round2(b.medianRightX + dx)
          if (b.placeholder) {
            b.placeholder = { x: round2(b.placeholder.x + dx), width: b.placeholder.width }
          }
        }
      }
    }
  }

  const lastLayoutBand = layoutBands[layoutBands.length - 1]!
  const heightPx = round2(lastLayoutBand.y + lastLayoutBand.height + PADDING_PX)
  const maxRightX = Math.max(
    ...layoutBands.map((b) => Math.max(b.rightOuterX, b.rightSpreadOuterX)),
  )
  const minLeftX = Math.min(...layoutBands.map((b) => Math.min(b.leftOuterX, b.leftSpreadOuterX)))
  const widthPx = round2(maxRightX - minLeftX + PADDING_PX * 2)
  const anchorBand =
    layoutBands.find(
      (b) =>
        !b.segment.synthetic && b.segment.wayId === anchor.wayId && b.segment.role === anchor.role,
    ) ?? layoutBands.find((b) => !b.segment.synthetic)!
  // Scene centreline = the selected way's own band (the guide may bend in neighbours).
  const currentBand = layoutBands.find((b) => !b.segment.synthetic && b.segment.role === 'current')
  const placementGuideX = round2((currentBand ?? anchorBand)?.centrelineX ?? baseCentrelineX)
  const bandCorrespondences = buildBandCorrespondences(layoutBands, correspondences)

  const sceneBands: SceneSegmentBand[] = layoutBands.map((b) => ({
    wayId: b.segment.wayId,
    role: b.segment.role,
    y: round2(b.y),
    height: round2(b.height),
    dimmed: b.segment.synthetic ? true : b.segment.role !== 'current',
    ...(b.segment.synthetic ? { synthetic: true } : {}),
    ...(b.junction ? { junction: true } : {}),
  }))

  const junctions: SceneJunctionBand[] = layoutBands
    .filter((b) => b.junction)
    .map((b) => ({ y: round2(b.y), height: round2(b.height) }))

  const slotRects: SceneSlotRect[] = []
  for (let bandIndex = 0; bandIndex < layoutBands.length; bandIndex++) {
    const band = layoutBands[bandIndex]!
    if (band.segment.synthetic) continue
    const extent = rectVerticalExtent(bandIndex, layoutBands.length, band.y, band.height)
    const dimmedBand = band.segment.role !== 'current'
    const fork = band.segment.fork
    const leftSet = new Set(fork?.leftSlotIds ?? [])
    const rightSet = new Set(fork?.rightSlotIds ?? [])

    // Opposite dual branch: real sibling slots when resolved.
    if (fork?.siblingSlots && band.siblingSlotLeftX) {
      for (let si = 0; si < fork.siblingSlots.length; si++) {
        const slot = fork.siblingSlots[si]!
        slotRects.push({
          slotId: slot.id,
          wayId: fork?.siblingWayId ?? band.segment.wayId,
          role: band.segment.role,
          kind: slot.kind,
          zone: slot.zone,
          direction: slot.direction,
          x: band.siblingSlotLeftX[si]!,
          y: extent.y,
          width: round2(slot.widthM * metersToPx),
          height: extent.height,
          widthProvenance: slot.widthProvenance,
          label: slot.label,
          turn: slot.turn,
          dimmed: true,
        })
      }
    }

    // Explicit median island rect (non-travel), only when a gap exists between branches.
    if (
      band.medianLeftX != null &&
      band.medianRightX != null &&
      band.medianRightX - band.medianLeftX > EPS &&
      !fork?.unresolvedSibling
    ) {
      slotRects.push({
        slotId: `way/${band.segment.wayId}/fork/median`,
        wayId: band.segment.wayId,
        role: band.segment.role,
        kind: 'median',
        zone: 'carriageway',
        direction: 'none',
        x: band.medianLeftX,
        y: extent.y,
        width: round2(band.medianRightX - band.medianLeftX),
        height: extent.height,
        widthProvenance: 'inferred',
        label: 'median',
        medianHint: fork?.medianHint ?? 'verge',
        dimmed: dimmedBand || undefined,
      })
    }

    for (let i = 0; i < band.segment.slots.length; i++) {
      const slot = band.segment.slots[i]!
      // Match ribbon dimming: only dual opposite-branch slots, not prev/next bands.
      let dimmed = false
      if (fork?.dimmedSide === 'left' && leftSet.has(slot.id)) dimmed = true
      if (fork?.dimmedSide === 'right' && rightSet.has(slot.id)) dimmed = true

      slotRects.push({
        slotId: slot.id,
        wayId: band.segment.wayId,
        role: band.segment.role,
        kind: slot.kind,
        zone: slot.zone,
        direction: slot.direction,
        x: band.slotLeftX[i]!,
        y: extent.y,
        width: round2(slot.widthM * metersToPx),
        height: extent.height,
        widthProvenance: slot.widthProvenance,
        label: slot.label,
        turn: slot.turn,
        dimmed: dimmed || undefined,
      })
    }
  }

  reshapeOuterSlotsForTapers(slotRects, layoutBands)
  appendExteriorTaperWedges(slotRects, layoutBands)
  const medianPocketSeams = reshapeMedianPocketTapers(slotRects, layoutBands)

  const extentForBand = (bandIndex: number) =>
    rectVerticalExtent(
      bandIndex,
      layoutBands.length,
      layoutBands[bandIndex]!.y,
      layoutBands[bandIndex]!.height,
    )
  const ribbons = buildCorridorRibbons(layoutBands, metersToPx, extentForBand, bandCorrespondences)
  const carriagewayPlates = buildCarriagewayPlates(layoutBands, ribbons)

  // Ribbons + morphing plate own pavement fills across transition bands.
  // Drop exterior kerb wedges (keep median-pocket fills with a different slotId prefix).
  if (ribbons.length > 0) {
    for (let i = slotRects.length - 1; i >= 0; i--) {
      const r = slotRects[i]!
      if (r.label === 'step_fill' && r.slotId.includes('/step-fill/')) slotRects.splice(i, 1)
    }
  }

  const polylines: ScenePolyline[] = []

  // Butt-end caps at the two ends of the whole chain (outer edges)
  const first = layoutBands[0]!
  const last = lastLayoutBand
  polylines.push({
    id: `butt-top-${first.segment.wayId}`,
    kind: 'kerb',
    style: 'solid',
    points: [
      { x: first.leftOuterX, y: round2(first.y) },
      { x: first.rightOuterX, y: round2(first.y) },
    ],
  })
  polylines.push({
    id: `butt-bottom-${last.segment.wayId}`,
    kind: 'kerb',
    style: 'solid',
    points: [
      { x: last.leftOuterX, y: round2(last.y + last.height) },
      { x: last.rightOuterX, y: round2(last.y + last.height) },
    ],
  })

  // Segment-boundary hairlines at the bottom of each real segment band.
  // Skipped when the following band is an implied junction (that band draws its own edges).
  {
    let realIdx = 0
    const realCount = layoutBands.filter((b) => !b.segment.synthetic).length
    for (let i = 0; i < layoutBands.length; i++) {
      const band = layoutBands[i]!
      if (band.segment.synthetic) continue
      if (realIdx >= realCount - 1) {
        realIdx++
        continue
      }
      const nextBand = layoutBands[i + 1]
      if (nextBand?.junction) {
        realIdx++
        continue
      }
      const yBound = round2(band.y + band.height)
      const left = band.leftOuterX
      const right = band.rightOuterX
      polylines.push({
        id: `segment-boundary-${realIdx}`,
        kind: 'segment_boundary',
        style: 'solid',
        points: [
          { x: left, y: yBound },
          { x: right, y: yBound },
        ],
      })
      realIdx++
    }
  }

  // Continuous travel-kerbs at carriageway boundaries. Broken at dual ↔ non-dual
  // and at implied junctions so tapers never cross a cross-street gap.
  {
    const hasFork = (i: number) => layoutBands[i]!.segment.fork != null
    const isJunction = (i: number) => layoutBands[i]!.junction === true
    let start = 0
    let runIdx = 0
    while (start < layoutBands.length) {
      if (isJunction(start)) {
        start++
        continue
      }
      let end = start + 1
      while (end < layoutBands.length && !isJunction(end) && hasFork(end) === hasFork(start)) {
        end++
      }
      const slice = layoutBands.slice(start, end)
      emitVerticalPolyline(
        polylines,
        `kerb-left-${runIdx}`,
        'kerb',
        'solid',
        slice.map((b) => ({
          y: b.y,
          height: b.height,
          x: b.leftKerbX,
          width: bandOuterWidth(b),
          synthetic: b.segment.synthetic,
        })),
        'left',
      )
      emitVerticalPolyline(
        polylines,
        `kerb-right-${runIdx}`,
        'kerb',
        'solid',
        slice.map((b) => ({
          y: b.y,
          height: b.height,
          x: b.rightKerbX,
          width: bandOuterWidth(b),
          synthetic: b.segment.synthetic,
        })),
        'right',
      )
      runIdx++
      start = end
    }
  }

  // Placeholder outer face (spreading side) — dual bands only; never merged into a
  // taper that crosses the median from a non-dual neighbour.
  {
    const leftPlaceholderXs = layoutBands.map((b) =>
      b.placeholder && b.segment.fork?.dimmedSide === 'left' ? [b.placeholder.x] : [],
    )
    const rightPlaceholderXs = layoutBands.map((b) =>
      b.placeholder && b.segment.fork?.dimmedSide === 'right'
        ? [round2(b.placeholder.x + b.placeholder.width)]
        : [],
    )
    emitMergedVerticalRuns(
      polylines,
      'kerb-placeholder-left',
      'kerb',
      'solid',
      leftPlaceholderXs,
      layoutBands,
    )
    emitMergedVerticalRuns(
      polylines,
      'kerb-placeholder-right',
      'kerb',
      'solid',
      rightPlaceholderXs,
      layoutBands,
    )
  }

  // Outer edges only where they differ from the travel kerb (sidepath present).
  // Emit like kerbs (continuous X-per-band) so width changes get diagonals — never
  // group by canonical X (that leaves disconnected stubs and 90° gaps).
  {
    const hasDistinctOuter = (b: BandGeometry, side: 'left' | 'right'): boolean => {
      if (side === 'left') {
        if (b.placeholder && b.segment.fork?.dimmedSide === 'left') {
          return differs(b.leftOuterX, b.leftSpreadOuterX) && differs(b.leftOuterX, b.leftKerbX)
        }
        return differs(b.leftOuterX, b.leftKerbX)
      }
      if (b.placeholder && b.segment.fork?.dimmedSide === 'right') {
        return differs(b.rightOuterX, b.rightSpreadOuterX) && differs(b.rightOuterX, b.rightKerbX)
      }
      return differs(b.rightOuterX, b.rightKerbX)
    }

    const emitOuterRuns = (side: 'left' | 'right', idPrefix: string) => {
      const hasFork = (i: number) => layoutBands[i]!.segment.fork != null
      const isJunction = (i: number) => layoutBands[i]!.junction === true
      let start = 0
      let runIdx = 0
      while (start < layoutBands.length) {
        if (isJunction(start)) {
          start++
          continue
        }
        let end = start + 1
        while (end < layoutBands.length && !isJunction(end) && hasFork(end) === hasFork(start)) {
          end++
        }
        const slice = layoutBands.slice(start, end)
        let subStart = 0
        while (subStart < slice.length) {
          while (subStart < slice.length && !hasDistinctOuter(slice[subStart]!, side)) {
            subStart++
          }
          if (subStart >= slice.length) break
          let subEnd = subStart + 1
          while (subEnd < slice.length && hasDistinctOuter(slice[subEnd]!, side)) {
            subEnd++
          }
          emitVerticalPolyline(
            polylines,
            `${idPrefix}-${runIdx++}`,
            'outer_edge',
            'solid',
            slice.slice(subStart, subEnd).map((b) => ({
              y: b.y,
              height: b.height,
              x: side === 'left' ? b.leftOuterX : b.rightOuterX,
              width: bandOuterWidth(b),
              synthetic: b.segment.synthetic,
            })),
            side,
          )
          subStart = subEnd
        }
        start = end
      }
    }

    emitOuterRuns('left', 'outer-edge-left')
    emitOuterRuns('right', 'outer-edge-right')
  }

  // Median faces as kerb runs (per dual band, merged when consecutive)
  const medianLeftPerBand = layoutBands.map((b) => (b.medianLeftX != null ? [b.medianLeftX] : []))
  const medianRightPerBand = layoutBands.map((b) =>
    b.medianRightX != null ? [b.medianRightX] : [],
  )
  emitMergedVerticalRuns(
    polylines,
    'kerb-median-left',
    'kerb',
    'solid',
    medianLeftPerBand,
    layoutBands,
  )
  emitMergedVerticalRuns(
    polylines,
    'kerb-median-right',
    'kerb',
    'solid',
    medianRightPerBand,
    layoutBands,
  )

  // Angled kerb where a non-dual turn pocket grows out of the dual travel hinge.
  for (const seam of medianPocketSeams) {
    const { plain, dual, plainIsAbove, pocketLeft, tipX } = seam
    if (plainIsAbove) {
      const points: Array<{ x: number; y: number }> = [{ x: pocketLeft, y: round2(plain.y) }]
      appendSCurve(
        points,
        pocketLeft,
        round2(plain.y),
        tipX,
        round2(plain.y + plain.height),
        TRANSITION_CURVE_SAMPLES,
      )
      points.push({ x: tipX, y: round2(dual.y + dual.height * TAPER_FRAC) })
      polylines.push({
        id: `kerb-median-pocket-${seam.seamIndex}`,
        kind: 'kerb',
        style: 'solid',
        points: dedupePoints(points),
      })
    } else {
      const points: Array<{ x: number; y: number }> = [
        { x: tipX, y: round2(dual.y + dual.height * (1 - TAPER_FRAC)) },
        { x: tipX, y: round2(plain.y) },
      ]
      appendSCurve(
        points,
        tipX,
        round2(plain.y),
        pocketLeft,
        round2(plain.y + plain.height),
        TRANSITION_CURVE_SAMPLES,
      )
      polylines.push({
        id: `kerb-median-pocket-${seam.seamIndex}`,
        kind: 'kerb',
        style: 'solid',
        points: dedupePoints(points),
      })
    }
  }

  // Separators: internal edges within the same zone (not kerb / outer)
  const sepPerBand: number[][] = layoutBands.map((band) => {
    if (band.segment.synthetic) return []
    const xs: number[] = []
    for (let i = 0; i < band.segment.slots.length - 1; i++) {
      const a = band.segment.slots[i]!
      const b = band.segment.slots[i + 1]!
      if (a.zone !== b.zone) continue // kerb lives here
      xs.push(round2(band.slotLeftX[i + 1]!))
    }
    return xs
  })

  // Emit separators grouped by laneMarkings style of the bands they cover
  const solidSep: number[][] = []
  const dashedSep: number[][] = []
  for (let i = 0; i < layoutBands.length; i++) {
    if (layoutBands[i]!.segment.laneMarkings) {
      solidSep.push(sepPerBand[i]!)
      dashedSep.push([])
    } else {
      solidSep.push([])
      dashedSep.push(sepPerBand[i]!)
    }
  }
  emitMergedVerticalRuns(polylines, 'sep-solid', 'separator', 'solid', solidSep, layoutBands)
  emitMergedVerticalRuns(polylines, 'sep-dashed', 'separator', 'dashed', dashedSep, layoutBands)

  // OSM placement centreline guide (lanes align left/right of this axis).
  polylines.push({
    id: 'placement-guide',
    kind: 'placement_guide',
    style: 'solid',
    points: buildPlacementGuidePoints(layoutBands),
  })
  polylines.push(...buildSiblingPlacementGuides(layoutBands, metersToPx))

  const separatelyMappedRaw = segments.flatMap((s) => s.separatelyMapped ?? [])
  const separatelyMappedSeen = new Set<string>()
  const separatelyMapped = separatelyMappedRaw.filter((h) => {
    const key = `${h.prefix}:${h.side}`
    if (separatelyMappedSeen.has(key)) return false
    separatelyMappedSeen.add(key)
    return true
  })

  const placementIssues = [
    ...collectPlacementIssues(segments),
    ...collectSolvedPlacementIssues(layoutBands, metersToPx),
  ]
  const unresolvedSibling = segments.some((s) => s.unresolvedSiblingHint)
  const debug = buildSceneDebug(
    segments,
    layoutBands,
    correspondences,
    stackLeftM,
    anchorIndex,
    baseCentrelineX,
    metersToPx,
  )

  return {
    widthPx,
    heightPx,
    metersToPx,
    centrelineX: placementGuideX,
    bands: sceneBands,
    ...(junctions.length > 0 ? { junctions } : {}),
    ribbons,
    ...(carriagewayPlates.length > 0
      ? {
          carriagewayPlate: carriagewayPlates[0],
          ...(carriagewayPlates.length > 1 ? { carriagewayPlates } : {}),
        }
      : {}),
    slotRects,
    polylines,
    ...(separatelyMapped.length > 0 ? { separatelyMapped } : {}),
    ...(unresolvedSibling ? { unresolvedSibling: true } : {}),
    ...(placementIssues.length > 0 ? { placementIssues } : {}),
    debug,
  }
}
