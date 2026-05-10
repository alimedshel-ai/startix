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
import { api } from '@/lib/api'

const DEPTS = [
  ['HR', 'Human resources'],
  ['FINANCE', 'Finance'],
  ['SALES', 'Sales'],
  ['MARKETING', 'Marketing'],
  ['OPERATIONS', 'Operations'],
  ['IT', 'IT'],
  ['CUSTOMER_SERVICE', 'Customer service'],
  ['SUPPORT', 'Support'],
  ['LOGISTICS', 'Logistics'],
  ['QUALITY', 'Quality'],
  ['PROJECTS', 'Projects'],
  ['GOVERNANCE', 'Governance'],
  ['COMPLIANCE', 'Compliance'],
] as const

const TOOLING = [
  ['none', 'None — manual'],
  ['basic', 'Basic — spreadsheets'],
  ['modern', 'Modern — SaaS in place'],
  ['advanced', 'Advanced — integrated stack'],
] as const

const schema = z.object({
  companyName: z.string().min(1).max(120),
  departmentType: z.enum(DEPTS.map((d) => d[0]) as [string, ...string[]]),
  experienceYears: z.string().regex(/^\d+$/, 'Numbers only'),
  teamSize: z.string().regex(/^\d+$/, 'Numbers only'),
  toolingMaturity: z.enum(TOOLING.map((t) => t[0]) as [string, ...string[]]),
  topChallenge: z.string().min(3, 'Add a short note').max(280),
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
      toast.success('Diagnostic saved')
      navigate('/manager/dept-dashboard')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Could not submit diagnostic'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  })

  const dept = watch('departmentType')
  const tooling = watch('toolingMaturity')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Manager diagnostic"
        description="Five questions to set up your department dashboard."
      />

      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Tell us about your department</CardTitle>
          <CardDescription>Answers feed the dept dashboard and KPI recommendations.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="companyName">Company name</Label>
              <Input id="companyName" {...register('companyName')} />
              {errors.companyName && (
                <p className="text-sm text-destructive">{errors.companyName.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Department</Label>
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
                <Label htmlFor="experienceYears">Years of experience</Label>
                <Input id="experienceYears" type="number" min={0} {...register('experienceYears')} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="teamSize">Team size</Label>
                <Input id="teamSize" type="number" min={0} {...register('teamSize')} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Tooling maturity</Label>
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
              <Label htmlFor="topChallenge">Top challenge right now</Label>
              <Textarea id="topChallenge" rows={3} {...register('topChallenge')} />
              {errors.topChallenge && (
                <p className="text-sm text-destructive">{errors.topChallenge.message}</p>
              )}
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
