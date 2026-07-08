# Startix — Deployment Guide

This document walks through deploying Startix end-to-end on AWS. The target
architecture follows section 9.3 of the phase plan:

- **API**: Elastic Beanstalk (Node.js 20), single t3.small instance to start
- **Web**: S3 static hosting + CloudFront distribution
- **DB**: Supabase Postgres (already provisioned)
- **Storage**: S3 (`startix-reports`) for generated Excel/PDF files
- **Mail**: AWS SES (`no-reply@startix.sa`)
- **Payments**: Stripe (live mode keys + webhook endpoint)

Everything below assumes the AWS CLI, EB CLI, and Stripe CLI are installed and
configured for the target account.

---

## 0. One-time prerequisites

1. Create an IAM user with `AmazonElasticBeanstalkFullAccess`, `AmazonS3FullAccess`, `AmazonSESFullAccess`, and `CloudFrontFullAccess`. Save the keys in `~/.aws/credentials`.
2. Verify the `startix.sa` domain in SES (and request production access — sandbox only sends to verified addresses).
3. Create the S3 bucket `startix-reports` in `me-south-1` (Bahrain) with public access blocked. The API uses presigned URLs.
4. Create the S3 bucket for the web build (e.g. `startix-web`), enable static website hosting, and put it behind a CloudFront distribution. Point `startix.sa` and `www.startix.sa` at the distribution.
5. In Stripe, create the `PROFESSIONAL` price (199 SAR / month) and `ENTERPRISE` price. Copy both `price_…` IDs.

---

## 1. Pre-flight check (run locally)

Before pushing anything, make sure the codebase is healthy:

```bash
# from repo root
npm --prefix server run build          # TypeScript compile, no errors
npm --prefix client run build          # Vite build, no errors

# Start the server in another terminal and run the smoke harness
( cd server && npm start ) &
./scripts/smoke.sh
```

`smoke.sh` must finish with **32 passed, 0 failed**. If anything is red, fix
it before deploying — production behavior won't be better than the harness.

---

## 2. Configure the backend on Elastic Beanstalk

### 2.1 Initialize the EB app

```bash
cd server
eb init startix-api --region me-south-1 --platform "Node.js 20"
eb create startix-api-prod --instance_type t3.small --single   # single instance, no load balancer at first
```

### 2.2 Set environment variables

Use `eb setenv` to inject every key from `server/.env.example` — never bake
secrets into `.ebextensions/`. At minimum:

```bash
eb setenv \
  NODE_ENV=production \
  CLIENT_URL=https://startix.sa \
  JWT_SECRET="$(openssl rand -base64 48)" \
  DATABASE_URL="postgresql://…pooler.supabase.com:6543/postgres?pgbouncer=true" \
  DIRECT_URL="postgresql://…pooler.supabase.com:5432/postgres" \
  SUPABASE_URL="https://PROJECT.supabase.co" \
  SUPABASE_ANON_KEY="…" \
  SUPABASE_SERVICE_KEY="…" \
  ANTHROPIC_API_KEY="sk-ant-…" \
  STRIPE_SECRET_KEY="sk_live_…" \
  STRIPE_WEBHOOK_SECRET="whsec_…" \
  STRIPE_PRICE_PROFESSIONAL="price_…" \
  STRIPE_PRICE_ENTERPRISE="price_…" \
  AWS_REGION="me-south-1" \
  SES_FROM_ADDRESS="no-reply@startix.sa" \
  S3_BUCKET="startix-reports"
```

EB will redeploy automatically once all env vars are set.

### 2.3 Apply Prisma migrations

Run migrations against production **once** before the app serves traffic:

```bash
cd server
DATABASE_URL="<DIRECT_URL value>" npx prisma migrate deploy
```

Use `DIRECT_URL` (port 5432) here, not the pooler — pgbouncer breaks migrations.

### 2.4 Build + deploy

```bash
cd server
npm run build       # produces dist/
eb deploy
```

`.ebignore` ships `dist/`, `prisma/`, `package.json`, `package-lock.json`,
`Procfile`, `.ebextensions/`, and `.platform/`. It excludes `src/`,
`tsconfig.json`, and `node_modules/` so EB installs cleanly on Linux.

### 2.5 Smoke the deployed API

```bash
API_URL=https://startix-api-prod.eba-….me-south-1.elasticbeanstalk.com ./scripts/smoke.sh
```

Expect 32/32 OK. `/health/config` is now behind `requireAuth` (SEC-3),
so the smoke harness verifies anon returns 401 and the post-login call
prints the integrations block (every one should be `ON` except possibly
`s3` if you haven't created the bucket yet).

---

## 3. Configure Stripe webhook

In the Stripe dashboard:

1. **Developers → Webhooks → Add endpoint**
2. URL: `https://api.startix.sa/api/payments/webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the signing secret (`whsec_…`) and set it via `eb setenv STRIPE_WEBHOOK_SECRET=…`

Verify with the Stripe CLI:

```bash
stripe trigger checkout.session.completed
```

Check EB logs (`eb logs`) for `[stripe] processed checkout.session.completed`.

---

## 4. Deploy the web client

```bash
cd client
# Make sure the env points at the live API
echo 'VITE_API_URL=https://api.startix.sa' > .env.production
echo 'VITE_STRIPE_PUBLISHABLE_KEY=pk_live_…' >> .env.production

npm run build
aws s3 sync dist/ s3://startix-web --delete --cache-control "public,max-age=300"
```

Then invalidate CloudFront so users get the new bundle immediately:

```bash
aws cloudfront create-invalidation --distribution-id DXXXXXXXXXXXX --paths "/*"
```

---

## 5. DNS

Point the records at the right targets:

| Host          | Type  | Target                                            |
|---------------|-------|---------------------------------------------------|
| `startix.sa`  | A     | CloudFront alias                                  |
| `www.startix.sa` | CNAME | CloudFront domain                              |
| `api.startix.sa` | CNAME | EB environment CNAME                           |
| `_acme-…`     | CNAME | (issued by ACM when you request the certificate) |

Issue ACM certificates in `us-east-1` for CloudFront and in `me-south-1` for
EB. Attach both to their respective distributions/environments.

---

## 6. Post-deploy checklist

- [ ] `https://api.startix.sa/health` returns 200
- [ ] `https://api.startix.sa/health/config` returns 401 anon and, after login, shows every integration `ON`
- [ ] Smoke harness against the production URL is 32/32 green
- [ ] Register a real test account, run the diagnostic, confirm the company is saved
- [ ] Stripe test purchase: dummy card `4242 4242 4242 4242` upgrades the user to `PROFESSIONAL`
- [ ] AI advisor responds in Arabic for a PROFESSIONAL user
- [ ] An Excel export from the Reports page downloads without a 402
- [ ] CloudWatch alarms set: 5xx rate > 1% (5 min), p99 latency > 2s (5 min)
- [ ] Daily Supabase backup confirmed (Supabase → Database → Backups)

---

## 7. Rolling back

EB keeps the last N versions. To revert:

```bash
eb appversion        # pick the prior label
eb deploy --version <label>
```

For Prisma rollbacks, **never** run `migrate reset` against production. Write
a corrective forward migration instead.

---

## 8. Local override for testing prod-like

To run the server with production-like settings locally:

```bash
cp server/.env.example server/.env
# fill in real values
NODE_ENV=production npm --prefix server start
```

The server reads `process.env.STRIPE_*` lazily, so missing keys degrade
gracefully (`/api/payments/create-checkout` returns 503 in Arabic) rather
than crashing.
