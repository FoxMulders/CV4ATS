import type { MetadataRoute } from 'next'

import { PROFESSION_LANDING_PAGES } from '@/lib/seo/profession-landing-pages'
import { SITE_URL } from '@/lib/seo/site-metadata'

const siteUrl = SITE_URL

export default function sitemap(): MetadataRoute.Sitemap {
  const professionEntries: MetadataRoute.Sitemap = PROFESSION_LANDING_PAGES.map((page) => ({
    url: `${siteUrl}/tailor/${page.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.9,
  }))

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...professionEntries,
    {
      url: `${siteUrl}/jobs`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ]
}
