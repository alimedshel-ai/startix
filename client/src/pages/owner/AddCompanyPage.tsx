import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createCompany } from '@/lib/deptApi'

const SIZES = ['MICRO', 'SMALL', 'MEDIUM', 'LARGE'] as const

export function AddCompanyPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [sector, setSector] = useState('')
  const [size, setSize] = useState<typeof SIZES[number]>('SMALL')
  const [stage, setStage] = useState('')
  const [country, setCountry] = useState('SA')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Company name is required')
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
      toast.success('Company created')
      navigate('/companies')
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not create company'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Add company"
        description="Create a new company entity."
        breadcrumbs={[{ label: 'Companies', to: '/companies' }, { label: 'Add' }]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Company details</CardTitle>
          <CardDescription>Sector, size and stage refine the diagnostic and the compliance audit.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My company" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sector">Sector</Label>
              <Input id="sector" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="retail, tech, manufacturing…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="size">Entity size</Label>
              <select
                id="size"
                className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                value={size}
                onChange={(e) => setSize(e.target.value as typeof SIZES[number])}
              >
                {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="stage">Stage</Label>
              <Input id="stage" value={stage} onChange={(e) => setStage(e.target.value)} placeholder="startup, scaling, stable…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="country">Country (ISO-2)</Label>
              <Input id="country" value={country} onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create company'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
