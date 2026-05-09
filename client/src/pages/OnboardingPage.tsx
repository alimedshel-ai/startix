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
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types/user'

const schema = z.object({
  phone: z.string().max(40).optional().or(z.literal('')),
  avatarUrl: z.string().url().optional().or(z.literal('')),
})
type Form = z.infer<typeof schema>

export function OnboardingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { phone: user?.phone ?? '', avatarUrl: user?.avatarUrl ?? '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      const { data } = await api.patch<{ user: User }>('/api/auth/me', {
        phone: values.phone || null,
        avatarUrl: values.avatarUrl || null,
      })
      setUser(data.user)
      toast.success('Profile saved')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Update failed'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {user?.name?.split(' ')[0]}</h1>
          <p className="text-sm text-muted-foreground">
            Joined as {user?.userType.toLowerCase()}.{' '}
            {user?.isVerified ? 'Email verified.' : 'Check your inbox to verify your email.'}
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={async () => {
            await logout()
            navigate('/')
          }}
        >
          Sign out
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Step 1 — Account preferences</CardTitle>
          <CardDescription>Optional. You can fill these in later from your profile.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="+966…" {...register('phone')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <Input id="avatarUrl" placeholder="https://…" {...register('avatarUrl')} />
              {errors.avatarUrl && (
                <p className="text-sm text-destructive">{errors.avatarUrl.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save preferences'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="opacity-60">
        <CardHeader>
          <CardTitle>Step 2 — Create your first company</CardTitle>
          <CardDescription>
            Coming in Phase 3 — companies, sectors, departments, and KPIs.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button disabled>Continue</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
