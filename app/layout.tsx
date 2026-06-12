import { Inter, Source_Serif_4 } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'

import { SiteJsonLd } from '@/components/seo/site-json-ld'
import { GlobalAppShell } from '@/components/layout/global-app-shell'
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_TITLE,
  SITE_URL,
  siteOpenGraph,
} from '@/lib/seo/site-metadata'

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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1e293b',
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s | cv2ats',
  },
  description: SITE_DESCRIPTION,
  keywords: [...SITE_KEYWORDS],
  applicationName: 'cv2ats',
  authors: [{ name: 'cv2ats', url: SITE_URL }],
  creator: 'cv2ats',
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
  openGraph: siteOpenGraph,
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-CA" className={`${inter.variable} ${sourceSerif.variable} h-full`}>
      <body className="h-full antialiased font-sans">
        <SiteJsonLd />
        <GlobalAppShell>{children}</GlobalAppShell>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
