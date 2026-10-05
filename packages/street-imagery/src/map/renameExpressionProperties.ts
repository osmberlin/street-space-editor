/**
 * A copy of a MapLibre expression that reads other property names: every `['get', name]` with a
 * `name` in `names` gets the mapped name. For a style written for this package's GeoJSON
 * (`capturedAt`, `isPano`) that has to run on a provider's own tiles (`captured_at`, `is_pano`).
 */
export const renameExpressionProperties = <T>(expression: T, names: Record<string, string>): T => {
  if (!Array.isArray(expression)) return expression

  const [operator, name] = expression
  if (
    operator === 'get' &&
    expression.length === 2 &&
    typeof name === 'string' &&
    Object.hasOwn(names, name)
  ) {
    return ['get', names[name]] as T
  }

  return expression.map((part) => renameExpressionProperties(part, names)) as T
}
