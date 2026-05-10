import { Link, useNavigate } from 'react-router-dom'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/authStore'
import type { UserType } from '@/types/user'

const OPTIONS: { type: UserType; title: string; blurb: string }[] = [
  {
    type: 'OWNER',
    title: 'Business Owner',
    blurb: 'Run the strategy of your own company across all 13 departments.',
  },
  {
    type: 'MANAGER',
    title: 'Manager / Consultant',
    blurb: 'Manage strategy on behalf of clients or as an internal department head.',
  },
  {
    type: 'INVESTOR',
    title: 'Investor',
    blurb: 'Evaluate strategic and operational health of companies in your portfolio.',
  },
]

export function SelectTypePage() {
  const navigate = useNavigate()
  const setSelectedType = useAuthStore((s) => s.setSelectedType)

  const choose = (type: UserType) => {
    setSelectedType(type)
    navigate('/join')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">How will you use Startix?</h1>
        <p className="mt-2 text-muted-foreground">Pick the role that fits — you can switch later.</p>
      </div>

      <div className="grid w-full gap-4 md:grid-cols-3">
        {OPTIONS.map((o) => (
          <Card key={o.type} className="flex flex-col">
            <CardHeader>
              <CardTitle>{o.title}</CardTitle>
              <CardDescription>{o.blurb}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter>
              <Button className="w-full" onClick={() => choose(o.type)}>
                Continue as {o.title}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Link to="/login" className={buttonVariants({ variant: 'ghost' })}>
        Already have an account? Sign in
      </Link>
    </div>
  )
}
