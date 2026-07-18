-- إصلاح الجسر المقطوع: ربط المبادرة بالهدف الاستراتيجي.
-- بدونه تطفو المبادرات/المشاريع/المهام حرّةً بلا جذر استراتيجي.
-- objectiveId اختياري (String?) — البيانات القديمة تبقى، صفر مخاطرة.
-- ON DELETE SET NULL: حذف الهدف لا يحذف المبادرة، يفكّ الربط فقط.
ALTER TABLE "Initiative" ADD COLUMN "objectiveId" TEXT;

CREATE INDEX "Initiative_objectiveId_idx" ON "Initiative"("objectiveId");

ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
