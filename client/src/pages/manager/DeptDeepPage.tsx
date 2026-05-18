import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const PROMPTS = [
  'ما هو القيد الأكبر الذي يعيق هذا القسم اليوم؟',
  'أي عملية تبدو هشّة، وكم ستكلّف لو فشلت غداً؟',
  'لو كنت تستطيع أتمتة مهمة واحدة أو حذفها في هذا القسم، فماذا ستكون؟',
  'ما هي الممارسة الجيدة الراسخة هنا والتي تستحق التوسّع؟',
]

export function DeptDeepPage() {
  const [answers, setAnswers] = useState<Record<number, string>>({})

  function save() {
    const written = Object.values(answers).filter(Boolean).length
    if (written === 0) {
      toast.error('اكتب إجابة واحدة على الأقل قبل الحفظ.')
      return
    }
    // Phase 5 keeps this local (no model linked yet); Phase 7 will pipe it
    // through the AI layer.
    toast.success(`تم حفظ ${written} إجابة محلياً.`)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="تحليل عميق للقسم"
        description="تأمل بنص حر. يُغذّي طبقة الذكاء الاصطناعي في المرحلة 7؛ يُحفظ محلياً مؤقتاً."
      />

      {PROMPTS.map((p, i) => (
        <Card key={i} className="bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-200 transition hover:-translate-y-0.5 hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-base">السؤال {i + 1}</CardTitle>
            <CardDescription>{p}</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor={`p_${i}`} className="sr-only">الإجابة على السؤال {i + 1}</Label>
            <Textarea
              id={`p_${i}`}
              value={answers[i] ?? ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
              rows={4}
              placeholder="اكتب إجابتك…"
            />
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={save}>حفظ</Button>
      </div>
    </div>
  )
}
