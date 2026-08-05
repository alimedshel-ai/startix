import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { ReportDocument } from '@/components/report/ReportDocument'
import { getReport, type Report } from '@/lib/reportsApi'

/**
 * Bare-chrome printable view of a saved report (by id, authenticated). No
 * sidebar/topbar — opens in a new tab; the user uses "Print → Save as PDF".
 * الشكل مشترك مع الصفحة العامّة عبر ReportDocument.
 */
export function ReportPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getReport(id)
      .then(setReport)
      .catch((err) => setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'تعذّر التحميل'))
  }, [id])

  // Auto-trigger print dialog when the report is loaded
  useEffect(() => {
    if (report) {
      const t = setTimeout(() => window.print(), 300)
      return () => clearTimeout(t)
    }
  }, [report])

  if (error) {
    return (
      <div dir="rtl" className="min-h-screen bg-white p-12 text-base text-black">
        <p className="text-rose-700">⚠️ {error}</p>
      </div>
    )
  }
  if (!report) {
    return (
      <div dir="rtl" className="min-h-screen bg-white p-12 text-base text-black">
        <p>جاري التحميل…</p>
      </div>
    )
  }

  return <ReportDocument report={report} />
}
