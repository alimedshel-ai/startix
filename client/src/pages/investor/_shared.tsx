import { useEffect, useState } from 'react'

import { apiErrorMessage } from '@/lib/api'
import { listMyCompanies, type CompanyWithRole } from '@/lib/deptApi'

// ─── أدوات المستثمر المشتركة ────────────────────────────────────────────────
// المستثمر يعمل على «شركات المحفظة» — الشركات التي رُبط بها عبر CompanyUser
// (دور investor). كل تحليلات المحفظة (Dupont / Monte Carlo / التوصيات)
// تختار شركة أولاً ثم تشغّل المحرّك على معرّفها. الوصول محميّ على السيرفر
// عبر assertCompanyAccess، فالمستثمر لا يرى إلا شركاته.

export function usePortfolioCompanies() {
  const [companies, setCompanies] = useState<CompanyWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const rows = await listMyCompanies()
        if (!cancel) setCompanies(rows)
      } catch (err) {
        if (!cancel) setError(apiErrorMessage(err, 'تعذّر تحميل شركات المحفظة'))
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  return { companies, loading, error }
}

export function PortfolioCompanySelect({
  companies,
  value,
  onChange,
}: {
  companies: CompanyWithRole[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  return (
    <div className="space-y-1">
      <label htmlFor="portfolio_company" className="text-xs text-muted-foreground">
        اختر شركة من محفظتك
      </label>
      <select
        id="portfolio_company"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-md border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="">— اختر شركة —</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}
