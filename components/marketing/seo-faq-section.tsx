const FAQ_ITEMS = [
  {
    question: 'What is an ATS-compliant resume template?',
    answer:
      'An ATS-compliant resume uses a single-column layout, standard section headings (Summary, Skills, Experience, Education), and plain text formatting that applicant tracking systems can parse accurately. ATS4CV rebuilds your resume for both ATS parsers and human recruiters—without rigid templates that strip your authentic career story.',
  },
  {
    question: 'How do I tailor my resume to a specific job description?',
    answer:
      'Paste the target job description and your current resume into ATS4CV. Our AI-powered ATS resume tailoring scans the posting for methodologies, tools, and competencies, then weaves matching terms into your summary, skills, and accomplishment bullets—semantically, not by copy-pasting phrases from the posting.',
  },
  {
    question: 'Can recruiters tell if an AI wrote my cover letter?',
    answer:
      'Generic AI cover letters often sound templated and may reuse job-description phrasing recruiters recognize instantly. ATS4CV applies anti-plagiarism guardrails—including an Exact Phrasing Auditor that flags 4+ consecutive words copied from the posting—so your cover letter reads as a strategic, human-sounding pitch grounded in your real experience.',
  },
  {
    question: 'Does ATS4CV store my resume on your servers?',
    answer:
      'No. Your resume is processed in memory for generation and can be saved locally in your browser for convenience. It is not permanently stored or sold. Premium exports unlock through secure Square checkout.',
  },
] as const

function buildFaqJsonLd() {
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

export function SeoFaqSection({ embedded = false }: { embedded?: boolean }) {
  const content = (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd()) }}
      />
      {!embedded ? (
        <div className="mb-6 max-w-3xl space-y-2">
          <h2 id="seo-faq-heading" className="font-heading text-2xl font-semibold text-foreground">
            ATS resume tailoring FAQ
          </h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            Answers to common questions about ATS-compliant resumes, job-description tailoring, and
            AI cover letter quality.
          </p>
        </div>
      ) : null}
      <div className="space-y-3">
        {FAQ_ITEMS.map((item) => (
          <details
            key={item.question}
            className="group rounded-lg border border-border/70 bg-muted/20 px-4 py-3 open:bg-muted/30"
          >
            <summary className="cursor-pointer list-none text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-3">
                {item.question}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-muted-foreground transition group-open:rotate-45"
                >
                  +
                </span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </div>
    </>
  )

  if (embedded) {
    return content
  }

  return (
    <section
      aria-labelledby="seo-faq-heading"
      className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm sm:p-8"
    >
      {content}
    </section>
  )
}
