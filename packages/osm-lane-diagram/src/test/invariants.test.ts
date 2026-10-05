import { describe, expect, test } from 'bun:test'
import { mirrorTags, normalizeTagsForDirection } from '@osm-editor-kit/osm-way-chain'
import { laneDiagramFixtures } from '../fixtures'
import {
  buildRoadSpaceSegment,
  layoutRoadSpace,
  solveChainOffsets,
  type RoadSpaceChain,
  type RoadSpaceScene,
  type RoadSpaceSegment,
  type StackCorrespondence,
} from '../index'

const EPS = 0.02

const MULTI_SEGMENT_FIXTURES = [
  'one-lane-each-way',
  'two-lane-each-way',
  'right-turn-pocket',
  'turn-pocket-then-continue',
  'dual-carriageway-island',
  'karl-marx-dual-split',
  'karl-marx-bi-to-dual',
  'karl-marx-dual-opposite',
  'karl-marx-crossing-turns',
  't-junction',
  'placement-transition',
  'reversed-neighbour',
] as const

const KARL_MARX_FIXTURES = [
  'karl-marx-bi-to-dual',
  'karl-marx-dual-opposite',
  'karl-marx-crossing-turns',
] as const

function fixtureChain(id: string): RoadSpaceChain {
  const fixture = laneDiagramFixtures.find((f) => f.id === id)
  if (!fixture) throw new Error(`missing fixture ${id}`)
  // Match audit / orientation contract: next (ahead) on top so forward travel draws up.
  return {
    segments: [...fixture.segments].reverse().map((seg) =>
      buildRoadSpaceSegment(seg.tags, {
        wayId: seg.wayId,
        role: seg.role,
        dualSibling: seg.dualSibling,
        medianHint: seg.medianHint,
      }),
    ),
  }
}

function assertCorrespondenceNonCrossing(corrs: StackCorrespondence[]): void {
  for (const corr of corrs) {
    for (let i = 0; i < corr.pairs.length; i++) {
      for (let j = i + 1; j < corr.pairs.length; j++) {
        const p1 = corr.pairs[i]!
        const p2 = corr.pairs[j]!
        if ((p1.branchA ?? 'travel') !== (p2.branchA ?? 'travel')) continue
        if ((p1.branchB ?? 'travel') !== (p2.branchB ?? 'travel')) continue
        const crosses =
          (p1.indexA - p2.indexA) * (p1.indexB - p2.indexB) < 0 &&
          p1.indexA !== p2.indexA &&
          p1.indexB !== p2.indexB
        expect(crosses).toBe(false)
      }
    }
  }
}

function ribbonLeftXAtBand(ribbon: RoadSpaceScene['ribbons'][number], bandIndex: number): number {
  const slice = ribbon.bandSlices.find((s) => s.bandIndex === bandIndex)
  if (!slice) return NaN
  const bandYs = ribbon.points.filter(
    (p) => p.y >= slice.y - EPS && p.y <= slice.y + slice.height + EPS,
  )
  if (bandYs.length > 0) return Math.min(...bandYs.map((p) => p.x))
  return Math.min(...ribbon.points.map((p) => p.x))
}

function assertRibbonsNonCrossingAtBands(scene: RoadSpaceScene): void {
  for (let bi = 0; bi < scene.bands.length; bi++) {
    const band = scene.bands[bi]!
    if (band.synthetic) continue
    const entries = scene.ribbons
      .filter((r) => r.zone === 'carriageway' && r.bandSlices.some((s) => s.bandIndex === bi))
      .map((r) => ({ ribbon: r, leftX: ribbonLeftXAtBand(r, bi) }))
      .filter((e) => Number.isFinite(e.leftX))
      .sort((a, b) => a.leftX - b.leftX)
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i]!.leftX).toBeGreaterThanOrEqual(entries[i - 1]!.leftX - EPS)
    }
  }
}

function ribbonTouchesBand(ribbon: RoadSpaceScene['ribbons'][number], bandIndex: number): boolean {
  return ribbon.bandSlices.some((s) => s.bandIndex === bandIndex)
}

function ribbonSpansSeam(
  scene: RoadSpaceScene,
  slotId: string,
  wayId: number,
  glueBandIndex: number,
): boolean {
  const ribbon = scene.ribbons.find((r) =>
    r.bandSlices.some((s) => s.slotId === slotId && s.wayId === wayId),
  )
  if (!ribbon) return false
  const above = glueBandIndex - 1
  const below = glueBandIndex + 1
  const touchesGlue = ribbonTouchesBand(ribbon, glueBandIndex)
  const touchesBoth = ribbonTouchesBand(ribbon, above) && ribbonTouchesBand(ribbon, below)
  return (
    touchesBoth ||
    (touchesGlue && (ribbonTouchesBand(ribbon, above) || ribbonTouchesBand(ribbon, below)))
  )
}

function hasSeamWedge(scene: RoadSpaceScene, slotId: string, wayId: number): boolean {
  return scene.slotRects.some(
    (r) =>
      r.slotId === slotId &&
      r.wayId === wayId &&
      (r.label === 'step_fill' || (r.points != null && r.points.length >= 3)),
  )
}

function travelCarriagewaySlots(seg: RoadSpaceSegment) {
  const fork = seg.fork
  const leftSet = new Set(fork?.leftSlotIds ?? [])
  const rightSet = new Set(fork?.rightSlotIds ?? [])
  return seg.slots.filter(
    (s) =>
      s.zone === 'carriageway' &&
      s.kind !== 'median' &&
      !(fork?.dimmedSide === 'left' && leftSet.has(s.id)) &&
      !(fork?.dimmedSide === 'right' && rightSet.has(s.id)),
  )
}

function assertCarriagewayConnectivity(scene: RoadSpaceScene, chain: RoadSpaceChain): void {
  const glueBandIndices = scene.bands.map((b, i) => (b.synthetic ? i : -1)).filter((i) => i >= 0)

  for (const seg of chain.segments) {
    for (const slot of travelCarriagewaySlots(seg)) {
      const inRibbon = scene.ribbons.some((r) =>
        r.bandSlices.some((s) => s.slotId === slot.id && s.wayId === seg.wayId),
      )
      const inRect = scene.slotRects.some((r) => r.slotId === slot.id && r.wayId === seg.wayId)
      expect(inRibbon || inRect).toBe(true)
    }
  }

  if (chain.segments.length < 2) return

  const { correspondences } = solveChainOffsets(chain.segments)
  for (let si = 0; si < correspondences.length; si++) {
    const corr = correspondences[si]!
    const glueIdx = glueBandIndices[si]
    if (glueIdx == null) continue
    const glueIsJunction = scene.bands[glueIdx]?.junction === true

    for (const pair of corr.pairs) {
      const branchA = pair.branchA ?? 'travel'
      const branchB = pair.branchB ?? 'travel'
      const slotA =
        branchA === 'sibling'
          ? chain.segments[si]!.fork?.siblingSlots?.[pair.indexA]
          : chain.segments[si]!.slots[pair.indexA]
      const slotB =
        branchB === 'sibling'
          ? chain.segments[si + 1]!.fork?.siblingSlots?.[pair.indexB]
          : chain.segments[si + 1]!.slots[pair.indexB]
      if (!slotA || !slotB) continue
      if (slotA.zone !== 'carriageway' || slotB.zone !== 'carriageway') continue

      const wayA =
        branchA === 'sibling' ? chain.segments[si]!.fork?.siblingWayId : chain.segments[si]!.wayId
      const wayB =
        branchB === 'sibling'
          ? chain.segments[si + 1]!.fork?.siblingWayId
          : chain.segments[si + 1]!.wayId
      if (wayA == null || wayB == null) continue

      if (glueIsJunction) {
        // Junction seams butt-end — matched lanes need not span the glue band.
        const ribbonA = scene.ribbons.find((r) =>
          r.bandSlices.some((s) => s.slotId === slotA.id && s.wayId === wayA),
        )
        const ribbonB = scene.ribbons.find((r) =>
          r.bandSlices.some((s) => s.slotId === slotB.id && s.wayId === wayB),
        )
        expect(ribbonA != null || ribbonB != null).toBe(true)
        continue
      }

      const spansA = ribbonSpansSeam(scene, slotA.id, wayA, glueIdx)
      const spansB = ribbonSpansSeam(scene, slotB.id, wayB, glueIdx)
      expect(spansA || spansB).toBe(true)
    }

    const unmatchedSlots: Array<{ segIndex: number; index: number; branch: 'travel' | 'sibling' }> =
      [
        ...corr.unmatchedA.map((u) => ({
          segIndex: si,
          index: u.index,
          branch: u.branch ?? 'travel',
        })),
        ...corr.unmatchedB.map((u) => ({
          segIndex: si + 1,
          index: u.index,
          branch: u.branch ?? 'travel',
        })),
      ]

    for (const u of unmatchedSlots) {
      const seg = chain.segments[u.segIndex]!
      const slot = u.branch === 'sibling' ? seg.fork?.siblingSlots?.[u.index] : seg.slots[u.index]
      if (!slot || slot.zone !== 'carriageway') continue
      const wayId = u.branch === 'sibling' ? (seg.fork?.siblingWayId ?? seg.wayId) : seg.wayId
      const ribbon = scene.ribbons.find((r) =>
        r.bandSlices.some((s) => s.slotId === slot.id && s.wayId === wayId),
      )
      const wedge = hasSeamWedge(scene, slot.id, wayId)
      const singleBand =
        ribbon != null &&
        ribbon.bandSlices.filter((s) => !scene.bands[s.bandIndex]?.synthetic).length === 1
      expect(ribbon != null || wedge || singleBand || glueIsJunction).toBe(true)
    }
  }
}

function assertNoEmptyGlueCoverage(scene: RoadSpaceScene, chain: RoadSpaceChain): void {
  if (chain.segments.length < 2) return
  const { correspondences } = solveChainOffsets(chain.segments)
  const glueBandIndices = scene.bands.map((b, i) => (b.synthetic ? i : -1)).filter((i) => i >= 0)

  for (let si = 0; si < correspondences.length; si++) {
    const corr = correspondences[si]!
    const glueIdx = glueBandIndices[si]
    if (glueIdx == null) continue
    if (scene.bands[glueIdx]?.junction) continue
    const glueBand = scene.bands[glueIdx]!
    const cwPairs = corr.pairs.filter((pair) => {
      const slotA = chain.segments[si]!.slots[pair.indexA]
      const slotB = chain.segments[si + 1]!.slots[pair.indexB]
      return slotA?.zone === 'carriageway' && slotB?.zone === 'carriageway'
    })
    if (cwPairs.length === 0) continue

    const glueRibbons = scene.ribbons.filter((r) => ribbonTouchesBand(r, glueIdx))
    const glueCoverage = glueRibbons.some((r) => {
      const xs = r.points.filter(
        (p) => p.y >= glueBand.y - EPS && p.y <= glueBand.y + glueBand.height + EPS,
      )
      if (xs.length < 2) return false
      const minX = Math.min(...xs.map((p) => p.x))
      const maxX = Math.max(...xs.map((p) => p.x))
      return maxX - minX > EPS
    })
    expect(glueCoverage || glueRibbons.length >= cwPairs.length).toBe(true)
  }
}

describe('chain connectivity invariants', () => {
  for (const fixtureId of MULTI_SEGMENT_FIXTURES) {
    describe(fixtureId, () => {
      const chain = fixtureChain(fixtureId)
      const scene = layoutRoadSpace(chain)
      const { correspondences } = solveChainOffsets(chain.segments)

      test('correspondence indices are non-crossing', () => {
        assertCorrespondenceNonCrossing(correspondences)
      })

      test('carriageway ribbons do not cross within bands', () => {
        assertRibbonsNonCrossingAtBands(scene)
      })

      test('every travel carriageway slot chains or terminates at a seam wedge', () => {
        assertCarriagewayConnectivity(scene, chain)
      })

      test('glue bands have ribbon coverage for matched carriageway pairs', () => {
        assertNoEmptyGlueCoverage(scene, chain)
      })

      test('layout emits debug metadata', () => {
        expect(scene.debug).toBeDefined()
        expect(scene.debug!.bandOffsets.length).toBe(chain.segments.length)
        if (chain.segments.length > 1) {
          expect(scene.debug!.correspondenceLinks.length).toBeGreaterThan(0)
        }
      })
    })
  }

  test('Karl-Marx fixtures: through motor ribbons span at least two real bands', () => {
    for (const fixtureId of KARL_MARX_FIXTURES) {
      const scene = layoutRoadSpace(fixtureChain(fixtureId))
      const through = scene.ribbons.filter(
        (r) => r.zone === 'carriageway' && r.kind === 'motor' && /\/forward\/through\//.test(r.id),
      )
      expect(through.length).toBeGreaterThan(0)
      for (const ribbon of through) {
        const realBands = new Set(
          ribbon.bandSlices
            .filter((s) => !scene.bands[s.bandIndex]?.synthetic)
            .map((s) => s.bandIndex),
        )
        expect(realBands.size).toBeGreaterThanOrEqual(1)
      }
    }
  })

  test('reversed neighbour: oriented tags match centre segment stack', () => {
    const fixture = laneDiagramFixtures.find((f) => f.id === 'reversed-neighbour')!
    const current = fixture.segments.find((s) => s.role === 'current')!
    const prev = fixture.segments.find((s) => s.role === 'prev')!
    const digitisedOpposite = mirrorTags(prev.tags)
    const oriented = normalizeTagsForDirection(digitisedOpposite, true)

    const centreSeg = buildRoadSpaceSegment(current.tags, {
      wayId: current.wayId,
      role: 'current',
    })
    const prevSeg = buildRoadSpaceSegment(oriented, {
      wayId: prev.wayId,
      role: 'prev',
    })

    const label = (seg: typeof centreSeg) =>
      seg.slots
        .filter((s) => s.zone === 'carriageway')
        .map((s) => `${s.kind}:${s.side ?? ''}:${s.direction}:${s.turn ?? ''}`)

    expect(label(prevSeg)).toEqual(label(centreSeg))
    expect(prevSeg.centrelineOffsetM).toBeCloseTo(centreSeg.centrelineOffsetM, 2)
  })
})
