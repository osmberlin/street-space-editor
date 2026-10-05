import * as m from '@app/paraglide/messages'
import type { RoadSpaceScene, RoadSpaceSegmentRole } from '@osm-editor-kit/osm-lane-diagram'
import { laneDiagramFixtures, type DiagramFixture } from '@osm-editor-kit/osm-lane-diagram/fixtures'
import { Link, Outlet, useMatch } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, type ReactElement, type ReactNode } from 'react'
import { APP_REPO_URL } from '../../../lib/app-identity'
import {
  RoadSpaceDiagram,
  RoadSpaceMedianCrossingLegendIcon,
  RoadSpaceMedianVergeLegendIcon,
  ROAD_SPACE_KIND_SWATCH,
  ROAD_SPACE_SIBLING_SWATCH,
  separatelyMappedNotesEn,
} from '../components/RoadSpaceDiagram'
import { adjacentDemos, AUDIT_NAV_GROUPS, demoTitle, type AuditDemoId } from './audit-demos'
import {
  formatTagLines,
  parseTagLines,
  sceneFromSegmentTags,
  type SegmentTagsInput,
} from './build-scene'

const ROLE_ORDER: readonly RoadSpaceSegmentRole[] = ['prev', 'current', 'next']

const ROLE_LABEL: Record<RoadSpaceSegmentRole, string> = {
  prev: 'Previous',
  current: 'Current',
  next: 'Next',
}

const DEFAULT_SANDBOX_CURRENT = `highway=residential
lanes=2
sidewalk=both`

const LANE_RENDERING_RESEARCH_URL = `${APP_REPO_URL}/blob/main/research/lane-rendering/README.md`
const WIDTH_MEASUREMENTS_RESEARCH_URL = `${APP_REPO_URL}/blob/main/research/width-measurements/README.md`
const CYCLEWAY_ONEWAY_RESEARCH_URL = `${APP_REPO_URL}/blob/main/research/lane-editor-tags/tags/cycleway-oneway.md`

function fixtureById(id: string): DiagramFixture {
  const fixture = laneDiagramFixtures.find((f) => f.id === id)
  if (!fixture) throw new Error(`Missing lane diagram fixture: ${id}`)
  return fixture
}

function sceneForFixture(fixture: DiagramFixture): RoadSpaceScene {
  return sceneFromSegmentTags(fixture.segments)
}

function ariaLabelForFixture(fixture: DiagramFixture): string {
  const roles = fixture.segments.map((s) => s.role).join(', ')
  return `${fixture.title}: plan sketch for ${roles || 'current'} segment(s)`
}

type TagSideHint =
  | 'left'
  | 'right'
  | 'both'
  /** Bidirectional: forward lanes sit on the diagram-right half. */
  | 'forward'
  /** Bidirectional: backward lanes sit on the diagram-left half. */
  | 'backward'
  /** oneway=yes: forward spans the full carriageway. */
  | 'forward_oneway'
  | null

/**
 * Side (`:left`/`:right`/`:both`) wins over direction (`:forward`/`:backward`) so
 * keys like `cycleway:right:oneway` stay R.
 */
function tagSideHint(key: string, tags: Record<string, string>): TagSideHint {
  if (/(^|:)both(:|$)/.test(key) || key === 'both') return 'both'
  if (/(^|:)left(:|$)/.test(key)) return 'left'
  if (/(^|:)right(:|$)/.test(key)) return 'right'
  if (/(^|:)forward$/.test(key)) {
    return tags.oneway?.toLowerCase() === 'yes' ? 'forward_oneway' : 'forward'
  }
  if (/(^|:)backward$/.test(key)) return 'backward'
  return null
}

/**
 * Geometry key (“Gitternetz”): OSM way as a vertical centreline with forward ↑,
 * so *:left / *:right in the tag lists match diagram-left / diagram-right.
 */
function WayOrientationSchematic({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}): ReactElement {
  const w = compact ? 88 : 140
  const h = compact ? 72 : 96
  const cx = w / 2
  const top = compact ? 10 : 14
  const bot = h - (compact ? 10 : 14)
  const mid = (top + bot) / 2
  return (
    <svg
      className={className}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="OSM way points up; diagram left is asterisk-left, diagram right is asterisk-right"
    >
      <rect x={0.5} y={0.5} width={w - 1} height={h - 1} fill="#fafafa" stroke="#e4e4e7" />
      {/* Side gutters */}
      <rect
        x={4}
        y={top}
        width={compact ? 18 : 28}
        height={bot - top}
        fill="#dbeafe"
        opacity={0.55}
      />
      <rect
        x={w - (compact ? 22 : 32)}
        y={top}
        width={compact ? 18 : 28}
        height={bot - top}
        fill="#ffedd5"
        opacity={0.7}
      />
      {/* Way centreline + forward arrow (↑) */}
      <line x1={cx} y1={top} x2={cx} y2={bot} stroke="#7c3aed" strokeWidth={2.5} />
      <polyline
        fill="none"
        stroke="#7c3aed"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={`${cx - 5},${top + 10} ${cx},${top} ${cx + 5},${top + 10}`}
      />
      <text
        x={cx}
        y={mid - 6}
        textAnchor="middle"
        className="fill-violet-700"
        style={{ fontSize: compact ? 7 : 8, fontWeight: 600 }}
      >
        way ↑
      </text>
      <text
        x={compact ? 13 : 18}
        y={mid + 3}
        textAnchor="middle"
        className="fill-blue-800"
        style={{ fontSize: compact ? 8 : 9, fontWeight: 700 }}
      >
        L
      </text>
      <text
        x={w - (compact ? 13 : 18)}
        y={mid + 3}
        textAnchor="middle"
        className="fill-orange-800"
        style={{ fontSize: compact ? 8 : 9, fontWeight: 700 }}
      >
        R
      </text>
      {!compact ? (
        <>
          <text
            x={18}
            y={h - 4}
            textAnchor="middle"
            className="fill-zinc-500"
            style={{ fontSize: 7 }}
          >
            *:left
          </text>
          <text
            x={w - 18}
            y={h - 4}
            textAnchor="middle"
            className="fill-zinc-500"
            style={{ fontSize: 7 }}
          >
            *:right
          </text>
        </>
      ) : null}
    </svg>
  )
}

function TagSideBadge({ side }: { side: TagSideHint }): ReactElement | null {
  if (!side) return null
  const styles =
    side === 'left' || side === 'backward'
      ? 'bg-blue-100 text-blue-900'
      : side === 'right' || side === 'forward'
        ? 'bg-orange-100 text-orange-900'
        : side === 'forward_oneway'
          ? 'bg-violet-100 text-violet-900'
          : 'bg-zinc-200 text-zinc-800'
  const label =
    side === 'left'
      ? 'L'
      : side === 'right'
        ? 'R'
        : side === 'both'
          ? 'both'
          : side === 'forward'
            ? 'R ↑'
            : side === 'backward'
              ? 'L ↓'
              : '↑'
  const title =
    side === 'left'
      ? '*:left — diagram left (looking along way ↑)'
      : side === 'right'
        ? '*:right — diagram right (looking along way ↑)'
        : side === 'both'
          ? '*:both — applies to left and right'
          : side === 'forward'
            ? '*:forward — forward lanes, right half of the diagram (way points ↑)'
            : side === 'backward'
              ? '*:backward — backward lanes, left half of the diagram (way points ↑)'
              : '*:forward — oneway, spans full width'
  return (
    <span
      className={`mr-1 inline-flex min-w-7 justify-center rounded-sm px-1 text-[0.65rem] font-semibold tracking-wide ${side === 'left' || side === 'right' || side === 'both' ? 'uppercase' : ''} ${styles}`}
      title={title}
    >
      {label}
    </span>
  )
}

function TagList({ tags }: { tags: Record<string, string> }): ReactElement {
  const entries = Object.entries(tags).sort(([a], [b]) => {
    const sideRank = (k: string) => {
      const s = tagSideHint(k, tags)
      if (s === 'left' || s === 'backward') return 0
      if (s === 'both') return 1
      if (s === 'right' || s === 'forward' || s === 'forward_oneway') return 2
      return 3
    }
    const d = sideRank(a) - sideRank(b)
    return d !== 0 ? d : a.localeCompare(b)
  })
  if (entries.length === 0) {
    return <p className="m-0 text-xs text-zinc-500">(no tags)</p>
  }
  return (
    <ul className="m-0 list-none space-y-0.5 pl-0 font-mono text-xs leading-relaxed text-zinc-800">
      {entries.map(([key, value]) => (
        <li key={key} className="flex items-baseline gap-0.5">
          <TagSideBadge side={tagSideHint(key, tags)} />
          <span>
            {key}={value}
          </span>
        </li>
      ))}
    </ul>
  )
}

function SegmentTags({ fixture }: { fixture: DiagramFixture }): ReactElement {
  const byRole = new Map(fixture.segments.map((s) => [s.role, s] as const))
  const hasSibling = fixture.segments.some((s) => s.dualSibling != null)
  return (
    <section aria-labelledby="segment-tags-heading" className="mt-2">
      <div className="mb-3 flex flex-wrap items-start gap-4 rounded-sm border border-zinc-200 bg-zinc-50/80 px-3 py-2.5">
        <WayOrientationSchematic />
        <div className="min-w-0 flex-1">
          <h3
            id="segment-tags-heading"
            className="m-0 text-sm font-semibold tracking-wide text-zinc-500 uppercase"
          >
            Tag lists ↔ geometry
          </h3>
          <p className="mt-1 mb-0 max-w-2xl text-sm leading-relaxed text-zinc-600">
            OSM <code className="font-mono text-[0.9em]">*:left</code> /{' '}
            <code className="font-mono text-[0.9em]">*:right</code> are relative to the way&apos;s
            forward direction. The way points up the page (violet{' '}
            <strong className="font-semibold text-zinc-800">↑</strong>); facing up, your left hand
            is on the diagram&apos;s left — so{' '}
            <span className="font-semibold text-blue-800">L / *:left</span> is diagram-left and{' '}
            <span className="font-semibold text-orange-800">R / *:right</span> is diagram-right.
            This is a plan view, like a map rotated so the way points up. Driving side (Germany vs
            UK) doesn&apos;t change these tags. Badges on tag lines mark sided keys.
          </p>
        </div>
      </div>
      <div
        className={`grid gap-4 ${hasSibling ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-3'}`}
      >
        {ROLE_ORDER.map((role) => {
          const seg = byRole.get(role)
          return (
            <div key={role} className="min-w-0 rounded-sm border border-zinc-100 bg-white p-2">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="m-0 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                  {ROLE_LABEL[role]}
                  {seg ? ` · way ${seg.wayId}` : ''}
                </p>
                {seg ? <WayOrientationSchematic compact className="shrink-0" /> : null}
              </div>
              {seg ? <TagList tags={seg.tags} /> : <p className="m-0 text-xs text-zinc-400">—</p>}
              {seg?.dualSibling ? (
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <p className="m-0 mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    Opposite · way {seg.dualSibling.wayId}
                  </p>
                  <TagList tags={seg.dualSibling.tags} />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Legend(): ReactElement {
  const swatches: { label: string; color: string }[] = [
    { label: 'Motor (carriageway)', color: ROAD_SPACE_KIND_SWATCH.motor },
    { label: 'Bus', color: ROAD_SPACE_KIND_SWATCH.bus },
    { label: 'Cycle', color: ROAD_SPACE_KIND_SWATCH.cycle },
    { label: 'Both-ways', color: ROAD_SPACE_KIND_SWATCH.both_ways },
    { label: 'Sidewalk', color: ROAD_SPACE_KIND_SWATCH.sidewalk },
    { label: 'Shared path', color: ROAD_SPACE_KIND_SWATCH.shared_path },
    { label: 'Opposite carriageway', color: ROAD_SPACE_SIBLING_SWATCH },
  ]
  return (
    <section aria-labelledby="legend-heading" className="mt-8 border-t border-zinc-200 pt-6">
      <h2
        id="legend-heading"
        className="m-0 mb-3 text-sm font-semibold tracking-wide text-zinc-500 uppercase"
      >
        Legend
      </h2>
      <p className="mt-0 mb-3 max-w-3xl text-sm leading-relaxed text-zinc-600">
        ↑ = OSM way direction points <strong className="font-semibold text-zinc-800">up</strong> the
        page, so diagram-left = <code className="font-mono text-[0.9em]">*:left</code> and
        diagram-right = <code className="font-mono text-[0.9em]">*:right</code>. Forward travel
        draws ↑; backward draws ↓; both-ways is a double-headed vertical glyph. Bands stack next →
        current → prev top to bottom — ahead is up the page.
      </p>
      <ul className="m-0 mb-3 flex list-none flex-wrap gap-3 pl-0 text-sm text-zinc-700">
        {swatches.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className="inline-block size-3.5 rounded-sm border border-zinc-300"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            {s.label}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <RoadSpaceMedianVergeLegendIcon className="size-3.5 shrink-0" />
          Grass verge / median
        </li>
        <li className="flex items-center gap-2">
          <RoadSpaceMedianCrossingLegendIcon className="size-3.5 shrink-0" />
          Crossing island
        </li>
      </ul>
      <ul className="m-0 list-disc space-y-1 pl-5 text-sm leading-relaxed text-zinc-600">
        <li>
          Where turn pockets end, the seam is an implied junction — drawn as a full-width
          cross-street band instead of a lane morph.
        </li>
        <li>Previous / next bands are dimmed relative to the current segment.</li>
        <li>
          On dual carriageways the opposite branch’s real lanes render dimmed — they belong to a
          different OSM way. That way’s centreline is the thinner secondary violet guide (with its
          own way ↑/↓ when orientation is known).
        </li>
        <li>
          Explicit widths (<code className="font-mono text-[0.9em]">width:lanes</code>,{' '}
          <code className="font-mono text-[0.9em]">*:width</code>) show a dark metre label. When
          only <code className="font-mono text-[0.9em]">width=*</code> is present, lane metres are
          derived and shown in <strong className="text-violet-700">purple</strong>. Fallback
          defaults show a muted metre label plus dotted edges so it is clear values still need
          tagging. Direction / turn arrows and width labels repeat on every segment band.
        </li>
        <li>
          Kerbs are heavy strokes between sidewalk and carriageway; outer sidepath edges are
          lighter; dashed hairlines mark segment boundaries and unmarked separators. Dual
          carriageways leave the median as empty space with a grass (verge) or zebra (crossing)
          icon; the opposite dual branch uses real lane slots when resolved (else a grey “Opposite
          carriageway” placeholder). Turn pockets that grow into the median taper with an angled
          kerb from the dual travel hinge.
        </li>
        <li>
          <code className="font-mono text-[0.9em]">sidewalk:*=separate</code> /{' '}
          <code className="font-mono text-[0.9em]">cycleway:*=separate</code> do not draw slots —
          they appear as a short note under the diagram.{' '}
          <code className="font-mono text-[0.9em]">no</code> /{' '}
          <code className="font-mono text-[0.9em]">none</code> produce no geometry at all.
        </li>
        <li>
          Arrows hint travel direction (forward = up); turn glyphs come from{' '}
          <code className="font-mono text-[0.9em]">turn:lanes</code>.
        </li>
        <li>
          Diagrams render at their natural pixel size (scene widthPx × heightPx) and shrink with{' '}
          <code className="font-mono text-[0.9em]">max-width: 100%</code> — they never stretch
          beyond 1:1.
        </li>
      </ul>
    </section>
  )
}

function SandboxSection(): ReactElement {
  const [prevText, setPrevText] = useState('')
  const [currentText, setCurrentText] = useState(DEFAULT_SANDBOX_CURRENT)
  const [nextText, setNextText] = useState('')
  const [showDebug, setShowDebug] = useState(false)

  const segments: SegmentTagsInput[] = []
  const prevTags = parseTagLines(prevText)
  const currentTags = parseTagLines(currentText)
  const nextTags = parseTagLines(nextText)
  if (Object.keys(prevTags).length > 0) {
    segments.push({ role: 'prev', wayId: 9001, tags: prevTags })
  }
  if (Object.keys(currentTags).length > 0) {
    segments.push({ role: 'current', wayId: 9002, tags: currentTags })
  }
  if (Object.keys(nextTags).length > 0) {
    segments.push({ role: 'next', wayId: 9003, tags: nextTags })
  }

  let scene: RoadSpaceScene | null = null
  let error: string | null = null
  if (segments.length === 0) {
    error = 'Enter at least one key=value line for the current segment.'
  } else {
    try {
      scene = sceneFromSegmentTags(segments)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }

  const separateNotes = separatelyMappedNotesEn(scene?.separatelyMapped)

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 max-w-3xl text-sm leading-relaxed text-zinc-600">
        Type raw <code className="font-mono text-[0.9em]">key=value</code> lines for prev / current
        / next. Tags are assumed already oriented to the current way direction. The diagram stacks
        next (ahead) at the top, then current, then prev — matching way ↑. Open the details block
        for the layout scene JSON.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        {(
          [
            ['prev', prevText, setPrevText, 'Previous (optional)'],
            ['current', currentText, setCurrentText, 'Current'],
            ['next', nextText, setNextText, 'Next (optional)'],
          ] as const
        ).map(([role, value, setValue, label]) => (
          <label key={role} className="flex min-w-0 flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800">{label}</span>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              spellCheck={false}
              rows={10}
              className="resize-y rounded-sm border border-zinc-300 bg-white p-2 font-mono text-xs leading-relaxed text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={
                role === 'current' ? formatTagLines({ highway: 'residential', lanes: '2' }) : ''
              }
            />
          </label>
        ))}
      </div>
      {error ? (
        <p className="m-0 text-sm text-amber-800">{error}</p>
      ) : scene ? (
        <>
          <label className="mb-2 flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={showDebug}
              onChange={(e) => setShowDebug(e.target.checked)}
              className="size-4 rounded border-zinc-300"
            />
            Show correspondence / offset debug overlay
          </label>
          <div className="overflow-x-auto rounded-sm border border-zinc-200 bg-white p-3">
            <RoadSpaceDiagram
              scene={scene}
              ariaLabel="Sandbox plan sketch from edited tags"
              debug={showDebug}
              junctionLabel={m.lanes_junction_label()}
            />
            {separateNotes.length > 0 ? (
              <ul className="mt-2 mb-0 list-none space-y-0.5 pl-0 text-xs leading-snug text-zinc-500">
                {separateNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <details className="rounded-sm border border-zinc-200 bg-zinc-50 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-zinc-800">Scene JSON</summary>
            <pre className="mt-3 mb-0 overflow-x-auto text-xs leading-relaxed text-zinc-700">
              {JSON.stringify(scene, null, 2)}
            </pre>
          </details>
        </>
      ) : null}
    </div>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="m-0 text-xs text-zinc-500">{children}</p>
}

function DemoPrevNext({ demoId }: { demoId: AuditDemoId }): ReactElement {
  const { prev, next } = adjacentDemos(demoId)
  return (
    <div className="flex shrink-0 items-center gap-1">
      {prev ? (
        <Link
          to="/audit-lanes/$demoId"
          params={{ demoId: prev }}
          search={(prevSearch) => prevSearch}
          className="inline-flex items-center gap-0.5 rounded-sm border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
          title={demoTitle(prev)}
        >
          <ChevronLeft className="size-4" aria-hidden />
          Prev
        </Link>
      ) : (
        <span className="inline-flex items-center gap-0.5 rounded-sm border border-zinc-200 px-2 py-1 text-sm text-zinc-300">
          <ChevronLeft className="size-4" aria-hidden />
          Prev
        </span>
      )}
      {next ? (
        <Link
          to="/audit-lanes/$demoId"
          params={{ demoId: next }}
          search={(prevSearch) => prevSearch}
          className="inline-flex items-center gap-0.5 rounded-sm border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
          title={demoTitle(next)}
        >
          Next
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span className="inline-flex items-center gap-0.5 rounded-sm border border-zinc-200 px-2 py-1 text-sm text-zinc-300">
          Next
          <ChevronRight className="size-4" aria-hidden />
        </span>
      )}
    </div>
  )
}

function SideNav({ activeDemoId }: { activeDemoId: AuditDemoId | null }): ReactElement {
  return (
    <nav
      aria-label="Demos"
      className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-3 py-4 text-sm"
    >
      {AUDIT_NAV_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="m-0 mb-1.5 px-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            {group.label}
          </p>
          <ul className="m-0 list-none space-y-0.5 pl-0">
            {group.demos.map((demo) => {
              const active = demo.id === activeDemoId
              return (
                <li key={demo.id}>
                  <Link
                    to="/audit-lanes/$demoId"
                    params={{ demoId: demo.id }}
                    search={(prevSearch) => prevSearch}
                    className={`block rounded-sm px-2 py-1.5 leading-snug ${
                      active
                        ? 'bg-zinc-900 font-medium text-white'
                        : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {demo.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      <div>
        <p className="m-0 mb-1.5 px-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Tools
        </p>
        <ul className="m-0 list-none pl-0">
          <li>
            <Link
              to="/audit-lanes/$demoId"
              params={{ demoId: 'sandbox' }}
              search={(prevSearch) => prevSearch}
              className={`block rounded-sm px-2 py-1.5 leading-snug ${
                activeDemoId === 'sandbox'
                  ? 'bg-zinc-900 font-medium text-white'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
              aria-current={activeDemoId === 'sandbox' ? 'page' : undefined}
            >
              Sandbox
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  )
}

/** Layout shell: left demo nav + outlet for the active demo. */
export function LanesAuditLayout(): ReactElement {
  const demoMatch = useMatch({ from: '/audit-lanes/$demoId', shouldThrow: false })
  const activeDemoId = demoMatch?.params.demoId ?? null

  return (
    <div className="flex h-full min-h-0 bg-zinc-50 text-zinc-900">
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <p className="m-0 text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Street Space Editor · Audit
          </p>
          <h1 className="mt-1 mb-0 text-base font-semibold tracking-tight text-zinc-900">Lanes</h1>
          <div className="mt-2 flex flex-col gap-1 text-xs">
            <Link to="/audit-width" className="text-blue-700 hover:underline">
              Width — measure rules →
            </Link>
            <Link to="/$mode" params={{ mode: 'lanes' }} className="text-blue-700 hover:underline">
              ← Open lanes mode
            </Link>
          </div>
        </div>
        <SideNav activeDemoId={activeDemoId} />
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

/** Single fixture or sandbox demo body (prev/next next to the headline). */
export function LanesAuditDemo({ demoId }: { demoId: AuditDemoId }): ReactElement {
  const [showDebug, setShowDebug] = useState(true)

  if (demoId === 'sandbox') {
    return (
      <article>
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="min-w-0">
            <h2 className="m-0 text-2xl font-semibold tracking-tight text-zinc-900">Sandbox</h2>
            <p className="mt-1 mb-0 text-sm text-zinc-600">
              Live tag editor for plan-sketch experiments.
            </p>
          </div>
          <DemoPrevNext demoId={demoId} />
        </header>
        <SandboxSection />
        <footer className="mt-10 border-t border-zinc-200 pt-4">
          <Note>
            Fixtures live in{' '}
            <code className="font-mono text-[0.9em]">
              @osm-editor-kit/osm-lane-diagram/fixtures
            </code>
            . English only — developer audit page, not mode chrome.
          </Note>
        </footer>
      </article>
    )
  }

  const fixture = fixtureById(demoId)
  const scene = sceneForFixture(fixture)
  const separateNotes = separatelyMappedNotesEn(scene.separatelyMapped)

  return (
    <article>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4">
        <div className="min-w-0">
          <h2 className="m-0 text-2xl font-semibold tracking-tight text-zinc-900">
            {fixture.title}
          </h2>
          <p className="mt-1 mb-0 text-sm text-zinc-600">{fixture.description}</p>
        </div>
        <DemoPrevNext demoId={demoId} />
      </header>

      <label className="mb-2 flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={showDebug}
          onChange={(e) => setShowDebug(e.target.checked)}
          className="size-4 rounded border-zinc-300"
        />
        Show correspondence / offset debug overlay
      </label>

      <div className="mb-4 overflow-x-auto rounded-sm border border-zinc-200 bg-white p-3">
        <RoadSpaceDiagram
          scene={scene}
          ariaLabel={ariaLabelForFixture(fixture)}
          debug={showDebug}
          junctionLabel={m.lanes_junction_label()}
        />
        {separateNotes.length > 0 ? (
          <ul className="mt-2 mb-0 list-none space-y-0.5 pl-0 text-xs leading-snug text-zinc-500">
            {separateNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
        {scene.placementIssues && scene.placementIssues.length > 0 ? (
          <ul className="mt-2 mb-0 list-none space-y-0.5 pl-0 text-xs leading-snug text-amber-800">
            {scene.placementIssues.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <SegmentTags fixture={fixture} />
      {fixture.note ? (
        <p className="mt-4 mb-0 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {fixture.note}
        </p>
      ) : null}

      <Legend />

      <footer className="mt-10 border-t border-zinc-200 pt-4">
        <Note>
          Reasoning:{' '}
          <a
            href={LANE_RENDERING_RESEARCH_URL}
            target="_blank"
            rel="noreferrer"
            className="text-blue-700 hover:underline"
          >
            research/lane-rendering
          </a>{' '}
          ·{' '}
          <a
            href={WIDTH_MEASUREMENTS_RESEARCH_URL}
            target="_blank"
            rel="noreferrer"
            className="text-blue-700 hover:underline"
          >
            research/width-measurements
          </a>
          {demoId?.startsWith('karl-marx') ? (
            <>
              {' '}
              ·{' '}
              <a
                href={CYCLEWAY_ONEWAY_RESEARCH_URL}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 hover:underline"
              >
                cycleway:*:oneway
              </a>
            </>
          ) : null}
          . Share this demo via the URL path.
        </Note>
      </footer>
    </article>
  )
}
