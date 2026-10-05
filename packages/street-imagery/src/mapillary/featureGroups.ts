/**
 * Groups of Mapillary map-feature / detection values, for filters and counts.
 *
 * Values look like `regulatory--maximum-speed-limit-30--g1` (category, name, design variant) or
 * `object--traffic-light--general-upright`. Groups match by pattern, so new variants are covered.
 * Sign groups come from the iD Radnetz fork (feature 26); object and marking groups from the
 * Knotenpunkte plan (traffic lights, bicycle symbols, stop lines, arrows, crosswalks).
 */

export type MapFeatureGroup = {
  id: string
  label: string
  /** Tested against the whole value. */
  pattern: RegExp
}

/** Whether a value is a traffic sign (and not an object like `object--bench`). */
export const isSignValue = (value: string): boolean =>
  /^(regulatory|warning|information|complementary)--/.test(value)

/** `regulatory--maximum-speed-limit-30--g1` → `maximum-speed-limit-30`. */
export const signName = (value: string): string => value.split('--')[1] ?? value

/**
 * Matches `namePattern` inside the sign's name (the part between the first two `--`), unless the
 * name also has `exceptPattern`.
 */
const signGroup = (
  id: string,
  label: string,
  namePattern: string,
  exceptPattern?: string,
): MapFeatureGroup => ({
  id,
  label,
  pattern: new RegExp(
    `^(?:regulatory|warning|information|complementary)--${
      exceptPattern ? `(?!(?:(?!--).)*(?:${exceptPattern}))` : ''
    }(?:(?!--).)*(?:${namePattern})`,
  ),
})

/**
 * Traffic sign groups. In Berlin (2026-09) most detected signs are in none of them (direction
 * and warning signs, …); use `OTHER_SIGNS_GROUP_ID` for those.
 */
export const SIGN_GROUPS: MapFeatureGroup[] = [
  // Bicycle parking is a bike sign, not a parking restriction. No lookbehind: a browser without
  // it would fail to load the whole module.
  signGroup('parking', 'Parking & stopping', 'parking|stopping', '(?:bicycle|bike)-parking'),
  signGroup('bike', 'Bike', 'bicycl|bike|cyclist|cycling|pedestrians-only'),
  signGroup('speed', 'Speed', 'speed|living-street|built-up-area'),
  signGroup(
    'access',
    'Access & oneway',
    'one-way|no-entry|road-closed|no-motor-vehicles|no-heavy-goods|no-motorcycles|no-buses|(buses|trams|taxi|trucks|vehicles)-only|except-(vehicles|buses|trams)',
  ),
]

export const OTHER_SIGNS_GROUP_ID = 'other'

/** Ids of `SIGN_GROUPS` plus `other`, in display order. */
export const SIGN_GROUP_IDS = ['parking', 'bike', 'speed', 'access', OTHER_SIGNS_GROUP_ID] as const
export type SignGroupId = (typeof SIGN_GROUP_IDS)[number]

/** Objects and markings that matter at junctions. */
export const JUNCTION_FEATURE_GROUPS: MapFeatureGroup[] = [
  { id: 'traffic-light', label: 'Traffic lights', pattern: /^object--traffic-light--/ },
  {
    id: 'bicycle-symbol',
    label: 'Bicycle symbols',
    pattern: /^marking--discrete--symbol--bicycle/,
  },
  { id: 'stop-line', label: 'Stop lines', pattern: /^marking--discrete--stop-line/ },
  { id: 'arrow', label: 'Arrows', pattern: /^marking--discrete--arrow--/ },
  {
    id: 'crosswalk',
    label: 'Crosswalks',
    pattern: /^(marking--discrete--crosswalk-zebra|construction--flat--crosswalk-plain)/,
  },
]

/**
 * Per-photo detection classes for junction ratings (these exist only as outlines in images, not
 * as map points): bike-lane surface, line markings, hatching, traffic islands.
 */
export const JUNCTION_DETECTION_GROUPS: MapFeatureGroup[] = [
  { id: 'bike-lane', label: 'Bike lane surface', pattern: /^construction--flat--bike-lane/ },
  { id: 'line-marking', label: 'Line markings', pattern: /^marking--continuous--(dashed|solid)/ },
  { id: 'hatching', label: 'Hatched markings', pattern: /^marking--discrete--hatched/ },
  {
    id: 'traffic-island',
    label: 'Traffic islands',
    pattern: /^construction--flat--traffic-island/,
  },
  ...JUNCTION_FEATURE_GROUPS.filter((group) => group.id !== 'traffic-light'),
]

/** Ids of the groups a value belongs to (`[]` when none). */
export const mapFeatureGroupIds = (value: string, groups: readonly MapFeatureGroup[]): string[] =>
  groups.filter((group) => group.pattern.test(value)).map((group) => group.id)

/** Sign group ids of a value; `other` for signs in none of the named groups. */
export const signGroupIds = (value: string): string[] => {
  if (!isSignValue(value)) {
    return []
  }
  const ids = mapFeatureGroupIds(value, SIGN_GROUPS)
  return ids.length > 0 ? ids : [OTHER_SIGNS_GROUP_ID]
}

/** Predicate for `filter` options: values in any of the groups. */
export const matchesAnyGroup =
  (groups: readonly MapFeatureGroup[]) =>
  (value: string): boolean =>
    groups.some((group) => group.pattern.test(value))

/** Number of features per group id, e.g. for "3 traffic lights" next to a form field. */
export const countByGroup = <T extends { value: string }>(
  features: readonly T[],
  groups: readonly MapFeatureGroup[],
): Record<string, number> => {
  const counts: Record<string, number> = Object.fromEntries(groups.map((group) => [group.id, 0]))
  for (const feature of features) {
    for (const id of mapFeatureGroupIds(feature.value, groups)) {
      counts[id] = (counts[id] ?? 0) + 1
    }
  }
  return counts
}

const signFilterCache = new Map<string, (value: string) => boolean>()

/**
 * Filter for `filter.mapFeatureValue`: signs of the chosen groups pass; other objects always do.
 * `undefined` when all groups are chosen (no filtering). The function is cached per selection, so
 * its identity is stable and layers do not re-render on every call.
 */
export const signGroupFilter = (
  groups: readonly string[],
): ((value: string) => boolean) | undefined => {
  if (SIGN_GROUP_IDS.every((id) => groups.includes(id))) {
    return undefined
  }
  const key = [...groups].sort().join(',')
  let filter = signFilterCache.get(key)
  if (!filter) {
    const chosen = new Set(groups)
    filter = (value) => !isSignValue(value) || signGroupIds(value).some((id) => chosen.has(id))
    signFilterCache.set(key, filter)
  }
  return filter
}
