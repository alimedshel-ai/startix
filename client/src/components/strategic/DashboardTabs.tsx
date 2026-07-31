import { NavLink } from 'react-router-dom'

// ─── أ٣ — شريط تبويبات لوحات المالك (بيت واحد بدل ست وجهات متنافسة) ──────
// القيد الحاسم: لا نغيّر أي مسار (تتبّع المراحل يطابق المسارات حرفياً في
// nav.ts + المحرّك). لذلك التوحيد **بصريّ**: تبويبات تربط الطرق القائمة
// كما هي، فتبدو «بيتاً واحداً بأربعة تبويبات» دون لمس بنية الطرق. حُذف قسم
// «💼 لوحات القيادة» المبعثر من السايدبار — هذا الشريط صار المدخل الموحّد.

interface TabDef {
  to: string
  label: string
  icon: string
}

// التبويبات الأربعة الرئيسية. المجلس (حَوكمة/تصدير) والمسؤول (adminOnly)
// يبقيان خارج الصف الرئيسي — ثانويان لا يزاحمان يوميّ المالك.
const PRIMARY_TABS: TabDef[] = [
  { to: '/dashboard',           label: 'نظرة عامّة',       icon: '🏠' },
  { to: '/ceo-dashboard',       label: 'الرئيس التنفيذي',  icon: '👔' },
  { to: '/exec-dashboard',      label: 'الفريق التنفيذي',  icon: '👥' },
  { to: '/analytics-dashboard', label: 'التحليلات',        icon: '📈' },
]

// المجلس عرضٌ حَوكميّ ثانويّ — يظهر كزرّ منفصل بنبرة مختلفة لا كتبويب أساسي.
const BOARD_TAB: TabDef = { to: '/board-dashboard', label: 'عرض المجلس', icon: '🏛️' }

export function DashboardTabs() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b pb-2">
      {PRIMARY_TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`
          }
        >
          <span aria-hidden>{t.icon}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      <NavLink
        to={BOARD_TAB.to}
        end
        className={({ isActive }) =>
          `inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
            isActive
              ? 'border-amber-400 bg-amber-50 text-amber-900'
              : 'border-dashed text-muted-foreground hover:bg-accent hover:text-foreground'
          }`
        }
      >
        <span aria-hidden>{BOARD_TAB.icon}</span>
        <span>{BOARD_TAB.label}</span>
      </NavLink>
    </div>
  )
}
