import { type ReactNode, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// ─── Hub — مكوّن مشترك بتبويبات إلزاميّة (SIDEBAR-STRUCTURE.md) ────
// كل «Hub» في السايدبار (المالك/المدير/المستثمر) يُصيَّر عبر هذا المكوّن.
// التبويبات تُقرأ من `?tab=` وتُكتب فيه لتنقّل داخلي بلا reload.
//
// المبدأ الحاكم: «Hub = صفحة بتبويبات إلزاميّة». إن كانت الأدوات مسطّحة
// (رابط لكل واحدة) فهي **قسم** في السايدبار، لا Hub.
//
// يدعم:
//   • بادج «⏳ قريباً» على أي تبويب لم يُبنَ بعد
//   • preserve للـ query params (خصوصاً ?client=)
//   • defaultTab قابل للاحتساب من prop أو من ذكاء المسار

export interface HubTab {
  key: string
  icon: string
  label: string
  render: () => ReactNode
  // بادج معلوماتي (مثل: «مساندة» أو «⏳ قريباً»)
  hint?: string
  // إن كان التبويب placeholder — يُعرض بادج مميّز وبلا محتوى فعلي.
  isPlaceholder?: boolean
  // خارج مسار المستخدم — يُعرض بلون خافت مع tooltip.
  isDimmed?: boolean
  dimmedReason?: string
}

export interface HubProps {
  title: string
  description?: string
  tabs: HubTab[]
  defaultTab?: string
  // shell إضافي (شارات، banners) يُعرض قبل شريط التبويبات.
  headerExtras?: ReactNode
  // للـWrap: بعض الـHubs موجودة داخل StrategicShell (تمرّر companyId).
  // بقيّة الـHubs مستقلّة (لا shell خارجي).
  bare?: boolean
}

export function Hub({ title, description, tabs, defaultTab, headerExtras, bare }: HubProps) {
  const [params, setParams] = useSearchParams()
  const activeTab = params.get('tab') || defaultTab || tabs[0]?.key

  function switchTab(next: string) {
    const nextParams = new URLSearchParams(params)
    nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

  const currentTab = useMemo(() => tabs.find((t) => t.key === activeTab) ?? tabs[0], [tabs, activeTab])

  const inner = (
    <div className="flex flex-col gap-4">
      {headerExtras}
      <TabBar tabs={tabs} activeTab={currentTab?.key ?? ''} onSwitch={switchTab} />
      <div>
        {currentTab?.isPlaceholder ? (
          <PlaceholderTabContent tab={currentTab} />
        ) : (
          currentTab?.render()
        )}
      </div>
    </div>
  )

  if (bare) return inner

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} />
      {inner}
    </div>
  )
}

// شريط التبويبات — نفس النمط المستخدَم في MeasureHubPage/PriorityHubPage.
function TabBar({
  tabs, activeTab, onSwitch,
}: { tabs: HubTab[]; activeTab: string; onSwitch: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/30 p-2">
      {tabs.map((t) => {
        const active = t.key === activeTab
        const dimmed = t.isDimmed && !active
        return (
          <Button
            key={t.key}
            variant={active ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onSwitch(t.key)}
            title={t.dimmedReason ?? t.hint}
            className={cn('gap-1.5', dimmed && 'opacity-50')}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {t.isPlaceholder && (
              <span className="mr-1 rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] text-indigo-700">
                ⏳
              </span>
            )}
            {t.hint && !t.isPlaceholder && (
              <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                {t.hint}
              </span>
            )}
            {dimmed && (
              <span className="mr-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">
                خارج مسارك
              </span>
            )}
          </Button>
        )
      })}
    </div>
  )
}

// محتوى Placeholder لتبويب مخطّط بلا كود بعد.
function PlaceholderTabContent({ tab }: { tab: HubTab }) {
  return (
    <Card className="border-2 border-indigo-300 bg-gradient-to-l from-indigo-500/10 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="text-3xl">{tab.icon}</span>
          <span>{tab.label}</span>
          <span className="rounded-full border border-indigo-400 bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
            ⏳ قريباً
          </span>
        </CardTitle>
        <CardDescription>
          تبويب مخطّط عن قصد. يُبنى في مرحلة قادمة. مكانه محفوظ لتثبيت البنية الذهنيّة.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-xs leading-relaxed text-muted-foreground">
        <b className="text-foreground">💡 القاعدة:</b> «لا شيء يُدفَن». الوعد ظاهر لتجد مكانه قبل أن يصل الكود.
      </CardContent>
    </Card>
  )
}
