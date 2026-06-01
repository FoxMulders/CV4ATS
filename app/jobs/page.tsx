import type { Metadata } from 'next'

import { JobSearchPanel } from '@/components/jobs/job-search-panel'
import { PageHero } from '@/components/layout/page-hero'
import { SiteHeader } from '@/components/layout/site-header'
import { TrustBanner } from '@/components/layout/trust-banner'

export const metadata: Metadata = {
  title: 'Edmonton Job Search',
  description:
    'Search Edmonton-area roles in any field. Tailor your resume with ATS4CV and unlock a 24-Hour Job Pass for unlimited role-specific downloads.',
  alternates: {
    canonical: '/jobs',
  },
  openGraph: {
    title: 'ATS4CV Job Search | Find Any Edmonton Role',
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
        title="Find any role — tailor your resume"
        description="Search by job title or keywords across Edmonton-area employers, paste a direct posting link, and tailor your resume for each opening with one click."
      />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-10 sm:px-6">
        <TrustBanner message="Your resume is processed in memory and never stored. Apply links open the employer's official application portal." />

        <JobSearchPanel />
      </main>
    </div>
  )
}
