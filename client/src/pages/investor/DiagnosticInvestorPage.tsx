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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/PageHeader'
import { api, apiErrorMessage } from '@/lib/api'

const PORTFOLIO = [
  ['1', 'شركة واحدة'],
  ['2-5', '٢–٥ شركات'],
  ['6-15', '٦–١٥ شركة'],
  ['16+', '١٦+ شركة'],
] as const
const STAGE = [
  ['seed', 'تأسيس'],
  ['early', 'مرحلة مبكرة'],
  ['growth', 'نمو'],
  ['late', 'مرحلة متأخرة / مدرجة'],
] as const
const CADENCE = [
  ['monthly', 'شهري'],
  ['quarterly', 'ربعي'],
  ['annual', 'سنوي'],
] as const

const schema = z.object({
  companyName: z.string().min(1, 'مطلوب').max(120),
  portfolioSize: z.enum(PORTFOLIO.map((p) => p[0]) as [string, ...string[]]),
  investmentStage: z.enum(STAGE.map((s) => s[0]) as [string, ...string[]]),
  monitoringCadence: z.enum(CADENCE.map((c) => c[0]) as [string, ...string[]]),
})
type Form = z.infer<typeof schema>

export function DiagnosticInvestorPage() {
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
    defaultValues: { portfolioSize: '1', investmentStage: 'seed', monitoringCadence: 'quarterly' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      // ─── تحويل الفورم إلى schema السيرفر ─────────────────────────
      // السيرفر يتطلّب ٧ حقول (schema investorSchema)، الفورم يجمع ٤
      // منها فقط. نستكمل الباقية بقيم افتراضية معتدلة يمكن للمستثمر
      // تعديلها لاحقاً من إعدادات حسابه.
      await api.post('/api/diagnostic/investor', {
        ...values,
        sectorFocus: 'diverse',       // معتدل — لا تركّز في قطاع واحد
        involvementType: 'observer',  // معتدل — بين نشط وسلبي
        ticketSize: '100k_1m',        // معتدل — نطاق شائع للمستثمر السعودي
      })
      toast.success('تم حفظ التشخيص')
      navigate('/investor/dashboard')
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'تعذّر إرسال التشخيص'))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="تشخيص المستثمر"
        description="ثلاثة أسئلة لضبط لوحة المحفظة."
      />

      <Card className="mx-auto w-full max-w-2xl overflow-hidden shadow-sm">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
        <CardHeader>
          <CardTitle>ملف المحفظة</CardTitle>
          <CardDescription>إجاباتك تشكّل وتيرة المتابعة ومربعات اللوحة.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="companyName">اسم المحفظة</Label>
              <Input id="companyName" placeholder="مثال: صندوق الرياض للنمو" {...register('companyName')} />
              {errors.companyName && (
                <p className="text-sm text-destructive">{errors.companyName.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>حجم المحفظة</Label>
              <Select
                value={watch('portfolioSize')}
                onValueChange={(v) => setValue('portfolioSize', v as Form['portfolioSize'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PORTFOLIO.map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>مرحلة الاستثمار الرئيسية</Label>
              <Select
                value={watch('investmentStage')}
                onValueChange={(v) => setValue('investmentStage', v as Form['investmentStage'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE.map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>وتيرة المتابعة</Label>
              <Select
                value={watch('monitoringCadence')}
                onValueChange={(v) => setValue('monitoringCadence', v as Form['monitoringCadence'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CADENCE.map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
