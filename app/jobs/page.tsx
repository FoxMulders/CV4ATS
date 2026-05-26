import type { Metadata } from 'next'

import { JobSearchPanel } from '@/components/jobs/job-search-panel'
import { PageHero } from '@/components/layout/page-hero'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { TrustBanner } from '@/components/layout/trust-banner'

export const metadata: Metadata = {
  title: 'Edmonton SDLC & IT PM Job Search',
  description:
    'Search Edmonton-area SDLC, application development, and IT operations PM roles. Tailor your resume with ATS4CV and unlock a 24-Hour Job Pass for unlimited role-specific downloads.',
  alternates: {
    canonical: '/jobs',
  },
  openGraph: {
    title: 'ATS4CV Job Search | Edmonton SDLC & IT PM Roles',
    description:
      'Find target roles and tailor your resume with context-aware ATS optimization and 24-Hour Job Pass exports.',
  },
}

export default function JobsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <SiteHeader current="jobs" />

      <PageHero
        eyebrow="Edmonton job search"
        title="SDLC & IT application PM roles"
        description="Software delivery, application development, and technical IT operations project management across Edmonton-area employers — with one-click tailoring for every listing."
      />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-10 sm:px-6">
        <TrustBanner message="Your resume is processed in memory and never stored. Apply links open the employer's official application portal." />

        <JobSearchPanel />
      </main>

      <SiteFooter />
    </div>
  )
}
