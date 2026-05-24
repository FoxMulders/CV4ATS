import { NextResponse } from 'next/server'
import { z } from 'zod'

import { searchJobs } from '@/lib/jobs/search'

const searchQuerySchema = z.object({
  query: z.string().optional().default('project manager'),
  location: z.string().optional().default('Edmonton'),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = searchQuerySchema.safeParse({
    query: searchParams.get('query') ?? undefined,
    location: searchParams.get('location') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid search parameters.' }, { status: 400 })
  }

  const result = await searchJobs(parsed.data.query, parsed.data.location)
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = searchQuerySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid search parameters.' }, { status: 400 })
    }

    const result = await searchJobs(parsed.data.query, parsed.data.location)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Job search failed.' }, { status: 500 })
  }
}
