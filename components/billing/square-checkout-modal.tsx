'use client'

import { Loader2, Lock } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  PREMIUM_DOWNLOAD_CURRENCY,
  PREMIUM_DOWNLOAD_PRICE_CENTS,
} from '@/lib/billing/premium-access'
import { parseApiErrorResponse } from '@/lib/api/client-fetch'
import { cn } from '@/lib/utils'

interface SquareCheckoutConfig {
  enabled: boolean
  applicationId?: string
  locationId?: string
  sdkUrl?: string
}

interface SquareCheckoutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobDescription: string
  onSuccess: (result: {
    accessToken: string
    jobDescriptionHash: string
    expiresAt: number
    unlockedAt: number
  }) => void | Promise<void>
}

declare global {
  interface Window {
    Square?: {
      payments: (
        applicationId: string,
        locationId: string
      ) => Promise<{
        card: () => Promise<{
          attach: (selector: string) => Promise<void>
          tokenize: () => Promise<{
            status: string
            token?: string
            errors?: Array<{ detail?: string }>
          }>
        }>
      }>
    }
  }
}

function formatPrice(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(amountCents / 100)
}

function loadSquareSdk(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Square) {
      resolve()
      return
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-square-sdk="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Square SDK.')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.src = url
    script.async = true
    script.dataset.squareSdk = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Square SDK.'))
    document.body.appendChild(script)
  })
}

export function SquareCheckoutModal({
  open,
  onOpenChange,
  jobDescription,
  onSuccess,
}: SquareCheckoutModalProps) {
  const cardContainerId = useId().replace(/:/g, '')
  const cardRef = useRef<{ tokenize: () => Promise<{ status: string; token?: string }> } | null>(
    null
  )
  const [config, setConfig] = useState<SquareCheckoutConfig | null>(null)
  const [initializing, setInitializing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function bootstrap() {
      setInitializing(true)
      setReady(false)

      try {
        const response = await fetch('/api/checkout/square')
        const data = (await response.json()) as SquareCheckoutConfig

        if (!response.ok || !data.enabled || !data.applicationId || !data.locationId || !data.sdkUrl) {
          throw new Error('Square checkout is not configured.')
        }

        if (cancelled) return
        setConfig(data)
        await loadSquareSdk(data.sdkUrl)
        if (cancelled || !window.Square) return

        const payments = await window.Square.payments(data.applicationId, data.locationId)
        const card = await payments.card()
        await card.attach(`#${cardContainerId}`)
        cardRef.current = card
        setReady(true)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to initialize Square checkout.')
        onOpenChange(false)
      } finally {
        if (!cancelled) {
          setInitializing(false)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
      cardRef.current = null
      setReady(false)
    }
  }, [open, cardContainerId, onOpenChange])

  async function handleCheckout() {
    if (!cardRef.current) {
      toast.error('Payment form is not ready yet.')
      return
    }

    if (jobDescription.trim().length < 20) {
      toast.error('Paste a complete job description before unlocking a 24-Hour Job Pass.')
      return
    }

    setProcessing(true)
    try {
      const tokenResult = await cardRef.current.tokenize()
      if (tokenResult.status !== 'OK' || !tokenResult.token) {
        throw new Error('Card tokenization failed. Check your card details and try again.')
      }

      const response = await fetch('/api/checkout/square', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-payment',
          sourceId: tokenResult.token,
          idempotencyKey: crypto.randomUUID(),
          jobDescription: jobDescription.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error(await parseApiErrorResponse(response, 'Payment failed.'))
      }

      const data = (await response.json()) as {
        accessToken?: string
        status?: string
        jobDescriptionHash?: string
        expiresAt?: number
        unlockedAt?: number
      }
      if (
        !data.accessToken ||
        !data.jobDescriptionHash ||
        !data.expiresAt ||
        !data.unlockedAt ||
        (data.status !== 'COMPLETED' && data.status !== 'APPROVED')
      ) {
        throw new Error('Payment did not complete successfully.')
      }

      await onSuccess({
        accessToken: data.accessToken,
        jobDescriptionHash: data.jobDescriptionHash,
        expiresAt: data.expiresAt,
        unlockedAt: data.unlockedAt,
      })
      toast.success('24-Hour Job Pass activated for this role.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payment failed.')
    } finally {
      setProcessing(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="square-checkout-title"
        className="w-full max-w-md rounded-xl border border-border/80 bg-card p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-full bg-brand-gold/15 p-2 text-brand-gold">
            <Lock className="size-5" />
          </div>
          <div>
            <h2 id="square-checkout-title" className="font-heading text-xl font-semibold">
              Unlock 24-Hour Full Access
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Unlock 24-Hour Full Access for this role for {formatPrice(PREMIUM_DOWNLOAD_PRICE_CENTS, PREMIUM_DOWNLOAD_CURRENCY)}.
              Unlimited edits, tweaks, and re-downloads until your resume is completely perfect.
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between text-sm">
            <span>24-Hour Job Pass · this role</span>
            <span className="font-semibold">
              {formatPrice(PREMIUM_DOWNLOAD_PRICE_CENTS, PREMIUM_DOWNLOAD_CURRENCY)}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Includes unlimited resume edits, AI snippet tweaks, similarity-auditor checks, and
            PDF/DOCX/TXT re-downloads for the next 24 hours on this exact job description.
          </p>
        </div>

        <div
          id={cardContainerId}
          className={cn(
            'min-h-[112px] rounded-lg border bg-background p-3',
            initializing && 'opacity-60'
          )}
        />

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            className="flex-1"
            disabled={!ready || processing || initializing || jobDescription.trim().length < 20}
            onClick={() => void handleCheckout()}
          >
            {processing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>Unlock 24-Hour Job Pass</>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={processing}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>

        {config?.enabled ? (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Location ID verified server-side · {PREMIUM_DOWNLOAD_CURRENCY} · Square Web Payments SDK
          </p>
        ) : null}
      </div>
    </div>
  )
}