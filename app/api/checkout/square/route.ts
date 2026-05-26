import { NextResponse } from 'next/server'
import { z } from 'zod'

import { safeErrorMessage } from '@/lib/api/safe-error'
import { hashJobDescriptionSync } from '@/lib/billing/job-description-hash'
import { createPremiumAccessToken } from '@/lib/billing/premium-access'
import {
  createSquareCheckoutLink,
  createSquarePayment,
  getSquarePublicConfig,
  isSquarePaymentCompleted,
  retrieveSquarePayment,
} from '@/lib/billing/square-client'

export const runtime = 'nodejs'

const paymentSchema = z.object({
  action: z.literal('create-payment'),
  sourceId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  jobDescription: z.string().min(20),
})

const verifySchema = z.object({
  action: z.literal('verify-payment'),
  paymentId: z.string().min(1),
  jobDescription: z.string().min(20),
})

const checkoutLinkSchema = z.object({
  action: z.literal('create-checkout-link'),
  redirectUrl: z.string().url(),
})

const requestSchema = z.discriminatedUnion('action', [
  paymentSchema,
  verifySchema,
  checkoutLinkSchema,
])

function issueJobPass(paymentId: string, jobDescription: string) {
  const jobDescriptionHash = hashJobDescriptionSync(jobDescription)
  const { token, payload } = createPremiumAccessToken(paymentId, jobDescriptionHash)

  return {
    accessToken: token,
    jobDescriptionHash,
    unlockedAt: payload.unlockedAt,
    expiresAt: payload.expiresAt,
  }
}

export async function GET() {
  const config = getSquarePublicConfig()
  if (!config) {
    return NextResponse.json(
      { enabled: false, error: 'Square checkout is not configured.' },
      { status: 503 }
    )
  }

  return NextResponse.json({
    enabled: true,
    ...config,
    passDurationHours: 24,
    productLabel: '24-Hour Job Pass',
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid checkout request.' }, { status: 400 })
    }

    if (parsed.data.action === 'create-payment') {
      const payment = await createSquarePayment(parsed.data.sourceId, parsed.data.idempotencyKey)

      if (!isSquarePaymentCompleted(payment.status)) {
        return NextResponse.json(
          { error: `Payment not completed. Status: ${payment.status ?? 'UNKNOWN'}.` },
          { status: 402 }
        )
      }

      return NextResponse.json({
        status: payment.status,
        paymentId: payment.id,
        ...issueJobPass(payment.id!, parsed.data.jobDescription),
      })
    }

    if (parsed.data.action === 'verify-payment') {
      const payment = await retrieveSquarePayment(parsed.data.paymentId)

      if (!isSquarePaymentCompleted(payment?.status)) {
        return NextResponse.json(
          { error: `Payment not completed. Status: ${payment?.status ?? 'UNKNOWN'}.` },
          { status: 402 }
        )
      }

      return NextResponse.json({
        status: payment?.status,
        paymentId: payment?.id,
        ...issueJobPass(payment!.id!, parsed.data.jobDescription),
      })
    }

    const checkout = await createSquareCheckoutLink(parsed.data.redirectUrl)
    return NextResponse.json(checkout)
  } catch (error) {
    console.error('Square checkout error:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Square checkout failed.') },
      { status: 500 }
    )
  }
}
