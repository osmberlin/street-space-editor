type PhotoCountProps = {
  /** Position of the shown photo, starting at 1; leave out to show only the total. */
  index?: number
  total: number
  className?: string
}

/**
 * "1/5" behind a small picture icon: this button has several photos and a click on it shows the
 * next one.
 */
export const PhotoCount = ({ index, total, className }: PhotoCountProps) => (
  <span className={`inline-flex shrink-0 items-center gap-0.5 tabular-nums ${className ?? ''}`}>
    <svg
      aria-hidden
      className="size-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      <path d="M4 6h16v12H4ZM4 15l4.5-4.5 4 4L15 12l5 5M9 9.5h.01" />
    </svg>
    {index != null ? `${index}/` : ''}
    {total}
  </span>
)
