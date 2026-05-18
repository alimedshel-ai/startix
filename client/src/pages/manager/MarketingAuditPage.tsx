import { useState } from 'react'

import { DeptAuditPage } from '@/components/dept/DeptAuditPage'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'

export function MarketingAuditPage() {
  const plan = useAuthStore((s) => s.user?.plan ?? 'BASIC')
  const proAllowed = plan === 'PROFESSIONAL' || plan === 'ENTERPRISE'
  const [variant, setVariant] = useState<'basic' | 'pro'>('basic')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end gap-2">
        <Button
          variant={variant === 'basic' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setVariant('basic')}
        >
          Basic
        </Button>
        <Button
          variant={variant === 'pro' ? 'default' : 'outline'}
          size="sm"
          disabled={!proAllowed}
          title={proAllowed ? '' : 'Requires Professional plan'}
          onClick={() => setVariant('pro')}
        >
          Pro
        </Button>
      </div>
      <DeptAuditPage deptCode="MARKETING" variant={variant} />
    </div>
  )
}
