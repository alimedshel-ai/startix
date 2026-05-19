import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { advisorStream, type ChatMessage } from '@/lib/aiApi'

const SAMPLE_PROMPTS = [
  'ما أهم ٣ خطوات أبدأ بها لتحسين الربحية في الـ٩٠ يوم القادمة؟',
  'حلّل نقاط الضعف في فريقي الحالي وكيف أعالجها؟',
  'اقترح ٥ مؤشرات أداء جوهرية لشركة في قطاعي.',
  'ما الفرق بين استراتيجية النمو واستراتيجية الربحية؟ أيهما يناسبني؟',
]

export function AdvisorPage() {
  return (
    <StrategicShell
      title="المستشار الاستراتيجي"
      description="محادثة مفتوحة مع Claude — أجاب يأخذ سياق شركتك ومسارها الاستراتيجي تلقائياً."
    >
      {(companyId) => <Chat companyId={companyId} />}
    </StrategicShell>
  )
}

function Chat({ companyId }: { companyId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, streaming])

  async function send(text: string) {
    const t = text.trim()
    if (!t || streaming) return
    setInput('')

    // Optimistic: push user msg + empty assistant placeholder
    setMessages((prev) => [...prev, { role: 'user', content: t }, { role: 'assistant', content: '' }])

    setStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      let assistantText = ''
      for await (const evt of advisorStream(
        { companyId, history: messages, message: t },
        controller.signal,
      )) {
        if (evt.type === 'delta') {
          assistantText += evt.text
          setMessages((prev) => {
            const next = [...prev]
            next[next.length - 1] = { role: 'assistant', content: assistantText }
            return next
          })
        } else if (evt.type === 'error') {
          toast.error(evt.message)
          // Replace empty assistant slot with the error or remove it
          setMessages((prev) => {
            const next = [...prev]
            if (next[next.length - 1].content === '') {
              next[next.length - 1] = { role: 'assistant', content: `⚠️ ${evt.message}` }
            }
            return next
          })
          break
        } else if (evt.type === 'done') {
          break
        }
      }
    } catch (err) {
      toast.error((err as Error).message || 'تعذّر الاتصال')
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function stop() {
    abortRef.current?.abort()
    setStreaming(false)
  }

  function clear() {
    setMessages([])
    setInput('')
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <Card className="flex h-[640px] flex-col overflow-hidden">
        <div className="h-1.5 bg-gradient-to-l from-violet-500 via-fuchsia-500 to-rose-500" />
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className="inline-block size-2 animate-pulse rounded-full bg-emerald-500" />
              متصل بـ Claude
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={clear} disabled={streaming || messages.length === 0}>
              مسح
            </Button>
          </div>
        </CardHeader>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
              <div>
                <div className="mb-2 text-4xl">💬</div>
                <p>ابدأ المحادثة باختيار اقتراح من الجانب،</p>
                <p>أو اكتب سؤالك في الأسفل.</p>
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border'
                }`}
              >
                {m.content}
                {streaming && i === messages.length - 1 && m.role === 'assistant' && (
                  <span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-muted-foreground" />
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="border-t bg-background/50 p-3">
          <div className="flex gap-2">
            <Textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="اكتب سؤالك… (Enter للإرسال، Shift+Enter لسطر جديد)"
              disabled={streaming}
              className="flex-1 resize-none"
            />
            {streaming ? (
              <Button variant="outline" onClick={stop}>إيقاف</Button>
            ) : (
              <Button onClick={() => send(input)} disabled={!input.trim()}>إرسال</Button>
            )}
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="bg-gradient-to-br from-violet-500/10 to-transparent border-violet-200">
          <CardHeader>
            <CardTitle className="text-sm">اقتراحات</CardTitle>
            <CardDescription className="text-xs">أمثلة للبدء.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {SAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => send(p)}
                disabled={streaming}
                className="block w-full rounded-lg border bg-card p-2.5 text-right text-xs leading-relaxed transition hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">معلومة</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground leading-relaxed">
            <p>كل محادثة تستخدم بيانات شركتك الحالية كسياق (اسم، قطاع، حجم، مرحلة، والمسار الموصى به).</p>
            <p className="mt-2">السجل لا يُحفظ بعد تحديث الصفحة.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
