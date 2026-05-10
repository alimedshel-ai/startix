import { Link } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'

const FEATURES = [
  { title: 'Strategic Diagnostics', body: 'Owner, manager, and investor lenses powered by Claude.' },
  { title: '13 Department Audits', body: 'HR, Finance, Sales, Compliance and ten more — all in one place.' },
  { title: 'Saudi Compliance', body: 'Pre-loaded Saudi regulators and penalty estimates.' },
]

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-8 py-4">
        <span className="text-xl font-semibold">Startix</span>
        <nav className="flex gap-2">
          <Link to="/pricing" className={buttonVariants({ variant: 'ghost' })}>
            Pricing
          </Link>
          <Link to="/login" className={buttonVariants({ variant: 'ghost' })}>
            Sign in
          </Link>
          <Link to="/select-type" className={buttonVariants()}>
            Get started
          </Link>
        </nav>
      </header>

      <section className="flex flex-col items-center justify-center gap-6 px-8 py-24 text-center">
        <h1 className="text-balance text-5xl font-semibold tracking-tight">
          Strategy that runs your business, not the other way around.
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Startix helps Saudi businesses diagnose, plan, and execute strategy across 13 departments —
          with built-in compliance, AI analysis, and quarterly reviews.
        </p>
        <div className="flex gap-3">
          <Link to="/select-type" className={buttonVariants({ size: 'lg' })}>
            Start free
          </Link>
          <Link
            to="/pricing"
            className={buttonVariants({ size: 'lg', variant: 'outline' })}
          >
            See pricing
          </Link>
        </div>
      </section>

      <section className="grid gap-6 border-t px-8 py-16 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-lg border p-6">
            <h3 className="mb-2 font-medium">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto border-t px-8 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Startix
      </footer>
    </div>
  )
}
