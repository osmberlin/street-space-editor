/** Parsed tiles kept in memory. */
const MAX_RESOLVED_ENTRIES = 60
/**
 * Items (photos, lines …) kept in memory over all tiles. A photo takes about 500 bytes, and one
 * Mapillary tile of a city centre holds about 180,000 of them: this is a view of four such tiles,
 * about 400 MB. Without it, 60 such tiles would be several GB.
 */
const MAX_RESOLVED_ITEMS = 800_000

type PendingEntry = {
  promise: Promise<unknown>
  controller: AbortController
  activeSubscribers: number
  settled: boolean
}

const pendingTiles = new Map<string, PendingEntry>()
const resolvedTiles = new Map<string, { value: unknown; items: number }>()
let resolvedItems = 0

export const getTileCacheKey = (providerId: string, tile: { z: number; x: number; y: number }) =>
  `${providerId}:${tile.z}:${tile.x}:${tile.y}`

const subscribe = (key: string, entry: PendingEntry, signal: AbortSignal) => {
  entry.activeSubscribers += 1
  const onAbort = () => {
    entry.activeSubscribers -= 1
    if (entry.activeSubscribers === 0 && !entry.settled) {
      entry.controller.abort()
      pendingTiles.delete(key)
    }
  }
  if (signal.aborted) {
    onAbort()
  } else {
    signal.addEventListener('abort', onAbort, { once: true })
  }
}

const dropResolved = (key: string) => {
  resolvedItems -= resolvedTiles.get(key)?.items ?? 0
  resolvedTiles.delete(key)
}

/** Put the tile last (most recently used) and drop the oldest ones over the limits. */
const touchResolved = (key: string, value: unknown, items: number) => {
  dropResolved(key)
  resolvedTiles.set(key, { value, items })
  resolvedItems += items
  // The tile just used always stays, however large it is.
  while (
    resolvedTiles.size > 1 &&
    (resolvedTiles.size > MAX_RESOLVED_ENTRIES || resolvedItems > MAX_RESOLVED_ITEMS)
  ) {
    const oldestKey = resolvedTiles.keys().next().value
    if (oldestKey === undefined) {
      break
    }
    dropResolved(oldestKey)
  }
}

export const fetchTileCached = async <T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  /** How many items the tile holds, for the memory limit. Default: an array's length, else 0. */
  countItems: (value: T) => number = (value) => (Array.isArray(value) ? value.length : 0),
): Promise<T> => {
  const resolved = resolvedTiles.get(key)
  if (resolved) {
    touchResolved(key, resolved.value, resolved.items)
    return resolved.value as T
  }

  const existing = pendingTiles.get(key)
  if (existing) {
    subscribe(key, existing, signal)
    return existing.promise as Promise<T>
  }

  const controller = new AbortController()
  const entry: PendingEntry = {
    promise: undefined as unknown as Promise<unknown>,
    controller,
    activeSubscribers: 0,
    settled: false,
  }

  entry.promise = fetcher(controller.signal).then(
    (value) => {
      entry.settled = true
      if (pendingTiles.get(key) === entry) {
        pendingTiles.delete(key)
        touchResolved(key, value, countItems(value))
      }
      return value
    },
    (error) => {
      entry.settled = true
      if (pendingTiles.get(key) === entry) {
        pendingTiles.delete(key)
      }
      throw error
    },
  )

  pendingTiles.set(key, entry)
  subscribe(key, entry, signal)
  return entry.promise as Promise<T>
}

/** Await all tile fetches, tolerating partial failures. Throws only when every tile failed. */
export const collectSettledTiles = async <T>(promises: Promise<T>[]): Promise<Awaited<T>[]> => {
  const results = await Promise.allSettled(promises)
  const fulfilled = results
    .filter((result): result is PromiseFulfilledResult<Awaited<T>> => result.status === 'fulfilled')
    .map((result) => result.value)

  if (results.length > 0 && fulfilled.length === 0) {
    const firstRejected = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )
    throw firstRejected?.reason ?? new Error('All tile fetches failed')
  }

  return fulfilled
}

export const clearTileCache = () => {
  pendingTiles.clear()
  resolvedTiles.clear()
  resolvedItems = 0
}
