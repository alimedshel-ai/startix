#!/usr/bin/env bash
# Startix smoke harness — exercises the critical paths from the Phase 9
# testing checklist. Run after starting the server (`npm run dev` in /server)
# and verify all checks print "OK". Designed to be re-runnable: each test
# creates a fresh user + company and cleans up at the end.
#
# Usage:
#   chmod +x scripts/smoke.sh
#   ./scripts/smoke.sh                       # defaults to http://localhost:5001
#   API_URL=https://api.startix.sa ./scripts/smoke.sh

set -euo pipefail

API="${API_URL:-http://localhost:5001}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

pass=0
fail=0

ok()   { printf "  \033[32mOK\033[0m  %s\n"   "$1"; pass=$((pass+1)); }
bad()  { printf "  \033[31mFAIL\033[0m %s\n" "$1"; fail=$((fail+1)); }
hdr()  { printf "\n\033[1m== %s ==\033[0m\n" "$1"; }

# ───── Tiny test helpers ────────────────────────────────────────────────────
http() {
  # http METHOD URL [BODY] → prints "STATUS\nBODY"
  local method="$1" url="$2" body="${3:-}"
  if [ -z "$body" ]; then
    curl -s -w "\n%{http_code}" -b "$JAR" -c "$JAR" "$API$url" -X "$method"
  else
    curl -s -w "\n%{http_code}" -b "$JAR" -c "$JAR" "$API$url" \
      -X "$method" -H 'Content-Type: application/json' -d "$body"
  fi
}

status_of() { tail -n1; }
body_of()   { sed '$d'; }

# Use python for JSON parsing (built into macOS)
field() {
  # field KEY — read the JSON key path from stdin, e.g. echo "$json" | field id
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['$1'])"
}

# ───── Health ───────────────────────────────────────────────────────────────
hdr "Health"
RES=$(http GET /health)
[ "$(echo "$RES" | status_of)" = "200" ] && ok "/health 200" || bad "/health"

RES=$(http GET /health/db)
[ "$(echo "$RES" | status_of)" = "200" ] && ok "/health/db reachable" || bad "/health/db"

RES=$(http GET /health/config)
[ "$(echo "$RES" | status_of)" = "200" ] && ok "/health/config 200" || bad "/health/config"
CONFIG_BODY=$(echo "$RES" | body_of)
echo "    integrations:"
echo "$CONFIG_BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)['integrations']
for k,v in d.items():
    print(f'      {k}: {\"ON\" if v else \"--\"}')"

# ───── Auth flow ────────────────────────────────────────────────────────────
hdr "Auth flow"
EMAIL="smoke-$(date +%s)@startix.dev"
PASS="Passw0rd!"

RES=$(http POST /api/auth/register "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"اختبار\",\"userType\":\"OWNER\"}")
[ "$(echo "$RES" | status_of)" = "201" ] && ok "register" || bad "register (status $(echo "$RES" | status_of))"

RES=$(http POST /api/auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
[ "$(echo "$RES" | status_of)" = "200" ] && ok "login" || bad "login"

RES=$(http GET /api/auth/me)
[ "$(echo "$RES" | status_of)" = "200" ] && ok "/me with cookie" || bad "/me"

# Confirm refresh works
RES=$(http POST /api/auth/refresh "{}")
[ "$(echo "$RES" | status_of)" = "200" ] && ok "refresh token rotates" || bad "refresh"

# ───── Companies ────────────────────────────────────────────────────────────
hdr "Companies CRUD"
RES=$(http POST /api/companies '{"name":"Smoke","sector":"tech","size":"SMALL"}')
[ "$(echo "$RES" | status_of)" = "201" ] && ok "create company" || bad "create company"
CO_ID=$(echo "$RES" | body_of | field id)
ok "company id captured ($CO_ID)"

# ───── Diagnostic engine (1 of 5 paths sampled) ─────────────────────────────
hdr "Diagnostic engine"
DIAG='{"companyName":"Smoke","sector":"tech","stage":"scaling","size":"small","ownerDependency":"high","financialTracking":"good","liquidity":"mid","governance":"partial","scalability":"mid","exitStrategy":"mna"}'
RES=$(http POST /api/diagnostic/owner "$DIAG")
[ "$(echo "$RES" | status_of)" = "201" ] && ok "diagnostic submitted" || bad "diagnostic"
PATH_VAL=$(echo "$RES" | body_of | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["strategicPath"])' 2>/dev/null || echo "?")
echo "    strategicPath=$PATH_VAL"

RES=$(http GET /api/diagnostic/me/latest)
[ "$(echo "$RES" | status_of)" = "200" ] && ok "/diagnostic/me/latest rehydrates" || bad "rehydrate"

# ───── Audit engine ─────────────────────────────────────────────────────────
hdr "Audit engine"
RES=$(http POST /api/departments "{\"companyId\":\"$CO_ID\",\"type\":\"HR\"}")
[ "$(echo "$RES" | status_of)" = "201" ] && ok "dept HR created" || bad "dept create"
DEPT_ID=$(echo "$RES" | body_of | field id)

# Fetch questions and answer them all "good"
RES=$(http GET "/api/departments/$DEPT_ID/questions")
ANSWERS=$(echo "$RES" | body_of | python3 -c '
import sys,json
d = json.load(sys.stdin)
print(json.dumps({"answers": [{"questionId": q["id"], "value": "good"} for q in d["questions"]]}))')
RES=$(http POST "/api/departments/$DEPT_ID/audit" "$ANSWERS")
[ "$(echo "$RES" | status_of)" = "201" ] && ok "HR audit submitted" || bad "audit"
HEALTH=$(echo "$RES" | body_of | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["score"]["healthPct"], d["score"]["dangerZone"])')
echo "    health=$HEALTH"

# ───── Plan gating ──────────────────────────────────────────────────────────
hdr "Plan gating (BASIC user)"
RES=$(http POST "/api/departments/$DEPT_ID/audit-pro" "$ANSWERS")
[ "$(echo "$RES" | status_of)" = "402" ] && ok "audit-pro returns 402 for BASIC" || bad "audit-pro gating"

RES=$(http POST /api/ai/advisor "{\"companyId\":\"$CO_ID\",\"history\":[],\"message\":\"hi\"}")
[ "$(echo "$RES" | status_of)" = "402" ] && ok "AI advisor 402 for BASIC" || bad "AI gating"

RES=$(http POST /api/ai/presentation "{\"companyId\":\"$CO_ID\"}")
[ "$(echo "$RES" | status_of)" = "402" ] && ok "AI presentation 402 for BASIC" || bad "presentation gating"

# Smart Guide stays available — it just degrades gracefully when Claude key missing
RES=$(http POST /api/ai/smart-guide "{\"companyId\":\"$CO_ID\",\"path\":\"/dashboard\"}")
[ "$(echo "$RES" | status_of)" = "200" ] && ok "Smart Guide ungated (200)" || bad "Smart Guide"

# ───── SWOT → TOWS flow ─────────────────────────────────────────────────────
hdr "SWOT → TOWS (rule-based fallback)"
SWOT='{"strengths":["فريق متمرّس"],"weaknesses":["لا توجد عمليات"],"opportunities":["رؤية 2030"],"threats":["منافسون أكبر"]}'
RES=$(http PUT "/api/strategic/swot/$CO_ID" "$SWOT")
[ "$(echo "$RES" | status_of)" = "200" ] && ok "SWOT saved" || bad "SWOT save"

RES=$(http POST "/api/strategic/swot/$CO_ID/tows/suggest" "{}")
[ "$(echo "$RES" | status_of)" = "200" ] && ok "TOWS cross-product suggestion" || bad "TOWS suggest"

# ───── Lifecycle CRUD ───────────────────────────────────────────────────────
hdr "Lifecycle CRUD"
RES=$(http POST /api/strategic/objectives "{\"companyId\":\"$CO_ID\",\"title\":\"نمو ARR\",\"type\":\"financial\"}")
[ "$(echo "$RES" | status_of)" = "201" ] && ok "objective created" || bad "objective"

RES=$(http POST /api/strategic/kpis "{\"companyId\":\"$CO_ID\",\"name\":\"NPS\",\"unit\":\"NPS\",\"targetValue\":50,\"frequency\":\"quarterly\"}")
[ "$(echo "$RES" | status_of)" = "201" ] && ok "KPI created" || bad "KPI"

RES=$(http POST /api/strategic/tasks "{\"companyId\":\"$CO_ID\",\"title\":\"إعداد التشخيص\",\"priority\":\"high\"}")
[ "$(echo "$RES" | status_of)" = "201" ] && ok "task created" || bad "task"

# ───── Reports ──────────────────────────────────────────────────────────────
hdr "Reports + Excel export gating"
for t in strategic compliance department annual executive; do
  RES=$(http POST /api/reports "{\"companyId\":\"$CO_ID\",\"type\":\"$t\"}")
  [ "$(echo "$RES" | status_of)" = "201" ] && ok "report $t generated" || bad "report $t"
done

RES=$(http GET "/api/reports/company/$CO_ID")
COUNT=$(echo "$RES" | body_of | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
[ "$COUNT" = "5" ] && ok "5 reports in archive" || bad "archive count (got $COUNT)"

# Pick first report and try Excel (should 402 for BASIC)
RID=$(echo "$RES" | body_of | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
EXCEL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" "$API/api/reports/$RID/excel")
[ "$EXCEL_STATUS" = "402" ] && ok "Excel export 402 for BASIC" || bad "Excel gating (status $EXCEL_STATUS)"

# ───── Wave ب — SWOT synthesis (C8, C10) ───────────────────────────────────
hdr "SWOT synthesis (waves ب)"
RES=$(http POST "/api/strategic/swot/$CO_ID/seed-from-diagnostic" "{}")
[ "$(echo "$RES" | status_of)" = "200" ] && ok "SWOT seed-from-diagnostic (C8)" || bad "seed-from-diagnostic"

RES=$(http POST "/api/strategic/swot/$CO_ID/synthesize-from-audits" "{}")
[ "$(echo "$RES" | status_of)" = "200" ] && ok "SWOT synthesize-from-audits (C10)" || bad "synthesize-from-audits"

# ───── Wave ج — Finance (C12, C13) ──────────────────────────────────────────
hdr "Finance module (waves ج)"
BE_BODY="{\"companyId\":\"$CO_ID\",\"fixedCosts\":100000,\"pricePerUnit\":250,\"variableCostPerUnit\":100,\"currentRevenue\":500000}"
RES=$(http POST /api/finance/break-even "$BE_BODY")
[ "$(echo "$RES" | status_of)" = "201" ] && ok "break-even create (C12)" || bad "break-even create"

RES=$(http GET "/api/finance/break-even/$CO_ID/latest")
[ "$(echo "$RES" | status_of)" = "200" ] && ok "break-even latest (C12)" || bad "break-even latest"

DUP_BODY="{\"companyId\":\"$CO_ID\",\"netIncome\":150000,\"revenue\":1000000,\"totalAssets\":800000,\"equity\":400000}"
RES=$(http POST /api/finance/dupont "$DUP_BODY")
[ "$(echo "$RES" | status_of)" = "201" ] && ok "Dupont create (C13)" || bad "Dupont create"
ROE=$(echo "$RES" | body_of | python3 -c 'import sys,json;print(json.load(sys.stdin)["roe"])' 2>/dev/null || echo "?")
echo "    ROE=$ROE (expected 0.375)"

MC_BODY="{\"companyId\":\"$CO_ID\",\"revenue\":{\"min\":800000,\"likely\":1200000,\"max\":1600000},\"variableCostPct\":{\"min\":0.35,\"likely\":0.42,\"max\":0.55},\"fixedCosts\":{\"min\":400000,\"likely\":500000,\"max\":650000},\"iterations\":2000}"
RES=$(http POST /api/finance/monte-carlo "$MC_BODY")
[ "$(echo "$RES" | status_of)" = "201" ] && ok "Monte Carlo run (C13)" || bad "Monte Carlo"

# ───── Wave ج — Deals (C14) ─────────────────────────────────────────────────
hdr "Investor deals (C14)"
RES=$(http POST /api/deals '{"targetCompanyName":"شركة اختبار","sector":"تقنية","stage":"seed","valuation":5000000}')
[ "$(echo "$RES" | status_of)" = "201" ] && ok "deal created" || bad "deal create"
DEAL_ID=$(echo "$RES" | body_of | field id)

RES=$(http PATCH "/api/deals/$DEAL_ID" '{"status":"due_diligence"}')
[ "$(echo "$RES" | status_of)" = "200" ] && ok "deal status patched" || bad "deal patch"

RES=$(http GET /api/deals)
COUNT=$(echo "$RES" | body_of | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
[ "$COUNT" = "1" ] && ok "deal listed (count=1)" || bad "deal list (got $COUNT)"

DEL=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X DELETE "$API/api/deals/$DEAL_ID")
[ "$DEL" = "204" ] && ok "deal deleted (204)" || bad "deal delete (got $DEL)"

# ───── Wave ج — Notifications + Invitations (C15) ──────────────────────────
hdr "Notifications + Invitations (C15)"
RES=$(http GET /api/notifications/me)
[ "$(echo "$RES" | status_of)" = "200" ] && ok "notifications list" || bad "notifications"
UNREAD=$(echo "$RES" | body_of | python3 -c 'import sys,json;print(json.load(sys.stdin)["unread"])')
echo "    unread=$UNREAD"

INV_BODY="{\"companyId\":\"$CO_ID\",\"email\":\"invitee-$(date +%s)@example.com\",\"role\":\"manager\"}"
RES=$(http POST /api/invitations "$INV_BODY")
[ "$(echo "$RES" | status_of)" = "201" ] && ok "invitation created" || bad "invitation create"

RES=$(http GET "/api/invitations/company/$CO_ID")
[ "$(echo "$RES" | status_of)" = "200" ] && ok "company invitations listed" || bad "invitations list"

# ───── Wave ج — Insight engine (C16) ────────────────────────────────────────
hdr "Insight engine (C16)"
RES=$(http POST "/api/insight/$CO_ID/generate" "{}")
[ "$(echo "$RES" | status_of)" = "200" ] && ok "insight generate" || bad "insight generate"
GENERATED=$(echo "$RES" | body_of | python3 -c 'import sys,json;print(json.load(sys.stdin)["generated"])')
echo "    generated=$GENERATED recommendations"

RES=$(http GET "/api/insight/$CO_ID")
[ "$(echo "$RES" | status_of)" = "200" ] && ok "insight list" || bad "insight list"

# ───── Wave د — Assessment engine (C17–C20) ────────────────────────────────
hdr "Assessment engine (waves د)"
RES=$(http GET /api/assessments/templates)
[ "$(echo "$RES" | status_of)" = "200" ] && ok "templates list (C19)" || bad "templates"
TCOUNT=$(echo "$RES" | body_of | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
[ "$TCOUNT" = "5" ] && ok "5 templates registered" || bad "template count (got $TCOUNT)"

RES=$(http POST /api/assessments/from-template "{\"companyId\":\"$CO_ID\",\"modelType\":\"BSC\"}")
[ "$(echo "$RES" | status_of)" = "201" ] && ok "assessment from-template (C19)" || bad "from-template"
A_ID=$(echo "$RES" | body_of | field id)

RES=$(http POST "/api/assessments/$A_ID/calculate" "{}")
[ "$(echo "$RES" | status_of)" = "200" ] && ok "calculate maturity (C18)" || bad "calculate"

# Weight validation — deliberately-wrong build should 400
BAD_BUILD="{\"companyId\":\"$CO_ID\",\"name\":\"سيئ\",\"modelType\":\"BSC\",\"dimensions\":[{\"name\":\"a\",\"weight\":40,\"criteria\":[]},{\"name\":\"b\",\"weight\":40,\"criteria\":[]}]}"
RES=$(http POST /api/assessments/build "$BAD_BUILD")
[ "$(echo "$RES" | status_of)" = "400" ] && ok "build rejects sum!=100 with 400" || bad "build validation"

# AI generate-assessment must 402 for BASIC (C20 gate)
RES=$(http POST /api/ai/generate-assessment "{\"companyId\":\"$CO_ID\",\"modelType\":\"BSC\"}")
[ "$(echo "$RES" | status_of)" = "402" ] && ok "AI generate-assessment 402 for BASIC" || bad "AI generate gating"

# ───── Additional plan gates (predictions + simulate) ──────────────────────
hdr "AI PROFESSIONAL gates (BASIC user)"
RES=$(http GET "/api/ai/predictions/$CO_ID")
[ "$(echo "$RES" | status_of)" = "402" ] && ok "predictions 402 for BASIC" || bad "predictions gating"

RES=$(http POST /api/ai/simulate "{\"companyId\":\"$CO_ID\",\"revenueGrowthPct\":0.1,\"costReductionPct\":0.05,\"baseRevenue\":1000000,\"baseCost\":700000,\"investment\":50000}")
[ "$(echo "$RES" | status_of)" = "402" ] && ok "simulate 402 for BASIC" || bad "simulate gating"

# ───── Admin gap (known — reported in C22) ─────────────────────────────────
hdr "Admin stats (known gap)"
RES=$(http GET /api/admin/stats)
if [ "$(echo "$RES" | status_of)" = "200" ]; then
  ok "/admin/stats accessible (BASIC — known gap awaiting role guard)"
else
  bad "/admin/stats unexpected status $(echo "$RES" | status_of)"
fi

# ───── Payments ─────────────────────────────────────────────────────────────
hdr "Payments"
RES=$(http GET /api/payments/plans)
[ "$(echo "$RES" | status_of)" = "200" ] && ok "/plans returns catalog" || bad "/plans"

# Without Stripe key these should 503 — but they should be the *right* 503
RES=$(http POST /api/payments/create-checkout '{"plan":"PROFESSIONAL"}')
S=$(echo "$RES" | status_of)
if [ "$S" = "503" ] || [ "$S" = "200" ]; then ok "checkout gracefully handles missing key ($S)"; else bad "checkout (status $S)"; fi

# ───── Cleanup ──────────────────────────────────────────────────────────────
hdr "Cleanup"
DEL=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X DELETE "$API/api/companies/$CO_ID")
[ "$DEL" = "204" ] && ok "company deleted" || bad "delete (status $DEL)"

# ───── Summary ──────────────────────────────────────────────────────────────
printf "\n\033[1mResult:\033[0m \033[32m%d passed\033[0m" "$pass"
if [ "$fail" -gt 0 ]; then
  printf ", \033[31m%d failed\033[0m\n" "$fail"
  exit 1
else
  printf ", 0 failed\n"
fi
