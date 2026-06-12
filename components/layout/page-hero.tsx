import { PAGE_CONTAINER_CLASS } from '@/lib/layout/container-classes'
import { cn } from '@/lib/utils'

interface PageHeroProps {
  eyebrow?: string
  title: string
  description: string
}

export function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary via-primary to-[oklch(0.26_0.07_260)] text-primary-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,oklch(0.72_0.12_75_/_0.18),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,oklch(1_0_0_/_0.08),transparent_40%)]" />
      <div
        className={cn(
          PAGE_CONTAINER_CLASS,
          'relative py-[clamp(2.5rem,5vw,3.5rem)]'
        )}
      >
        {eyebrow ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-heading max-w-3xl text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl lg:text-[2.5rem]">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-primary-foreground/90 sm:text-lg">
          {description}
        </p>
      </div>
    </section>
  )
}
