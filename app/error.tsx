'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'

import { SiteHeader } from '@/components/layout/site-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader current="tailor" />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="max-w-lg border-border/80 shadow-lg">
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
      </main>
    </div>
  )
}
