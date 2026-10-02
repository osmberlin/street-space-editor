import type { PhotoCandidate, ViewSuggestion } from '@osm-editor-kit/street-imagery'
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { PhotoCount } from '../i18n/PhotoCount'
import { PhotoDate } from '../i18n/PhotoDate'
import { useStreetImageryI18n } from '../i18n/StreetImageryLocaleProvider'
import { viewSuggestionLabel } from './viewDirectionLabels'

type Layout = { right: number; bottom: number; width: number; minimized: boolean }

const DEFAULT_LAYOUT: Layout = { right: 16, bottom: 32, width: 420, minimized: false }
const MIN_WIDTH = 280
const EDGE = 8

const readLayout = (storageKey: string): Layout => {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? { ...DEFAULT_LAYOUT, ...(JSON.parse(raw) as Partial<Layout>) } : DEFAULT_LAYOUT
  } catch {
    return DEFAULT_LAYOUT
  }
}

const writeLayout = (storageKey: string, layout: Layout) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(layout))
  } catch {
    // Storage may be unavailable (private mode); layout just isn't remembered.
  }
}

const Icon = ({ path, className = 'size-4' }: { path: string; className?: string }) => (
  <svg
    aria-hidden
    className={className}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.75}
    viewBox="0 0 24 24"
  >
    <path d={path} />
  </svg>
)

const ICONS = {
  back: 'M15 18l-6-6 6-6',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  forward: 'M9 18l6-6-6-6',
  close: 'M18 6 6 18M6 6l12 12',
  minimize: 'M5 12h14',
  expand: 'M4 14v6h6M20 10V4h-6M14 10l6-6M10 14l-6 6',
  arrow: 'M12 20V5M6 11l6-6 6 6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01',
}

const ToolbarButton = ({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) => (
  <button
    aria-label={label}
    className="inline-flex size-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    disabled={disabled}
    onClick={onClick}
    title={label}
    type="button"
  >
    {children}
  </button>
)

const SuggestionChip = ({
  suggestion,
  active,
  shownPhotoId,
  showPlace,
  onSelect,
}: {
  suggestion: ViewSuggestion
  active: boolean
  shownPhotoId: string | null | undefined
  /** Several viewpoints (start, end, junction …): name the place; one viewpoint needs no name. */
  showPlace: boolean
  onSelect: (candidate: PhotoCandidate) => void
}) => {
  const { messages } = useStreetImageryI18n()
  const { candidates } = suggestion
  const best = candidates[0]
  // The active view counts through its photos, best match first: "2/5".
  const shownIndex = active
    ? candidates.findIndex((candidate) => candidate.photo.photoId === shownPhotoId)
    : -1
  const shown = shownIndex >= 0 ? candidates[shownIndex] : best
  const canStep = active && candidates.length > 1
  const hasCount = canStep && shownIndex >= 0
  const name = viewSuggestionLabel(suggestion, messages)
  const label = canStep ? messages.viewer.nextPhotoOfView(name) : name
  return (
    <button
      aria-label={best ? label : messages.viewer.noPhoto(label)}
      aria-pressed={active}
      className={[
        'flex min-w-0 flex-col items-center rounded-md border px-1 py-0.5 text-xs leading-tight',
        active
          ? 'border-fuchsia-600 bg-fuchsia-600 text-white'
          : best
            ? 'border-slate-300 bg-white text-slate-700 hover:border-fuchsia-500'
            : 'border-dashed border-slate-200 bg-white text-slate-400',
      ].join(' ')}
      disabled={!best}
      onClick={() => {
        // The active view again: its next photo. Another view: its best photo.
        const next = canStep ? candidates[(shownIndex + 1) % candidates.length] : best
        if (next) {
          onSelect(next)
        }
      }}
      title={best ? label : messages.viewer.noMatchingPhoto(label)}
      type="button"
    >
      {/* Direction left and count right when there is a count; else the direction centred. */}
      <span
        className={`flex items-center gap-1 font-medium ${hasCount ? 'w-full justify-between px-1' : 'max-w-full'}`}
      >
        <span className="flex min-w-0 items-center gap-1">
          <span
            aria-hidden
            className="inline-flex shrink-0"
            style={{ transform: `rotate(${suggestion.direction.bearing}deg)` }}
          >
            <Icon className="size-3" path={ICONS.arrow} />
          </span>
          <span className="truncate">
            {showPlace
              ? `${suggestion.viewpoint.label ?? messages.viewpointRole[suggestion.viewpoint.role]} `
              : ''}
            {messages.compass[Math.round(suggestion.direction.bearing / 45) % 8]}
          </span>
        </span>
        {/* Only the active view counts: a click on it shows its next photo. */}
        {hasCount ? (
          <PhotoCount
            className="font-normal text-fuchsia-100"
            index={shownIndex + 1}
            total={candidates.length}
          />
        ) : null}
      </span>
      {shown ? (
        <PhotoDate
          className={`max-w-full truncate ${active ? 'text-fuchsia-100' : 'text-slate-400'}`}
          timestamp={shown.photo.capturedAt}
        />
      ) : (
        <span className="text-slate-400">—</span>
      )}
    </button>
  )
}

/** Info button for `titleActions`; `label` is its tooltip and accessible name. */
export const FloatingViewerInfoButton = ({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) => (
  <ToolbarButton label={label} onClick={onClick}>
    <Icon path={ICONS.info} />
  </ToolbarButton>
)

export type FloatingPhotoViewerProps = {
  title: ReactNode
  /** Buttons right after the title, e.g. `<FloatingViewerInfoButton>` for the photo's details. */
  titleActions?: ReactNode
  /** Suggested views (viewpoint × direction); shown as chips. Empty hides the strip. */
  suggestions: ViewSuggestion[]
  activeDirectionKey: string | null
  /**
   * A view button was clicked. `candidate` is the photo to show: the view's best one, or the next
   * one when the active view is clicked again.
   */
  onSelectSuggestion: (suggestion: ViewSuggestion, candidate: PhotoCandidate) => void
  /** The photo in the viewer, so the active view can show which of its photos that is. */
  shownPhotoId?: string | null
  canGoBack: boolean
  canGoForward: boolean
  onBack: () => void
  onForward: () => void
  onClose: () => void
  /**
   * Step to the neighbouring photo, e.g. along the clicked street: the `<` `>` buttons at the
   * left of the header. A missing handler disables its button.
   */
  step?: {
    onPrevious?: () => void
    onNext?: () => void
    previousLabel: string
    nextLabel: string
  }
  /**
   * Bar below the header, in place of the suggested-view chips; e.g. the map feature the photos
   * belong to, with a button per capture day.
   */
  toolbar?: ReactNode
  /** Short status line, e.g. "Loading…" or "No photos from the last 2 years". */
  status?: ReactNode
  /** Viewer body (provider panel). */
  children?: ReactNode
  footer?: ReactNode
  /** Collapsible list below the footer, e.g. other photos near the click. */
  drawer?: { label: ReactNode; content: ReactNode }
  /** localStorage key for position, width and minimized state. */
  storageKey?: string
}

/**
 * Photo viewer box floating over the map. Render inside a positioned (relative) map container.
 * Drag the header to move, drag the left edge to resize. Keys: Esc closes, [ and ] step history,
 * Alt + arrow left/right step along (`step`).
 */
export const FloatingPhotoViewer = ({
  title,
  titleActions,
  suggestions,
  activeDirectionKey,
  onSelectSuggestion,
  shownPhotoId,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onClose,
  step,
  toolbar,
  status,
  children,
  footer,
  drawer,
  storageKey = 'street-imagery:floating-viewer',
}: FloatingPhotoViewerProps) => {
  const { messages } = useStreetImageryI18n()
  const severalViewpoints =
    new Set(suggestions.map((suggestion) => suggestion.viewpoint.id)).size > 1
  const [layout, setLayout] = useState<Layout>(() => readLayout(storageKey))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const dragRef = useRef<{
    x: number
    y: number
    layout: Layout
    mode: 'move' | 'resize'
  } | null>(null)

  const updateLayout = (next: Layout) => {
    setLayout(next)
    writeLayout(storageKey, next)
  }

  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target
    if (
      target instanceof Element &&
      target.closest('input, textarea, select, [contenteditable="true"]')
    ) {
      return
    }
    if (event.key === 'Escape') {
      onClose()
    } else if (event.key === '[' && canGoBack) {
      onBack()
    } else if (event.key === ']' && canGoForward) {
      onForward()
    } else if (event.key === 'ArrowLeft' && event.altKey) {
      step?.onPrevious?.()
    } else if (event.key === 'ArrowRight' && event.altKey) {
      step?.onNext?.()
    }
  })

  useEffect(function subscribeKeyboardShortcuts() {
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  const startDrag = (event: PointerEvent<HTMLElement>, mode: 'move' | 'resize') => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, layout, mode }
  }

  const onDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag) {
      return
    }
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    setLayout(
      drag.mode === 'move'
        ? {
            ...drag.layout,
            right: Math.max(EDGE, drag.layout.right - dx),
            bottom: Math.max(EDGE, drag.layout.bottom - dy),
          }
        : { ...drag.layout, width: Math.max(MIN_WIDTH, drag.layout.width - dx) },
    )
  }

  const endDrag = () => {
    if (dragRef.current) {
      dragRef.current = null
      writeLayout(storageKey, layout)
    }
  }

  const dragHandlers = { onPointerMove: onDrag, onPointerUp: endDrag, onPointerCancel: endDrag }

  if (layout.minimized) {
    return (
      <button
        className="absolute z-10 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-lg ring-1 ring-slate-200 hover:bg-slate-50"
        onClick={() => updateLayout({ ...layout, minimized: false })}
        style={{ right: layout.right, bottom: layout.bottom }}
        type="button"
      >
        <Icon path={ICONS.expand} />
        {title}
      </button>
    )
  }

  return (
    <section
      aria-label={messages.viewer.regionLabel}
      className="absolute z-10 flex max-h-[calc(100%-1rem)] flex-col overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200"
      style={{
        right: layout.right,
        bottom: layout.bottom,
        width: `min(${layout.width}px, calc(100% - 1rem))`,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-ew-resize hover:bg-fuchsia-500/20"
        onPointerDown={(event) => startDrag(event, 'resize')}
        {...dragHandlers}
      />
      <header
        className="flex cursor-move touch-none items-center gap-1 border-b border-slate-100 px-2 py-1.5 select-none"
        onPointerDown={(event) => startDrag(event, 'move')}
        {...dragHandlers}
      >
        {step ? (
          <>
            <ToolbarButton
              disabled={!step.onPrevious}
              label={step.previousLabel}
              onClick={() => step.onPrevious?.()}
            >
              <Icon path={ICONS.back} />
            </ToolbarButton>
            <ToolbarButton
              disabled={!step.onNext}
              label={step.nextLabel}
              onClick={() => step.onNext?.()}
            >
              <Icon path={ICONS.forward} />
            </ToolbarButton>
          </>
        ) : null}
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          <h2 className="min-w-0 truncate px-1 text-sm font-semibold text-slate-800">{title}</h2>
          {titleActions}
        </div>
        <ToolbarButton disabled={!canGoBack} label={messages.viewer.backInHistory} onClick={onBack}>
          <Icon path={ICONS.undo} />
        </ToolbarButton>
        <ToolbarButton
          disabled={!canGoForward}
          label={messages.viewer.forwardInHistory}
          onClick={onForward}
        >
          <Icon path={ICONS.redo} />
        </ToolbarButton>
        <ToolbarButton
          label={messages.viewer.minimize}
          onClick={() => updateLayout({ ...layout, minimized: true })}
        >
          <Icon path={ICONS.minimize} />
        </ToolbarButton>
        <ToolbarButton label={messages.viewer.close} onClick={onClose}>
          <Icon path={ICONS.close} />
        </ToolbarButton>
      </header>

      {toolbar ? (
        <div className="border-b border-slate-100 px-2 py-1.5">{toolbar}</div>
      ) : suggestions.length > 0 ? (
        <nav
          aria-label={messages.viewer.suggestedViews}
          className="grid grid-cols-[repeat(auto-fit,minmax(5.25rem,1fr))] gap-1 border-b border-slate-100 px-2 py-1.5"
          title={messages.viewer.suggestedViewsHint}
        >
          {suggestions.map((suggestion) => (
            <SuggestionChip
              active={suggestion.direction.key === activeDirectionKey}
              key={suggestion.direction.key}
              onSelect={(candidate) => onSelectSuggestion(suggestion, candidate)}
              shownPhotoId={shownPhotoId}
              showPlace={severalViewpoints}
              suggestion={suggestion}
            />
          ))}
        </nav>
      ) : null}

      <div className="min-h-0 overflow-y-auto">
        {status ? (
          <p className="px-3 py-2 text-xs text-slate-500" role="status">
            {status}
          </p>
        ) : null}
        {children}
        {footer ? <div className="px-3 py-2 text-xs text-slate-600">{footer}</div> : null}
        {drawer ? (
          <div className="border-t border-slate-100">
            <button
              aria-expanded={drawerOpen}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setDrawerOpen((open) => !open)}
              type="button"
            >
              {drawer.label}
              <span aria-hidden className={drawerOpen ? 'inline-flex rotate-90' : 'inline-flex'}>
                <Icon className="size-3.5" path={ICONS.forward} />
              </span>
            </button>
            {drawerOpen ? <div className="px-2 pb-2">{drawer.content}</div> : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
