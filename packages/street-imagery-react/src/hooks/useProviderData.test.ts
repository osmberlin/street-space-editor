import { describe, expect, test } from 'bun:test'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { previousDataWhile } from './useProviderData'

const options = (bbox: string | null) => ({
  queryKey: ['provider-photos', 'mapillary', bbox ?? 'none', 15],
  queryFn: async () => [`photo in ${bbox}`],
  enabled: bbox != null,
  placeholderData: previousDataWhile(bbox != null),
})

describe('previousDataWhile', () => {
  test('keeps the last result while the next viewport loads', async () => {
    const observer = new QueryObserver(new QueryClient(), options('1,2,3,4'))
    const unsubscribe = observer.subscribe(() => {})
    await observer.refetch()

    observer.setOptions(options('5,6,7,8'))
    expect(observer.getCurrentResult().data).toEqual(['photo in 1,2,3,4'])
    unsubscribe()
  })

  test('drops the last result when the query is turned off', async () => {
    const observer = new QueryObserver(new QueryClient(), options('1,2,3,4'))
    const unsubscribe = observer.subscribe(() => {})
    await observer.refetch()

    observer.setOptions(options(null))
    expect(observer.getCurrentResult().data).toBeUndefined()
    unsubscribe()
  })
})
