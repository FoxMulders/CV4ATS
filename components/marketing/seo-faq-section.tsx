import { SEO_FAQ_ITEMS } from '@/lib/seo/faq-schema'
import { SURFACE_CARD_CLASS } from '@/lib/layout/container-classes'
import { cn } from '@/lib/utils'



export function SeoFaqSection({ embedded = false }: { embedded?: boolean }) {

  const content = (

    <>

      {!embedded ? (

        <div className="mb-6 max-w-3xl space-y-2">

          <h2 id="seo-faq-heading" className="font-heading text-2xl font-semibold text-foreground">

            ATS resume tailoring FAQ

          </h2>

          <p className="text-base text-muted-foreground sm:text-base">

            Answers to common questions about ATS-compliant resumes, job-description tailoring, and

            AI cover letter quality.

          </p>

        </div>

      ) : null}

      <div className="space-y-3">

        {SEO_FAQ_ITEMS.map((item) => (

          <details

            key={item.question}

            className="group rounded-[var(--radius-surface)] border border-border/70 bg-muted/20 px-[var(--space-inline)] py-3 open:bg-muted/30"

          >

            <summary className="cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden">

              <span className="flex min-h-12 items-center justify-between gap-3 py-1">

                <h3 className="text-base font-semibold text-foreground">{item.question}</h3>

                <span

                  aria-hidden="true"

                  className="shrink-0 text-muted-foreground transition group-open:rotate-45"

                >

                  +

                </span>

              </span>

            </summary>

            <p className="mt-1 text-base leading-relaxed text-muted-foreground">{item.answer}</p>

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

      className={cn(SURFACE_CARD_CLASS, 'rounded-[var(--radius-surface-lg)] p-[var(--space-section)]')}

    >

      {content}

    </section>

  )

}


