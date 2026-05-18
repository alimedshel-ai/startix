import { Link } from 'react-router-dom'

import { DeptAuditPage } from '@/components/dept/DeptAuditPage'
import { buttonVariants } from '@/components/ui/button'

export function ProjectsAuditPage() {
  return (
    <DeptAuditPage
      deptCode="PROJECTS"
      afterResult={() => (
        <div className="flex justify-end">
          <Link to="/gantt-chart" className={buttonVariants({ variant: 'outline' })}>
            View Gantt chart →
          </Link>
        </div>
      )}
    />
  )
}
