const FAQ_ITEMS = [
  {
    question: 'What is an ATS-compliant resume template?',
    answer:
      'An ATS-compliant resume uses a single-column layout, standard section headings (Summary, Skills, Experience, Education), and plain text formatting that applicant tracking systems can parse accurately. cv2ats rebuilds your resume for both ATS parsers and human recruiters—without rigid templates that strip your authentic career story.',
  },
  {
    question: 'How do I tailor my resume to a specific job description?',
    answer:
      'Paste the target job description and your current resume into cv2ats. Our AI-powered ATS resume tailoring scans the posting for methodologies, tools, and competencies, then weaves matching terms into your summary, skills, and accomplishment bullets—semantically, not by copy-pasting phrases from the posting.',
  },
  {
    question: 'Can recruiters tell if an AI wrote my cover letter?',
    answer:
      'Generic AI cover letters often sound templated and may reuse job-description phrasing recruiters recognize instantly. cv2ats applies anti-plagiarism guardrails—including an Exact Phrasing Auditor that flags 4+ consecutive words copied from the posting—so your cover letter reads as a strategic, human-sounding pitch grounded in your real experience.',
  },
  {
    question: 'Does cv2ats store my resume on your servers?',
    answer:
      'No. Your resume is processed in memory for generation and can be saved locally in your browser for convenience. It is not permanently stored or sold. Premium exports unlock through secure Square checkout.',
  },
] as const

export type FaqItem = (typeof FAQ_ITEMS)[number]

export const SEO_FAQ_ITEMS: readonly FaqItem[] = FAQ_ITEMS

export function buildFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}
