import { useLocation, useSearchParams } from 'react-router-dom'

import type { StageId } from '@/lib/journeyStages'
import { useAuthStore } from '@/store/authStore'

import { useJourneyCompletions } from './useJourneyCompletions'

// ─── 🎯 التالي لك الآن — resolver الديناميكي ─────────────────────
// يقرأ:
//   • مسار المستخدم الاستراتيجي (strategyPath) → أولوية المرحلة القادمة.
//   • العميل النشط (؟client=X أو /manager/clients/:id) → context.
//   • اكتمال المراحل (useJourneyCompletions) → ما التالي فعلياً؟
//
// يُرجع بطاقة عمل مفهومة: label + to + reason. null → لا توجد خطوة تالية.
//
// المنطق (بالترتيب):
//   ١) لا عميل نشط → «أضف أول عميل».
//   ٢) لم يكتمل التشخيص (①) → «ابدأ التدقيق».
//   ٣) لم يكتمل التوليف (②) → «أكمل SWOT».
//   ٤) QUICK path → قفزة مباشرة لـ ⑤ المبادرات.
//   ٥) MEDIUM/LONG → إن لم يكتمل ③ → قرار استراتيجي.
//   ٦) LONG → إن لم يكتمل ④ → الأهداف والمؤشرات.
//   ٧) لم يكتمل ⑤ → مبادرات + مخاطر.
//   ٨) الكل مكتمل → متابعة التنفيذ (⑥).

export interface NextStep {
  label: string
  to: string
  reason: string
  icon: string
  stageId?: StageId
}

export function useNextStep(): { loading: boolean; step: NextStep | null } {
  const user = useAuthStore((s) => s.user)
  const [params] = useSearchParams()
  const location = useLocation()

  // استخراج companyId — نفس منطق ClientContextBar للتوافق.
  const paramClient = params.get('client')
  const pathMatch = location.pathname.match(/^\/manager\/clients\/([^/]+)$/)
  const activeCompanyId = paramClient ?? pathMatch?.[1] ?? null

  const { loading, completions } = useJourneyCompletions(activeCompanyId)

  const isPro = user?.userType === 'MANAGER' && user?.managerType === 'INDEPENDENT_PRO'
  const path = user?.strategyPath ?? 'LONG'
  const clientQS = activeCompanyId ? `?client=${activeCompanyId}` : ''

  // ١) لا عميل نشط.
  if (isPro && !activeCompanyId) {
    return {
      loading: false,
      step: {
        label: 'أضف/اختر عميلاً للبدء',
        to: '/manager/clients',
        reason: 'الأدوات الاستراتيجية تعمل على عميل محدّد.',
        icon: '👥',
      },
    }
  }

  if (loading) return { loading: true, step: null }

  // ٢) التشخيص.
  if (!completions.environment) {
    // للمدير المستقل مع تخصّص: يوجّه لتدقيق التخصّص.
    const to = isPro && user?.specialtyDeptType
      ? `/manager/${deptSlug(user.specialtyDeptType)}/audit${clientQS}`
      : `/internal-environment${clientQS}`
    return {
      loading: false,
      step: {
        label: 'ابدأ التشخيص',
        to,
        reason: 'المرحلة ① — البيئة الداخلية والخارجية.',
        icon: '🌐',
        stageId: 'environment',
      },
    }
  }

  // ٣) التوليف.
  if (!completions.synthesis) {
    return {
      loading: false,
      step: {
        label: 'أكمل تحليل SWOT',
        to: `/swot${clientQS}`,
        reason: 'المرحلة ② — التوليف يُحوّل التشخيص إلى استراتيجيات.',
        icon: '🧭',
        stageId: 'synthesis',
      },
    }
  }

  // ٤) QUICK path → قفزة للمبادرات مباشرة.
  if (path === 'QUICK') {
    if (!completions.initiatives) {
      return {
        loading: false,
        step: {
          label: 'أنشئ مبادرات فورية',
          to: `/priority${clientQS}`,
          reason: 'مسارك التشغيلي (قصير الأمد) يتجاوز التوجّه/المؤشرات ويقفز للتنفيذ.',
          icon: '💡',
          stageId: 'initiatives',
        },
      }
    }
    return finalExecutionStep(clientQS)
  }

  // ٥) MEDIUM/LONG → التوجّه.
  if (!completions.directions) {
    return {
      loading: false,
      step: {
        label: 'اتّخذ القرار الاستراتيجي',
        to: `/directions${clientQS}`,
        reason: 'المرحلة ③ — التوجّهات ثم القرار.',
        icon: '🎯',
        stageId: 'directions',
      },
    }
  }

  // MEDIUM → قفزة للمبادرات (يتجاوز ④).
  if (path === 'MEDIUM') {
    if (!completions.initiatives) {
      return {
        loading: false,
        step: {
          label: 'حوّل القرار إلى مبادرات',
          to: `/priority${clientQS}`,
          reason: 'مسارك التكتيكي (متوسّط الأمد) يتجاوز المؤشرات ويربط القرار بالتنفيذ.',
          icon: '💡',
          stageId: 'initiatives',
        },
      }
    }
    return finalExecutionStep(clientQS)
  }

  // ٦) LONG → المؤشرات.
  if (!completions.indicators) {
    return {
      loading: false,
      step: {
        label: 'حدّد الأهداف والمؤشرات',
        to: `/measure${clientQS}`,
        reason: 'المرحلة ④ — ترجم الاستراتيجية إلى أهداف قابلة للقياس.',
        icon: '📊',
        stageId: 'indicators',
      },
    }
  }

  // ٧) المبادرات.
  if (!completions.initiatives) {
    return {
      loading: false,
      step: {
        label: 'أطلق المبادرات',
        to: `/priority${clientQS}`,
        reason: 'المرحلة ⑤ — حوّل الأهداف إلى مبادرات مرتّبة بالأولوية.',
        icon: '💡',
        stageId: 'initiatives',
      },
    }
  }

  // ٨) الكل مكتمل → التنفيذ.
  return finalExecutionStep(clientQS)
}

function finalExecutionStep(clientQS: string): { loading: boolean; step: NextStep } {
  return {
    loading: false,
    step: {
      label: 'راجع التنفيذ',
      to: `/execute${clientQS}`,
      reason: 'المرحلة ⑥ — تابع التنفيذ عبر المشاريع ومخطّط جانت والمهام.',
      icon: '🚀',
      stageId: 'execution',
    },
  }
}

// خريطة `DeptType` → مسار التدقيق. تطابق مسارات /manager/<slug>/audit في الراوتر.
function deptSlug(dept: string): string {
  const map: Record<string, string> = {
    HR: 'hr',
    FINANCE: 'finance',
    SALES: 'sales',
    MARKETING: 'marketing',
    OPERATIONS: 'operations',
    IT: 'it',
    CUSTOMER_SERVICE: 'cs',
    SUPPORT: 'support',
    LOGISTICS: 'logistics',
    QUALITY: 'quality',
    PROJECTS: 'projects',
    COMPLIANCE: 'compliance',
    GOVERNANCE: 'governance',
  }
  return map[dept] ?? dept.toLowerCase()
}
