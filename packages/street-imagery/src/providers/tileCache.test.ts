import { afterEach, describe, expect, it, vi } from 'bun:test'
import { clearTileCache, collectSettledTiles, fetchTileCached } from './tileCache'

const deferredFetcher = () => {
  let resolve!: (value: string) => void
  let capturedSignal: AbortSignal | null = null
  const fetcher = vi.fn((signal: AbortSignal) => {
    capturedSignal = signal
    return new Promise<string>((res, rej) => {
      resolve = res
      signal.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')))
    })
  })
  return {
    fetcher,
    resolveWith: (value: string) => resolve(value),
    getSignal: () => capturedSignal,
  }
}

describe('fetchTileCached', () => {
  afterEach(() => {
    clearTileCache()
  })

  it('deduplicates concurrent callers onto one fetch', async () => {
    const { fetcher, resolveWith } = deferredFetcher()
    const a = fetchTileCached('k', fetcher, new AbortController().signal)
    const b = fetchTileCached('k', fetcher, new AbortController().signal)
    resolveWith('value')
    expect(await a).toBe('value')
    expect(await b).toBe('value')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('keeps fetching while at least one subscriber is still interested', async () => {
    const { fetcher, resolveWith, getSignal } = deferredFetcher()
    const controllerA = new AbortController()
    const controllerB = new AbortController()

    const a = fetchTileCached('k', fetcher, controllerA.signal)
    const b = fetchTileCached('k', fetcher, controllerB.signal)

    controllerA.abort()
    expect(getSignal()?.aborted).toBe(false)

    resolveWith('value')
    expect(await a).toBe('value')
    expect(await b).toBe('value')
  })

  it('aborts the underlying fetch and evicts the entry when all subscribers abort', async () => {
    const { fetcher, getSignal } = deferredFetcher()
    const controllerA = new AbortController()
    const controllerB = new AbortController()

    const a = fetchTileCached('k', fetcher, controllerA.signal)
    const b = fetchTileCached('k', fetcher, controllerB.signal)

    controllerA.abort()
    controllerB.abort()
    expect(getSignal()?.aborted).toBe(true)

    const results = await Promise.allSettled([a, b])
    expect(results).toEqual([
      expect.objectContaining({
        status: 'rejected',
        reason: expect.objectContaining({ name: 'AbortError' }),
      }),
      expect.objectContaining({
        status: 'rejected',
        reason: expect.objectContaining({ name: 'AbortError' }),
      }),
    ])

    // The pending entry was evicted, so a fresh caller triggers a new fetch.
    const retry = deferredFetcher()
    const c = fetchTileCached('k', retry.fetcher, new AbortController().signal)
    expect(retry.fetcher).toHaveBeenCalledTimes(1)
    retry.resolveWith('fresh')
    expect(await c).toBe('fresh')
  })

  it('evicts failed fetches so later callers retry', async () => {
    const failing = vi.fn(() => Promise.reject(new Error('boom')))
    await expect(fetchTileCached('k', failing, new AbortController().signal)).rejects.toThrow(
      'boom',
    )

    const succeeding = vi.fn(() => Promise.resolve('ok'))
    expect(await fetchTileCached('k', succeeding, new AbortController().signal)).toBe('ok')
    expect(succeeding).toHaveBeenCalledTimes(1)
  })
})

describe('collectSettledTiles', () => {
  it('returns fulfilled results when only some tiles fail', async () => {
    const results = await collectSettledTiles([
      Promise.resolve('a'),
      Promise.reject(new Error('tile failed')),
      Promise.resolve('c'),
    ])
    expect(results).toEqual(['a', 'c'])
  })

  it('throws when all tiles fail', async () => {
    await expect(
      collectSettledTiles([
        Promise.reject(new Error('outage')),
        Promise.reject(new Error('outage')),
      ]),
    ).rejects.toThrow('outage')
  })

  it('drops the least recently used tiles when they hold too many items', async () => {
    const signal = new AbortController().signal
    const tile = (items: number) => () => Promise.resolve(Array.from({ length: items }, () => 0))
    const refetched = vi.fn(tile(1))

    await fetchTileCached('a', tile(300_000), signal)
    await fetchTileCached('b', tile(300_000), signal)
    // Use `a` again, so `b` is the oldest when `c` goes over the limit.
    await fetchTileCached('a', refetched, signal)
    await fetchTileCached('c', tile(300_000), signal)

    await fetchTileCached('a', refetched, signal)
    expect(refetched).toHaveBeenCalledTimes(0)
    await fetchTileCached('b', refetched, signal)
    expect(refetched).toHaveBeenCalledTimes(1)
  })

  it('keeps a single tile that is over the limit on its own', async () => {
    const signal = new AbortController().signal
    const fetcher = vi.fn(() => Promise.resolve(Array.from({ length: 2_000_000 }, () => 0)))

    await fetchTileCached('huge', fetcher, signal)
    await fetchTileCached('huge', fetcher, signal)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
