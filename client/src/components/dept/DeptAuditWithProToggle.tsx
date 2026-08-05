import { useState } from 'react'

import { DeptAuditPage } from '@/components/dept/DeptAuditPage'
import { Button } from '@/components/ui/button'
import type { DeptCode } from '@/lib/deptApi'
import { useAuthStore } from '@/store/authStore'

/**
 * غلافٌ مشترك لأقسام التدقيق ذات بنك pro (HR · SALES · MARKETING): زرّ تبديل
 * أساسي/احترافي مبوّبٌ بالخطّة. بدونه تعود الصفحة إلى variant='basic' افتراضاً
 * فلا يصل بنك pro إطلاقاً (كان عيب HR/SALES قبل التوحيد). الأقسام بلا بنك pro
 * تبقى `<DeptAuditPage deptCode=... />` مباشرةً — لا تستعمل هذا الغلاف.
 */
export function DeptAuditWithProToggle({ deptCode }: { deptCode: DeptCode }) {
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
          أساسي
        </Button>
        <Button
          variant={variant === 'pro' ? 'default' : 'outline'}
          size="sm"
          disabled={!proAllowed}
          title={proAllowed ? '' : 'يتطلّب خطة احترافية'}
          onClick={() => setVariant('pro')}
        >
          احترافي
        </Button>
      </div>
      <DeptAuditPage deptCode={deptCode} variant={variant} />
    </div>
  )
}
