import {
  DEFAULT_STREET_IMAGERY_LOCALE,
  type StreetImageryLocale,
} from '@osm-editor-kit/street-imagery'
import { createContext, use, type ReactNode } from 'react'
import { STREET_IMAGERY_MESSAGES, type StreetImageryMessages } from './messages'

type StreetImageryI18n = { locale: StreetImageryLocale; messages: StreetImageryMessages }

/** Overrides per group, e.g. `{ feature: { name: germanSignName } }`. */
export type StreetImageryMessageOverrides = {
  [Group in keyof StreetImageryMessages]?: StreetImageryMessages[Group] extends object
    ? StreetImageryMessages[Group] extends ((...args: never[]) => unknown) | readonly unknown[]
      ? StreetImageryMessages[Group]
      : Partial<StreetImageryMessages[Group]>
    : StreetImageryMessages[Group]
}

const DEFAULT_I18N: StreetImageryI18n = {
  locale: DEFAULT_STREET_IMAGERY_LOCALE,
  messages: STREET_IMAGERY_MESSAGES[DEFAULT_STREET_IMAGERY_LOCALE],
}

const I18nContext = createContext<StreetImageryI18n>(DEFAULT_I18N)

const mergeMessages = (
  base: StreetImageryMessages,
  overrides: StreetImageryMessageOverrides | undefined,
): StreetImageryMessages =>
  overrides
    ? {
        unknownDate: overrides.unknownDate ?? base.unknownDate,
        viewer: { ...base.viewer, ...overrides.viewer },
        viewpointRole: { ...base.viewpointRole, ...overrides.viewpointRole },
        compass: overrides.compass?.length === 8 ? overrides.compass : base.compass,
        viewDirection: overrides.viewDirection ?? base.viewDirection,
      }
    : base

type StreetImageryLocaleProviderProps = {
  /** Language of the package's texts and date formats. Without a provider: English. */
  locale: StreetImageryLocale
  messages?: StreetImageryMessageOverrides
  children: ReactNode
}

export const StreetImageryLocaleProvider = ({
  locale,
  messages,
  children,
}: StreetImageryLocaleProviderProps) => (
  <I18nContext
    value={{ locale, messages: mergeMessages(STREET_IMAGERY_MESSAGES[locale], messages) }}
  >
    {children}
  </I18nContext>
)

/** Locale and texts of the nearest `StreetImageryLocaleProvider`. */
export const useStreetImageryI18n = (): StreetImageryI18n => use(I18nContext)
