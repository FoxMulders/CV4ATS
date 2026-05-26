import { Inter, Source_Serif_4 } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'

import { SiteJsonLd } from '@/components/seo/site-json-ld'

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
    default: 'ATS4CV | 24-Hour Job Pass Resume Tailoring',
    template: '%s | ATS4CV',
  },
  description:
    'Tailor your resume to beat ATS scanners without sounding like a robot. Unlock a 24-Hour Job Pass per role for unlimited edits, anti-plagiarism checks, and re-downloads. Secure Square checkout for $4.99 CAD.',
  keywords: [
    'ATS resume',
    'resume tailoring',
    '24 hour job pass',
    'job description keywords',
    'anti-plagiarism resume',
    'cover letter generator',
    'ATS compliance score',
    'resume download pass',
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
    title: 'ATS4CV | 24-Hour Job Pass Resume Tailoring',
    description:
      'Context-aware resume tailoring with Exact Phrasing Auditor guardrails. One $4.99 CAD 24-Hour Job Pass unlocks unlimited edits and downloads for each target role.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ATS4CV | 24-Hour Job Pass Resume Tailoring',
    description:
      'Beat corporate scanners without copy-paste keyword stuffing. Unlimited tweaks and re-downloads for 24 hours per job description.',
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
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
