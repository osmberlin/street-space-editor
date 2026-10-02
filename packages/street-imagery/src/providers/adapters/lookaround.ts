/** Default camera altitude (meters) used in Apple Maps Look Around share `_mvs` blobs. */
const DEFAULT_LOOK_AROUND_ALTITUDE_M = 50

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

/**
 * Encode Apple Maps Look Around `_mvs` view state.
 * Share links from Maps include this protobuf; without it, `/look-around?coordinate=`
 * opens the place/map card instead of Look Around.
 *
 * Layout: length-delimited message with little-endian fixed64 fields
 * 1=latitude, 2=longitude, 3=altitude (meters).
 */
export const encodeLookAroundMvs = (
  lat: number,
  lng: number,
  altitudeMeters: number = DEFAULT_LOOK_AROUND_ALTITUDE_M,
): string => {
  const inner = new Uint8Array(27)
  const view = new DataView(inner.buffer)
  let offset = 0
  for (const [field, value] of [
    [1, lat],
    [2, lng],
    [3, altitudeMeters],
  ] as const) {
    inner[offset] = (field << 3) | 1
    offset += 1
    view.setFloat64(offset, value, true)
    offset += 8
  }

  const raw = new Uint8Array(2 + inner.length)
  raw[0] = 0x0a
  raw[1] = inner.length
  raw.set(inner, 2)
  return bytesToBase64(raw)
}

/** Apple Maps Look Around deep link (no API key). Includes `_mvs` so Maps opens Look Around. */
export const lookAroundDeepLink = (lat: number, lng: number): string => {
  const params = new URLSearchParams({
    coordinate: `${lat},${lng}`,
    _mvs: encodeLookAroundMvs(lat, lng),
  })
  return `https://maps.apple.com/look-around?${params.toString()}`
}

/**
 * Link-out-only provider: no official bulk coverage listing API.
 * Map clicks open Apple Maps Look Around at the clicked coordinate.
 */
