-- Phase 1 — عمود القياس: القيمة المتوقّعة لكل KPI
-- baselineValue: نقطة الانطلاق. expectedPath: مسار S-Curve مولّد آليّاً.
-- startedAt: تاريخ بدء المسار (تحسب منه المدّة المنقضية).
ALTER TABLE "KPI"
  ADD COLUMN "baselineValue" DOUBLE PRECISION,
  ADD COLUMN "expectedPath"  JSONB,
  ADD COLUMN "startedAt"     TIMESTAMP(3);
