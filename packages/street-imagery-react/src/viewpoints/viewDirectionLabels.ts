import type { ViewSuggestion } from '@osm-editor-kit/street-imagery'
import type { StreetImageryMessages } from '../i18n/messages'

/** Label of a suggested view, e.g. "Start, looking along the street". */
export const viewSuggestionLabel = (
  { viewpoint, direction }: ViewSuggestion,
  messages: StreetImageryMessages,
): string =>
  messages.viewDirection(viewpoint.label ?? messages.viewpointRole[viewpoint.role], direction.kind)
