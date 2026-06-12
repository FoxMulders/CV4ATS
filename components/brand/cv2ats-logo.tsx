import { cn } from '@/lib/utils'

type Cv2atsLogoProps = {
  className?: string
  /** Icon only, text only, or combined lockup. */
  variant?: 'full' | 'mark' | 'wordmark'
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: { mark: 28, wordmark: 'text-base' },
  md: { mark: 36, wordmark: 'text-lg' },
  lg: { mark: 44, wordmark: 'text-xl' },
} as const

function Cv2atsLogoMark({
  size,
  className,
  decorative = true,
}: {
  size: number
  className?: string
  decorative?: boolean
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : 'cv2ats logo — ATS resume builder'}
      role={decorative ? undefined : 'img'}
      className={cn('shrink-0', className)}
    >
      {!decorative ? <title>cv2ats — ATS resume builder logo</title> : null}
      <defs>
        <linearGradient id="cv2ats-bg" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="oklch(0.32 0.08 260)" />
          <stop offset="1" stopColor="oklch(0.26 0.07 260)" />
        </linearGradient>
        <linearGradient id="cv2ats-gold" x1="18" y1="12" x2="26" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="oklch(0.78 0.13 75)" />
          <stop offset="1" stopColor="oklch(0.68 0.12 75)" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#cv2ats-bg)" />
      {/* Source document (CV) */}
      <rect x="8" y="10" width="11" height="14" rx="2" fill="white" fillOpacity="0.92" />
      <rect x="10" y="13" width="7" height="1.5" rx="0.75" fill="oklch(0.32 0.08 260)" fillOpacity="0.35" />
      <rect x="10" y="16.5" width="5.5" height="1.5" rx="0.75" fill="oklch(0.32 0.08 260)" fillOpacity="0.25" />
      <rect x="10" y="20" width="6.5" height="1.5" rx="0.75" fill="oklch(0.32 0.08 260)" fillOpacity="0.25" />
      {/* Transformation bridge */}
      <path
        d="M21 20 L24 20 L24 17 L28 20 L24 23 L24 20"
        fill="url(#cv2ats-gold)"
      />
      {/* ATS-optimized output */}
      <rect x="29" y="10" width="3" height="14" rx="1" fill="white" fillOpacity="0.85" />
      <rect x="33" y="10" width="3" height="14" rx="1" fill="white" fillOpacity="0.65" />
      <path
        d="M30.5 26.5 L32.5 28.5 L36 24.5"
        stroke="url(#cv2ats-gold)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Cv2atsWordmark({ className, textSize }: { className?: string; textSize: string }) {
  return (
    <span
      className={cn(
        'font-heading font-semibold leading-none tracking-tight text-foreground',
        textSize,
        className
      )}
    >
      <span className="text-foreground">cv</span>
      <span className="text-brand-gold">2</span>
      <span className="text-foreground">ats</span>
    </span>
  )
}

export function Cv2atsLogo({ className, variant = 'full', size = 'md' }: Cv2atsLogoProps) {
  const { mark, wordmark } = sizeMap[size]

  if (variant === 'mark') {
    return (
      <span className={cn('inline-flex', className)}>
        <Cv2atsLogoMark size={mark} />
      </span>
    )
  }

  if (variant === 'wordmark') {
    return <Cv2atsWordmark textSize={wordmark} className={className} />
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Cv2atsLogoMark size={mark} />
      <Cv2atsWordmark textSize={wordmark} />
    </span>
  )
}
