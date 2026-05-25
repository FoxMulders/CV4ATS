import { JobSearchPanel } from '@/components/jobs/job-search-panel'
import { PageHero } from '@/components/layout/page-hero'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { TrustBanner } from '@/components/layout/trust-banner'

export default function JobsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <SiteHeader current="jobs" />

      <PageHero
        eyebrow="Edmonton job search"
        title="SDLC & IT application PM roles"
        description="Software delivery, application development, and technical IT operations project management — with one-click tailoring for every listing."
      />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-10 sm:px-6">
        <TrustBanner message="Your resume is processed in memory and never stored. Apply links open the employer's official application portal." />

        <JobSearchPanel />
      </main>

      <SiteFooter />
    </div>
  )
}
