import { describe, expect, test } from 'bun:test'
import { renameExpressionProperties } from './renameExpressionProperties'

const names = { capturedAt: 'captured_at', isPano: 'is_pano' }

describe('renameExpressionProperties', () => {
  test('renames nested property reads and leaves the rest', () => {
    const expression = [
      'case',
      ['==', ['get', 'isPano'], true],
      'blue',
      ['<', ['get', 'capturedAt'], 5],
      'grey',
      ['get', 'other'],
    ]

    expect(renameExpressionProperties(expression, names)).toEqual([
      'case',
      ['==', ['get', 'is_pano'], true],
      'blue',
      ['<', ['get', 'captured_at'], 5],
      'grey',
      ['get', 'other'],
    ])
  })

  test('returns a plain colour as it is', () => {
    expect(renameExpressionProperties('#171717', names)).toBe('#171717')
  })

  test('does not touch a string that only looks like a property name', () => {
    expect(renameExpressionProperties(['match', ['get', 'kind'], 'isPano', 1, 0], names)).toEqual([
      'match',
      ['get', 'kind'],
      'isPano',
      1,
      0,
    ])
  })
})
