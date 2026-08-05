-- الجبهة ب (الجلسة ٢): رابط مشاركة عامّ للتقرير مع مالكٍ لم يسجّل.
-- shareToken فريد (يقرأه المسار العامّ GET /reports/shared/:token)؛ null = غير
-- مشارَك (يسمح Postgres بتعدّد NULL في الفهرس الفريد). shareExpires ينهي الرابط.
-- كلاهما اختياريّ → البيانات القديمة تبقى، صفر مخاطرة، قابل للعكس (set null = إلغاء).
ALTER TABLE "Report" ADD COLUMN "shareToken" TEXT;
ALTER TABLE "Report" ADD COLUMN "shareExpires" TIMESTAMP(3);
CREATE UNIQUE INDEX "Report_shareToken_key" ON "Report"("shareToken");
