import { afterEach, describe, expect, it } from 'bun:test'
import { createStreetImageryConfig, setStreetImageryConfig } from '../config'
import { buildInfra3dUrl } from './infra3d'

const PROJECT = 'ec2428b7-8e49-4d93-80a0-edfec6da1cf3'
const lng = 13.38886
const lat = 52.51704

const configure = (infra3d?: { projectUid: string }) => {
  setStreetImageryConfig(createStreetImageryConfig({ mapillaryToken: 'test-token', infra3d }))
}

/** The decoded JSON of one param, read the way a browser reads the URL. */
const jsonParam = (url: string, name: string) =>
  JSON.parse(new URL(url).searchParams.get(name) ?? 'null') as Record<string, unknown> | null

afterEach(() => {
  configure()
})

describe('buildInfra3dUrl', () => {
  it('jumps to a position with the project of the config', () => {
    configure({ projectUid: PROJECT })
    expect(buildInfra3dUrl({ mode: 'jumpTo', lng, lat })).toBe(
      `https://app.infra3d.com/edit/?projectUID=${PROJECT}&jumpTo=%7B%22easting%22%3A13.38886%2C%22northing%22%3A52.51704%2C%22epsg%22%3A4326%7D`,
    )
  })

  it('puts the longitude into easting and the latitude into northing', () => {
    const url = buildInfra3dUrl({ mode: 'jumpTo', lng, lat, projectUid: PROJECT })
    expect(jsonParam(url, 'jumpTo')).toEqual({ easting: lng, northing: lat, epsg: 4326 })
  })

  it('encodes the JSON with encodeURIComponent', () => {
    const url = buildInfra3dUrl({ mode: 'jumpTo', lng, lat, projectUid: PROJECT })
    const raw = url.split('&jumpTo=')[1]
    expect(raw).toBe(
      encodeURIComponent(JSON.stringify({ easting: lng, northing: lat, epsg: 4326 })),
    )
    expect(raw).not.toMatch(/[{}":,+ ]/)
  })

  it('looks at the ground of a point when no height is given', () => {
    const url = buildInfra3dUrl({ mode: 'lookAt', lng, lat, projectUid: PROJECT })
    expect(jsonParam(url, 'lookAt')).toEqual({ easting: lng, northing: lat, epsg: 4326 })
  })

  it('looks at a point at a height', () => {
    const url = buildInfra3dUrl({ mode: 'lookAt', lng, lat, height: 38.5, projectUid: PROJECT })
    expect(jsonParam(url, 'lookAt')).toEqual({
      easting: lng,
      northing: lat,
      height: 38.5,
      epsg: 4326,
    })
  })

  it('opens one image, optionally pointed', () => {
    const imageKey = '0b1c2d3e-0000-4000-8000-123456789abc'
    const plain = buildInfra3dUrl({ mode: 'imageKey', imageKey, projectUid: PROJECT })
    expect(plain).toBe(`https://app.infra3d.com/edit/?projectUID=${PROJECT}&imageKey=${imageKey}`)

    const pointTo = { type: 'pano', lat: 0, lon: 0, fov: 70 } as const
    const pointed = buildInfra3dUrl({ mode: 'imageKey', imageKey, pointTo, projectUid: PROJECT })
    expect(jsonParam(pointed, 'pointTo')).toEqual(pointTo)
  })

  it('never combines jumpTo, lookAt and imageKey', () => {
    const urls = [
      buildInfra3dUrl({ mode: 'jumpTo', lng, lat, projectUid: PROJECT }),
      buildInfra3dUrl({ mode: 'lookAt', lng, lat, projectUid: PROJECT }),
      buildInfra3dUrl({ mode: 'imageKey', imageKey: 'abc', projectUid: PROJECT }),
    ]
    for (const url of urls) {
      const params = new URL(url).searchParams
      const modes = ['jumpTo', 'lookAt', 'imageKey'].filter((name) => params.has(name))
      expect(modes).toHaveLength(1)
    }
  })

  it('throws without a project', () => {
    expect(() => buildInfra3dUrl({ mode: 'jumpTo', lng, lat })).toThrow('infra3D project')
  })
})
