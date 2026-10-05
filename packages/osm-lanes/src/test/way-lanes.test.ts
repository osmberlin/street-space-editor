import { describe, expect, test } from 'bun:test'
import {
  joinLanesPipe,
  parseWayLanes,
  serializeWayLanes,
  splitLanesPipe,
  validateWayLanes,
} from '../index'

describe('pipe helpers', () => {
  test('splitLanesPipe and joinLanesPipe round-trip', () => {
    const parts = ['left', 'through', 'right']
    expect(splitLanesPipe('left|through|right')).toEqual(parts)
    expect(joinLanesPipe(parts)).toBe('left|through|right')
  })
})

describe('parseWayLanes', () => {
  test('oneway 2 lanes with turn:lanes', () => {
    const tags = {
      highway: 'primary',
      oneway: 'yes',
      lanes: '2',
      'turn:lanes': 'left|through',
    }
    const model = parseWayLanes(tags)
    expect(model.slots).toHaveLength(2)
    expect(model.slots[0]).toMatchObject({
      index: 0,
      direction: 'forward',
      turn: 'left',
      kind: 'travel',
    })
    expect(model.slots[1]).toMatchObject({ index: 1, turn: 'through' })
    expect(model.lanesForward).toBe(2)

    const out = serializeWayLanes(model, tags)
    expect(out['turn:lanes']).toBe('left|through')
    expect(out['turn:lanes:forward']).toBeUndefined()
    expect(out.lanes).toBe('2')
    expect(out.highway).toBe('primary')
  })

  test('two-way with directional lanes and turn pipes', () => {
    const tags = {
      highway: 'secondary',
      lanes: '4',
      'lanes:forward': '2',
      'lanes:backward': '2',
      'turn:lanes:forward': 'left|through',
      'turn:lanes:backward': 'through|right',
    }
    const model = parseWayLanes(tags)
    const forward = model.slots.filter((s) => s.direction === 'forward')
    const backward = model.slots.filter((s) => s.direction === 'backward')
    expect(forward).toHaveLength(2)
    expect(backward).toHaveLength(2)
    expect(forward[0]?.turn).toBe('left')
    expect(backward[1]?.turn).toBe('right')

    const out = serializeWayLanes(model, tags)
    expect(out['turn:lanes:forward']).toBe('left|through')
    expect(out['turn:lanes:backward']).toBe('through|right')
    expect(out['lanes:forward']).toBe('2')
    expect(out['lanes:backward']).toBe('2')
  })

  test('middle bike lane (Mittellage)', () => {
    const tags = {
      highway: 'tertiary',
      lanes: '2',
      'turn:lanes': 'left|left;through|right',
      'vehicle:lanes': 'yes|no|yes',
      'bicycle:lanes': 'no|designated|yes',
      'cycleway:lanes': 'none|lane|none',
      placement: 'right_of:1',
    }
    const model = parseWayLanes(tags)
    expect(model.slots).toHaveLength(3)
    expect(model.slots[1]).toMatchObject({
      kind: 'bicycle',
      bicycleAccess: 'designated',
      vehicleAccess: 'no',
    })
    expect(model.secondary?.cyclewayLanes['cycleway:lanes']).toBe('none|lane|none')
    expect(model.placement).toBe('right_of:1')

    const out = serializeWayLanes(model, tags)
    expect(out['bicycle:lanes']).toBe('no|designated|yes')
    expect(out['vehicle:lanes']).toBe('yes|no|yes')
    expect(out['cycleway:lanes']).toBe('none|lane|none')
    expect(out.placement).toBe('right_of:1')
  })

  test('bus via lanes:bus:forward', () => {
    const tags = {
      highway: 'primary',
      lanes: '3',
      'lanes:forward': '2',
      'lanes:backward': '1',
      'lanes:bus:forward': '1',
      'turn:lanes:forward': 'through|through',
      'turn:lanes:backward': 'through',
    }
    const model = parseWayLanes(tags)
    const forward = model.slots.filter((s) => s.direction === 'forward')
    expect(forward).toHaveLength(2)
    expect(forward[1]?.kind).toBe('bus')
    expect(forward[1]?.busAccess).toBe('designated')
    expect(forward[1]?.provenance.busAccess).toBe('inferred')
  })

  test('bus via bus:lanes pipe', () => {
    const tags = {
      highway: 'primary',
      oneway: 'yes',
      lanes: '3',
      'bus:lanes': 'yes|yes|designated',
    }
    const model = parseWayLanes(tags)
    expect(model.slots).toHaveLength(3)
    expect(model.slots[2]?.kind).toBe('bus')
    expect(model.slots[2]?.busAccess).toBe('designated')
    // `yes` = buses may use the lane, it is still a normal lane
    expect(model.slots[0]?.kind).toBe('travel')
    expect(model.slots[1]?.kind).toBe('travel')

    const out = serializeWayLanes(model, tags)
    expect(out['bus:lanes']).toBe('yes|yes|designated')
  })
})

describe('validateWayLanes', () => {
  test('flags pipe/count mismatch', () => {
    const tags = {
      lanes: '3',
      'lanes:forward': '2',
      'turn:lanes:forward': 'left|through|right',
    }
    const model = parseWayLanes(tags)
    const warnings = validateWayLanes(model, tags)
    expect(warnings.some((w) => w.code === 'pipe_count_mismatch')).toBe(true)
  })

  test('flags lanes sum mismatch', () => {
    const model = parseWayLanes({
      lanes: '5',
      'lanes:forward': '2',
      'lanes:backward': '2',
    })
    const warnings = validateWayLanes({
      ...model,
      lanesTotal: 5,
      lanesForward: 2,
      lanesBackward: 2,
      lanesBothWays: 0,
    })
    expect(warnings.some((w) => w.code === 'lanes_sum_mismatch')).toBe(true)
  })

  test('flags bike lane count inconsistency', () => {
    const tags = {
      lanes: '2',
      'bicycle:lanes': 'no|designated|yes',
      'vehicle:lanes': 'yes|no|yes',
    }
    const model = parseWayLanes(tags)
    const warnings = validateWayLanes(model, tags)
    expect(warnings.some((w) => w.code === 'bike_lanes_count_inconsistency')).toBe(true)
  })

  test('flags placement out of range', () => {
    const tags = {
      lanes: '2',
      'lanes:forward': '2',
      'placement:forward': 'middle_of:3',
    }
    const model = parseWayLanes(tags)
    const warnings = validateWayLanes(model, tags)
    expect(warnings.some((w) => w.code === 'placement_out_of_range')).toBe(true)
  })
})

describe('serializeWayLanes', () => {
  test('preserves unrelated tags', () => {
    const base = {
      highway: 'residential',
      name: 'Teststraße',
      maxspeed: '30',
      lanes: '2',
      'turn:lanes': 'left|through',
    }
    const model = parseWayLanes(base)
    const out = serializeWayLanes(model, base)
    expect(out.name).toBe('Teststraße')
    expect(out.highway).toBe('residential')
    expect(out.maxspeed).toBe('30')
    expect(out['turn:lanes']).toBe('left|through')
  })
})

describe('muv-inspired fixtures', () => {
  test('muv-hwy-even_lane_count: lanes=4 split', () => {
    const model = parseWayLanes({ highway: 'primary', lanes: '4' })
    expect(model.lanesTotal).toBe(4)
    expect(model.lanesForward).toBe(2)
    expect(model.lanesBackward).toBe(2)
    expect(model.slots.filter((s) => s.direction === 'forward')).toHaveLength(2)
    expect(model.slots.filter((s) => s.direction === 'backward')).toHaveLength(2)
  })

  test('muv-hwy-odd_lane_count: lanes=5, lanes:backward=2', () => {
    const tags = {
      highway: 'primary',
      lanes: '5',
      'lanes:backward': '2',
    }
    const model = parseWayLanes(tags)
    expect(model.lanesTotal).toBe(5)
    expect(model.lanesBackward).toBe(2)
    expect(model.lanesForward).toBe(3)
    expect(model.slots.filter((s) => s.direction === 'forward')).toHaveLength(3)
    expect(model.slots.filter((s) => s.direction === 'backward')).toHaveLength(2)
  })

  test('muv-hwy-bus_lanes_count: lanes:bus:forward=1', () => {
    const tags = {
      highway: 'primary',
      lanes: '4',
      'lanes:forward': '2',
      'lanes:backward': '2',
      'lanes:bus:forward': '1',
      'turn:lanes:forward': 'through|through',
    }
    const model = parseWayLanes(tags)
    const forward = model.slots.filter((s) => s.direction === 'forward')
    expect(forward[1]?.kind).toBe('bus')
  })

  test('muv-base-placement_forward: valid placement:backward', () => {
    const tags = {
      lanes: '3',
      'lanes:backward': '2',
      'placement:backward': 'middle_of:2',
      'turn:lanes:backward': 'through|through',
    }
    const model = parseWayLanes(tags)
    expect(model.placementBackward).toBe('middle_of:2')
    const warnings = validateWayLanes(model, tags)
    expect(warnings.some((w) => w.code === 'placement_out_of_range')).toBe(false)
  })

  test('muv-side-no_duplicate_cycleway_lanes_on_oneway pattern', () => {
    const tags = {
      oneway: 'yes',
      lanes: '2',
      'cycleway:right': 'lane',
      'cycleway:lanes': 'no|lane|no',
      'vehicle:lanes': 'yes|no|yes',
      'bicycle:lanes': 'no|designated|yes',
    }
    const model = parseWayLanes(tags)
    expect(model.slots).toHaveLength(3)
    expect(model.slots[1]?.kind).toBe('bicycle')
    // TODO: deduplicate side cycleway vs on-carriageway slot when building geometry
  })

  test('turn:backward fallback when turn:lanes:backward is absent', () => {
    const tags = {
      highway: 'secondary',
      lanes: '2',
      'width:lanes:backward': '3.2',
      'width:lanes:forward': '3.2',
      'turn:backward': 'through;right',
    }
    const model = parseWayLanes(tags)
    const backward = model.slots.filter((s) => s.direction === 'backward')
    expect(backward).toHaveLength(1)
    expect(backward[0]?.turn).toBe('through;right')
  })

  test('round-trip preserves primary lane tags', () => {
    const tags = {
      highway: 'secondary',
      lanes: '4',
      'lanes:forward': '2',
      'lanes:backward': '2',
      'turn:lanes:forward': 'left|through',
      'turn:lanes:backward': 'through|right',
      lane_markings: 'yes',
    }
    const model = parseWayLanes(tags)
    const out = serializeWayLanes(model, tags)
    expect(out.lanes).toBe('4')
    expect(out['lanes:forward']).toBe('2')
    expect(out['turn:lanes:forward']).toBe('left|through')
    expect(out.lane_markings).toBe('yes')
    expect(out.highway).toBe('secondary')
  })
})
