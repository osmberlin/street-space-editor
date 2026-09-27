import type { LngLat, NormalizedPhoto, Viewpoint } from '@osm-editor-kit/street-imagery'
import { create } from 'zustand'

export type ViewpointHistoryEntry = {
  photo: NormalizedPhoto
  /** Suggested view the photo came from; `null` for photos picked by hand. */
  directionKey: string | null
}

type OpenInput = {
  viewpoints: Viewpoint[]
  /** Clicked line, drawn as context on the map. */
  line?: LngLat[] | null
}

type ViewpointSessionStore = {
  /** Increments on every `open`, so hooks can tell sessions apart. */
  sessionId: number
  viewpoints: Viewpoint[]
  line: LngLat[] | null
  activeDirectionKey: string | null
  history: ViewpointHistoryEntry[]
  historyIndex: number
  actions: {
    open: (input: OpenInput) => void
    /** Show a photo; truncates forward history. No-op when it is already the current photo. */
    showPhoto: (entry: ViewpointHistoryEntry) => void
    back: () => ViewpointHistoryEntry | null
    forward: () => ViewpointHistoryEntry | null
    close: () => void
  }
}

const HISTORY_LIMIT = 100

const samePhoto = (a: NormalizedPhoto | undefined, b: NormalizedPhoto) =>
  a != null && a.providerId === b.providerId && a.photoId === b.photoId

const useViewpointSessionStore = create<ViewpointSessionStore>()((set, get) => ({
  sessionId: 0,
  viewpoints: [],
  line: null,
  activeDirectionKey: null,
  history: [],
  historyIndex: -1,
  actions: {
    open: ({ viewpoints, line = null }) =>
      set((state) => ({
        sessionId: state.sessionId + 1,
        viewpoints,
        line,
        activeDirectionKey: null,
      })),
    showPhoto: (entry) =>
      set((state) => {
        const current = state.history[state.historyIndex]
        if (samePhoto(current?.photo, entry.photo)) {
          return entry.directionKey != null && entry.directionKey !== state.activeDirectionKey
            ? { activeDirectionKey: entry.directionKey }
            : state
        }
        const history = [...state.history.slice(0, state.historyIndex + 1), entry].slice(
          -HISTORY_LIMIT,
        )
        return {
          history,
          historyIndex: history.length - 1,
          activeDirectionKey: entry.directionKey ?? state.activeDirectionKey,
        }
      }),
    back: () => {
      const { history, historyIndex } = get()
      const entry = history[historyIndex - 1]
      if (!entry) {
        return null
      }
      set({ historyIndex: historyIndex - 1, activeDirectionKey: entry.directionKey })
      return entry
    },
    forward: () => {
      const { history, historyIndex } = get()
      const entry = history[historyIndex + 1]
      if (!entry) {
        return null
      }
      set({ historyIndex: historyIndex + 1, activeDirectionKey: entry.directionKey })
      return entry
    },
    close: () => set({ viewpoints: [], line: null, activeDirectionKey: null }),
  },
}))

export const useViewpointSessionId = () => useViewpointSessionStore((state) => state.sessionId)
export const useViewpoints = () => useViewpointSessionStore((state) => state.viewpoints)
export const useViewpointLine = () => useViewpointSessionStore((state) => state.line)
export const useActiveDirectionKey = () =>
  useViewpointSessionStore((state) => state.activeDirectionKey)
export const useCurrentHistoryEntry = () =>
  useViewpointSessionStore((state) => state.history[state.historyIndex] ?? null)
export const useCanGoBack = () => useViewpointSessionStore((state) => state.historyIndex > 0)
export const useCanGoForward = () =>
  useViewpointSessionStore((state) => state.historyIndex < state.history.length - 1)
export const useViewpointSessionActions = () => useViewpointSessionStore((state) => state.actions)

/** Actions + current entry outside React (event handlers, tests). */
export const getViewpointSession = () => {
  const { actions, history, historyIndex } = useViewpointSessionStore.getState()
  return { actions, current: history[historyIndex] ?? null }
}
