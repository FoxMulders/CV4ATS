import {
  PREMIUM_DOWNLOAD_CURRENCY,
  PREMIUM_DOWNLOAD_NOTE,
  PREMIUM_DOWNLOAD_PRICE_CENTS,
} from '@/lib/billing/premium-access'

const SQUARE_API_VERSION = '2024-08-21'

function squareApiBaseUrl(): string {
  return process.env.SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'
}

function squareWebSdkUrl(): string {
  return process.env.SQUARE_ENVIRONMENT === 'production'
    ? 'https://web.squarecdn.com/v1/square.js'
    : 'https://sandbox.web.squarecdn.com/v1/square.js'
}

function requireSquareAccessToken(): string {
  const token = process.env.SQUARE_ACCESS_TOKEN?.trim()
  if (!token) {
    throw new Error('Square access token is not configured.')
  }
  return token
}

function requireSquareLocationId(): string {
  const locationId = process.env.SQUARE_LOCATION_ID?.trim()
  if (!locationId) {
    throw new Error('Square location ID is not configured.')
  }
  return locationId
}

export function getSquarePublicConfig() {
  const applicationId = process.env.SQUARE_APPLICATION_ID?.trim()
  const locationId = process.env.SQUARE_LOCATION_ID?.trim()

  if (!applicationId || !locationId) {
    return null
  }

  return {
    applicationId,
    locationId,
    sdkUrl: squareWebSdkUrl(),
    amountCents: PREMIUM_DOWNLOAD_PRICE_CENTS,
    currency: PREMIUM_DOWNLOAD_CURRENCY,
    note: PREMIUM_DOWNLOAD_NOTE,
  }
}

interface SquarePaymentResponse {
  payment?: {
    id?: string
    status?: string
  }
  errors?: Array<{ detail?: string; code?: string }>
}

interface SquareCheckoutLinkResponse {
  payment_link?: {
    id?: string
    url?: string
    long_url?: string
  }
  errors?: Array<{ detail?: string; code?: string }>
}

async function squareRequest<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${squareApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireSquareAccessToken()}`,
      'Content-Type': 'application/json',
      'Square-Version': SQUARE_API_VERSION,
    },
    body: JSON.stringify(body),
  })

  const data = (await response.json()) as T & { errors?: Array<{ detail?: string }> }

  if (!response.ok) {
    const detail = data.errors?.[0]?.detail ?? `Square API request failed (${response.status}).`
    throw new Error(detail)
  }

  if (data.errors?.length) {
    throw new Error(data.errors[0]?.detail ?? 'Square API returned an error.')
  }

  return data
}

export async function createSquarePayment(sourceId: string, idempotencyKey: string) {
  const data = await squareRequest<SquarePaymentResponse>('/v2/payments', {
    source_id: sourceId,
    idempotency_key: idempotencyKey,
    location_id: requireSquareLocationId(),
    amount_money: {
      amount: PREMIUM_DOWNLOAD_PRICE_CENTS,
      currency: PREMIUM_DOWNLOAD_CURRENCY,
    },
    note: PREMIUM_DOWNLOAD_NOTE,
  })

  const payment = data.payment
  if (!payment?.id) {
    throw new Error('Square did not return a payment ID.')
  }

  return payment
}

export async function retrieveSquarePayment(paymentId: string) {
  const response = await fetch(`${squareApiBaseUrl()}/v2/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${requireSquareAccessToken()}`,
      'Square-Version': SQUARE_API_VERSION,
    },
  })

  const data = (await response.json()) as SquarePaymentResponse
  if (!response.ok) {
    throw new Error(data.errors?.[0]?.detail ?? 'Failed to verify Square payment.')
  }

  return data.payment
}

export async function createSquareCheckoutLink(redirectUrl: string) {
  const data = await squareRequest<SquareCheckoutLinkResponse>('/v2/online-checkout/payment-links', {
    idempotency_key: crypto.randomUUID(),
    checkout_options: {
      redirect_url: redirectUrl,
    },
    pre_populated_data: {},
    payment_note: PREMIUM_DOWNLOAD_NOTE,
    order: {
      location_id: requireSquareLocationId(),
      line_items: [
        {
          name: PREMIUM_DOWNLOAD_NOTE,
          quantity: '1',
          base_price_money: {
            amount: PREMIUM_DOWNLOAD_PRICE_CENTS,
            currency: PREMIUM_DOWNLOAD_CURRENCY,
          },
        },
      ],
    },
  })

  const url = data.payment_link?.long_url ?? data.payment_link?.url
  if (!url) {
    throw new Error('Square did not return a checkout URL.')
  }

  return {
    url,
    paymentLinkId: data.payment_link?.id ?? '',
  }
}

export function isSquarePaymentCompleted(status: string | undefined): boolean {
  return status === 'COMPLETED' || status === 'APPROVED'
}
