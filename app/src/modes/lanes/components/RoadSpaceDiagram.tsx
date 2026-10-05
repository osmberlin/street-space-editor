import type {
  RoadSpaceDirection,
  RoadSpaceScene,
  RoadSpaceSlotKind,
  RoadSpaceZone,
  ScenePolyline,
  SceneRibbon,
  SceneSlotRect,
  SceneSlotRectKind,
  SeparatelyMappedSidepath,
} from '@osm-editor-kit/osm-lane-diagram'
import { Bike, Footprints } from 'lucide-react'
import { type ReactElement } from 'react'

/**
 * Palette aligned with width-guide BAND_STYLE + lanes map chrome.
 * Carriageway motor is cool zinc; sidewalks are warmer and lighter so zones separate at a glance.
 */
const COLORS = {
  motor: '#a1a1aa', // zinc-400 — carriageway travel (width-guide motor)
  bus: '#fde68a', // amber-200
  cycle: '#5eead4', // teal-300 — width-guide cycle
  both_ways: '#fda4af', // rose-300
  sidewalk: '#f5f5f4', // stone-100 — warm, lighter than carriageway
  shared_path: '#a7f3d0', // emerald-200 — between cycle and sidewalk
  median: 'transparent', // median rects are filled with medianVerge / medianCrossing
  medianVerge: '#d9f99d', // lime-200 — grass between the carriageways
  medianCrossing: '#f5f5f4', // stone-100 — paved island with a crossing
  sibling: '#e4e4e7', // zinc-200 — opposite carriageway placeholder
  motorUntagged: '#c4c4c8',
  busUntagged: '#fef3c7',
  cycleUntagged: '#99f6e4',
  both_waysUntagged: '#fecdd3',
  sidewalkUntagged: '#e7e5e4',
  shared_pathUntagged: '#d1fae5',
  kerb: '#44403c', // stone-700
  outer_edge: '#a8a29e', // stone-400 — lighter than kerb
  separator: '#71717a', // zinc-500
  centreline: '#3f3f46', // zinc-700
  placement_guide: '#8b5cf6', // violet-500
  segment_boundary: '#d4d4d8', // zinc-300 hairline
  highlight: '#2563eb', // blue-600
  highlightStroke: '#1d4ed8', // blue-700
  untaggedEdge: '#a1a1aa',
  /** Fallback default widths (no tagged/inferred width) — darker than edge dashes so readable on sidewalks. */
  defaultWidthLabel: '#52525b', // zinc-600
  arrow: '#3f3f46',
  turn: '#18181b',
  widthLabel: '#27272a',
  /** Default / inferred clear widths (not OSM-tagged). */
  calculatedWidthLabel: '#7c3aed', // violet-600
  siblingLabel: '#52525b',
  medianIcon: '#4d7c0f', // lime-700 — grass verge
  separateMarker: '#57534e', // stone-600 — sidewalk / cycleway mapped as its own way
  crossingIcon: '#57534e', // stone-600
  carriagewayPlate: '#e7e5e4', // stone-200 — subtle asphalt behind motor/bus
  debugLink: '#0891b2', // cyan-600
  debugAnchor: '#16a34a', // green-600
  debugChained: '#64748b', // slate-500
  debugPlacementDelta: '#d97706', // amber-600
  debugLabelBg: 'rgb(255 255 255 / 0.8)',
} as const

/** Monospace debug label with a translucent background for readability on the diagram. */
function DebugLabel({
  x,
  y,
  fontSize,
  fill,
  opacity = 1,
  children,
}: {
  x: number
  y: number
  fontSize: number
  fill: string
  opacity?: number
  children: string
}): ReactElement {
  const padX = 2
  const padY = 1.5
  // ui-monospace ≈ 0.6em; emoji / Δ slightly wider — good enough for audit overlay
  const approxWidth = Math.max(children.length * fontSize * 0.62, fontSize)
  const height = fontSize + padY * 2
  return (
    <g opacity={opacity}>
      <rect
        x={x - padX}
        y={y - fontSize + padY}
        width={approxWidth + padX * 2}
        height={height}
        rx={2}
        fill={COLORS.debugLabelBg}
      />
      <text x={x} y={y} fontSize={fontSize} fill={fill} fontFamily="ui-monospace, monospace">
        {children}
      </text>
    </g>
  )
}

function kindFill(kind: SceneSlotRectKind, tagged: boolean): string {
  if (kind === 'median') return COLORS.median
  if (tagged) {
    return COLORS[kind]
  }
  switch (kind) {
    case 'motor':
      return COLORS.motorUntagged
    case 'bus':
      return COLORS.busUntagged
    case 'cycle':
      return COLORS.cycleUntagged
    case 'both_ways':
      return COLORS.both_waysUntagged
    case 'sidewalk':
      return COLORS.sidewalkUntagged
    case 'shared_path':
      return COLORS.shared_pathUntagged
  }
}

function polylineStroke(line: ScenePolyline): string {
  switch (line.kind) {
    case 'kerb':
      return COLORS.kerb
    case 'outer_edge':
      return COLORS.outer_edge
    case 'centreline':
      return COLORS.centreline
    case 'placement_guide':
    case 'sibling_placement_guide':
      return COLORS.placement_guide
    case 'segment_boundary':
      return COLORS.segment_boundary
    default:
      return COLORS.separator
  }
}

function polylineStrokeWidth(line: ScenePolyline): number {
  switch (line.kind) {
    case 'kerb':
      return 2.25
    case 'outer_edge':
      return 1.25
    case 'segment_boundary':
      return 0.75
    case 'centreline':
      return 1.25
    case 'placement_guide':
      return 4
    case 'sibling_placement_guide':
      return 2.5
    default:
      return 1.5
  }
}

function pointsAttr(points: Array<{ x: number; y: number }>): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ')
}

function formatWidthLabel(widthM: number): string {
  if (Number.isInteger(widthM)) return `${widthM}`
  return widthM.toFixed(1)
}

/**
 * OSM way direction points **up** the page (↑). Diagram-left = `*:left`.
 * forward → ↑, backward → ↓, both_ways → ↕.
 */
function DirectionHint({
  direction,
  cx,
  cy,
  size,
}: {
  direction: RoadSpaceDirection
  cx: number
  cy: number
  size: number
}): ReactElement | null {
  if (direction === 'none') return null
  const half = size / 2
  const stroke = COLORS.arrow

  if (direction === 'both_ways') {
    return (
      <g opacity={0.75} pointerEvents="none">
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={`${cx},${cy + half} ${cx},${cy - half}`}
        />
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={`${cx - half * 0.55},${cy - half * 0.35} ${cx},${cy - half} ${cx + half * 0.55},${cy - half * 0.35}`}
        />
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={`${cx - half * 0.55},${cy + half * 0.35} ${cx},${cy + half} ${cx + half * 0.55},${cy + half * 0.35}`}
        />
      </g>
    )
  }

  // forward = up-page (↑); backward = down-page (↓)
  const tipY = direction === 'forward' ? cy - half : cy + half
  const baseY = direction === 'forward' ? cy + half * 0.35 : cy - half * 0.35
  const headSign = direction === 'forward' ? 1 : -1
  return (
    <g opacity={0.75} pointerEvents="none">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={`${cx},${baseY} ${cx},${tipY}`}
      />
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={`${cx - half * 0.55},${tipY + headSign * half * 0.45} ${cx},${tipY} ${cx + half * 0.55},${tipY + headSign * half * 0.45}`}
      />
    </g>
  )
}

function turnGlyphFlipTransform(
  direction: RoadSpaceDirection,
  cx: number,
  cy: number,
): string | undefined {
  if (direction !== 'backward') return undefined
  // Glyphs are drawn for forward=↑; 180° keeps left=CCW / right=CW for stem ↓.
  return `rotate(180 ${cx} ${cy})`
}

/**
 * Turn glyphs assume OSM forward = **up** the page (stem from bottom, tip toward top).
 * Left = counterclockwise from stem; right = clockwise (also for backward via 180°).
 */
function turnGlyphPaths(
  turn: string,
  direction: RoadSpaceDirection,
  cx: number,
  cy: number,
  size: number,
): ReactElement | null {
  const tokens = turn
    .split(';')
    .map((t) => t.trim())
    .filter(Boolean)
  if (tokens.length === 0) return null

  const half = size / 2
  const stroke = COLORS.turn
  const elements: ReactElement[] = []

  for (const token of tokens) {
    if (token === 'through' || token === 'none') {
      elements.push(
        <polyline
          key={`${token}-through`}
          fill="none"
          stroke={stroke}
          strokeWidth={1.35}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={`${cx},${cy + half} ${cx},${cy - half}`}
        />,
      )
      elements.push(
        <polyline
          key={`${token}-through-head`}
          fill="none"
          stroke={stroke}
          strokeWidth={1.35}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={`${cx - half * 0.45},${cy - half * 0.35} ${cx},${cy - half} ${cx + half * 0.45},${cy - half * 0.35}`}
        />,
      )
      continue
    }
    if (token === 'left' || token === 'sharp_left' || token === 'slight_left') {
      // Stem from bottom → up, then bend diagram-left (CCW from travel direction).
      const bend = token === 'slight_left' ? 0.55 : 0.85
      elements.push(
        <path
          key={token}
          fill="none"
          stroke={stroke}
          strokeWidth={1.35}
          strokeLinecap="round"
          strokeLinejoin="round"
          d={`M ${cx} ${cy + half} L ${cx} ${cy} Q ${cx} ${cy - half * bend} ${cx - half} ${cy - half * bend}`}
        />,
      )
      elements.push(
        <polyline
          key={`${token}-head`}
          fill="none"
          stroke={stroke}
          strokeWidth={1.35}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={`${cx - half + half * 0.35},${cy - half * bend - half * 0.35} ${cx - half},${cy - half * bend} ${cx - half + half * 0.35},${cy - half * bend + half * 0.35}`}
        />,
      )
      continue
    }
    if (token === 'right' || token === 'sharp_right' || token === 'slight_right') {
      const bend = token === 'slight_right' ? 0.55 : 0.85
      elements.push(
        <path
          key={token}
          fill="none"
          stroke={stroke}
          strokeWidth={1.35}
          strokeLinecap="round"
          strokeLinejoin="round"
          d={`M ${cx} ${cy + half} L ${cx} ${cy} Q ${cx} ${cy - half * bend} ${cx + half} ${cy - half * bend}`}
        />,
      )
      elements.push(
        <polyline
          key={`${token}-head`}
          fill="none"
          stroke={stroke}
          strokeWidth={1.35}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={`${cx + half - half * 0.35},${cy - half * bend - half * 0.35} ${cx + half},${cy - half * bend} ${cx + half - half * 0.35},${cy - half * bend + half * 0.35}`}
        />,
      )
      continue
    }
    if (token === 'reverse' || token === 'merge_to_left' || token === 'merge_to_right') {
      elements.push(
        <text
          key={token}
          x={cx}
          y={cy + 3}
          textAnchor="middle"
          fontSize={Math.max(8, size * 0.7)}
          fill={stroke}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {token === 'reverse' ? '↩' : token.startsWith('merge_to_left') ? '↖' : '↗'}
        </text>,
      )
    }
  }

  if (elements.length === 0) return null
  return (
    <g opacity={0.9} pointerEvents="none" transform={turnGlyphFlipTransform(direction, cx, cy)}>
      {elements}
    </g>
  )
}

function SiblingPlaceholderLabel({
  rect,
  siblingLabel,
  cx,
  cy,
}: {
  rect: SceneSlotRect
  siblingLabel: string
  cx: number
  cy: number
}): ReactElement | null {
  if (rect.width < 12 || rect.height < 28) return null
  // Rotated along the band; textLength constrains the glyph run to the band height.
  const maxGlyphRun = Math.max(24, rect.height - 14)
  const fontSize = Math.min(8, Math.max(5.5, rect.width * 0.22))
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={fontSize}
      fill={COLORS.siblingLabel}
      fontFamily="ui-sans-serif, system-ui, sans-serif"
      transform={`rotate(-90 ${cx} ${cy})`}
      textLength={maxGlyphRun}
      lengthAdjust="spacingAndGlyphs"
    >
      {siblingLabel}
    </text>
  )
}

/** Simple tuft-of-grass glyph for dual median verge. */
function MedianVergeIcon({ cx, cy, size }: { cx: number; cy: number; size: number }): ReactElement {
  const s = Math.max(8, Math.min(18, size))
  const x = cx - s / 2
  const y = cy - s / 2
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden>
      <path
        d={`M ${s * 0.5} ${s * 0.9} L ${s * 0.22} ${s * 0.2} M ${s * 0.5} ${s * 0.9} L ${s * 0.5} ${s * 0.12} M ${s * 0.5} ${s * 0.9} L ${s * 0.78} ${s * 0.2}`}
        fill="none"
        stroke={COLORS.medianIcon}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

/** Zebra-crossing bars for a median with a crossing node on the way. */
function MedianCrossingIcon({
  cx,
  cy,
  size,
}: {
  cx: number
  cy: number
  size: number
}): ReactElement {
  const s = Math.max(10, Math.min(20, size))
  const x = cx - s / 2
  const y = cy - s / 2
  const barH = s * 0.14
  const gap = s * 0.1
  const bars = [0, 1, 2, 3].map((i) => y + s * 0.18 + i * (barH + gap))
  return (
    <g aria-hidden>
      {bars.map((by, i) => (
        <rect
          key={i}
          x={x + s * 0.15}
          y={by}
          width={s * 0.7}
          height={barH}
          rx={0.5}
          fill={COLORS.crossingIcon}
          opacity={0.85}
        />
      ))}
    </g>
  )
}

function MedianMark({
  rect,
  cx,
  cy,
}: {
  rect: SceneSlotRect
  cx: number
  cy: number
}): ReactElement | null {
  if (rect.width < 8 || rect.height < 16) return null
  const size = Math.min(rect.width * 0.85, rect.height * 0.35, 20)
  if (rect.medianHint === 'crossing') {
    return <MedianCrossingIcon cx={cx} cy={cy} size={size} />
  }
  return <MedianVergeIcon cx={cx} cy={cy} size={size} />
}

function medianFill(hint: 'verge' | 'crossing' | undefined): string {
  return hint === 'crossing' ? COLORS.medianCrossing : COLORS.medianVerge
}

/**
 * Marker next to the road edge for a sidewalk / cycleway that is mapped as its own way:
 * a dashed line with a small icon, outside the kerb where the path would be.
 */
function SeparatelyMappedMarker({
  hint,
  band,
}: {
  hint: NonNullable<RoadSpaceScene['bands'][number]['separatelyMapped']>[number]
  band: RoadSpaceScene['bands'][number]
}): ReactElement {
  const offset = hint.prefix === 'cycleway' ? 5 : 10
  const x = hint.side === 'left' ? hint.x - offset : hint.x + offset
  const midY = band.y + band.height / 2 + (hint.prefix === 'cycleway' ? -12 : 12)
  const Icon = hint.prefix === 'cycleway' ? Bike : Footprints
  const size = 12
  return (
    <g pointerEvents="none" opacity={band.dimmed ? 0.7 : 1}>
      <line
        x1={x}
        y1={band.y + 5}
        x2={x}
        y2={band.y + band.height - 5}
        stroke={COLORS.separateMarker}
        strokeWidth={1.25}
        strokeDasharray="1 4"
        strokeLinecap="round"
      />
      <rect
        x={x - size / 2 - 1}
        y={midY - size / 2 - 1}
        width={size + 2}
        height={size + 2}
        fill="white"
      />
      <Icon
        x={x - size / 2}
        y={midY - size / 2}
        width={size}
        height={size}
        color={COLORS.separateMarker}
        strokeWidth={2}
        aria-hidden
      />
    </g>
  )
}

function isRibbonHighlighted(ribbon: SceneRibbon, highlightedSlotId?: string | null): boolean {
  if (highlightedSlotId == null || highlightedSlotId === '') return false
  if (ribbon.slotId === highlightedSlotId) return true
  return ribbon.bandSlices.some((s) => s.slotId === highlightedSlotId)
}

function CorridorRibbon({
  ribbon,
  highlightedSlotId,
}: {
  ribbon: SceneRibbon
  highlightedSlotId?: string | null
}): ReactElement {
  const hasHighlight = highlightedSlotId != null && highlightedSlotId !== ''
  const isHighlighted = isRibbonHighlighted(ribbon, highlightedSlotId)
  const isSiblingDimmed = hasHighlight && !isHighlighted
  const isSibling = ribbon.label === 'sibling'
  const isTagged = ribbon.widthProvenance === 'tagged'
  const isInferred = ribbon.widthProvenance === 'inferred'
  const fill = isSibling ? COLORS.sibling : kindFill(ribbon.kind, isTagged || isInferred)
  const opacity = isSibling
    ? ribbon.dimmed || isSiblingDimmed
      ? 0.7
      : 1
    : ribbon.dimmed || isSiblingDimmed
      ? 0.4
      : 1

  return (
    <g opacity={opacity} pointerEvents="none">
      <polygon
        points={pointsAttr(ribbon.points)}
        fill={fill}
        stroke={isHighlighted ? COLORS.highlightStroke : 'none'}
        strokeWidth={isHighlighted ? 2.5 : 0}
        shapeRendering="geometricPrecision"
      />
    </g>
  )
}

function SlotRect({
  rect,
  highlightedSlotId,
  metersToPx,
  siblingLabel,
  ribbons,
  ribbonsCoverTravel,
}: {
  rect: SceneSlotRect
  highlightedSlotId?: string | null
  metersToPx: number
  siblingLabel: string
  ribbons: SceneRibbon[]
  ribbonsCoverTravel: boolean
}): ReactElement {
  const hasHighlight = highlightedSlotId != null && highlightedSlotId !== ''
  const isHighlighted = hasHighlight && rect.slotId === highlightedSlotId
  const isSiblingDimmed = hasHighlight && !isHighlighted
  const isMedian = rect.kind === 'median'
  const isSibling = rect.label === 'sibling'
  const isStepFill = rect.label === 'step_fill'
  const isTagged = rect.widthProvenance === 'tagged'
  const isInferred = rect.widthProvenance === 'inferred'
  const isDefaultWidth = rect.widthProvenance === 'default'
  // Metre label on every real band (tagged / inferred / fallback defaults).
  const showWidthLabel = isTagged || isInferred || isDefaultWidth
  const zone: RoadSpaceZone = rect.zone
  const skipTravelFill =
    ribbonsCoverTravel &&
    !isMedian &&
    !isStepFill &&
    rect.kind !== 'median' &&
    (!isSibling ||
      ribbons.some(
        (r) =>
          r.label === 'sibling' &&
          (r.slotId === rect.slotId || r.bandSlices.some((s) => s.slotId === rect.slotId)),
      ))
  const fill = isMedian
    ? 'none'
    : isSibling
      ? COLORS.sibling
      : skipTravelFill
        ? 'none'
        : kindFill(rect.kind, isTagged || isInferred)
  // Per-band overlays use this rect's centre — not the ribbon's single glyph
  // anchor (that collapsed prev/next labels onto the current band).
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const glyphSize = Math.min(rect.width, rect.height) * 0.42
  const fillOpacity = isMedian
    ? 1
    : isSibling
      ? rect.dimmed || isSiblingDimmed
        ? 0.7
        : 1
      : rect.dimmed || isSiblingDimmed
        ? 0.4
        : 1
  const widthM = metersToPx > 0 ? rect.width / metersToPx : undefined
  const inset = 2
  const hasLaneGlyph =
    !isMedian &&
    !isSibling &&
    !isStepFill &&
    (rect.kind === 'motor' ||
      rect.kind === 'bus' ||
      rect.kind === 'cycle' ||
      rect.kind === 'both_ways')
  const widthLabelColor = isTagged
    ? COLORS.widthLabel
    : isInferred
      ? COLORS.calculatedWidthLabel
      : COLORS.defaultWidthLabel
  const glyphNudge =
    showWidthLabel && widthM != null && rect.width >= 18 && rect.height >= 14 ? 4 : 0

  return (
    <g pointerEvents="none">
      <g opacity={fillOpacity}>
        {!skipTravelFill && (
          <>
            {isMedian ? (
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill={medianFill(rect.medianHint)}
              />
            ) : rect.points && rect.points.length >= 3 ? (
              <polygon
                points={pointsAttr(rect.points)}
                fill={fill}
                stroke={isHighlighted ? COLORS.highlightStroke : 'none'}
                strokeWidth={isHighlighted ? 2.5 : 0}
                shapeRendering="geometricPrecision"
              />
            ) : (
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill={fill}
                stroke={isHighlighted ? COLORS.highlightStroke : 'none'}
                strokeWidth={isHighlighted ? 2.5 : 0}
                opacity={zone === 'sidepath' && (isTagged || isInferred) ? 0.95 : 1}
                shapeRendering="geometricPrecision"
              />
            )}
          </>
        )}
        {/* Fallback width: dotted edges — still needs an explicit tag. */}
        {isDefaultWidth &&
        !isMedian &&
        !isSibling &&
        !isStepFill &&
        rect.width > inset * 2 &&
        rect.height > inset * 2 ? (
          <g
            fill="none"
            stroke={COLORS.untaggedEdge}
            strokeWidth={1}
            strokeDasharray="1.25 2.25"
            opacity={0.85}
          >
            <line
              x1={rect.x + inset}
              y1={rect.y + inset}
              x2={rect.x + inset}
              y2={rect.y + rect.height - inset}
            />
            <line
              x1={rect.x + rect.width - inset}
              y1={rect.y + inset}
              x2={rect.x + rect.width - inset}
              y2={rect.y + rect.height - inset}
            />
          </g>
        ) : null}
      </g>
      {isSibling ? (
        <SiblingPlaceholderLabel rect={rect} siblingLabel={siblingLabel} cx={cx} cy={cy} />
      ) : null}
      {isMedian ? <MedianMark rect={rect} cx={cx} cy={cy} /> : null}
      {showWidthLabel &&
      !isMedian &&
      !isSibling &&
      !isStepFill &&
      widthM != null &&
      rect.width >= 18 &&
      rect.height >= 14 ? (
        <text
          x={cx}
          y={cy + (hasLaneGlyph ? glyphSize * 0.55 + (rect.turn ? 4 : 0) : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.min(10, Math.max(7, rect.width * 0.22))}
          fill={widthLabelColor}
          opacity={isTagged ? 0.8 : 0.9}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {formatWidthLabel(widthM)}
        </text>
      ) : null}
      {hasLaneGlyph && rect.turn ? (
        turnGlyphPaths(rect.turn, rect.direction, cx, cy - glyphNudge, Math.max(10, glyphSize))
      ) : hasLaneGlyph ? (
        <DirectionHint
          direction={rect.direction}
          cx={cx}
          cy={cy - glyphNudge}
          size={Math.max(8, glyphSize * 0.85)}
        />
      ) : null}
    </g>
  )
}

const PLACEMENT_DELTA_WARN_M = 0.35

function DebugOverlay({ scene }: { scene: RoadSpaceScene }): ReactElement | null {
  const debug = scene.debug
  if (!debug) return null

  return (
    <g pointerEvents="none" aria-hidden data-overlay="lane-debug">
      {debug.correspondenceLinks.map((link, i) => (
        <line
          key={`corr-${link.segmentPairIndex}-${link.indexA}-${link.indexB}-${i}`}
          x1={link.xAbove}
          y1={link.yAbove}
          x2={link.xBelow}
          y2={link.yBelow}
          stroke={COLORS.debugLink}
          strokeWidth={1}
          strokeDasharray="3 2"
          opacity={0.75}
        />
      ))}

      {debug.bandOffsets.map((offset) => {
        const band = scene.bands[offset.bandIndex]
        if (!band) return null
        const midY = band.y + band.height / 2
        const labelX = 4
        const provenanceColor =
          offset.provenance === 'anchor' ? COLORS.debugAnchor : COLORS.debugChained
        const hasPlacementWarn =
          offset.placementDeltaM != null &&
          Math.abs(offset.placementDeltaM) > PLACEMENT_DELTA_WARN_M

        return (
          <g key={`offset-${offset.bandIndex}`}>
            <line
              x1={offset.stackLeftX}
              y1={band.y + 2}
              x2={offset.stackLeftX}
              y2={band.y + band.height - 2}
              stroke={provenanceColor}
              strokeWidth={1.5}
              opacity={0.85}
            />
            <DebugLabel x={labelX} y={midY - 3} fontSize={9} fill={provenanceColor}>
              {`${offset.provenance === 'anchor' ? '⚓' : '⇢'} ${offset.stackLeftM.toFixed(2)} m`}
            </DebugLabel>
            <DebugLabel x={labelX} y={midY + 9} fontSize={8} fill={provenanceColor} opacity={0.85}>
              {`way ${offset.wayId} · ${offset.role}`}
            </DebugLabel>
            {hasPlacementWarn && offset.taggedStackLeftX != null ? (
              <>
                <line
                  x1={offset.taggedStackLeftX}
                  y1={midY - 6}
                  x2={offset.stackLeftX}
                  y2={midY - 6}
                  stroke={COLORS.debugPlacementDelta}
                  strokeWidth={1.25}
                  strokeDasharray="2 2"
                  opacity={0.9}
                />
                <DebugLabel
                  x={Math.min(offset.taggedStackLeftX, offset.stackLeftX) + 2}
                  y={midY - 8}
                  fontSize={8}
                  fill={COLORS.debugPlacementDelta}
                >
                  {`Δ${offset.placementDeltaM!.toFixed(2)} m`}
                </DebugLabel>
              </>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}

/**
 * Render-only plan-sketch diagram. No hit-testing, no focusable children,
 * no stores — callers drive `highlightedSlotId` from the form.
 *
 * Sized at the scene’s natural pixel size (`widthPx`×`heightPx`); CSS may shrink
 * with `max-width: 100%` but must not stretch beyond 1:1 (shared metre scale).
 */
export function RoadSpaceDiagram({
  scene,
  ariaLabel,
  highlightedSlotId,
  className,
  siblingLabel = 'Opposite carriageway',
  junctionLabel = 'junction',
  debug = false,
}: {
  scene: RoadSpaceScene
  ariaLabel: string
  highlightedSlotId?: string | null
  className?: string
  /** Label drawn inside `label: 'sibling'` placeholder rects. */
  siblingLabel?: string
  /** Centred label on implied-junction placeholder bands. */
  junctionLabel?: string
  /** Audit overlay: correspondence links, solved offsets, placement deltas. */
  debug?: boolean
}): ReactElement {
  const ribbons = scene.ribbons ?? []
  const ribbonsCoverTravel = ribbons.length > 0
  const plates = scene.carriagewayPlates ?? (scene.carriagewayPlate ? [scene.carriagewayPlate] : [])

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      className={className}
      width={scene.widthPx}
      height={scene.heightPx}
      viewBox={`0 0 ${scene.widthPx} ${scene.heightPx}`}
      preserveAspectRatio="xMidYMin meet"
      style={{
        pointerEvents: 'none',
        width: scene.widthPx,
        maxWidth: '100%',
        height: 'auto',
        display: 'block',
        marginInline: 'auto',
      }}
    >
      {plates.map((plate, i) => (
        <polygon
          key={`plate-${i}`}
          points={pointsAttr(plate.points)}
          fill={COLORS.carriagewayPlate}
          opacity={0.5}
          pointerEvents="none"
          shapeRendering="geometricPrecision"
        />
      ))}

      {(scene.junctions ?? []).map((junction, i) => (
        <g key={`junction-${i}`} pointerEvents="none">
          <rect
            x={0}
            y={junction.y}
            width={scene.widthPx}
            height={junction.height}
            fill={COLORS.carriagewayPlate}
            opacity={0.6}
          />
          <line
            x1={0}
            y1={junction.y}
            x2={scene.widthPx}
            y2={junction.y}
            stroke={COLORS.segment_boundary}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <line
            x1={0}
            y1={junction.y + junction.height}
            x2={scene.widthPx}
            y2={junction.y + junction.height}
            stroke={COLORS.segment_boundary}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text
            x={scene.widthPx / 2}
            y={junction.y + junction.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fill={COLORS.siblingLabel}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {junctionLabel}
          </text>
        </g>
      ))}

      {scene.polylines
        .filter((line) => line.kind === 'segment_boundary')
        .map((line) => (
          <polyline
            key={line.id}
            fill="none"
            stroke={polylineStroke(line)}
            strokeWidth={polylineStrokeWidth(line)}
            points={pointsAttr(line.points)}
          />
        ))}

      {ribbons.map((ribbon) => (
        <CorridorRibbon key={ribbon.id} ribbon={ribbon} highlightedSlotId={highlightedSlotId} />
      ))}

      {(scene.medianOpenings ?? []).map((opening, i) => (
        <polygon
          key={`median-opening-${i}`}
          points={pointsAttr(opening.points)}
          fill={medianFill(opening.medianHint)}
          pointerEvents="none"
        />
      ))}

      {scene.slotRects.map((rect) => (
        <SlotRect
          key={`${rect.role}-${rect.slotId}`}
          rect={rect}
          highlightedSlotId={highlightedSlotId}
          metersToPx={scene.metersToPx}
          siblingLabel={siblingLabel}
          ribbons={ribbons}
          ribbonsCoverTravel={ribbonsCoverTravel}
        />
      ))}

      {/* Wide placement guide under lane markings so dashes/centrelines stay readable. */}
      {scene.polylines
        .filter((line) => line.kind === 'placement_guide')
        .map((line) => (
          <polyline
            key={`${line.id}-band`}
            fill="none"
            stroke={COLORS.placement_guide}
            strokeWidth={10}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.28}
            pointerEvents="none"
            points={pointsAttr(line.points)}
          />
        ))}

      {/* Secondary guide over the opposite dual carriageway (narrower / dimmer). */}
      {scene.polylines
        .filter((line) => line.kind === 'sibling_placement_guide')
        .map((line) => (
          <polyline
            key={`${line.id}-band`}
            fill="none"
            stroke={COLORS.placement_guide}
            strokeWidth={6}
            strokeLinecap="round"
            opacity={0.2}
            pointerEvents="none"
            points={pointsAttr(line.points)}
          />
        ))}

      {scene.polylines
        .filter(
          (line) =>
            line.kind !== 'segment_boundary' &&
            line.kind !== 'placement_guide' &&
            line.kind !== 'sibling_placement_guide',
        )
        .map((line) => (
          <polyline
            key={line.id}
            fill="none"
            stroke={polylineStroke(line)}
            strokeWidth={polylineStrokeWidth(line)}
            strokeDasharray={line.style === 'dashed' ? '4 3' : undefined}
            strokeLinecap={line.kind === 'kerb' || line.kind === 'outer_edge' ? 'round' : undefined}
            strokeLinejoin={
              line.kind === 'kerb' || line.kind === 'outer_edge' ? 'round' : undefined
            }
            points={pointsAttr(line.points)}
          />
        ))}

      {scene.bands.flatMap((band) =>
        (band.separatelyMapped ?? []).map((hint) => (
          <SeparatelyMappedMarker
            key={`separate-${band.wayId}-${band.role}-${hint.prefix}-${hint.side}`}
            hint={hint}
            band={band}
          />
        )),
      )}

      {/* Way-direction cue + side labels above markings. */}
      {scene.polylines
        .filter((line) => line.kind === 'placement_guide')
        .map((line) => {
          // Arrow on the current band (the line can bend between bands); label at the top.
          const topX = line.points[0]?.x ?? scene.centrelineX ?? 0
          const x = scene.centrelineX ?? topX
          const y0 = Math.min(...line.points.map((p) => p.y))
          const y1 = Math.max(...line.points.map((p) => p.y))
          const currentBand = scene.bands.find((b) => b.role === 'current' && !b.synthetic)
          const midY = currentBand ? currentBand.y + currentBand.height / 2 : (y0 + y1) / 2
          const head = 7
          const travelRects = scene.slotRects.filter(
            (r) => r.label !== 'step_fill' && r.kind !== 'median' && !r.dimmed,
          )
          const leftEdge =
            travelRects.length > 0
              ? Math.min(...travelRects.map((r) => r.x))
              : Math.max(8, topX - 40)
          const rightEdge =
            travelRects.length > 0
              ? Math.max(...travelRects.map((r) => r.x + r.width))
              : Math.min(scene.widthPx - 8, topX + 40)
          return (
            <g key={line.id} pointerEvents="none">
              {/* Way direction = up the page (OSM forward). */}
              <polyline
                fill="none"
                stroke={COLORS.placement_guide}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.55}
                points={`${x - head},${midY + head * 0.2} ${x},${midY - head} ${x + head},${midY + head * 0.2}`}
              />
              {/* Not on narrow roads: the label would run into *:right. */}
              {rightEdge - topX > 75 ? (
                <text
                  x={topX + 8}
                  y={y0 + 12}
                  fontSize={9}
                  fill={COLORS.placement_guide}
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fontWeight={600}
                  opacity={0.75}
                >
                  way ↑
                </text>
              ) : null}
              <text
                x={leftEdge + 4}
                y={y0 + 12}
                fontSize={9}
                fill="#1e40af"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight={700}
                opacity={0.9}
              >
                *:left
              </text>
              <text
                x={rightEdge - 4}
                y={y0 + 12}
                textAnchor="end"
                fontSize={9}
                fill="#9a3412"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight={700}
                opacity={0.9}
              >
                *:right
              </text>
            </g>
          )
        })}

      {/* Sibling-way direction cue on the secondary violet guide. */}
      {scene.polylines
        .filter((line) => line.kind === 'sibling_placement_guide')
        .map((line) => {
          const ys = line.points.map((p) => p.y)
          const xs = line.points.map((p) => p.x)
          const x = xs.reduce((a, b) => a + b, 0) / xs.length
          const y0 = Math.min(...ys)
          const y1 = Math.max(...ys)
          const midY = (y0 + y1) / 2
          const head = 5
          const arrowPoints =
            line.forward === 'down'
              ? `${x - head},${midY - head * 0.2} ${x},${midY + head} ${x + head},${midY - head * 0.2}`
              : line.forward === 'up'
                ? `${x - head},${midY + head * 0.2} ${x},${midY - head} ${x + head},${midY + head * 0.2}`
                : null
          // Names the dimmed lanes: they belong to the other OSM way of this street.
          const label = `${siblingLabel}${line.forward === 'down' ? ' ↓' : line.forward === 'up' ? ' ↑' : ''}`
          return (
            <g key={`${line.id}-cue`} pointerEvents="none">
              {arrowPoints ? (
                <polyline
                  fill="none"
                  stroke={COLORS.placement_guide}
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.4}
                  points={arrowPoints}
                />
              ) : null}
              {label ? (
                <text
                  x={x}
                  y={y0 + 24}
                  textAnchor="middle"
                  fontSize={7.5}
                  fill={COLORS.placement_guide}
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fontWeight={600}
                  opacity={0.8}
                >
                  {label}
                </text>
              ) : null}
            </g>
          )
        })}

      {debug ? <DebugOverlay scene={scene} /> : null}
    </svg>
  )
}

/** Swatch colours for legend UIs (editor + audit). */
export const ROAD_SPACE_KIND_SWATCH: Record<RoadSpaceSlotKind, string> = {
  motor: COLORS.motor,
  bus: COLORS.bus,
  cycle: COLORS.cycle,
  both_ways: COLORS.both_ways,
  sidewalk: COLORS.sidewalk,
  shared_path: COLORS.shared_path,
}

export const ROAD_SPACE_MEDIAN_SWATCH = COLORS.medianIcon
export const ROAD_SPACE_CROSSING_SWATCH = COLORS.crossingIcon
export const ROAD_SPACE_SIBLING_SWATCH = COLORS.sibling
/** Diagram + legend + form colour for calculated (untagged) metre labels. */
export const ROAD_SPACE_CALCULATED_WIDTH_COLOR = COLORS.calculatedWidthLabel
export const ROAD_SPACE_TAGGED_WIDTH_COLOR = COLORS.widthLabel

export function formatRoadSpaceWidthLabel(widthM: number): string {
  return formatWidthLabel(widthM)
}
/** Tiny grass tuft for legend rows (matches median verge icon). */
export function RoadSpaceMedianVergeLegendIcon({
  className,
}: {
  className?: string
}): ReactElement {
  return (
    <svg className={className} width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <path
        d="M5 9 L2.2 2 M5 9 L5 1.2 M5 9 L7.8 2"
        fill="none"
        stroke={COLORS.medianIcon}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Tiny zebra bars for legend rows (matches median crossing icon). */
export function RoadSpaceMedianCrossingLegendIcon({
  className,
}: {
  className?: string
}): ReactElement {
  return (
    <svg className={className} width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      {[1.5, 3.5, 5.5, 7.5].map((y) => (
        <rect key={y} x="1.5" y={y} width="7" height="1.2" rx="0.3" fill={COLORS.crossingIcon} />
      ))}
    </svg>
  )
}

/** English notes for `/audit-lanes` (no paraglide). Dedupes across chain segments. */
export function separatelyMappedNotesEn(hints: SeparatelyMappedSidepath[] | undefined): string[] {
  if (!hints || hints.length === 0) return []
  const seen = new Set<string>()
  const notes: string[] = []
  for (const h of hints) {
    const key = `${h.prefix}:${h.side}`
    if (seen.has(key)) continue
    seen.add(key)
    const side = h.side === 'left' ? 'Left' : 'Right'
    const feature = h.prefix === 'sidewalk' ? 'sidewalk' : 'cycleway'
    notes.push(`${side} ${feature} is mapped as its own way`)
  }
  return notes
}
