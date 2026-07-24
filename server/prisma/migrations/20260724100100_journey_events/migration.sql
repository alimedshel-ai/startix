-- الرقعة D: جدول أحداث الرحلة — APPEND-ONLY (INSERT فقط؛ لا UPDATE/DELETE).
-- يقيس فجوة «الموصى به مقابل ما اختير»: المستقل يخرج عن التوصية مع عميل
-- ويلتزم مع آخر — الفرق هو المعلومة نفسها. recommended_tool عمود مستقل بجانب
-- tool (لا داخل payload) لأن المقارنة بينهما تُستعلَم في كل تقرير.
-- ملاحظة توافق: المعرّفات TEXT (لا UUID) لمطابقة بقيّة المخطّط — جدول مستقل
-- بلا مفاتيح أجنبيّة عمداً (عزل تحليليّ، لا يُقيّد الكتابة).
CREATE TABLE "journey_events" (
  "id"               BIGSERIAL PRIMARY KEY,
  "user_id"          TEXT NOT NULL,
  "client_id"        TEXT,
  "event"            TEXT NOT NULL,      -- 'next_shown' | 'next_accepted' | 'next_overridden'
  "stage_id"         TEXT,
  "tool"             TEXT,               -- ما اختاره المستخدم فعلاً
  "recommended_tool" TEXT,               -- الموصى به وقت العرض (للمقارنة)
  "payload"          JSONB,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "idx_journey_events_client" ON "journey_events" ("client_id", "created_at");
CREATE INDEX "idx_journey_events_tool"   ON "journey_events" ("recommended_tool", "tool");
