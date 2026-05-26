'use client'

import { Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface PremiumUnlockBannerProps {
  onUnlockRequest: () => void
}

export function PremiumUnlockBanner({ onUnlockRequest }: PremiumUnlockBannerProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-brand-gold/15 p-1.5 text-brand-gold">
          <Lock className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Preview is free — downloads require a pass</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Review your ATS score and tailored resume below. Unlock a 24-Hour Job Pass to export
            PDF/DOCX files and re-download after edits.
          </p>
        </div>
      </div>
      <Button type="button" size="sm" className="shrink-0" onClick={onUnlockRequest}>
        Unlock 24-Hour Job Pass — $4.99
      </Button>
    </div>
  )
}
