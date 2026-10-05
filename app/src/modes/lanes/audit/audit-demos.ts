import { laneDiagramFixtures } from '@osm-editor-kit/osm-lane-diagram/fixtures'

export type FixtureGroupId =
  | 'basic'
  | 'transitions'
  | 'islands'
  | 'field'
  | 'berlin'
  | 'bike'
  | 'width'

export type AuditDemoId = (typeof AUDIT_DEMO_IDS)[number]

const FIXTURE_GROUPS: readonly {
  id: FixtureGroupId
  label: string
  fixtureIds: readonly string[]
}[] = [
  {
    id: 'basic',
    label: 'Basic',
    fixtureIds: ['one-lane-each-way', 'two-lane-each-way'],
  },
  {
    id: 'transitions',
    label: 'Transitions & pockets',
    fixtureIds: ['right-turn-pocket', 'turn-pocket-then-continue', 'placement-transition'],
  },
  {
    id: 'islands',
    label: 'Islands & junctions',
    fixtureIds: ['dual-carriageway-island', 'karl-marx-dual-split', 't-junction'],
  },
  {
    id: 'field',
    label: 'Field bugs (Berlin)',
    fixtureIds: ['karl-marx-bi-to-dual', 'karl-marx-dual-opposite', 'karl-marx-crossing-turns'],
  },
  {
    id: 'berlin',
    label: 'Berlin cases',
    fixtureIds: [
      'streitstrasse-mid-road-cycle',
      'karl-liebknecht-bus-lane',
      'heerstrasse-both-ways-lane',
      'seestrasse-merge-lane-drop',
      'hermannstrasse-placement-forward',
      'nahmitzer-damm-double-left',
    ],
  },
  {
    id: 'bike',
    label: 'Bike & sidepaths',
    fixtureIds: [
      'mid-road-cycle-lane',
      'oneway-sidewalks-cycle',
      'shared-sidepath-segregated',
      'shared-sidepath-not-segregated',
      'contraflow-cycling',
      'no-sidewalk-tagged',
      'sidewalk-no-and-separate',
      'reversed-neighbour',
    ],
  },
  {
    id: 'width',
    label: 'Width reconciliation',
    fixtureIds: [
      'width-vs-width-lanes',
      'parking-bike-buffer',
      'parking-both-sides',
      'parking-street-side-excluded',
      'cycle-separation-buffer',
      'unmarked-carriageway',
    ],
  },
]

const fixtureIdsInNavOrder = FIXTURE_GROUPS.flatMap((g) => g.fixtureIds)

/** Flat demo order for prev/next: fixtures then sandbox. */
export const AUDIT_DEMO_IDS = [...fixtureIdsInNavOrder, 'sandbox'] as const

export const DEFAULT_AUDIT_DEMO_ID: AuditDemoId = AUDIT_DEMO_IDS[0]

export function isAuditDemoId(value: string): value is AuditDemoId {
  return (AUDIT_DEMO_IDS as readonly string[]).includes(value)
}

export function demoTitle(demoId: AuditDemoId): string {
  if (demoId === 'sandbox') return 'Sandbox'
  const fixture = laneDiagramFixtures.find((f) => f.id === demoId)
  if (!fixture) throw new Error(`Missing lane diagram fixture: ${demoId}`)
  return fixture.title
}

export function adjacentDemos(demoId: AuditDemoId): {
  prev: AuditDemoId | null
  next: AuditDemoId | null
} {
  const index = AUDIT_DEMO_IDS.indexOf(demoId)
  return {
    prev: index > 0 ? AUDIT_DEMO_IDS[index - 1]! : null,
    next: index >= 0 && index < AUDIT_DEMO_IDS.length - 1 ? AUDIT_DEMO_IDS[index + 1]! : null,
  }
}

export const AUDIT_NAV_GROUPS = FIXTURE_GROUPS.map((group) => ({
  ...group,
  demos: group.fixtureIds.map((id) => {
    const fixture = laneDiagramFixtures.find((f) => f.id === id)
    if (!fixture) throw new Error(`Missing lane diagram fixture: ${id}`)
    return { id: id as AuditDemoId, title: fixture.title }
  }),
}))
