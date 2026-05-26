import { parseApiErrorResponse } from '@/lib/api/client-fetch'

export async function handleCheckout(
  sourceId: string,
  idempotencyKey: string,
  jobDescription: string
) {
  const response = await fetch('/api/checkout/square', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create-payment',
      sourceId,
      idempotencyKey,
      jobDescription,
    }),
  })

  if (!response.ok) {
    throw new Error(await parseApiErrorResponse(response, 'Square checkout failed.'))
  }

  return (await response.json()) as {
    status: string
    paymentId: string
    accessToken: string
    jobDescriptionHash: string
    unlockedAt: number
    expiresAt: number
  }
}
