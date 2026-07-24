-- الرقعة B: مصدر إنشاء المبادرة + ربطها بالإجراء التصحيحيّ للإنقاذ.
-- source = 'rescue' حين تُنشأ inline من شاشة الإنقاذ (خطوة ٣)؛ الافتراض 'manual'.
-- linkedActionId يربطها بالإجراء التصحيحيّ (خطوة ٢). كلاهما اختياريّ (nullable)
-- → البيانات القديمة تبقى، صفر مخاطرة، قابل للعكس.
-- اكتمال الإنقاذ ٣ = وجود مبادرة source='rescue' لهذا العميل (resolveRescuePlan).
ALTER TABLE "Initiative" ADD COLUMN "source" TEXT DEFAULT 'manual';
ALTER TABLE "Initiative" ADD COLUMN "linkedActionId" TEXT;
