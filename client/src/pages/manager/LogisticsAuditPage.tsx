import { Link } from 'react-router-dom'

import { DeptAuditPage } from '@/components/dept/DeptAuditPage'
import { buttonVariants } from '@/components/ui/button'

export function LogisticsAuditPage() {
  return (
    <DeptAuditPage
      deptCode="LOGISTICS"
      afterResult={() => (
        <div className="flex justify-end">
          <Link to="/manager/logistics/reform" className={buttonVariants({ variant: 'outline' })}>
            توليد خطة الإصلاح ←
          </Link>
        </div>
      )}
    />
  )
}
