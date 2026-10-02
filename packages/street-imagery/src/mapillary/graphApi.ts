import { getStreetImageryConfig } from '../config'

const GRAPH_URL = 'https://graph.mapillary.com/'

/** Ids per request for `?ids=a,b,…` batch lookups. */
export const MAPILLARY_BATCH_SIZE = 50

/** GET on the Mapillary Graph API with the configured token; throws on HTTP errors. */
export const mapillaryGraphGet = async <T>(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> => {
  const query = new URLSearchParams({
    ...params,
    access_token: getStreetImageryConfig().mapillaryToken,
  })
  const response = await fetch(`${GRAPH_URL}${path}?${query}`, { signal })
  if (!response.ok) {
    throw new Error(`Mapillary API ${response.status} for /${path}`)
  }
  return response.json() as Promise<T>
}
