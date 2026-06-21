# VDNX Platform Admin Layer — DONE

## How tenancy works today (recap)

- `organizations` = a customer (workspace). Every domain table (`clients`, `call_logs`, `call_sessions`, `transcriptions`, `ai_call_jobs`, `org_api_keys`, `org_webhooks`, `telavox_configs`, `teams`, …) carries `organization_id`.
- `org_members(user_id, organization_id, role)` with enum `org_role = owner | admin | team_lead | agent` decides what a user can do inside one org.
- RLS uses `is_org_member()` / `has_org_role()` SECURITY DEFINER helpers so a user only ever sees rows from orgs they belong to.
- `current-org.tsx` picks the active org (defaulting from `profiles.default_organization_id`) and every server fn / API key is scoped to it.

A user can belong to many orgs; switching org never leaks data because RLS is enforced server-side, not by the UI.

The existing `public.user_roles` + `app_role` enum is currently unused for app behavior. We will leave it alone and add a dedicated platform-staff layer as requested.

## What we are adding

A **VDNX-internal control panel**, completely separate from customer org roles, that lets your team see every workspace, its usage, and a simple internal billing/quota view. No payment processing in this pass — clean seam to add Stripe later.

### 1. Platform staff (super-admin) model

New, isolated from `org_members`:

- enum `platform_role` = `superadmin | staff | billing | support`
- table `platform_staff(user_id PK, role platform_role, created_at, created_by)`
- SECURITY DEFINER `is_platform_staff(_uid)` and `has_platform_role(_uid, _min)` helpers
- One-off seed: insert the first superadmin row by `user_id` via the migration (you confirm the email, I look up the id).

### 2. Billing plans + quotas (internal only)

- table `billing_plans(id, code, name, price_cents, currency, monthly_call_quota, monthly_ai_minute_quota, seat_quota, features jsonb, active)`
- table `org_subscriptions(organization_id PK, plan_id, status enum: trialing|active|past_due|canceled|suspended, current_period_start, current_period_end, trial_ends_at, notes)`
- table `org_usage_daily(organization_id, day date, calls_count, ai_minutes, transcription_minutes, sms_count, PRIMARY KEY (organization_id, day))` — rolled up nightly from `call_logs` / `transcriptions` / `ai_call_jobs` by a pg_cron job hitting an `/api/public/v1/cron/rollup-usage` route guarded by `CRON_TOKEN`.
- View `org_usage_current_period` joining subscription period bounds with `org_usage_daily` for fast panel queries.

All four tables: RLS on, `TO authenticated` SELECT/INSERT/UPDATE/DELETE policies that require `is_platform_staff(auth.uid())`; service_role full access. Customers cannot see these rows.

### 3. Cross-org read access for staff

Extend existing RLS on `organizations`, `org_members`, `call_logs`, `call_sessions`, `transcriptions`, `ai_call_jobs`, `clients` with an additional SELECT policy: `USING (public.is_platform_staff(auth.uid()))`. Existing customer policies are untouched. Staff get read-only visibility everywhere; no write policies added — staff mutations go through dedicated server fns.

### 4. Admin server functions (`src/lib/platform.functions.ts`)

All `.middleware([requireSupabaseAuth])` + an `assertPlatformStaff(context)` guard. None of these are reachable to non-staff even by URL probing.

- `listCustomers({ q, plan, status, limit, cursor })` → orgs + plan + current-period usage + member count
- `getCustomer({ organization_id })` → org detail, members, recent activity, usage trend (last 30 days), API keys, telephony status
- `setCustomerPlan({ organization_id, plan_id, period_start?, period_end?, trial_ends_at? })`
- `setCustomerStatus({ organization_id, status, reason? })` — `suspended` is enforced by a tiny check in the existing org-scoped fns (cheap: one `org_subscriptions.status` lookup in `has_org_role` wrapper, or a dedicated `is_org_active` helper used by write policies on `call_sessions`)
- `listPlans` / `upsertPlan` / `archivePlan`
- `listPlatformStaff` / `grantStaff({ user_id, role })` / `revokeStaff({ user_id })` — superadmin only
- `usageOverview({ from, to })` → platform-wide totals + top N orgs

### 5. Admin UI (`/admin/*`, gated)

New pathless layout `src/routes/_platform/route.tsx` (`ssr: false`), client-side gate calls `me.isPlatformStaff` and redirects non-staff to `/`. Sidebar entry "VDNX Admin" only renders when staff.

Pages:
- `/admin` — dashboard: total customers, active subscriptions by plan, MRR-style total (sum of plan prices × active), 30-day call/AI-minute trend, quota-breach list.
- `/admin/customers` — searchable table: name, plan, status, seats used / quota, calls this period / quota, AI minutes / quota, last activity. Row click → detail.
- `/admin/customers/$orgId` — overview, members, usage chart, API keys (read-only), actions: change plan, set status, edit notes, impersonation-free "view as" link that just deep-links the route while staying as the staff user (no token swap).
- `/admin/plans` — CRUD on `billing_plans`.
- `/admin/staff` — CRUD on `platform_staff` (superadmin only).
- `/admin/usage` — platform-wide usage explorer with date range.

### 6. Quota enforcement (lightweight)

When a customer hits a hard quota:
- `call_sessions` insert policy (or a `before insert` trigger calling a SECURITY DEFINER helper) blocks new sessions when `org_subscriptions.status in ('suspended','canceled')` or current-period calls ≥ `monthly_call_quota`.
- Same for `ai_call_jobs` against `monthly_ai_minute_quota`.
- Errors surface as friendly toasts in the existing softphone / campaigns flows.

## Stripe seam (later, not built now)

`org_subscriptions` already has `status`, period bounds, `plan_id`, and `notes`. Adding Stripe later = add `stripe_customer_id`, `stripe_subscription_id`, a webhook route under `/api/public/v1/webhooks/stripe`, and translate webhook events into the same status enum. No UI rewrites.

## Technical details

- New migration creates: enum `platform_role`, tables `platform_staff`, `billing_plans`, `org_subscriptions`, `org_usage_daily`; functions `is_platform_staff`, `has_platform_role`, `is_org_active`, `record_usage_for_day`; view `org_usage_current_period`; staff-read SELECT policies on the cross-org tables listed in §3; trigger-based quota enforcement on `call_sessions` and `ai_call_jobs`; seeds 3 default plans (Starter / Growth / Scale) and the first superadmin row.
- Rollup runs via `pg_cron` calling the existing public route convention with `CRON_TOKEN`, identical pattern to other cron usage in the project.
- All admin code is gated twice: server fns assert `is_platform_staff`, RLS allows the read; UI gate is purely a UX nicety.
- No changes to the customer-facing org switcher, onboarding, invites, or API-key flows.

## Open input I need before building

1. Email of the first VDNX superadmin (to seed `platform_staff`).
2. Default plan names/prices/quotas, or accept placeholder Starter (1k calls / 100 AI min / 3 seats), Growth (10k / 1k / 15), Scale (unlimited / 10k / 100).
