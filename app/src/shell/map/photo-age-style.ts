import { ageStepColorExpression, createAgeSteps } from '@osm-editor-kit/street-imagery'
import type { ExpressionSpecification } from 'maplibre-gl'

/**
 * Photo age: orange older than 4 years, yellow 2–4 years, green newer (the package's TILDA
 * steps). Fixed at load, so the paint stays stable between renders.
 */
export const PHOTO_AGE_STEPS = createAgeSteps()

export type PhotoAgeBucketId = 'current' | 'mid' | 'old'

/** `circle-color` of photos by `capturedAt`; grey without a date. */
export const PHOTO_AGE_CIRCLE_COLOR = ageStepColorExpression(
  PHOTO_AGE_STEPS,
) as ExpressionSpecification

/** Newest first. */
export const PHOTO_AGE_LEGEND = [...PHOTO_AGE_STEPS]
  .reverse()
  .map((step) => ({ id: step.id as PhotoAgeBucketId, color: step.color }))
