import { ShieldCheck } from 'lucide-react'

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/80 bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-heading text-sm font-semibold text-foreground">ATS4CV</p>
          <p className="text-xs text-muted-foreground">
            Keyword-optimized resumes, cover letters, and ATS compliance scoring.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-brand-gold" />
          <span>Processed in memory · Never stored · No account required</span>
        </div>
      </div>
    </footer>
  )
}
