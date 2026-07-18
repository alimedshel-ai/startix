-- level (المستوى: تشغيلي/تكتيكي/استراتيجي) + cost (التكلفة المقدّرة SAR) على
-- Initiative و Task. كلاهما اختياريّ (nullable) → البيانات القديمة تبقى، صفر
-- مخاطرة، قابل للعكس. الميزانيّة تُقرأ من Company.opex.budget القائم (لا حقل جديد).
CREATE TYPE "PlanLevel" AS ENUM ('operational', 'tactical', 'strategic');

ALTER TABLE "Initiative" ADD COLUMN "level" "PlanLevel";
ALTER TABLE "Initiative" ADD COLUMN "cost" DECIMAL(14,2);

ALTER TABLE "Task" ADD COLUMN "level" "PlanLevel";
ALTER TABLE "Task" ADD COLUMN "cost" DECIMAL(14,2);
