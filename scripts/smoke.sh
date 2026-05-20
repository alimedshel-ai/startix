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
