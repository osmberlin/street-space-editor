import type { ViewSuggestion, ViewpointRole } from '@osm-editor-kit/street-imagery'

const ROLE_LABELS: Record<ViewpointRole, string> = {
  here: 'Here',
  'line-start': 'Start',
  'line-end': 'End',
  'into-node': 'Junction',
  custom: 'View',
}

export const viewpointRoleLabel = (role: ViewpointRole): string => ROLE_LABELS[role]

/** Short human label, e.g. "Start → forward", "Here · N", "Junction · in". */
export const viewSuggestionLabel = ({ viewpoint, direction }: ViewSuggestion): string => {
  const role = viewpoint.label ?? viewpointRoleLabel(viewpoint.role)
  switch (direction.kind) {
    case 'forward':
      return `${role}, looking along the street`
    case 'back':
      return `${role}, looking back along the street`
    case 'into':
      return `${role}, looking into the junction`
    case 'N':
    case 'E':
    case 'S':
    case 'W':
      return `${role}, looking ${direction.kind}`
  }
}
