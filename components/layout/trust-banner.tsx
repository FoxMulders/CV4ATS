import { Shield } from 'lucide-react'

import { cn } from '@/lib/utils'

interface TrustBannerProps {
  message: string
}

export function TrustBanner({ message }: TrustBannerProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-[var(--space-inline)] rounded-[var(--radius-surface)]',
        'border border-brand-gold/30 bg-brand-gold/10 p-[var(--space-inline)]',
        'text-base leading-relaxed text-foreground shadow-[var(--shadow-ambient)]'
      )}
    >
      <Shield className="mt-0.5 size-4 shrink-0 text-brand-gold" />
      <p>{message}</p>
    </div>
  )
}
