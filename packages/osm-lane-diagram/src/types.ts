import type { Placement } from './placement'

export type RoadSpaceSlotKind = 'motor' | 'bus' | 'cycle' | 'both_ways' | 'sidewalk' | 'shared_path'

/** Carriageway = inside kerbs; sidepath = sidewalk / track / shared path outside kerbs. */
export type RoadSpaceZone = 'carriageway' | 'sidepath'

export type RoadSpaceDirection = 'forward' | 'backward' | 'both_ways' | 'none'

export type RoadSpaceProvenance = 'tagged' | 'default' | 'inferred'

export type RoadSpaceSlot = {
  id: string
  kind: RoadSpaceSlotKind
  zone: RoadSpaceZone
  direction: RoadSpaceDirection
  widthM: number
  widthProvenance: RoadSpaceProvenance
  /** Cross-section side for on-carriageway cycle lanes from sided tags. */
  side?: 'left' | 'right'
  turn?: string
  access?: { vehicle?: string; bicycle?: string; bus?: string }
  segregated?: boolean
  label?: string
}

export type RoadSpaceSegmentRole = 'prev' | 'current' | 'next'

/** Hint that a sidepath exists as its own OSM way — not a slot on this cross-section. */
export type SeparatelyMappedSidepath = {
  prefix: 'sidewalk' | 'cycleway'
  side: 'left' | 'right'
}

export type RoadSpaceMedianHint = 'verge' | 'crossing'

export type RoadSpaceSegment = {
  wayId: number
  role: RoadSpaceSegmentRole
  /** Synthetic wedge between real segments — not editable, no OSM way. */
  synthetic?: boolean
  slots: RoadSpaceSlot[]
  /** Distance from left edge of the LTR stack (incl. placeholder/gap) to the OSM centreline. */
  centrelineOffsetM: number
  /**
   * Resolved OSM `placement` used for `centrelineOffsetM` (transition falls back to a
   * default anchor). Lane indices are 1-based over the LTR carriageway stack.
   */
  placement: Placement
  /** Raw `placement=*` when present (before transition fallback). */
  placementTag?: string
  /** False when `lane_markings=no`. */
  laneMarkings: boolean
  /** Sidepaths tagged `separate` — text hint only, no geometry / metres. */
  separatelyMapped?: SeparatelyMappedSidepath[]
  /** Opposite dual branch not resolved in loaded OSM data — text hint only. */
  unresolvedSiblingHint?: boolean
  fork?: {
    gapM: number
    leftSlotIds: string[]
    rightSlotIds: string[]
    dimmedSide?: 'left' | 'right'
    /** Real opposite-branch slots (already LTR for the dimmed side). */
    siblingSlots?: RoadSpaceSlot[]
    siblingWayId?: number
    /** What the median gap represents (default verge). */
    medianHint?: RoadSpaceMedianHint
    /** Opposite branch unknown — median edge line only, no placeholder width. */
    unresolvedSibling?: boolean
  }
}

export type RoadSpaceChain = {
  /** Ordered top → bottom as given by the caller. */
  segments: RoadSpaceSegment[]
}

/** Scene rect kinds: travel slots plus non-travel `median` (dual-carriageway gap). */
export type SceneSlotRectKind = RoadSpaceSlotKind | 'median'

export type SceneSlotRect = {
  slotId: string
  wayId: number
  role: RoadSpaceSegmentRole
  kind: SceneSlotRectKind
  zone: RoadSpaceZone
  direction: RoadSpaceDirection
  x: number
  y: number
  width: number
  height: number
  widthProvenance: RoadSpaceProvenance
  label?: string
  turn?: string
  dimmed?: boolean
  /** Dual median: grass verge vs crossing island (drives diagram icon). */
  medianHint?: RoadSpaceMedianHint
  /** When set, render as polygon (taper fills) instead of the axis-aligned rect. */
  points?: Array<{ x: number; y: number }>
}

export type ScenePolyline = {
  id: string
  kind:
    | 'kerb'
    | 'outer_edge'
    | 'separator'
    | 'centreline'
    | 'placement_guide'
    /** Secondary violet guide over a dual-carriageway sibling branch. */
    | 'sibling_placement_guide'
    | 'segment_boundary'
  style: 'solid' | 'dashed'
  points: Array<{ x: number; y: number }>
  /**
   * For `sibling_placement_guide`: OSM forward of the sibling way in scene space
   * (derived from prepared sibling slot directions after `prepareDualSiblingSlots`).
   */
  forward?: 'up' | 'down'
}

export type SceneSegmentBand = {
  wayId: number
  role: RoadSpaceSegmentRole
  y: number
  height: number
  dimmed: boolean
  label?: string
  synthetic?: boolean
  /** Synthetic placeholder where pure-turn pockets end at an implied junction. */
  junction?: boolean
  /**
   * Sidewalks / cycleways tagged `separate` on this segment, with the road's outer
   * edge `x` on that side — for a marker next to the band.
   */
  separatelyMapped?: Array<SeparatelyMappedSidepath & { x: number }>
}

/** Median area in a glue band where a street splits into two carriageways. */
export type SceneMedianOpening = {
  points: Array<{ x: number; y: number }>
  medianHint: 'verge' | 'crossing'
  dimmed?: boolean
}

export type SceneJunctionBand = {
  y: number
  height: number
}

export type SceneRibbonBandSlice = {
  bandIndex: number
  wayId: number
  role: RoadSpaceSegmentRole
  slotId: string
  y: number
  height: number
}

/** Continuous multi-band corridor fill for one logical lane. */
export type SceneRibbon = {
  id: string
  /** Primary slot id (first band in chain) for highlight matching. */
  slotId: string
  kind: SceneSlotRectKind
  zone: RoadSpaceZone
  direction: RoadSpaceDirection
  widthProvenance: RoadSpaceProvenance
  label?: string
  turn?: string
  dimmed?: boolean
  points: Array<{ x: number; y: number }>
  bandSlices: SceneRibbonBandSlice[]
  /** Glyph placement on the current band (or middle band). */
  glyphCx: number
  glyphCy: number
  glyphBandRole: RoadSpaceSegmentRole
}

export type SceneCarriagewayPlate = {
  points: Array<{ x: number; y: number }>
}

export type SceneDebugCorrespondenceLink = {
  /** Index into the segment-pair correspondence list (segments[i] ↔ segments[i+1]). */
  segmentPairIndex: number
  indexA: number
  indexB: number
  branchA: 'travel' | 'sibling'
  branchB: 'travel' | 'sibling'
  xAbove: number
  yAbove: number
  xBelow: number
  yBelow: number
}

export type SceneDebugBandOffset = {
  bandIndex: number
  wayId: number
  role: RoadSpaceSegmentRole
  /** Solved LTR stack left edge (metres, anchor-relative chain). */
  stackLeftM: number
  /** Solved LTR stack left edge (px, after layout crop). */
  stackLeftX: number
  provenance: 'anchor' | 'chained'
  /** Tagged placement-only stack left (px) when `placement=*` is present. */
  taggedStackLeftX?: number
  /** Solved minus tagged stack offset (metres); large values trigger placement warnings. */
  placementDeltaM?: number
}

/** Optional layout debug metadata for audit overlays — omitted in default editor scenes. */
export type RoadSpaceSceneDebug = {
  correspondenceLinks: SceneDebugCorrespondenceLink[]
  bandOffsets: SceneDebugBandOffset[]
}

export type RoadSpaceScene = {
  widthPx: number
  heightPx: number
  metersToPx: number
  /** Shared OSM placement centreline X (px) — lanes align left/right of this guide. */
  centrelineX?: number
  bands: SceneSegmentBand[]
  /** Implied-junction placeholder bands (full-width cross-street gaps). */
  junctions?: SceneJunctionBand[]
  /** Continuous corridor ribbons — primary fill geometry. */
  ribbons: SceneRibbon[]
  /**
   * Optional asphalt plate(s) behind carriageway motor/bus ribbons.
   * Split into separate polygons when an implied junction interrupts the corridor.
   */
  carriagewayPlate?: SceneCarriagewayPlate
  carriagewayPlates?: SceneCarriagewayPlate[]
  slotRects: SceneSlotRect[]
  /** Median fills in glue bands (the median growing out of a bidirectional road). */
  medianOpenings?: SceneMedianOpening[]
  polylines: ScenePolyline[]
  /** Union of segment `separatelyMapped` hints (text only; no geometry). */
  separatelyMapped?: SeparatelyMappedSidepath[]
  /** Segments where the opposite dual branch was not resolved (text only). */
  unresolvedSibling?: boolean
  /**
   * Placement tagging problems that make a shared centreline guide geometrically
   * inconsistent across the corridor (by definition the ribbons will shear).
   */
  placementIssues?: string[]
  /** Correspondence / offset provenance for audit overlays. */
  debug?: RoadSpaceSceneDebug
}
