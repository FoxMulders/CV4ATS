import { Inter, Source_Serif_4 } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'

import { SiteJsonLd } from '@/components/seo/site-json-ld'
import { GlobalAppShell } from '@/components/layout/global-app-shell'

import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ats-resume-builder-flax.vercel.app'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1e293b',
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'ATS Resume Builder & Cover Letter Tailoring Tool | ATS4CV',
    template: '%s | ATS4CV',
  },
  description:
    'Tailor your resume and generate cover letters to beat automated tracking systems. Scan your resume against job descriptions using context-aware AI. Start for free.',
  keywords: [
    'ATS resume builder',
    'resume tailoring',
    'cover letter generator',
    'ATS resume scanner',
    'tailor resume to job description',
    'ATS-compliant resume',
    'AI resume optimization',
    'keyword match report',
    'anti-plagiarism resume',
  ],
  authors: [{ name: 'ATS4CV' }],
  creator: 'ATS4CV',
  category: 'Business',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_CA',
    url: siteUrl,
    siteName: 'ATS4CV',
    title: 'ATS Resume Builder & Cover Letter Tailoring Tool | ATS4CV',
    description:
      'Tailor your resume and generate cover letters to beat automated tracking systems. Scan your resume against job descriptions using context-aware AI. Start for free.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ATS Resume Builder & Cover Letter Tailoring Tool | ATS4CV',
    description:
      'Tailor your resume and generate cover letters to beat automated tracking systems. Context-aware AI with anti-plagiarism guardrails. Start for free.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body className="min-h-screen antialiased font-sans">
        <SiteJsonLd />
        <GlobalAppShell>{children}</GlobalAppShell>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
