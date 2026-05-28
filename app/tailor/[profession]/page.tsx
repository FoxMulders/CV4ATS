import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { TailorWorkspacePage } from '@/components/pages/tailor-workspace-page'
import {
  PROFESSION_SLUGS,
  getProfessionLanding,
} from '@/lib/seo/profession-landing-pages'

type PageProps = {
  params: Promise<{ profession: string }>
}

export function generateStaticParams() {
  return PROFESSION_SLUGS.map((profession) => ({ profession }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { profession } = await params
  const config = getProfessionLanding(profession)
  if (!config) return {}

  const title = `${config.title} | ATS4CV`

  return {
    title,
    description: config.metaDescription,
    alternates: {
      canonical: `/tailor/${config.slug}`,
    },
    openGraph: {
      title,
      description: config.metaDescription,
      url: `/tailor/${config.slug}`,
    },
    twitter: {
      title,
      description: config.metaDescription,
    },
  }
}

export default async function ProfessionTailorPage({ params }: PageProps) {
  const { profession } = await params
  const config = getProfessionLanding(profession)
  if (!config) notFound()

  return (
    <TailorWorkspacePage
      hero={config.hero}
      initialJobDescription={config.sampleJobDescription}
      coverLetterFieldId={`cover-letter-${config.slug}`}
    />
  )
}
