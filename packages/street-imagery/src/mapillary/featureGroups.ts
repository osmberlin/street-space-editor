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

/** Matches `namePattern` inside the sign's name (the part between the first two `--`). */
const signGroup = (id: string, label: string, namePattern: string): MapFeatureGroup => ({
  id,
  label,
  pattern: new RegExp(
    `^(?:regulatory|warning|information|complementary)--(?:(?!--).)*(?:${namePattern})`,
  ),
})

/**
 * Traffic sign groups. In Berlin (2026-09) 79 % of the detected signs are in none of them
 * (parking, direction signs); use `OTHER_SIGNS_GROUP_ID` for those.
 */
export const SIGN_GROUPS: MapFeatureGroup[] = [
  signGroup('bike', 'Bike', 'bicycl|bike|cyclist|cycling|pedestrians-only'),
  signGroup('speed', 'Speed', 'speed|living-street|built-up-area'),
  signGroup(
    'access',
    'Access & oneway',
    'one-way|no-entry|road-closed|no-motor-vehicles|no-heavy-goods|no-motorcycles|no-buses|(buses|trams|taxi|trucks|vehicles)-only|except-(vehicles|buses|trams)',
  ),
]

export const OTHER_SIGNS_GROUP_ID = 'other'

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
