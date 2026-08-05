/**
 * عرضٌ مشترك لتقريرٍ محفوظ (رأس + جسم حسب النوع + تذييل) — يقوده شكل البيانات
 * لا مصدرها. يستعمله مساران: صفحة الطباعة الخاصّة (بالمعرّف، مصادَقة) والصفحة
 * العامّة (بالتوكن، بلا تسجيل). لا جلب هنا — تتلقّى التقرير جاهزاً.
 */

export interface ReportDocData {
  type: string
  title: string
  data: unknown
  createdAt: string
}

const TYPE_LABEL: Record<string, string> = {
  strategic: 'استراتيجي', compliance: 'امتثال', department: 'إدارات', annual: 'خطة سنوية', executive: 'ملخص تنفيذي',
}

export function ReportDocument({ report }: { report: ReportDocData }) {
  const d = (report.data ?? {}) as Record<string, unknown>
  return (
    <div dir="rtl" className="mx-auto max-w-3xl bg-white p-8 text-base text-black print:p-0">
      <header className="mb-8 border-b pb-4">
        <div className="mb-2 text-xs text-gray-500">
          {TYPE_LABEL[report.type] ?? report.type} · {new Date(report.createdAt).toLocaleString('ar-SA')}
        </div>
        <h1 className="text-3xl font-bold">{report.title}</h1>
      </header>

      <Body type={report.type} data={d} />

      <footer className="mt-12 border-t pt-4 text-center text-xs text-gray-500">
        صادر من منصة ستارتكس — {new Date().toLocaleDateString('ar-SA')}
      </footer>
    </div>
  )
}

type AnyRec = Record<string, unknown>

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 mb-2 text-xl font-bold print:text-lg">{children}</h2>
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <li className="flex justify-between gap-2 border-b py-1.5 last:border-b-0">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  )
}

function Body({ type, data }: { type: string; data: AnyRec }) {
  switch (type) {
    case 'executive':  return <Exec d={data} />
    case 'strategic':  return <Strat d={data} />
    case 'compliance': return <Compliance d={data} />
    case 'department': return <Depts d={data} />
    case 'annual':     return <Annual d={data} />
    default: return <pre className="overflow-x-auto rounded-md bg-gray-50 p-3 text-xs">{JSON.stringify(data, null, 2)}</pre>
  }
}

function Exec({ d }: { d: AnyRec }) {
  const company = d.company as { name?: string; sector?: string; size?: string; stage?: string } | null
  const k = d.kpiSummary as { total: number; onTrack: number } | undefined
  const dept = d.deptSummary as { total: number; audited: number } | undefined
  const weaknesses = (d.topWeaknesses as { label: string; pct: number }[] | undefined) ?? []
  return (
    <>
      <H2>عن الشركة</H2>
      <ul>
        <KV label="الاسم" value={company?.name ?? '—'} />
        <KV label="القطاع" value={company?.sector ?? '—'} />
        <KV label="الحجم" value={company?.size ?? '—'} />
        <KV label="المرحلة" value={company?.stage ?? '—'} />
      </ul>

      <H2>القياسات الرئيسية</H2>
      <ul>
        <KV label="الصحة العامة" value={`${String(d.healthScore ?? '—')}%`} />
        <KV label="درجة النضج" value={String(d.maturityScore ?? '—')} />
        <KV label="المسار الاستراتيجي" value={String(d.strategicPath ?? '—')} />
        <KV label="مؤشرات في المسار" value={`${k?.onTrack ?? 0} / ${k?.total ?? 0}`} />
        <KV label="إدارات مدققة" value={`${dept?.audited ?? 0} / ${dept?.total ?? 0}`} />
        <KV label="مهام متأخرة" value={String(d.overdueTasks ?? 0)} />
      </ul>

      {weaknesses.length > 0 && (
        <>
          <H2>أبرز نقاط الضعف</H2>
          <ol className="list-decimal space-y-1 pr-5">
            {weaknesses.map((w, i) => <li key={i}>{w.label} — <span className="text-gray-600">{w.pct}%</span></li>)}
          </ol>
        </>
      )}
    </>
  )
}

function Strat({ d }: { d: AnyRec }) {
  const diag = d.diagnostic as { strategicPath?: string; maturityScore?: number; roadmap?: { title: string; detail: string }[]; weaknesses?: { label: string; pct: number }[] } | null
  const swot = d.swot as { strengths?: string[]; weaknesses?: string[]; opportunities?: string[]; threats?: string[] } | null
  const objectives = (d.objectives as { title: string; status: string; okrs: { keyResult: string }[] }[] | undefined) ?? []
  const kpis = (d.kpis as { name: string; currentValue: number; targetValue: number; unit: string }[] | undefined) ?? []
  return (
    <>
      {diag && (
        <>
          <H2>نتيجة التشخيص</H2>
          <ul>
            <KV label="المسار الاستراتيجي" value={String(diag.strategicPath ?? '—')} />
            <KV label="درجة النضج" value={String(diag.maturityScore ?? '—')} />
          </ul>
          {diag.weaknesses && diag.weaknesses.length > 0 && (
            <>
              <h3 className="mt-3 mb-1 font-semibold">أبرز نقاط الضعف</h3>
              <ul className="space-y-0.5 text-sm">
                {diag.weaknesses.slice(0, 5).map((w, i) => <li key={i}>• {w.label} — {w.pct}%</li>)}
              </ul>
            </>
          )}
        </>
      )}

      {swot && (
        <>
          <H2>تحليل SWOT</H2>
          <div className="grid grid-cols-2 gap-3">
            <SwotCol title="القوة" items={swot.strengths ?? []} />
            <SwotCol title="الضعف" items={swot.weaknesses ?? []} />
            <SwotCol title="الفرص" items={swot.opportunities ?? []} />
            <SwotCol title="التهديدات" items={swot.threats ?? []} />
          </div>
        </>
      )}

      {objectives.length > 0 && (
        <>
          <H2>الأهداف الاستراتيجية</H2>
          <ul className="space-y-1">
            {objectives.map((o, i) => (
              <li key={i}>• <b>{o.title}</b> ({o.status}) — {o.okrs.length} نتيجة رئيسية</li>
            ))}
          </ul>
        </>
      )}

      {kpis.length > 0 && (
        <>
          <H2>أبرز المؤشرات</H2>
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr><th className="p-2 text-right">المؤشر</th><th className="p-2">الحالي</th><th className="p-2">الهدف</th></tr>
            </thead>
            <tbody>
              {kpis.slice(0, 8).map((k, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{k.name}</td>
                  <td className="p-2 text-center tabular-nums">{k.currentValue}</td>
                  <td className="p-2 text-center tabular-nums">{k.targetValue} {k.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {diag?.roadmap && diag.roadmap.length > 0 && (
        <>
          <H2>خارطة الـ90 يوم</H2>
          <ol className="list-decimal space-y-1 pr-5">
            {diag.roadmap.map((r, i) => (
              <li key={i}><b>{r.title}.</b> <span className="text-gray-600">{r.detail}</span></li>
            ))}
          </ol>
        </>
      )}
    </>
  )
}

function SwotCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded border p-3">
      <h3 className="mb-2 font-semibold">{title} ({items.length})</h3>
      {items.length === 0 ? <p className="text-xs text-gray-500">—</p> : (
        <ul className="space-y-1 text-sm">{items.map((s, i) => <li key={i}>• {s}</li>)}</ul>
      )}
    </div>
  )
}

function Compliance({ d }: { d: AnyRec }) {
  const basic = d.basic as { maturityPct?: number; dangerZone?: string } | null
  const pro = d.pro as { maturityPct?: number; dangerZone?: string; reformPlan?: { week: number; axis: string; action: string }[]; penaltyEstimate?: number } | null
  return (
    <>
      <H2>نتائج التدقيق</H2>
      <ul>
        <KV label="تدقيق أساسي — النضج" value={basic?.maturityPct != null ? `${basic.maturityPct}%` : '—'} />
        <KV label="تدقيق أساسي — المنطقة" value={basic?.dangerZone ?? '—'} />
        <KV label="تدقيق احترافي — النضج" value={pro?.maturityPct != null ? `${pro.maturityPct}%` : '—'} />
        <KV label="تدقيق احترافي — المنطقة" value={pro?.dangerZone ?? '—'} />
        <KV label="تعرّض الغرامات (SAR)" value={pro?.penaltyEstimate != null ? pro.penaltyEstimate.toLocaleString('ar-SA') : '—'} />
      </ul>

      {pro?.reformPlan && pro.reformPlan.length > 0 && (
        <>
          <H2>خطة الإصلاح ١٢ أسبوع</H2>
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr><th className="p-2 w-16">الأسبوع</th><th className="p-2 text-right">المحور</th><th className="p-2 text-right">الإجراء</th></tr>
            </thead>
            <tbody>
              {pro.reformPlan.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2 text-center tabular-nums">{r.week}</td>
                  <td className="p-2">{r.axis}</td>
                  <td className="p-2">{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}

function Depts({ d }: { d: AnyRec }) {
  const depts = (d.departments as { type: string; label: string; auditScore: number | null; kpis: { name: string; currentValue: number; targetValue: number }[] }[] | undefined) ?? []
  return (
    <>
      <H2>الإدارات</H2>
      <div className="grid gap-3 sm:grid-cols-2">
        {depts.map((dept, i) => (
          <div key={i} className="rounded border p-3">
            <h3 className="mb-2 font-semibold">{dept.label}</h3>
            <p className="text-sm">صحة: <b className="tabular-nums">{dept.auditScore != null ? `${Math.round(dept.auditScore)}%` : '—'}</b></p>
            {dept.kpis.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs">
                {dept.kpis.map((k, j) => <li key={j}>• {k.name}: <span className="tabular-nums">{k.currentValue}/{k.targetValue}</span></li>)}
              </ul>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

function Annual({ d }: { d: AnyRec }) {
  const objectives = (d.objectives as { title: string; status: string; okrsCount: number }[] | undefined) ?? []
  const initiatives = (d.initiatives as { title: string; priority: string; status: string }[] | undefined) ?? []
  const projects = (d.projects as { title: string; status: string }[] | undefined) ?? []
  return (
    <>
      <H2>الخطة السنوية {String(d.year ?? '')}</H2>
      <ul>
        <KV label="مهام السنة" value={String(d.taskCount ?? 0)} />
        <KV label="متأخرات" value={String(d.overdueTasks ?? 0)} />
      </ul>

      <H2>الأهداف</H2>
      <ul className="space-y-1 text-sm">{objectives.map((o, i) => <li key={i}>• {o.title} ({o.status})</li>)}</ul>

      <H2>المبادرات</H2>
      <ul className="space-y-1 text-sm">{initiatives.map((x, i) => <li key={i}>• {x.title} — {x.priority} / {x.status}</li>)}</ul>

      <H2>المشاريع</H2>
      <ul className="space-y-1 text-sm">{projects.map((x, i) => <li key={i}>• {x.title} — {x.status}</li>)}</ul>
    </>
  )
}
