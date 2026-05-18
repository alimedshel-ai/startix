import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const PROMPTS = [
  'What is the single biggest constraint holding this department back today?',
  'Which process feels brittle, and what would it cost if it failed tomorrow?',
  'If you could automate or eliminate one task in this department, what would it be?',
  'What good practice is well established here that deserves to be expanded?',
]

export function DeptDeepPage() {
  const [answers, setAnswers] = useState<Record<number, string>>({})

  function save() {
    const written = Object.values(answers).filter(Boolean).length
    if (written === 0) {
      toast.error('Write at least one answer before saving.')
      return
    }
    // Phase 5 keeps this local (no model linked yet); Phase 7 will pipe it
    // through the AI layer.
    toast.success(`${written} answer${written === 1 ? '' : 's'} saved locally.`)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Department deep dive"
        description="Free-text reflection. Feeds the AI layer in Phase 7; for now it's kept locally."
      />

      {PROMPTS.map((p, i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle className="text-base">Prompt {i + 1}</CardTitle>
            <CardDescription>{p}</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor={`p_${i}`} className="sr-only">Answer to prompt {i + 1}</Label>
            <Textarea
              id={`p_${i}`}
              value={answers[i] ?? ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
              rows={4}
              placeholder="Type your answer…"
            />
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={save}>Save</Button>
      </div>
    </div>
  )
}
