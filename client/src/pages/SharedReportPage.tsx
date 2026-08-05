import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { ReportDocument, type ReportDocData } from '@/components/report/ReportDocument'
import { getSharedReport } from '@/lib/reportsApi'

/**
 * صفحةٌ عامّة (بلا تسجيل) لتقريرٍ مُشارَك بتوكن — الوجهة التي يفتحها مالكٌ لم
 * يسجّل. لا تخطيط ولا شريط جانبيّ؛ الشكل مشترك مع صفحة الطباعة عبر ReportDocument.
 * لا طباعة تلقائيّة — زرٌّ صريح (الزائر قد يتصفّح أوّلاً).
 */
export function SharedReportPage() {
  const { token } = useParams<{ token: string }>()
  const [report, setReport] = useState<ReportDocData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    getSharedReport(token)
      .then(setReport)
      .catch((err) => setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'الرابط غير صالح أو منتهٍ'))
  }, [token])

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

  return (
    <div className="bg-white">
      <div dir="rtl" className="mx-auto max-w-3xl px-8 pt-4 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
        >
          🖨️ طباعة / حفظ PDF
        </button>
      </div>
      <ReportDocument report={report} />
    </div>
  )
}
