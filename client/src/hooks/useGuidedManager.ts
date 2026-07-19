import { useAuthStore } from '@/store/authStore'

// ─── هل المستخدم الحالي «مدير مستقل» يخضع للمسار الموجّه؟ ──────────
// المسار الموجّه (شريط «أنت هنا» + بطاقة الخطوة التالية المرفوعة + مبدأ
// «الإجراء الواحد» §٤) مخصّص لـ INDEPENDENT_PRO وحده. المالك/المدير
// الداخلي/المستثمر يبقون بالسلوك السابق. مركزيّة هذا الفحص تمنع تكراره
// وتضمن اتّساق القرار عبر الصفحات (إظهار/إخفاء روابط «التالي» المكرّرة).
export function useGuidedManager(): boolean {
  return useAuthStore(
    (s) => s.user?.userType === 'MANAGER' && s.user?.managerType === 'INDEPENDENT_PRO',
  )
}
