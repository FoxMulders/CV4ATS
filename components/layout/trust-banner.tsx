import { Shield } from 'lucide-react'

interface TrustBannerProps {
  message: string
}

export function TrustBanner({ message }: TrustBannerProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-gold/30 bg-brand-gold/10 p-4 text-sm text-foreground shadow-sm">
      <Shield className="mt-0.5 size-4 shrink-0 text-brand-gold" />
      <p>{message}</p>
    </div>
  )
}
