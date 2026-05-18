import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiErrorMessage } from '@/lib/api'
import { createCompany } from '@/lib/deptApi'

const SIZES = [
  ['MICRO', 'متناهية الصغر (1–9)'],
  ['SMALL', 'صغيرة (10–49)'],
  ['MEDIUM', 'متوسطة (50–249)'],
  ['LARGE', 'كبيرة (250+)'],
] as const

export function AddCompanyPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [sector, setSector] = useState('')
  const [size, setSize] = useState<typeof SIZES[number][0]>('SMALL')
  const [stage, setStage] = useState('')
  const [country, setCountry] = useState('SA')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('اسم الشركة مطلوب')
      return
    }
    setSubmitting(true)
    try {
      await createCompany({
        name: name.trim(),
        sector: sector.trim() || undefined,
        size,
        stage: stage.trim() || undefined,
        country: country.trim() || 'SA',
      })
      toast.success('تم إنشاء الشركة')
      navigate('/companies')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر إنشاء الشركة'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="إضافة شركة"
        description="إنشاء كيان شركة جديد."
        breadcrumbs={[{ label: 'الشركات', to: '/companies' }, { label: 'إضافة' }]}
      />

      <Card className="overflow-hidden shadow-sm">
        <div className="h-1.5 bg-gradient-to-l from-indigo-500 via-sky-500 to-teal-500" />
        <CardHeader>
          <CardTitle>تفاصيل الشركة</CardTitle>
          <CardDescription>القطاع والحجم والمرحلة تساعد في تخصيص التشخيص وتدقيق الامتثال.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="name">الاسم</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="شركتي" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sector">القطاع</Label>
              <Input id="sector" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="تجزئة، تقنية، تصنيع…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="size">حجم الكيان</Label>
              <select
                id="size"
                className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                value={size}
                onChange={(e) => setSize(e.target.value as typeof SIZES[number][0])}
              >
                {SIZES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="stage">المرحلة</Label>
              <Input id="stage" value={stage} onChange={(e) => setStage(e.target.value)} placeholder="ناشئة، متوسعة، مستقرة…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="country">الدولة (رمز ISO-2)</Label>
              <Input id="country" dir="ltr" className="text-left" value={country} onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={submitting}>{submitting ? 'جاري الإنشاء…' : 'إنشاء الشركة'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
