const FEATURES: Array<{
  icon: string
  title: string
  badge?: string
  description: string
}> = [
  {
    icon: '🧠',
    title: 'Context-Aware Tailoring',
    badge: 'Our Core Moat',
    description:
      'Instead of using rigid templates, our system reads your authentic career history and seamlessly blends missing skills into your natural writing style.',
  },
  {
    icon: '🚫',
    title: 'Anti-Plagiarism Guardrails',
    description:
      'Our built-in Exact Phrasing Auditor actively flags sequences of 4+ identical words from the job posting, protecting you from automated similarity filters and cynical recruiters.',
  },
  {
    icon: '✨',
    title: 'Adaptive Phrase Diversification',
    description:
      'Our onboard AI strictly ensures that no two bullet points or edit cards share the same sentence mechanics, keeping your final document completely unique.',
  },
  {
    icon: '🔒',
    title: 'Complete Privacy & Secure Checkout',
    description:
      'Your resume data is processed entirely in memory and is never permanently stored or sold. Unlock a 24-Hour Job Pass with secure Square checkout for unlimited edits and re-downloads per role for just $4.99.',
  },
] 

export function CompetitiveAdvantagesSection() {
  function scrollToWorkspace() {
    document.getElementById('tailor-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section
      aria-labelledby="competitive-advantages-heading"
      className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.08] via-card to-brand-gold/[0.08] p-6 shadow-sm sm:p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,oklch(0.72_0.12_75_/_0.12),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,oklch(0.32_0.08_260_/_0.08),transparent_40%)]" />

      <div className="relative space-y-6">
        <div className="max-w-4xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold">
            Why ATS4CV beats traditional resume builders
          </p>
          <h2
            id="competitive-advantages-heading"
            className="font-heading text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl"
          >
            The Smartest Way to Align with Corporate Scanners—Without Sounding Like a Robot.
          </h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Traditional resume tailoring tools trap you into copy-pasting generic keywords that human
            recruiters flag instantly. ATS4CV uses context-aware contextual intelligence to write
            natural, distinct achievements tailored to your specific target role.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="group rounded-xl border border-border/70 bg-card/90 p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-gold/40 hover:shadow-md"
            >
              <div className="mb-3 flex items-center gap-2">
                <span aria-hidden="true" className="text-xl">
                  {feature.icon}
                </span>
                <h3 className="text-sm font-semibold leading-snug text-foreground">
                  {feature.title}
                  {feature.badge ? (
                    <span className="mt-1 block text-[11px] font-medium uppercase tracking-wide text-brand-gold">
                      {feature.badge}
                    </span>
                  ) : null}
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </article>
          ))}
        </div>

        <div>
          <button
            type="button"
            onClick={scrollToWorkspace}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            Start Tailoring ↓
          </button>
        </div>
      </div>
    </section>
  )
}
