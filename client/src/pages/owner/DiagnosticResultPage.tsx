import { Link } from 'react-router-dom'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { PathBadge } from '@/components/PathBadge'
import { RadarChart } from '@/components/charts/RadarChart'
import { useDiagnosticStore } from '@/store/diagnosticStore'

export function DiagnosticResultPage() {
  const result = useDiagnosticStore((s) => s.result)
  const reset = useDiagnosticStore((s) => s.reset)

  if (!result) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Diagnostic result" />
        <EmptyState
          title="No diagnostic yet"
          description="Run the owner diagnostic first to see your strategic path and roadmap."
          action={
            <Link to="/diagnostic/owner" className={buttonVariants()}>
              Start owner diagnostic
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Diagnostic result"
        description="Strategic path, maturity, radar profile, and your top 4 urgent actions."
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                reset()
              }}
            >
              Retake
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-5">
          <CardHeader>
            <CardDescription>Recommended strategic path</CardDescription>
            <CardTitle className="flex items-center gap-3">
              <PathBadge path={result.strategicPath} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-semibold">{result.maturityScore}</div>
              <div className="text-sm text-muted-foreground">/ 100 maturity</div>
            </div>
            <ul className="mt-4 grid gap-1 text-xs text-muted-foreground">
              {(['EMERGENCY_RISK', 'NASCENT_CAUTIOUS', 'GROWING_CHAOTIC', 'MATURE_COMPETITIVE'] as const).map(
                (k) => (
                  <li key={k} className="flex justify-between">
                    <span>{k.replace('_', ' / ').toLowerCase()}</span>
                    <span>{result.pathScores[k]}</span>
                  </li>
                )
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="md:col-span-7">
          <CardHeader>
            <CardTitle>Capability radar</CardTitle>
            <CardDescription>Governance · Financial · Team · Digital — each 0-100.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadarChart data={result.radarData} />
          </CardContent>
        </Card>

        <Card className="md:col-span-6">
          <CardHeader>
            <CardTitle>Top weaknesses</CardTitle>
            <CardDescription>Lowest-scoring dimensions to address first.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {result.weaknesses.map((w) => (
                <li key={w.key} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                  <span>{w.label}</span>
                  <span className="text-muted-foreground">{w.pct}%</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="md:col-span-6">
          <CardHeader>
            <CardTitle>Urgent actions</CardTitle>
            <CardDescription>Four moves to execute over the next 90 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid list-decimal gap-3 pl-5 text-sm">
              {result.roadmap.map((a, i) => (
                <li key={`${a.source}-${i}`}>
                  <span className="font-medium">{a.title}.</span>{' '}
                  <span className="text-muted-foreground">{a.detail}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="md:col-span-12">
          <CardHeader>
            <CardTitle>Scenario previews</CardTitle>
            <CardDescription>
              Two directional outcomes for the {result.strategicPath.toLowerCase().replace('_', ' / ')} path.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {result.scenarios.map((s) => (
              <div key={s.name} className="rounded-md border p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.name}</div>
                <div className="mt-1 font-medium">{s.headline}</div>
                <p className="mt-2 text-sm text-muted-foreground">{s.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
