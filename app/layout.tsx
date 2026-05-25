import { Inter, Source_Serif_4 } from 'next/font/google'
import type { Metadata } from 'next'
import { Toaster } from 'sonner'

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

export const metadata: Metadata = {
  title: 'ATS4CV | ATS Resume Tailoring',
  description:
    'Professional ATS resume tailoring — keyword-optimized resumes, cover letters, and compliance scores for every application.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body className="min-h-screen antialiased font-sans">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
