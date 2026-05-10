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

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type Form = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      await login(values.email, values.password)
      toast.success('Welcome back')
      navigate('/onboarding')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Login failed'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Sign in to Startix</CardTitle>
          <CardDescription>Continue with your email and password.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
            <div className="flex w-full justify-between text-sm text-muted-foreground">
              <Link to="/select-type" className="hover:text-foreground">
                Create account
              </Link>
              <Link to="/forgot-password" className="hover:text-foreground">
                Forgot password?
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
