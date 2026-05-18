import { Link } from 'react-router-dom'

import { DeptAuditPage } from '@/components/dept/DeptAuditPage'
import { buttonVariants } from '@/components/ui/button'

export function GovernanceAuditPage() {
  return (
    <DeptAuditPage
      deptCode="GOVERNANCE"
      afterResult={() => (
        <div className="flex justify-end">
          <Link to="/manager/governance/hub" className={buttonVariants({ variant: 'outline' })}>
            فتح مركز الحوكمة ←
          </Link>
        </div>
      )}
    />
  )
}
