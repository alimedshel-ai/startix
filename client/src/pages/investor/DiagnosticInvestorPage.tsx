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
import { api } from '@/lib/api'

const PORTFOLIO = [
  ['1', '1 company'],
  ['2-5', '2–5 companies'],
  ['6-15', '6–15 companies'],
  ['16+', '16+ companies'],
] as const
const STAGE = [
  ['seed', 'Seed'],
  ['early', 'Early stage'],
  ['growth', 'Growth'],
  ['late', 'Late stage / public'],
] as const
const CADENCE = [
  ['monthly', 'Monthly'],
  ['quarterly', 'Quarterly'],
  ['annual', 'Annual'],
] as const

const schema = z.object({
  companyName: z.string().min(1).max(120),
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
      await api.post('/api/diagnostic/investor', values)
      toast.success('Diagnostic saved')
      navigate('/investor/dashboard')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Could not submit diagnostic'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Investor diagnostic"
        description="Three questions to tune your portfolio dashboard."
      />

      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Portfolio profile</CardTitle>
          <CardDescription>Answers shape monitoring cadence and rollup tiles.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="companyName">Portfolio name</Label>
              <Input id="companyName" placeholder="e.g. Riyadh Growth Fund" {...register('companyName')} />
              {errors.companyName && (
                <p className="text-sm text-destructive">{errors.companyName.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Portfolio size</Label>
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
              <Label>Primary investment stage</Label>
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
              <Label>Monitoring cadence</Label>
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
            <Button type="submit" disabled={submitting} className="ml-auto">
              {submitting ? 'Saving…' : 'Save diagnostic'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
