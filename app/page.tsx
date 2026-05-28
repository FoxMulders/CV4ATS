import type { Metadata } from 'next'

import { TailorWorkspacePage } from '@/components/pages/tailor-workspace-page'

const HOME_TITLE = 'ATS Resume Builder & Cover Letter Tailoring Tool | ATS4CV'
const HOME_DESCRIPTION =
  'Tailor your resume and generate cover letters to beat automated tracking systems. Scan your resume against job descriptions using context-aware AI. Start for free.'

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: '/',
  },
  twitter: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
}

export default function HomePage() {
  return <TailorWorkspacePage showFaq />
}
