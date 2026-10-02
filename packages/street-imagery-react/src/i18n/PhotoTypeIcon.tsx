import { useStreetImageryI18n } from './StreetImageryLocaleProvider'

type PhotoTypeIconProps = {
  /** `true` 360° photo, `false` flat photo; nothing is drawn for unknown. */
  isPano: boolean | null | undefined
  className?: string
}

/** Small icon for the kind of photo: a globe for 360°, a picture frame for flat photos. */
export const PhotoTypeIcon = ({ isPano, className = 'size-3' }: PhotoTypeIconProps) => {
  const { messages } = useStreetImageryI18n()
  if (isPano == null) {
    return null
  }
  return (
    <svg
      aria-label={isPano ? messages.photoType.pano : messages.photoType.flat}
      className={`inline-block shrink-0 ${className}`}
      fill="none"
      role="img"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      <title>{isPano ? messages.photoType.pano : messages.photoType.flat}</title>
      {isPano ? (
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9s1.3-6.4 3.8-9Z" />
      ) : (
        <path d="M4 6h16v12H4ZM4 15l4.5-4.5 4 4L15 12l5 5M9 9.5h.01" />
      )}
    </svg>
  )
}
