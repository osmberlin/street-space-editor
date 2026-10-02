/**
 * Mapillary image keys in OSM tags (iD Radnetz fork, feature 19): which keys hold image ids, what
 * they are about (a road side, a traffic sign, a direction) and which image to show first.
 *
 * Key grammar: `[source:][cycleway|sidewalk[:left|:right|:both]:][traffic_sign[:forward|:backward]:]mapillary[:forward|:backward|:<n>]`
 * (as in the Berlin data and TILDA's `extract_bikelanes.lua`).
 */
export type OsmTags = Record<string, string | undefined>

export type MapillaryTagKey = {
  key: string
  /** `source:` prefix: the image is the source of the tag, not a picture of the feature. */
  source: boolean
  prefix?: 'cycleway' | 'sidewalk'
  side?: 'left' | 'right' | 'both'
  /** Image of the traffic sign. */
  trafficSign: boolean
  direction?: 'forward' | 'backward'
  /** `mapillary:2` */
  number?: number
}

const KEY_PATTERN =
  /^(source:)?(?:(cycleway|sidewalk)(?::(left|right|both))?:)?(traffic_sign(?::(forward|backward))?:)?mapillary(?::(forward|backward|\d{1,3}))?$/

/** Not image ids. Year suffixes (`mapillary:2019`) are not supported: numbers have at most 3 digits. */
const NOT_IMAGE_KEYS = new Set(['mapillary:map_feature'])

/** Parse an image key, or `undefined` for other keys (`mapillary:map_feature`, `was:mapillary`). */
export const parseMapillaryTagKey = (key: string): MapillaryTagKey | undefined => {
  if (NOT_IMAGE_KEYS.has(key)) {
    return undefined
  }
  const match = key.match(KEY_PATTERN)
  if (!match) {
    return undefined
  }
  const [, source, prefix, side, trafficSign, signDirection, suffix] = match
  // A direction on the sign (`traffic_sign:forward:mapillary`) or on the key (`mapillary:forward`).
  const direction = (signDirection ??
    (suffix === 'forward' || suffix === 'backward'
      ? suffix
      : undefined)) as MapillaryTagKey['direction']
  return {
    key,
    source: !!source,
    prefix: prefix as MapillaryTagKey['prefix'],
    side: side as MapillaryTagKey['side'],
    trafficSign: !!trafficSign,
    direction,
    number: suffix && /^\d+$/.test(suffix) ? Number(suffix) : undefined,
  }
}

/** Image ids of a value: `;`-separated, trimmed, without empty parts. */
export const splitMapillaryImageIds = (value: string | undefined): string[] =>
  value
    ? value
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
    : []

/** Own images first (forward, plain, backward, numbered), then road sides, signs, sources. */
const rank = (parsed: MapillaryTagKey): number => {
  let value = 0
  if (parsed.source) value += 1000
  if (parsed.trafficSign) value += 100
  if (parsed.prefix) value += parsed.prefix === 'cycleway' ? 10 : 20
  if (parsed.side) value += { right: 1, left: 2, both: 3 }[parsed.side]
  const direction = parsed.direction === 'forward' ? 0 : parsed.direction === 'backward' ? 2 : 1
  return value * 10 + direction + (parsed.number ?? 0) * 0.01
}

/** The image keys of `tags` that have a value, in display order. */
export const mapillaryTagKeysOf = (tags: OsmTags): MapillaryTagKey[] =>
  Object.keys(tags)
    .filter((key) => tags[key])
    .flatMap((key) => parseMapillaryTagKey(key) ?? [])
    .sort((a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key))

const SIDE_LABEL = { left: 'left', right: 'right', both: 'both sides' } as const

/** Short English label: "Right bike lane · traffic sign · forward (source)". */
export const mapillaryTagKeyLabel = (parsed: MapillaryTagKey): string => {
  const parts: string[] = []
  if (parsed.prefix) {
    const thing = parsed.prefix === 'cycleway' ? 'bike lane' : 'sidewalk'
    parts.push(parsed.side ? `${SIDE_LABEL[parsed.side]} ${thing}` : thing)
  }
  if (parsed.trafficSign) parts.push('traffic sign')
  if (parsed.direction) parts.push(parsed.direction)
  if (parsed.number !== undefined) parts.push(`#${parsed.number}`)
  const label = parts.length > 0 ? parts.join(' · ') : 'image'
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1)
  return parsed.source ? `${capitalized} (source)` : capitalized
}

export type MapillaryTagImage = { imageId: string; key: MapillaryTagKey; label: string }

/** All images in a feature's tags, in display order, each id once (first key wins). */
export const mapillaryImagesOfTags = (tags: OsmTags): MapillaryTagImage[] => {
  const seen = new Set<string>()
  return mapillaryTagKeysOf(tags).flatMap((key) =>
    splitMapillaryImageIds(tags[key.key]).flatMap((imageId) => {
      if (seen.has(imageId)) {
        return []
      }
      seen.add(imageId)
      return [{ imageId, key, label: mapillaryTagKeyLabel(key) }]
    }),
  )
}

/** The image to show first: `mapillary:forward`, then `mapillary`, then the rest in display order. */
export const preferredMapillaryImageId = (tags: OsmTags): string | undefined => {
  const keys = mapillaryTagKeysOf(tags)
  const key =
    keys.find((k) => k.key === 'mapillary:forward') ??
    keys.find((k) => k.key === 'mapillary') ??
    keys[0]
  return key ? splitMapillaryImageIds(tags[key.key])[0] : undefined
}
