import { describe, expect, it } from 'bun:test'
import { destinationPoint, type LngLat } from '../viewpoints/geometry'
import { alignLineToPoints } from './alignLine'

const start: LngLat = [13.4, 52.5]
const end = destinationPoint(start, 90, 100)
const line = [start, end]

describe('alignLineToPoints', () => {
  it('adds a corner for a point beside a straight piece', () => {
    const photo = destinationPoint(destinationPoint(start, 90, 40), 0, 2)
    expect(alignLineToPoints(line, [photo])).toEqual([start, photo, end])
  })

  it('keeps the order along the line', () => {
    const a = destinationPoint(destinationPoint(start, 90, 70), 0, 1)
    const b = destinationPoint(destinationPoint(start, 90, 30), 180, 1)
    expect(alignLineToPoints(line, [a, b])).toEqual([start, b, a, end])
  })

  it('replaces a corner that is right next to a point', () => {
    const corner = destinationPoint(start, 90, 50)
    const photo = destinationPoint(corner, 0, 1.5)
    expect(alignLineToPoints([start, corner, end], [photo])).toEqual([start, photo, end])
  })

  it('ignores points out of reach', () => {
    const far = destinationPoint(destinationPoint(start, 90, 40), 0, 20)
    expect(alignLineToPoints(line, [far])).toEqual(line)
  })
})
