import { useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { aiPresentation } from '@/lib/aiApi'
import { apiErrorMessage } from '@/lib/api'

interface Deck {
  title: string
  slides: { title: string; bullets: string[] }[]
}

const SLIDE_TINTS = [
  'border-violet-200 bg-gradient-to-br from-violet-500/10 to-transparent',
  'border-rose-200   bg-gradient-to-br from-rose-500/10   to-transparent',
  'border-amber-200  bg-gradient-to-br from-amber-500/10  to-transparent',
  'border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-transparent',
  'border-sky-200    bg-gradient-to-br from-sky-500/10    to-transparent',
  'border-indigo-200 bg-gradient-to-br from-indigo-500/10 to-transparent',
  'border-fuchsia-200 bg-gradient-to-br from-fuchsia-500/10 to-transparent',
]

export function PresentationPage() {
  return (
    <StrategicShell
      title="مولّد العروض التقديمية"
      description="بضغطة زر، Claude يبني محتوى عرض احترافي للجهات المعنية من بيانات شركتك الحالية."
    >
      {(companyId) => <Generator companyId={companyId} />}
    </StrategicShell>
  )
}

function Generator({ companyId }: { companyId: string }) {
  const [deck, setDeck] = useState<Deck | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)

  async function generate() {
    setLoading(true)
    setDeck(null)
    setStep(0)
    try {
      const result = await aiPresentation({ companyId })
      setDeck(result)
      toast.success('تم توليد العرض')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر توليد العرض'))
    } finally {
      setLoading(false)
    }
  }

  function downloadAsMarkdown() {
    if (!deck) return
    const md = [
      `# ${deck.title}`,
      '',
      ...deck.slides.flatMap((s, i) => [
        `## الشريحة ${i + 1}: ${s.title}`,
        '',
        ...s.bullets.map((b) => `- ${b}`),
        '',
      ]),
    ].join('\n')
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${deck.title.replace(/\s+/g, '-')}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('تم تنزيل العرض بصيغة Markdown')
  }

  function downloadAsJson() {
    if (!deck) return
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${deck.title.replace(/\s+/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-bl from-rose-500/10 via-orange-500/5 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-rose-500 via-orange-500 to-amber-500" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">🎞️</span>
            توليد عرض جديد
          </CardTitle>
          <CardDescription>
            Claude يقرأ التشخيص، SWOT، الأهداف، وحالة الإدارات، ثم يبني ٧ شرائح جاهزة للعرض.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={generate} disabled={loading} size="lg">
            {loading ? 'جاري التوليد…' : '✨ ولّد العرض'}
          </Button>
        </CardFooter>
      </Card>

      {deck && (
        <>
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{deck.title}</CardTitle>
                <CardDescription>{deck.slides.length} شريحة جاهزة</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadAsMarkdown}>تنزيل MD</Button>
                <Button variant="outline" size="sm" onClick={downloadAsJson}>تنزيل JSON</Button>
                <Button size="sm" onClick={() => window.print()}>طباعة</Button>
              </div>
            </CardHeader>
          </Card>

          <Card className={`${SLIDE_TINTS[step % SLIDE_TINTS.length]} min-h-[360px]`}>
            <CardHeader>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>شريحة {step + 1} من {deck.slides.length}</span>
                <span>{Math.round(((step + 1) / deck.slides.length) * 100)}%</span>
              </div>
              <CardTitle className="text-2xl">{deck.slides[step].title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-base leading-relaxed">
                {deck.slides[step].bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span aria-hidden className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>← السابقة</Button>
              <Button variant="ghost" onClick={() => setStep((s) => Math.min(deck.slides.length - 1, s + 1))} disabled={step === deck.slides.length - 1}>التالية →</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">معاينة كل الشرائح</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {deck.slides.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setStep(i)}
                    className={`text-right rounded-xl border p-3 text-xs transition hover:-translate-y-0.5 hover:shadow-sm ${
                      i === step ? 'ring-2 ring-primary' : ''
                    } ${SLIDE_TINTS[i % SLIDE_TINTS.length]}`}
                  >
                    <div className="text-[10px] text-muted-foreground">شريحة {i + 1}</div>
                    <div className="mt-1 line-clamp-1 text-sm font-semibold">{s.title}</div>
                    <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                      {s.bullets.slice(0, 2).map((b, j) => <li key={j} className="line-clamp-1">• {b}</li>)}
                    </ul>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!deck && !loading && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <p>اضغط <span className="font-medium">"ولّد العرض"</span> فوق لإنشاء أول عرض.</p>
            <p className="mt-1 text-xs">يحتاج مفتاح Claude مفعّل في <code className="rounded bg-card px-1">server/.env</code></p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
