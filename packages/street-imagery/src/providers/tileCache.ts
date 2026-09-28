/** Parsed tiles kept in memory; dense Mapillary tiles are large, so keep this small. */
const MAX_RESOLVED_ENTRIES = 60

type PendingEntry = {
  promise: Promise<unknown>
  controller: AbortController
  activeSubscribers: number
  settled: boolean
}

const pendingTiles = new Map<string, PendingEntry>()
const resolvedTiles = new Map<string, unknown>()

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

const touchResolved = (key: string, value: unknown) => {
  resolvedTiles.delete(key)
  resolvedTiles.set(key, value)
  while (resolvedTiles.size > MAX_RESOLVED_ENTRIES) {
    const oldestKey = resolvedTiles.keys().next().value
    if (oldestKey === undefined) {
      break
    }
    resolvedTiles.delete(oldestKey)
  }
}

export const fetchTileCached = async <T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
): Promise<T> => {
  if (resolvedTiles.has(key)) {
    const value = resolvedTiles.get(key) as T
    touchResolved(key, value)
    return value
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
        touchResolved(key, value)
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
}
