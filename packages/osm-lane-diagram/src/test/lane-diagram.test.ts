import { describe, expect, test } from 'bun:test'
import { mirrorTags, normalizeTagsForDirection } from '@osm-editor-kit/osm-way-chain'
import { DEFAULT_MEDIAN_GAP_M, DEFAULT_METERS_TO_PX, SEGMENT_BAND_HEIGHT_PX } from '../defaults'
import { laneDiagramFixtures } from '../fixtures'
import {
  buildRoadSpaceSegment,
  centrelineOffsetM,
  createsOnWaySidepathSlot,
  DEFAULT_WIDTHS_M,
  formatEdgeSlotId,
  formatLaneSlotId,
  JUNCTION_BAND_HEIGHT_FRAC,
  layoutRoadSpace,
  matchSegmentStacks,
  matchStacks,
  parsePlacement,
  parseSlotId,
  resolvePlacement,
  sceneToSvg,
  seamIsImpliedJunction,
  slotCenterM,
  solveChainOffsets,
  type RoadSpaceChain,
  type RoadSpaceSlot,
} from '../index'

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

function motorSlot(id: string, widthM = 3): RoadSpaceSlot {
  return {
    id,
    kind: 'motor',
    zone: 'carriageway',
    direction: 'forward',
    widthM,
    widthProvenance: 'default',
  }
}

describe('placement', () => {
  test('SRK defaults: odd → middle_of:ceil(n/2), even → left_of:(n/2+1)', () => {
    expect(resolvePlacement({}, 3)).toEqual({ kind: 'middle_of', lane: 2 })
    expect(resolvePlacement({}, 4)).toEqual({ kind: 'left_of', lane: 3 })
    expect(resolvePlacement({}, 1)).toEqual({ kind: 'middle_of', lane: 1 })
    expect(resolvePlacement({}, 2)).toEqual({ kind: 'left_of', lane: 2 })
  })

  test('parses left_of / right_of / middle_of / transition', () => {
    expect(parsePlacement('left_of:2')).toEqual({ kind: 'left_of', lane: 2 })
    expect(parsePlacement('right_of:1')).toEqual({ kind: 'right_of', lane: 1 })
    expect(parsePlacement('middle_of:3')).toEqual({ kind: 'middle_of', lane: 3 })
    expect(parsePlacement('transition')).toEqual({ kind: 'transition' })
    expect(parsePlacement('nope')).toBeNull()
  })

  test('transition falls back to default anchor via resolvePlacement', () => {
    expect(resolvePlacement({ placement: 'transition' }, 4)).toEqual({
      kind: 'left_of',
      lane: 3,
    })
  })

  test('lanes:forward/backward default to opposing-traffic boundary', () => {
    expect(resolvePlacement({ 'lanes:backward': '1', 'lanes:forward': '2' }, 3)).toEqual({
      kind: 'left_of',
      lane: 2,
    })
    expect(resolvePlacement({ 'lanes:backward': '2', 'lanes:forward': '2' }, 4)).toEqual({
      kind: 'left_of',
      lane: 3,
    })
  })

  test('centrelineOffsetM maths', () => {
    const slots: RoadSpaceSlot[] = [motorSlot('a'), motorSlot('b'), motorSlot('c'), motorSlot('d')]
    expect(centrelineOffsetM(slots, { kind: 'left_of', lane: 3 })).toBe(6)
    expect(centrelineOffsetM(slots, { kind: 'right_of', lane: 1 })).toBe(3)
    expect(centrelineOffsetM(slots, { kind: 'middle_of', lane: 2 })).toBe(4.5)
    expect(centrelineOffsetM(slots, { kind: 'transition' })).toBe(6)
  })
})

describe('from-tags', () => {
  test('cycle lane expansion counts; bus in lanes=*, cycle not', () => {
    const withBus = buildRoadSpaceSegment(
      {
        highway: 'residential',
        oneway: 'yes',
        lanes: '3',
        'bus:lanes': '||designated',
      },
      { wayId: 1, role: 'current' },
    )
    const motorOrBus = withBus.slots.filter((s) => s.kind === 'motor' || s.kind === 'bus')
    expect(motorOrBus).toHaveLength(3)
    expect(withBus.slots.some((s) => s.kind === 'bus')).toBe(true)

    const withCycle = buildRoadSpaceSegment(
      {
        highway: 'residential',
        oneway: 'yes',
        lanes: '1',
        'cycleway:right': 'lane',
      },
      { wayId: 2, role: 'current' },
    )
    expect(withCycle.slots.filter((s) => s.kind === 'motor')).toHaveLength(1)
    expect(withCycle.slots.filter((s) => s.kind === 'cycle')).toHaveLength(1)
    expect(withCycle.slots.find((s) => s.kind === 'cycle')?.zone).toBe('carriageway')
  })

  test('two-way cycleway:both=lane — left backward, right forward', () => {
    const seg = buildRoadSpaceSegment(
      {
        highway: 'residential',
        lanes: '2',
        'cycleway:both': 'lane',
      },
      { wayId: 20, role: 'current' },
    )
    const cycles = seg.slots.filter((s) => s.kind === 'cycle' && s.zone === 'carriageway')
    expect(cycles).toHaveLength(2)
    expect(cycles[0]?.side).toBe('left')
    expect(cycles[0]?.direction).toBe('backward')
    expect(cycles[1]?.side).toBe('right')
    expect(cycles[1]?.direction).toBe('forward')
  })

  test('oneway cycleway:right=lane — forward on right side', () => {
    const seg = buildRoadSpaceSegment(
      {
        highway: 'residential',
        oneway: 'yes',
        lanes: '1',
        'cycleway:right': 'lane',
      },
      { wayId: 21, role: 'current' },
    )
    const cycle = seg.slots.find((s) => s.kind === 'cycle' && s.zone === 'carriageway')
    expect(cycle?.side).toBe('right')
    expect(cycle?.direction).toBe('forward')
  })

  test('oneway contraflow left — backward on left side', () => {
    const seg = buildRoadSpaceSegment(
      {
        highway: 'residential',
        oneway: 'yes',
        'oneway:bicycle': 'no',
        lanes: '1',
        'cycleway:left': 'lane',
      },
      { wayId: 22, role: 'current' },
    )
    const cycle = seg.slots.find((s) => s.kind === 'cycle' && s.zone === 'carriageway')
    expect(cycle?.side).toBe('left')
    expect(cycle?.direction).toBe('backward')
  })

  test('oneway=-1 remirror: cycleway:left=lane matches forward cycleway:right=lane', () => {
    const forward = buildRoadSpaceSegment(
      {
        highway: 'secondary',
        oneway: 'yes',
        lanes: '1',
        'cycleway:right': 'lane',
      },
      { wayId: 24, role: 'current' },
    )
    const reversed = buildRoadSpaceSegment(
      {
        highway: 'secondary',
        oneway: '-1',
        lanes: '1',
        'cycleway:left': 'lane',
      },
      { wayId: 25, role: 'prev' },
    )
    const cwLabel = (seg: ReturnType<typeof buildRoadSpaceSegment>) =>
      seg.slots
        .filter((s) => s.zone === 'carriageway')
        .map((s) => `${s.kind}:${s.side ?? ''}:${s.direction}`)
    expect(cwLabel(reversed)).toEqual(cwLabel(forward))
    expect(cwLabel(forward)).toEqual(['motor::forward', 'cycle:right:forward'])
  })

  test('way/213887879 single-orient via normalizeTagsForDirection matches raw centre LTR', () => {
    const raw213887879 = {
      highway: 'secondary',
      oneway: 'yes',
      lanes: '1',
      dual_carriageway: 'yes',
      'cycleway:left': 'no',
      'cycleway:right': 'lane',
      'cycleway:right:oneway': 'yes',
      'cycleway:right:width': '1.4',
      width: '5.5',
      'width:lanes': '3.5',
    }
    const oriented = buildRoadSpaceSegment(
      mirrorTags(normalizeTagsForDirection(raw213887879, true)),
      { wayId: 213887879, role: 'current' },
    )
    const raw = buildRoadSpaceSegment(raw213887879, { wayId: 213887879, role: 'current' })
    const cwLabel = (seg: ReturnType<typeof buildRoadSpaceSegment>) =>
      seg.slots
        .filter((s) => s.zone === 'carriageway')
        .map((s) => `${s.kind}:${s.side ?? ''}:${s.direction}`)
    expect(cwLabel(oriented)).toEqual(cwLabel(raw))
    expect(cwLabel(raw)).toEqual(['motor::forward', 'cycle:right:forward'])
  })

  test('oneway cycleway:both:oneway=yes — with traffic per side (not both OSM-forward)', () => {
    const seg = buildRoadSpaceSegment(
      {
        highway: 'secondary',
        lanes: '2',
        'cycleway:both': 'lane',
        'cycleway:both:oneway': 'yes',
      },
      { wayId: 23, role: 'current' },
    )
    const cycles = seg.slots.filter((s) => s.kind === 'cycle' && s.zone === 'carriageway')
    expect(cycles).toHaveLength(2)
    expect(cycles[0]?.side).toBe('left')
    expect(cycles[0]?.direction).toBe('backward')
    expect(cycles[1]?.side).toBe('right')
    expect(cycles[1]?.direction).toBe('forward')
  })

  test('cycleway:right:oneway=-1 is OSM-backward (contraflow)', () => {
    const seg = buildRoadSpaceSegment(
      {
        highway: 'secondary',
        lanes: '2',
        'cycleway:right': 'lane',
        'cycleway:right:oneway': '-1',
      },
      { wayId: 24, role: 'current' },
    )
    const cycle = seg.slots.find((s) => s.kind === 'cycle' && s.zone === 'carriageway')
    expect(cycle?.side).toBe('right')
    expect(cycle?.direction).toBe('backward')
  })

  test('mirror(tags) then double-mirror restores segment stack', () => {
    const tags = {
      highway: 'residential',
      lanes: '2',
      'lanes:forward': '1',
      'lanes:backward': '1',
      'cycleway:right': 'lane',
    }
    const original = buildRoadSpaceSegment(tags, { wayId: 1, role: 'current' })
    const once = buildRoadSpaceSegment(mirrorTags(tags), { wayId: 2, role: 'current' })
    const twice = buildRoadSpaceSegment(mirrorTags(mirrorTags(tags)), { wayId: 3, role: 'current' })
    expect(once.slots.map((s) => `${s.kind}:${s.direction}:${s.side ?? ''}`)).not.toEqual(
      original.slots.map((s) => `${s.kind}:${s.direction}:${s.side ?? ''}`),
    )
    expect(twice.slots.map((s) => `${s.kind}:${s.direction}:${s.side ?? ''}`)).toEqual(
      original.slots.map((s) => `${s.kind}:${s.direction}:${s.side ?? ''}`),
    )
  })

  test('double mirror restores tag-equivalent segment', () => {
    const tags = {
      highway: 'residential',
      lanes: '2',
      sidewalk: 'both',
      'cycleway:right': 'lane',
    }
    const forward = buildRoadSpaceSegment(tags, { wayId: 2, role: 'current' })
    const restored = buildRoadSpaceSegment(mirrorTags(mirrorTags(tags)), {
      wayId: 1,
      role: 'prev',
    })
    expect(restored.slots.map((s) => `${s.kind}:${s.direction}:${s.side ?? ''}`)).toEqual(
      forward.slots.map((s) => `${s.kind}:${s.direction}:${s.side ?? ''}`),
    )
  })

  test('no sidewalk invented when untagged', () => {
    const seg = buildRoadSpaceSegment(
      { highway: 'residential', lanes: '2' },
      { wayId: 14, role: 'current' },
    )
    expect(seg.slots.every((s) => s.kind !== 'sidewalk' && s.kind !== 'shared_path')).toBe(true)
  })

  test('sidewalks are sidepath zone; motors are carriageway', () => {
    const seg = buildRoadSpaceSegment(
      { highway: 'residential', lanes: '2', sidewalk: 'both' },
      { wayId: 15, role: 'current' },
    )
    expect(seg.slots.filter((s) => s.kind === 'sidewalk').every((s) => s.zone === 'sidepath')).toBe(
      true,
    )
    expect(seg.slots.filter((s) => s.kind === 'motor').every((s) => s.zone === 'carriageway')).toBe(
      true,
    )
  })

  test('edge cycle track is sidepath; on-carriageway lane is carriageway', () => {
    const track = buildRoadSpaceSegment(
      {
        highway: 'residential',
        lanes: '2',
        'cycleway:right': 'track',
      },
      { wayId: 16, role: 'current' },
    )
    expect(track.slots.find((s) => s.kind === 'cycle')?.zone).toBe('sidepath')

    const lane = buildRoadSpaceSegment(
      {
        highway: 'residential',
        oneway: 'yes',
        lanes: '1',
        'cycleway:right': 'lane',
      },
      { wayId: 17, role: 'current' },
    )
    expect(lane.slots.find((s) => s.kind === 'cycle')?.zone).toBe('carriageway')
  })

  test('segregated shared_path handling', () => {
    const yes = buildRoadSpaceSegment(
      {
        highway: 'residential',
        lanes: '2',
        sidewalk: 'right',
        'cycleway:right': 'track',
        segregated: 'yes',
      },
      { wayId: 11, role: 'current' },
    )
    const sharedYes = yes.slots.filter((s) => s.kind === 'shared_path')
    expect(sharedYes).toHaveLength(1)
    expect(sharedYes[0]?.segregated).toBe(true)
    expect(sharedYes[0]?.zone).toBe('sidepath')

    const no = buildRoadSpaceSegment(
      {
        highway: 'residential',
        lanes: '2',
        sidewalk: 'right',
        'cycleway:right': 'track',
        segregated: 'no',
      },
      { wayId: 12, role: 'current' },
    )
    const sharedNo = no.slots.filter((s) => s.kind === 'shared_path')
    expect(sharedNo).toHaveLength(1)
    expect(sharedNo[0]?.segregated).toBe(false)
  })

  test('width provenance tagged vs default vs inferred from width=*', () => {
    const tagged = buildRoadSpaceSegment(
      {
        highway: 'residential',
        oneway: 'yes',
        lanes: '2',
        'width:lanes': '3.2|2.8',
      },
      { wayId: 3, role: 'current' },
    )
    expect(tagged.slots.every((s) => s.widthProvenance === 'tagged')).toBe(true)

    const def = buildRoadSpaceSegment(
      { highway: 'residential', oneway: 'yes', lanes: '2' },
      { wayId: 4, role: 'current' },
    )
    expect(def.slots.every((s) => s.widthProvenance === 'default')).toBe(true)
    expect(def.slots[0]?.widthM).toBe(DEFAULT_WIDTHS_M.motor)

    const inferred = buildRoadSpaceSegment(
      { highway: 'residential', oneway: 'yes', lanes: '2', width: '6.4' },
      { wayId: 5, role: 'current' },
    )
    const motors = inferred.slots.filter((s) => s.zone === 'carriageway')
    expect(motors).toHaveLength(2)
    expect(motors.every((s) => s.widthProvenance === 'inferred')).toBe(true)
    expect(motors[0]?.widthM).toBe(3.2)
    expect(motors[1]?.widthM).toBe(3.2)
  })

  test('createsOnWaySidepathSlot rejects absent / separately-mapped values', () => {
    expect(createsOnWaySidepathSlot('no')).toBe(false)
    expect(createsOnWaySidepathSlot('none')).toBe(false)
    expect(createsOnWaySidepathSlot('separate')).toBe(false)
    expect(createsOnWaySidepathSlot('use_sidepath')).toBe(false)
    expect(createsOnWaySidepathSlot('yes')).toBe(true)
    expect(createsOnWaySidepathSlot('both')).toBe(true)
    expect(createsOnWaySidepathSlot('track')).toBe(true)
    expect(createsOnWaySidepathSlot('lane')).toBe(true)
    expect(createsOnWaySidepathSlot('shared_lane')).toBe(true)
  })

  test('no / none / separate produce no sidepath slots; separate fills separatelyMapped', () => {
    const no = buildRoadSpaceSegment(
      { highway: 'residential', lanes: '2', sidewalk: 'no' },
      { wayId: 20, role: 'current' },
    )
    expect(no.slots.filter((s) => s.zone === 'sidepath')).toHaveLength(0)
    expect(no.separatelyMapped).toBeUndefined()

    const none = buildRoadSpaceSegment(
      {
        highway: 'residential',
        lanes: '2',
        'sidewalk:left': 'none',
        'sidewalk:right': 'none',
      },
      { wayId: 21, role: 'current' },
    )
    expect(none.slots.filter((s) => s.zone === 'sidepath')).toHaveLength(0)
    expect(none.separatelyMapped).toBeUndefined()

    const separate = buildRoadSpaceSegment(
      {
        highway: 'residential',
        lanes: '2',
        'sidewalk:left': 'no',
        'sidewalk:right': 'separate',
        'cycleway:left': 'no',
        'cycleway:right': 'separate',
      },
      { wayId: 22, role: 'current' },
    )
    expect(separate.slots.filter((s) => s.zone === 'sidepath')).toHaveLength(0)
    expect(separate.slots).toHaveLength(2) // motors only
    expect(separate.separatelyMapped).toEqual([
      { prefix: 'sidewalk', side: 'right' },
      { prefix: 'cycleway', side: 'right' },
    ])
    const scene = layoutRoadSpace({ segments: [separate] })
    expect(scene.separatelyMapped).toEqual(separate.separatelyMapped)

    const yes = buildRoadSpaceSegment(
      { highway: 'residential', lanes: '2', sidewalk: 'both', 'cycleway:right': 'track' },
      { wayId: 23, role: 'current' },
    )
    expect(yes.slots.filter((s) => s.kind === 'sidewalk')).toHaveLength(2)
    expect(yes.slots.filter((s) => s.kind === 'cycle' && s.zone === 'sidepath')).toHaveLength(1)
    expect(yes.separatelyMapped).toBeUndefined()
  })

  test('fixture sidewalk-no-and-separate: no edge slots, separatelyMapped hint', () => {
    const chain = fixtureChain('sidewalk-no-and-separate')
    const seg = chain.segments[0]!
    expect(seg.slots.every((s) => s.zone === 'carriageway')).toBe(true)
    expect(seg.separatelyMapped).toEqual([{ prefix: 'sidewalk', side: 'right' }])
  })

  test('fixture mid-road-cycle-lane: pipe order, 7.5 m carriageway, cycle between motors', () => {
    const chain = fixtureChain('mid-road-cycle-lane')
    const seg = chain.segments[0]!
    const cw = seg.slots.filter((s) => s.zone === 'carriageway')
    expect(cw.map((s) => `${s.kind}:${s.widthM}`)).toEqual(['motor:3', 'cycle:1.5', 'motor:3'])
    expect(cw.reduce((sum, s) => sum + s.widthM, 0)).toBe(7.5)
    expect(cw[1]?.kind).toBe('cycle')
    expect(cw[0]?.kind).toBe('motor')
    expect(cw[2]?.kind).toBe('motor')
    // Explicit placement=middle_of:2 indexes the full pipe stack → mid of cycle strip.
    expect(seg.placement).toEqual({ kind: 'middle_of', lane: 2 })
    expect(seg.placementTag).toBe('middle_of:2')
    const leftSidewalkW = seg.slots[0]!.kind === 'sidewalk' ? seg.slots[0]!.widthM : 0
    expect(seg.centrelineOffsetM).toBe(leftSidewalkW + 3 + 1.5 / 2)

    const scene = layoutRoadSpace(chain)
    expect(scene.centrelineX).toBeDefined()
    const cycleRibbon = scene.ribbons.find(
      (r) => r.zone === 'carriageway' && r.kind === 'cycle' && !r.dimmed,
    )
    expect(cycleRibbon).toBeDefined()
    // Purple guide must sit on the mid-road cycle strip (glyphCx is ribbon center).
    expect(Math.abs(cycleRibbon!.glyphCx - scene.centrelineX!)).toBeLessThan(0.5)
  })

  test('placement step with same middle_of:2 but different pipe kinds is flagged', () => {
    const chain: RoadSpaceChain = {
      segments: [
        buildRoadSpaceSegment(
          {
            highway: 'secondary',
            oneway: 'yes',
            lanes: '2',
            'cycleway:lanes': 'none|lane|none',
            'width:lanes': '3|1.5|3',
            placement: 'middle_of:2',
          },
          { wayId: 1, role: 'prev' },
        ),
        buildRoadSpaceSegment(
          {
            highway: 'secondary',
            oneway: 'yes',
            lanes: '2',
            placement: 'middle_of:2',
          },
          { wayId: 2, role: 'current' },
        ),
      ],
    }
    const scene = layoutRoadSpace(chain)
    expect(scene.placementIssues?.some((m) => m.includes('different slot kinds'))).toBe(true)
  })

  test('sided cycleway:right=lane stays at carriageway edge', () => {
    const seg = buildRoadSpaceSegment(
      {
        highway: 'residential',
        oneway: 'yes',
        lanes: '1',
        'cycleway:right': 'lane',
        'cycleway:right:width': '1.5',
      },
      { wayId: 30, role: 'current' },
    )
    const cw = seg.slots.filter((s) => s.zone === 'carriageway')
    expect(cw.map((s) => s.kind)).toEqual(['motor', 'cycle'])
  })
})

describe('slot-ids', () => {
  test('format + parseSlotId round-trip', () => {
    const laneId = formatLaneSlotId(42, 'forward', 1)
    expect(laneId).toBe('way/42/lane/forward/1')
    expect(parseSlotId(laneId)).toEqual({
      kind: 'lane',
      wayId: 42,
      direction: 'forward',
      index: 1,
    })

    const edgeId = formatEdgeSlotId({
      osmType: 'way',
      osmId: 7,
      prefix: 'sidewalk',
      side: 'left',
    })
    expect(edgeId).toBe('way/7/sidewalk/left')
    expect(parseSlotId(edgeId)).toEqual({
      kind: 'edge',
      ref: { osmType: 'way', osmId: 7, prefix: 'sidewalk', side: 'left' },
    })
    expect(parseSlotId('garbage')).toBeNull()
  })

  test('ids unique across a segment', () => {
    const seg = buildRoadSpaceSegment(
      {
        highway: 'residential',
        lanes: '2',
        sidewalk: 'both',
        'cycleway:right': 'lane',
      },
      { wayId: 99, role: 'current' },
    )
    const ids = seg.slots.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('correspondence', () => {
  test('matchStacks: identical stacks align 1:1 without crossing', () => {
    const slots: RoadSpaceSlot[] = [motorSlot('a'), motorSlot('b'), motorSlot('c')]
    const corr = matchStacks(slots, slots)
    expect(corr.pairs).toHaveLength(3)
    expect(corr.pairs.map((p) => [p.indexA, p.indexB])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ])
    expect(corr.unmatchedA).toHaveLength(0)
    expect(corr.unmatchedB).toHaveLength(0)
  })

  test('matchStacks: pocket appear/disappear leaves gaps', () => {
    const narrow: RoadSpaceSlot[] = [motorSlot('a'), motorSlot('b')]
    const wide: RoadSpaceSlot[] = [
      motorSlot('a'),
      { ...motorSlot('pocket'), turn: 'right' },
      motorSlot('b'),
    ]
    const corr = matchStacks(narrow, wide)
    expect(corr.pairs.some((p) => p.indexA === 0 && p.indexB === 0)).toBe(true)
    expect(corr.pairs.some((p) => p.indexA === 1 && p.indexB === 2)).toBe(true)
    expect(corr.unmatchedB.some((u) => u.index === 1)).toBe(true)
  })

  test('matchSegmentStacks: bidirectional ↔ dual maps forward to travel and backward to sibling', () => {
    const bi = buildRoadSpaceSegment(
      {
        highway: 'secondary',
        lanes: '2',
        'cycleway:both': 'lane',
        'cycleway:both:oneway': 'yes',
        'width:lanes:backward': '3.3',
        'width:lanes:forward': '3.3',
      },
      { wayId: 1, role: 'prev' },
    )
    const dual = buildRoadSpaceSegment(
      {
        highway: 'secondary',
        oneway: 'yes',
        dual_carriageway: 'yes',
        lanes: '1',
        'cycleway:right': 'lane',
        'cycleway:right:oneway': 'yes',
        'width:lanes': '3.5',
      },
      {
        wayId: 2,
        role: 'next',
        dualSibling: {
          wayId: 9,
          tags: {
            highway: 'secondary',
            oneway: 'yes',
            dual_carriageway: 'yes',
            lanes: '1',
            'cycleway:right': 'lane',
            'width:lanes': '3.5',
          },
        },
      },
    )
    const corr = matchSegmentStacks(
      { slots: bi.slots },
      { slots: dual.slots, siblingSlots: dual.fork?.siblingSlots },
    )
    const backOnBi = bi.slots.findIndex((s) => s.direction === 'backward')
    const fwdOnBi = bi.slots.findIndex((s) => s.direction === 'forward' && s.kind === 'motor')
    expect(backOnBi).toBeGreaterThanOrEqual(0)
    expect(fwdOnBi).toBeGreaterThanOrEqual(0)
    expect(
      corr.pairs.some((p) => p.indexA === fwdOnBi && p.branchB !== 'sibling' && p.indexB >= 0),
    ).toBe(true)
    expect(corr.pairs.some((p) => p.indexA === backOnBi && p.branchB === 'sibling')).toBe(true)
    // Monotonic on A: matched indices never cross within the LTR stack
    for (let i = 1; i < corr.pairs.length; i++) {
      expect(corr.pairs[i]!.indexA).toBeGreaterThanOrEqual(corr.pairs[i - 1]!.indexA)
    }
  })

  test('solveChainOffsets: matched centres align across different total widths', () => {
    const narrow = buildRoadSpaceSegment(
      { highway: 'primary', oneway: 'yes', lanes: '2', sidewalk: 'both' },
      { wayId: 1, role: 'prev' },
    )
    const wide = buildRoadSpaceSegment(
      {
        highway: 'primary',
        oneway: 'yes',
        lanes: '3',
        sidewalk: 'both',
        'turn:lanes:forward': 'left|through|right',
      },
      { wayId: 2, role: 'current' },
    )
    const { stackLeftM, correspondences } = solveChainOffsets([narrow, wide])
    expect(correspondences).toHaveLength(1)
    const corr = correspondences[0]!
    expect(corr.pairs.length).toBeGreaterThan(0)
    for (const pair of corr.pairs) {
      const slotA =
        (pair.branchA ?? 'travel') === 'sibling'
          ? narrow.fork?.siblingSlots?.[pair.indexA]
          : narrow.slots[pair.indexA]
      const slotB =
        (pair.branchB ?? 'travel') === 'sibling'
          ? wide.fork?.siblingSlots?.[pair.indexB]
          : wide.slots[pair.indexB]
      if (!slotA || !slotB || slotA.zone !== 'carriageway' || slotB.zone !== 'carriageway') {
        continue
      }
      const centerA = slotCenterM(narrow, pair.indexA, pair.branchA ?? 'travel')
      const centerB = slotCenterM(wide, pair.indexB, pair.branchB ?? 'travel')
      const aligned = stackLeftM[0]! + centerA - (stackLeftM[1]! + centerB)
      expect(Math.abs(aligned)).toBeLessThan(0.05)
    }
  })
})

describe('layout continuity', () => {
  test('kerbs at carriageway bounds; carriageway clear width sum; continuous equal bands', () => {
    const chain = fixtureChain('one-lane-each-way')
    const scene = layoutRoadSpace(chain)
    expect(scene.bands).toHaveLength(5)
    expect(scene.bands.filter((b) => b.synthetic)).toHaveLength(2)

    const leftKerb = scene.polylines.find((p) => p.id.startsWith('kerb-left'))!
    const rightKerb = scene.polylines.find((p) => p.id.startsWith('kerb-right'))!
    expect(leftKerb).toBeDefined()
    expect(rightKerb).toBeDefined()

    // Continuous run at one X; glue bands add y-only breakpoints
    for (const p of leftKerb.points) {
      expect(Math.abs(p.x - leftKerb.points[0]!.x)).toBeLessThanOrEqual(0.01)
    }
    for (const p of rightKerb.points) {
      expect(Math.abs(p.x - rightKerb.points[0]!.x)).toBeLessThanOrEqual(0.01)
    }
    expect(leftKerb.points.length).toBeGreaterThanOrEqual(2)
    expect(rightKerb.points.length).toBeGreaterThanOrEqual(2)

    // Outer edges exist when sidewalks present and differ from kerbs
    const outerLeft = scene.polylines.filter(
      (p) => p.kind === 'outer_edge' && p.id.includes('left'),
    )
    const outerRight = scene.polylines.filter(
      (p) => p.kind === 'outer_edge' && p.id.includes('right'),
    )
    expect(outerLeft.length).toBeGreaterThanOrEqual(1)
    expect(outerRight.length).toBeGreaterThanOrEqual(1)
    expect(Math.abs(outerLeft[0]!.points[0]!.x - leftKerb.points[0]!.x)).toBeGreaterThan(0.01)

    // Carriageway clear-width sum equals kerb-to-kerb
    for (const seg of chain.segments) {
      const cwSum = seg.slots
        .filter((s) => s.zone === 'carriageway')
        .reduce((s, slot) => s + slot.widthM, 0)
      expect(cwSum).toBeGreaterThan(0)
      expect(seg.slots.every((s) => s.widthM > 0)).toBe(true)

      const kerbToKerbM = (rightKerb.points[0]!.x - leftKerb.points[0]!.x) / scene.metersToPx
      expect(Math.abs(kerbToKerbM - cwSum)).toBeLessThan(0.05)

      const rects = scene.slotRects.filter(
        (r) =>
          r.wayId === seg.wayId && r.zone === 'carriageway' && !r.slotId.includes('placeholder'),
      )
      const rectSum = rects.reduce((s, r) => s + r.width / scene.metersToPx, 0)
      expect(Math.abs(rectSum - cwSum)).toBeLessThan(0.05)
    }

    // Segment boundaries present between real bands; glue bands sit between segments
    const boundaries = scene.polylines.filter((p) => p.kind === 'segment_boundary')
    expect(boundaries).toHaveLength(2)
    expect(boundaries.every((b) => b.style === 'solid')).toBe(true)
    expect(scene.bands.filter((b) => b.synthetic).length).toBeGreaterThanOrEqual(2)

    // Contiguous bands (zero gap)
    for (let i = 0; i < scene.bands.length - 1; i++) {
      const a = scene.bands[i]!
      const b = scene.bands[i + 1]!
      expect(Math.abs(a.y + a.height - b.y)).toBeLessThanOrEqual(0.01)
    }
  })

  test('disappearing / pocket motors on prev stay motor-gray (not neighbor-dimmed)', () => {
    const placement = layoutRoadSpace(fixtureChain('placement-transition'))
    const prevMotors = placement.ribbons.filter(
      (r) =>
        r.zone === 'carriageway' &&
        r.kind === 'motor' &&
        r.bandSlices.some((s) => s.role === 'prev'),
    )
    expect(prevMotors.length).toBeGreaterThan(0)
    expect(prevMotors.every((r) => !r.dimmed)).toBe(true)

    const pocket = layoutRoadSpace(fixtureChain('turn-pocket-then-continue'))
    const turnRibbons = pocket.ribbons.filter((r) => r.turn === 'left' || r.turn === 'right')
    expect(turnRibbons.length).toBe(2)
    expect(turnRibbons.every((r) => !r.dimmed)).toBe(true)
    // Glyphs sit on the real pocket band (prev at bottom after audit orientation).
    for (const r of turnRibbons) {
      expect(r.glyphBandRole).toBe('prev')
      expect(r.glyphCy).toBeGreaterThan(200)
    }
  })

  test('fixture 3: right-side pocket tapers right; left edge stays straight', () => {
    const scene = layoutRoadSpace(fixtureChain('right-turn-pocket'))
    const left = scene.polylines.find((p) => p.id.startsWith('kerb-left'))!
    const right = scene.polylines.find((p) => p.id.startsWith('kerb-right') && p.points.length > 2)!

    const leftXs = [...new Set(left.points.map((p) => p.x))]
    expect(leftXs).toHaveLength(1)

    const rightXs = [...new Set(right.points.map((p) => p.x))]
    expect(rightXs.length).toBeGreaterThan(1)
    expect(Math.max(...rightXs)).toBeGreaterThan(Math.min(...rightXs))

    // Diagonal taper: at least one segment changes both x and y
    let hasDiagonal = false
    for (let i = 1; i < right.points.length; i++) {
      const a = right.points[i - 1]!
      const b = right.points[i]!
      const dx = Math.abs(a.x - b.x) > 0.01
      const dy = Math.abs(a.y - b.y) > 0.01
      if (dx && dy) hasDiagonal = true
    }
    expect(hasDiagonal).toBe(true)
  })

  test('fixture 4: implied junction where left+right pockets end; through columns stay aligned', () => {
    const scene = layoutRoadSpace(fixtureChain('turn-pocket-then-continue'))
    expect(scene.junctions).toHaveLength(1)
    expect(scene.junctions![0]!.height).toBeCloseTo(
      SEGMENT_BAND_HEIGHT_PX * JUNCTION_BAND_HEIGHT_FRAC,
      1,
    )

    // Kerbs break at the junction — square ends, no continuous pinch across the seam.
    const leftKerbs = scene.polylines.filter((p) => p.id.startsWith('kerb-left'))
    const rightKerbs = scene.polylines.filter((p) => p.id.startsWith('kerb-right'))
    expect(leftKerbs.length).toBeGreaterThanOrEqual(2)
    expect(rightKerbs.length).toBeGreaterThanOrEqual(2)

    const throughRibbons = scene.ribbons.filter(
      (r) => r.zone === 'carriageway' && r.kind === 'motor' && /\/forward\/through\//.test(r.id),
    )
    expect(throughRibbons.length).toBeGreaterThanOrEqual(2)
  })

  test('dual carriageway: opposite branch forms continuous ribbons across dual bands', () => {
    const scene = layoutRoadSpace(fixtureChain('dual-carriageway-island'))
    const oppositeRibbons = scene.ribbons.filter(
      (r) => r.dimmed && r.bandSlices.some((s) => s.wayId === 512 || s.wayId === 513),
    )
    expect(oppositeRibbons.length).toBeGreaterThan(0)
    const spanning = oppositeRibbons.find((r) => r.bandSlices.length >= 2)
    expect(spanning).toBeDefined()
    expect(spanning!.points.length).toBeGreaterThanOrEqual(4)
  })

  test('dual carriageway: secondary violet guide over sibling carriageway only', () => {
    const scene = layoutRoadSpace(fixtureChain('dual-carriageway-island'))
    const main = scene.polylines.find((p) => p.kind === 'placement_guide')
    const sibling = scene.polylines.find((p) => p.kind === 'sibling_placement_guide')
    expect(main).toBeDefined()
    expect(sibling).toBeDefined()
    expect(sibling!.forward).toBe('down')

    const dualBands = scene.bands.filter(
      (b) => !b.synthetic && (b.role === 'current' || b.role === 'next'),
    )
    const plainBands = scene.bands.filter((b) => !b.synthetic && b.role === 'prev')
    expect(dualBands.length).toBe(2)
    expect(plainBands.length).toBe(1)

    const guideY0 = Math.min(...sibling!.points.map((p) => p.y))
    const guideY1 = Math.max(...sibling!.points.map((p) => p.y))
    const dualTop = Math.min(...dualBands.map((b) => b.y))
    const dualBot = Math.max(...dualBands.map((b) => b.y + b.height))
    // Guide spans the dual block (including intervening glue), not the plain approach.
    expect(guideY0).toBeLessThanOrEqual(dualTop + 0.5)
    expect(guideY1).toBeGreaterThanOrEqual(dualBot - 0.5)
    for (const plain of plainBands) {
      expect(guideY1).toBeLessThanOrEqual(plain.y + 0.5)
    }

    // Sibling guide sits left of the main (selected) centreline.
    const siblingX = sibling!.points.reduce((s, p) => s + p.x, 0) / sibling!.points.length
    expect(siblingX).toBeLessThan(main!.points[0]!.x - 10)

    // Over sibling carriageway extent (opposite motor rects).
    const oppMotors = scene.slotRects.filter(
      (r) =>
        (r.wayId === 512 || r.wayId === 513) &&
        r.kind === 'motor' &&
        r.zone === 'carriageway' &&
        r.label !== 'step_fill',
    )
    expect(oppMotors.length).toBeGreaterThan(0)
    const oppLeft = Math.min(...oppMotors.map((r) => r.x))
    const oppRight = Math.max(...oppMotors.map((r) => r.x + r.width))
    expect(siblingX).toBeGreaterThan(oppLeft)
    expect(siblingX).toBeLessThan(oppRight)

    // Single-carriageway fixtures must not emit a sibling guide.
    const plain = layoutRoadSpace(fixtureChain('one-lane-each-way'))
    expect(plain.polylines.some((p) => p.kind === 'sibling_placement_guide')).toBe(false)
  })

  test('turn-aware matching: left/right pockets do not chain to through lanes', () => {
    const scene = layoutRoadSpace(fixtureChain('turn-pocket-then-continue'))
    const throughRibbons = scene.ribbons.filter(
      (r) => r.zone === 'carriageway' && r.kind === 'motor' && /\/forward\/through\//.test(r.id),
    )
    // Junction splits through corridors into separate ribbons above/below the seam.
    expect(throughRibbons.length).toBeGreaterThanOrEqual(2)
    const leftRibbon = scene.ribbons.find((r) => /\/forward\/left\//.test(r.id))
    const rightRibbon = scene.ribbons.find((r) => /\/forward\/right\//.test(r.id))
    if (leftRibbon) {
      expect(leftRibbon.bandSlices.every((s) => !/through/.test(s.slotId))).toBe(true)
      expect(leftRibbon.bandSlices.length).toBeLessThanOrEqual(2)
    }
    if (rightRibbon) {
      expect(rightRibbon.bandSlices.every((s) => !/through/.test(s.slotId))).toBe(true)
      expect(rightRibbon.bandSlices.length).toBeLessThanOrEqual(2)
    }
  })

  test('corridor ribbons span contiguous bands with aligned edges', () => {
    const scene = layoutRoadSpace(fixtureChain('one-lane-each-way'))
    expect(scene.ribbons.length).toBeGreaterThan(0)
    const forward = scene.ribbons.find((r) => r.direction === 'forward' && r.kind === 'motor')
    expect(forward).toBeDefined()
    expect(forward!.bandSlices.length).toBe(5)
    const xs = forward!.points.map((p) => p.x)
    expect(Math.min(...xs)).toBeCloseTo(116, 0)
    expect(Math.max(...xs)).toBeCloseTo(176, 0)
    expect(scene.carriagewayPlate).toBeDefined()
  })

  test('width-step produces tapered ribbons at outer kerb seams', () => {
    const scene = layoutRoadSpace(fixtureChain('right-turn-pocket'))
    const taperedRibbon = scene.ribbons.find(
      (r) =>
        r.slotId.includes('forward/2') || r.bandSlices.some((s) => s.slotId.includes('forward/2')),
    )
    const taperedRect = scene.slotRects.filter(
      (r) => r.points != null && r.points.length >= 4 && r.label !== 'step_fill',
    )
    const rightKerb = scene.polylines.find(
      (p) => p.id.startsWith('kerb-right') && p.points.length > 2,
    )
    expect(taperedRibbon != null || taperedRect.length > 0 || rightKerb != null).toBe(true)
    const wedges = scene.slotRects.filter((r) => r.label === 'step_fill')
    // Ribbons may replace exterior wedge fills; wedges optional when ribbons cover taper.
    if (wedges.length > 0) {
      expect(wedges.every((w) => (w.points?.length ?? 0) >= 3)).toBe(true)
    }
  })

  test('pure lateral shift (same outer width) uses square kerb steps, not shear diagonals', () => {
    // Same lane stack, different placement → outers translate without changing total width.
    const chain: RoadSpaceChain = {
      segments: [
        buildRoadSpaceSegment(
          {
            highway: 'primary',
            oneway: 'yes',
            lanes: '2',
            sidewalk: 'both',
            placement: 'left_of:1',
          },
          { wayId: 1, role: 'prev' },
        ),
        buildRoadSpaceSegment(
          {
            highway: 'primary',
            oneway: 'yes',
            lanes: '2',
            sidewalk: 'both',
            placement: 'left_of:2',
          },
          { wayId: 2, role: 'current' },
        ),
      ],
    }
    expect(chain.segments[0]!.centrelineOffsetM).not.toBe(chain.segments[1]!.centrelineOffsetM)
    const scene = layoutRoadSpace(chain)
    const left = scene.polylines.find((p) => p.id.startsWith('kerb-left'))!
    const right = scene.polylines.find((p) => p.id.startsWith('kerb-right'))!
    for (const line of [left, right]) {
      for (let i = 1; i < line.points.length; i++) {
        const a = line.points[i - 1]!
        const b = line.points[i]!
        const dx = Math.abs(a.x - b.x) > 0.01
        const dy = Math.abs(a.y - b.y) > 0.01
        expect(dx && dy).toBe(false)
      }
    }
  })

  test('dual over bidirectional: through lanes align via correspondence', () => {
    const bi = {
      highway: 'secondary',
      lanes: '2',
      'cycleway:both': 'lane',
      'cycleway:both:width': '1.8',
      'cycleway:both:oneway': 'yes',
      'sidewalk:both': 'separate',
      'parking:both': 'no',
      width: '13',
      'width:lanes:backward': '3.3',
      'width:lanes:forward': '3.3',
    }
    const dualTags = {
      highway: 'secondary',
      oneway: 'yes',
      dual_carriageway: 'yes',
      lanes: '1',
      'cycleway:left': 'no',
      'cycleway:right': 'lane',
      'cycleway:right:width': '1.4',
      'cycleway:right:oneway': 'yes',
      'sidewalk:right': 'separate',
      'parking:both': 'no',
      width: '5.5',
      'width:lanes': '3.5',
    }
    const scene = layoutRoadSpace({
      segments: [
        buildRoadSpaceSegment(dualTags, {
          wayId: 1,
          role: 'prev',
          dualSibling: { wayId: 9, tags: dualTags },
          medianHint: 'crossing',
        }),
        buildRoadSpaceSegment(bi, { wayId: 2, role: 'current' }),
      ],
    })
    const through = scene.ribbons.filter(
      (r) => r.zone === 'carriageway' && r.kind === 'motor' && /\/forward\/through\//.test(r.id),
    )
    expect(through.some((r) => r.bandSlices.length >= 2)).toBe(true)
    expect(scene.slotRects.some((r) => r.role === 'prev' && r.wayId === 9)).toBe(true)

    const median = scene.slotRects.find((r) => r.role === 'prev' && r.kind === 'median')
    expect(median == null || median.width < 80).toBe(true)
  })

  test('karl-marx-bi-to-dual: glue between bi and dual rows; through lanes align', () => {
    const chain = fixtureChain('karl-marx-bi-to-dual')
    const scene = layoutRoadSpace(chain)
    const syntheticBands = scene.bands.filter((b) => b.synthetic)
    expect(syntheticBands.length).toBeGreaterThanOrEqual(2)

    const throughRibbons = scene.ribbons.filter(
      (r) =>
        r.zone === 'carriageway' &&
        r.kind === 'motor' &&
        /\/forward\/through\//.test(r.id) &&
        r.bandSlices.length >= 2,
    )
    expect(throughRibbons.length).toBeGreaterThanOrEqual(1)
    for (const ribbon of throughRibbons) {
      expect(ribbon.bandSlices.length).toBeGreaterThanOrEqual(2)
    }
  })

  test('karl-marx dual split: forward cycle lanes share a right edge; real opposite branch', () => {
    const chain = fixtureChain('karl-marx-dual-split')
    const dual = chain.segments.find((s) => s.role === 'next')!
    expect(dual.fork?.siblingWayId).toBe(213887879)
    expect(dual.fork?.siblingSlots?.length).toBeGreaterThan(0)
    expect(dual.fork?.unresolvedSibling).toBeUndefined()
    expect(dual.fork?.medianHint).toBe('crossing')

    const scene = layoutRoadSpace(chain)
    // Opposing bi lanes must not smear across the dual travel kerb.
    for (const r of scene.ribbons.filter(
      (x) => !x.dimmed && x.direction === 'backward' && x.zone === 'carriageway',
    )) {
      const span = Math.max(...r.points.map((p) => p.x)) - Math.min(...r.points.map((p) => p.x))
      expect(span).toBeLessThan(80)
    }
    const leftTurnRibbon = scene.ribbons.find((r) => r.turn === 'left')
    expect(leftTurnRibbon).toBeDefined()

    const forwardCycles = scene.slotRects.filter(
      (r) => r.kind === 'cycle' && r.direction === 'forward' && r.label !== 'step_fill',
    )
    expect(forwardCycles.length).toBeGreaterThanOrEqual(3)
    const dualForwardCycles = forwardCycles.filter((r) => r.wayId === 964589555)
    expect(dualForwardCycles.length).toBeGreaterThanOrEqual(1)
    const dualRights = dualForwardCycles.map((r) => Math.round((r.x + r.width) * 100) / 100)
    expect(Math.max(...dualRights) - Math.min(...dualRights)).toBeLessThanOrEqual(0.05)

    const biSegs = chain.segments.filter((s) => s.wayId === 37184618 || s.wayId === 1002238497)
    for (const seg of biSegs) {
      const cycles = seg.slots.filter((s) => s.kind === 'cycle' && s.zone === 'carriageway')
      expect(cycles.find((c) => c.side === 'left')?.direction).toBe('backward')
      expect(cycles.find((c) => c.side === 'right')?.direction).toBe('forward')
    }

    expect(scene.slotRects.find((r) => r.label === 'sibling')).toBeUndefined()
    const opposite = scene.slotRects.filter((r) => r.wayId === 213887879)
    expect(opposite.length).toBeGreaterThan(0)
    expect(opposite.every((r) => r.dimmed)).toBe(true)
    const median = scene.slotRects.find((r) => r.label === 'median')
    expect(median).toBeDefined()
    expect(median!.kind).toBe('median')
    expect(median!.medianHint).toBe('crossing')

    const leftTurn = scene.slotRects.find(
      (r) => r.role === 'current' && r.turn === 'left' && r.label !== 'step_fill',
    )
    expect(leftTurn).toBeDefined()
    // Median-pocket kerb may be folded into ribbon tapers when correspondence drives layout.
    expect(
      scene.polylines.some((p) => p.id.startsWith('kerb-median-pocket-')) ||
        leftTurnRibbon!.points.length >= 4,
    ).toBe(true)
  })

  test('fixture 5: dual median gap + real opposite branch inside scene', () => {
    const chain = fixtureChain('dual-carriageway-island')
    const dual = chain.segments.find((s) => s.role === 'current')!
    expect(dual.fork).toBeDefined()
    expect(dual.fork!.gapM).toBe(DEFAULT_MEDIAN_GAP_M)
    expect(dual.fork!.dimmedSide).toBe('left')
    expect(dual.fork!.unresolvedSibling).toBeUndefined()
    expect(dual.fork!.siblingSlots?.length).toBeGreaterThan(0)
    expect(dual.fork!.siblingWayId).toBe(512)

    const scene = layoutRoadSpace(chain)
    expect(
      scene.slotRects.find((r) => r.wayId === dual.wayId && r.slotId.endsWith('/fork/placeholder')),
    ).toBeUndefined()

    const opposite = scene.slotRects.filter((r) => r.wayId === 512)
    expect(opposite.length).toBeGreaterThan(0)
    expect(opposite.every((r) => r.dimmed)).toBe(true)

    const median = scene.slotRects.find(
      (r) => r.wayId === dual.wayId && r.kind === 'median' && r.role === 'current',
    )
    expect(median).toBeDefined()
    expect(median!.zone).toBe('carriageway')
    expect(median!.direction).toBe('none')
    expect(Math.abs(median!.width - DEFAULT_MEDIAN_GAP_M * scene.metersToPx)).toBeLessThanOrEqual(
      0.01,
    )

    const realCw = scene.slotRects.filter(
      (r) =>
        r.wayId === dual.wayId &&
        r.zone === 'carriageway' &&
        r.kind !== 'median' &&
        !r.slotId.includes('placeholder') &&
        r.role === 'current',
    )
    expect(realCw.length).toBeGreaterThanOrEqual(1)
    const cwLeft = Math.min(...realCw.map((r) => r.x))
    expect(Math.abs(cwLeft - (median!.x + median!.width))).toBeLessThanOrEqual(0.01)
    const oppRight = Math.max(...opposite.map((r) => r.x + r.width))
    const gapPx = cwLeft - oppRight
    expect(Math.abs(gapPx - DEFAULT_MEDIAN_GAP_M * scene.metersToPx)).toBeLessThanOrEqual(0.01)

    // No fork_edge polylines
    expect(scene.polylines.every((p) => p.kind !== ('fork_edge' as never))).toBe(true)
  })

  test('unresolved dual oneway: median edge kerb only, no placeholder sibling', () => {
    const segment = buildRoadSpaceSegment(
      {
        highway: 'primary',
        oneway: 'yes',
        lanes: '2',
        dual_carriageway: 'yes',
        sidewalk: 'right',
        name: 'Ringstraße',
      },
      { wayId: 502, role: 'current' },
    )
    expect(segment.unresolvedSiblingHint).toBe(true)
    expect(segment.fork?.unresolvedSibling).toBe(true)
    expect(segment.fork?.siblingSlots).toBeUndefined()

    const scene = layoutRoadSpace({ segments: [segment] })
    expect(scene.unresolvedSibling).toBe(true)
    expect(scene.slotRects.find((r) => r.label === 'sibling')).toBeUndefined()
    expect(scene.slotRects.find((r) => r.kind === 'median')).toBeUndefined()
    expect(scene.polylines.some((p) => p.id.startsWith('kerb-median'))).toBe(true)
  })

  test('dual chain: real opposite + median on dual bands; no polyline crosses median', () => {
    const chain = fixtureChain('dual-carriageway-island')
    // Audit order: next (dual), current (dual), prev (non-dual)
    expect(chain.segments.map((s) => s.fork != null)).toEqual([true, true, false])
    expect(chain.segments.map((s) => s.fork?.siblingWayId)).toEqual([513, 512, undefined])

    const scene = layoutRoadSpace(chain)
    const placeholders = scene.slotRects.filter((r) => r.slotId.endsWith('/fork/placeholder'))
    const medians = scene.slotRects.filter((r) => r.kind === 'median')
    expect(placeholders).toHaveLength(0)
    expect(medians).toHaveLength(2)
    expect(
      scene.slotRects.filter((r) => r.wayId === 512 || r.wayId === 513).length,
    ).toBeGreaterThan(0)
    expect(scene.slotRects.some((r) => r.role === 'prev' && r.slotId.includes('fork'))).toBe(false)

    for (const median of medians) {
      const mLeft = median.x
      const mRight = median.x + median.width
      const mTop = median.y
      const mBot = median.y + median.height
      for (const line of scene.polylines) {
        if (line.kind === 'segment_boundary') continue
        if (line.id.startsWith('kerb-median-pocket-')) continue
        for (let i = 0; i < line.points.length - 1; i++) {
          const a = line.points[i]!
          const b = line.points[i + 1]!
          const dy = Math.abs(a.y - b.y)
          const dx = Math.abs(a.x - b.x)
          // Only care about diagonals / horizontals that cut through the island
          // interior — vertical median faces are expected.
          if (dx <= 0.01) continue
          const midY = (a.y + b.y) / 2
          if (midY <= mTop + 0.01 || midY >= mBot - 0.01) continue
          const crosses =
            (a.x < mLeft - 0.01 && b.x > mRight + 0.01) ||
            (b.x < mLeft - 0.01 && a.x > mRight + 0.01) ||
            (midY > mTop + 0.01 &&
              midY < mBot - 0.01 &&
              ((a.x > mLeft + 0.01 && a.x < mRight - 0.01) ||
                (b.x > mLeft + 0.01 && b.x < mRight - 0.01)))
          expect({ id: line.id, a, b, crosses, dy }).toEqual(
            expect.objectContaining({ crosses: false }),
          )
        }
      }
    }
  })

  test('natural scene size fits a ~360px column at DEFAULT_METERS_TO_PX', () => {
    expect(DEFAULT_METERS_TO_PX).toBe(20)
    expect(SEGMENT_BAND_HEIGHT_PX).toBe(96)
    const scene = layoutRoadSpace(fixtureChain('two-lane-each-way'))
    expect(scene.widthPx).toBe(352)
    expect(scene.heightPx).toBeGreaterThan(320)
    expect(scene.heightPx).toBeLessThan(340)
    // Typical 14 m clear width → 280 px + padding stays under ~360
    expect(14 * DEFAULT_METERS_TO_PX + 32).toBeLessThanOrEqual(360)
  })

  test('every fixture lays out inside the scene box', () => {
    for (const fixture of laneDiagramFixtures) {
      const scene = layoutRoadSpace(fixtureChain(fixture.id))
      for (const rect of scene.slotRects) {
        expect(rect.x).toBeGreaterThanOrEqual(-0.01)
        expect(rect.y).toBeGreaterThanOrEqual(-0.01)
        expect(rect.x + rect.width).toBeLessThanOrEqual(scene.widthPx + 0.01)
        expect(rect.y + rect.height).toBeLessThanOrEqual(scene.heightPx + 0.01)
      }
      for (const line of scene.polylines) {
        for (const p of line.points) {
          expect(p.x).toBeGreaterThanOrEqual(-0.01)
          expect(p.y).toBeGreaterThanOrEqual(-0.01)
          expect(p.x).toBeLessThanOrEqual(scene.widthPx + 0.01)
          expect(p.y).toBeLessThanOrEqual(scene.heightPx + 0.01)
        }
      }
    }
  })
})

describe('implied junction seams', () => {
  test('turn-pocket-then-continue: one junction at the pocket seam', () => {
    const chain = fixtureChain('turn-pocket-then-continue')
    const { correspondences } = solveChainOffsets(chain.segments)
    const junctionSeams = correspondences
      .map((corr, i) =>
        seamIsImpliedJunction(chain.segments[i]!, chain.segments[i + 1]!, corr) ? i : -1,
      )
      .filter((i) => i >= 0)
    expect(junctionSeams).toEqual([1])

    const scene = layoutRoadSpace(chain)
    expect(scene.junctions).toHaveLength(1)
    expect(scene.junctions![0]!.height).toBeCloseTo(
      SEGMENT_BAND_HEIGHT_PX * JUNCTION_BAND_HEIGHT_FRAC,
      5,
    )
    expect(scene.bands.some((b) => b.junction)).toBe(true)
    const svg = sceneToSvg(scene)
    expect(svg).toContain('data-junction="1"')
    expect(svg).toContain('>junction</text>')
  })

  test('right-turn-pocket: appearing pocket stays a taper (no junction)', () => {
    const chain = fixtureChain('right-turn-pocket')
    const { correspondences } = solveChainOffsets(chain.segments)
    for (let i = 0; i < correspondences.length; i++) {
      expect(
        seamIsImpliedJunction(chain.segments[i]!, chain.segments[i + 1]!, correspondences[i]!),
      ).toBe(false)
    }
    expect(layoutRoadSpace(chain).junctions ?? []).toHaveLength(0)
  })

  test('two-lane-each-way: no junction', () => {
    const chain = fixtureChain('two-lane-each-way')
    const { correspondences } = solveChainOffsets(chain.segments)
    for (let i = 0; i < correspondences.length; i++) {
      expect(
        seamIsImpliedJunction(chain.segments[i]!, chain.segments[i + 1]!, correspondences[i]!),
      ).toBe(false)
    }
    expect(layoutRoadSpace(chain).junctions ?? []).toHaveLength(0)
  })

  test('through-lane count drop without pure-turn roles stays a smooth taper', () => {
    const chain: RoadSpaceChain = {
      segments: [
        buildRoadSpaceSegment(
          {
            highway: 'primary',
            oneway: 'yes',
            lanes: '2',
            sidewalk: 'both',
          },
          { wayId: 1, role: 'next' },
        ),
        buildRoadSpaceSegment(
          {
            highway: 'primary',
            oneway: 'yes',
            lanes: '3',
            sidewalk: 'both',
          },
          { wayId: 2, role: 'current' },
        ),
      ],
    }
    // 3 lanes below → 2 above: unmatched forward in B without turn tags.
    const { correspondences } = solveChainOffsets(chain.segments)
    expect(correspondences).toHaveLength(1)
    expect(seamIsImpliedJunction(chain.segments[0]!, chain.segments[1]!, correspondences[0]!)).toBe(
      false,
    )
    const scene = layoutRoadSpace(chain)
    expect(scene.junctions ?? []).toHaveLength(0)
    expect(scene.bands.some((b) => b.synthetic && !b.junction)).toBe(true)
  })

  test('placement-transition: merge seam shares S-curve x across kerb/plate/sidewalk/lane', () => {
    const chain = fixtureChain('placement-transition')
    const { correspondences } = solveChainOffsets(chain.segments)
    // No pure-turn roles → must not become an implied junction.
    for (let i = 0; i < correspondences.length; i++) {
      expect(
        seamIsImpliedJunction(chain.segments[i]!, chain.segments[i + 1]!, correspondences[i]!),
      ).toBe(false)
    }

    const scene = layoutRoadSpace(chain)
    expect(scene.junctions ?? []).toHaveLength(0)

    const glueIdx = scene.bands.findIndex(
      (b, i) =>
        b.synthetic &&
        !b.junction &&
        b.height > 20 &&
        scene.bands[i - 1]?.role === 'current' &&
        scene.bands[i + 1]?.role === 'prev',
    )
    expect(glueIdx).toBeGreaterThan(0)
    const glue = scene.bands[glueIdx]!

    const kerb = scene.polylines.find((p) => p.id.startsWith('kerb-left'))
    expect(kerb).toBeDefined()
    const plate = scene.carriagewayPlate
    expect(plate).toBeDefined()
    const sidewalk = scene.ribbons.find(
      (r) => r.zone === 'sidepath' && r.bandSlices.some((s) => s.bandIndex === glueIdx),
    )
    expect(sidewalk).toBeDefined()
    const merge = scene.ribbons.find(
      (r) =>
        r.zone === 'carriageway' &&
        r.kind === 'motor' &&
        r.bandSlices.some((s) => s.wayId === 1001 && s.slotId.includes('forward/0')),
    )
    expect(merge).toBeDefined()
    expect(merge!.bandSlices.some((s) => s.bandIndex === glueIdx)).toBe(true)

    const xAtY = (
      points: Array<{ x: number; y: number }>,
      y: number,
      side: 'left' | 'right',
    ): number | null => {
      const xs: number[] = []
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i]!
        const b = points[i + 1]!
        const ymin = Math.min(a.y, b.y)
        const ymax = Math.max(a.y, b.y)
        if (y < ymin - 0.05 || y > ymax + 0.05) continue
        if (Math.abs(a.y - b.y) < 0.05) {
          xs.push(a.x)
          continue
        }
        const t = (y - a.y) / (b.y - a.y)
        if (t >= -0.05 && t <= 1.05) xs.push(a.x + t * (b.x - a.x))
      }
      if (xs.length === 0) return null
      return side === 'left' ? Math.min(...xs) : Math.max(...xs)
    }

    // Sample through the glue band: kerb, plate left, sidewalk inner, merge left align.
    for (let i = 0; i <= 8; i++) {
      const y = glue.y + (glue.height * i) / 8
      const kerbX = xAtY(kerb!.points, y, 'left')
      const plateX = xAtY(plate!.points, y, 'left')
      const swInner = xAtY(sidewalk!.points, y, 'right')
      const mergeLeft = xAtY(merge!.points, y, 'left')
      const mergeRight = xAtY(merge!.points, y, 'right')
      expect(kerbX).not.toBeNull()
      expect(plateX).not.toBeNull()
      expect(swInner).not.toBeNull()
      expect(mergeLeft).not.toBeNull()
      expect(mergeRight).not.toBeNull()
      // Shared S-curve (± kerb fill overlap).
      expect(Math.abs(kerbX! - plateX!)).toBeLessThanOrEqual(1.5)
      expect(Math.abs(kerbX! - swInner!)).toBeLessThanOrEqual(1.5)
      expect(Math.abs(kerbX! - mergeLeft!)).toBeLessThanOrEqual(1.5)
      // Merging lane still has fill to the right of the kerb (no uncovered gap).
      expect(mergeRight!).toBeGreaterThan(mergeLeft! - 0.01)
      expect(mergeRight! - kerbX!).toBeGreaterThanOrEqual(-0.5)
    }
  })
})

describe('sceneToSvg snapshots', () => {
  for (const fixture of laneDiagramFixtures) {
    test(`deterministic SVG for ${fixture.id}`, () => {
      const scene = layoutRoadSpace(fixtureChain(fixture.id))
      const svg = sceneToSvg(scene)
      const svg2 = sceneToSvg(scene)
      expect(svg).toBe(svg2)
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
      expect(svg).toContain('</svg>')
      expect(svg).toMatchSnapshot()
    })
  }
})

describe('all fixtures', () => {
  test('every fixture lays out without throwing and has ≥1 slot rect per segment', () => {
    expect(laneDiagramFixtures).toHaveLength(31)
    for (const fixture of laneDiagramFixtures) {
      const chain = fixtureChain(fixture.id)
      const scene = layoutRoadSpace(chain)
      const realBands = scene.bands.filter((b) => !b.synthetic)
      expect(realBands.length).toBe(fixture.segments.length)
      expect(scene.bands.length).toBeGreaterThanOrEqual(fixture.segments.length * 2 - 1)
      for (const seg of chain.segments) {
        const rects = scene.slotRects.filter((r) => r.wayId === seg.wayId)
        expect(rects.length).toBeGreaterThanOrEqual(1)
      }
      expect(() => sceneToSvg(scene)).not.toThrow()
    }
  })
})
