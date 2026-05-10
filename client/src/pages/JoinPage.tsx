import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/authStore'
import type { UserType } from '@/types/user'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  phone: z.string().max(40).optional().or(z.literal('')),
  userType: z.enum(['OWNER', 'MANAGER', 'INVESTOR']),
})

type Form = z.infer<typeof schema>

export function JoinPage() {
  const navigate = useNavigate()
  const selectedType = useAuthStore((s) => s.selectedType)
  const registerUser = useAuthStore((s) => s.register)
  const login = useAuthStore((s) => s.login)
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      userType: (selectedType as UserType | null) ?? 'OWNER',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      await registerUser({
        email: values.email,
        password: values.password,
        name: values.name,
        userType: values.userType,
        phone: values.phone || undefined,
      })
      await login(values.email, values.password)
      toast.success('Account created — check your email to verify')
      navigate('/onboarding')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Registration failed'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Create your Startix account</CardTitle>
          <CardDescription>
            Joining as <span className="font-medium text-foreground">{selectedType ?? 'OWNER'}</span>.
            <Link to="/select-type" className="ml-1 underline-offset-4 hover:underline">
              Change
            </Link>
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="grid gap-4">
            <input type="hidden" {...register('userType')} />
            <div className="grid gap-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" autoComplete="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" autoComplete="tel" placeholder="+966…" {...register('phone')} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create account'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
