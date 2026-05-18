import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/PageHeader'
import { api, apiErrorMessage } from '@/lib/api'

const DEPTS = [
  ['HR', 'الموارد البشرية'],
  ['FINANCE', 'المالية'],
  ['SALES', 'المبيعات'],
  ['MARKETING', 'التسويق'],
  ['OPERATIONS', 'العمليات'],
  ['IT', 'تقنية المعلومات'],
  ['CUSTOMER_SERVICE', 'خدمة العملاء'],
  ['SUPPORT', 'الإمداد والدعم'],
  ['LOGISTICS', 'اللوجستيات'],
  ['QUALITY', 'الجودة'],
  ['PROJECTS', 'المشاريع'],
  ['GOVERNANCE', 'الحوكمة'],
  ['COMPLIANCE', 'الامتثال'],
] as const

const TOOLING = [
  ['none', 'لا يوجد — يدوي'],
  ['basic', 'أساسي — جداول'],
  ['modern', 'حديث — برامج سحابية'],
  ['advanced', 'متقدم — منظومة متكاملة'],
] as const

const schema = z.object({
  companyName: z.string().min(1, 'مطلوب').max(120),
  departmentType: z.enum(DEPTS.map((d) => d[0]) as [string, ...string[]]),
  experienceYears: z.string().regex(/^\d+$/, 'أرقام فقط'),
  teamSize: z.string().regex(/^\d+$/, 'أرقام فقط'),
  toolingMaturity: z.enum(TOOLING.map((t) => t[0]) as [string, ...string[]]),
  topChallenge: z.string().min(3, 'اكتب ملاحظة قصيرة').max(280),
})
type Form = z.infer<typeof schema>

export function DiagnosticManagerPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { departmentType: 'HR', toolingMaturity: 'basic' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      await api.post('/api/diagnostic/manager', {
        ...values,
        experienceYears: Number(values.experienceYears),
        teamSize: Number(values.teamSize),
      })
      toast.success('تم حفظ التشخيص')
      navigate('/manager/dept-dashboard')
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'تعذّر إرسال التشخيص'))
    } finally {
      setSubmitting(false)
    }
  })

  const dept = watch('departmentType')
  const tooling = watch('toolingMaturity')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="تشخيص المدير"
        description="خمسة أسئلة لإعداد لوحة قيادة إدارتك."
      />

      <Card className="mx-auto w-full max-w-2xl overflow-hidden shadow-sm">
        <div className="h-1.5 bg-gradient-to-l from-sky-500 via-teal-500 to-emerald-500" />
        <CardHeader>
          <CardTitle>أخبرنا عن إدارتك</CardTitle>
          <CardDescription>إجاباتك تغذي لوحة الإدارة وتوصيات مؤشرات الأداء.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="companyName">اسم الشركة</Label>
              <Input id="companyName" {...register('companyName')} />
              {errors.companyName && (
                <p className="text-sm text-destructive">{errors.companyName.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>الإدارة</Label>
              <Select value={dept} onValueChange={(v) => setValue('departmentType', v as Form['departmentType'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPTS.map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 md:grid-cols-2 md:gap-4">
              <div className="grid gap-2">
                <Label htmlFor="experienceYears">سنوات الخبرة</Label>
                <Input id="experienceYears" type="number" min={0} {...register('experienceYears')} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="teamSize">حجم الفريق</Label>
                <Input id="teamSize" type="number" min={0} {...register('teamSize')} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>نضج الأدوات</Label>
              <Select value={tooling} onValueChange={(v) => setValue('toolingMaturity', v as Form['toolingMaturity'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOOLING.map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="topChallenge">أكبر تحدٍّ حالياً</Label>
              <Textarea id="topChallenge" rows={3} {...register('topChallenge')} />
              {errors.topChallenge && (
                <p className="text-sm text-destructive">{errors.topChallenge.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={submitting} className="mr-auto">
              {submitting ? 'جاري الحفظ…' : 'حفظ التشخيص'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
