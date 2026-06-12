import type { Metadata } from 'next'

import { TailorWorkspacePage } from '@/components/pages/tailor-workspace-page'
import { HomePageJsonLd } from '@/components/seo/site-json-ld'
import { buildFaqJsonLd } from '@/lib/seo/faq-schema'
import {
  HOME_HERO,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
  siteOpenGraph,
} from '@/lib/seo/site-metadata'

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    ...siteOpenGraph,
    url: SITE_URL,
  },
  twitter: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
}

export default function HomePage() {
  return (
    <>
      <HomePageJsonLd faqJsonLd={buildFaqJsonLd()} />
      <TailorWorkspacePage hero={HOME_HERO} showFaq />
    </>
  )
}
