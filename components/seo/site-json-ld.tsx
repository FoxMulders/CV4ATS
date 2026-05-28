const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ats-resume-builder-flax.vercel.app'

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ATS4CV',
  url: siteUrl,
  description:
    'AI-powered ATS resume builder and cover letter tailoring tool with anti-plagiarism guardrails.',
}

const webApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'ATS4CV',
  url: siteUrl,
  operatingSystem: 'All',
  applicationCategory: 'BusinessApplication',
  description:
    'Tailor your resume and generate cover letters to beat automated tracking systems. Scan your resume against job descriptions using context-aware AI.',
  offers: {
    '@type': 'Offer',
    price: '4.99',
    priceCurrency: 'CAD',
    description: '24-Hour Job Pass with unlimited edits and re-downloads for one target role',
  },
  featureList: [
    'AI-powered ATS resume tailoring',
    'AI resume scanner with anti-plagiarism guardrails',
    'Cover letter generation',
    'Keyword match and ATS compliance scoring',
    'Exact Phrasing Auditor',
  ],
}

const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ATS4CV',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: siteUrl,
  offers: {
    '@type': 'Offer',
    price: '4.99',
    priceCurrency: 'CAD',
    description: '24-Hour Job Pass with unlimited edits and re-downloads for one target role',
  },
  featureList: [
    'AI-powered ATS resume tailoring',
    'AI resume scanner with anti-plagiarism guardrails',
    'Adaptive phrase diversification',
    '24-Hour Job Pass per role',
    'Square secure checkout',
  ],
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ATS4CV',
  url: siteUrl,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${siteUrl}/jobs?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
}

export function SiteJsonLd() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
    </>
  )
}
