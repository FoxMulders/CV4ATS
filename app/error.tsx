'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'

import { PageContainer } from '@/components/layout/page-container'
import { SiteHeader } from '@/components/layout/site-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SURFACE_ELEVATED_CLASS } from '@/lib/layout/container-classes'
import { cn } from '@/lib/utils'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader current="tailor" />
      <PageContainer
        as="main"
        className="flex flex-1 items-center justify-center py-[var(--space-page-y)]"
      >
        <Card className={cn(SURFACE_ELEVATED_CLASS, 'w-full max-w-lg')}>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-6 text-destructive" />
            </div>
            <CardTitle className="font-heading text-2xl">Something went wrong</CardTitle>
            <CardDescription>
              We hit an unexpected error. Your resume data was not saved — refresh and try again.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={reset}>
              <RefreshCw />
              Try again
            </Button>
            <Button variant="outline" onClick={() => (window.location.href = '/')}>
              Return home
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  )
}
