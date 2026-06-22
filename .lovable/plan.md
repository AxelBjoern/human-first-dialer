# Mirror VDNX signup: company info + org number on /auth

Goal: a user signing up on the Dialer enters the same identity fields VDNX collects, so the same person/company maps 1:1 across both apps and the integration becomes seamless.

## VDNX reference (project `VDNX`, `src/pages/AuthPage.tsx`)

Signup form fields:
- First name*, Last name*
- Email*, Password*, Confirm password*
- Company name*  → stored as `company_name`
- Organization number*  → stored as `company_vat`

We will mirror these field names on the Dialer side so the same value flows through unchanged.

## Changes

### 1. Database (migration)
Add company columns to `public.organizations`:
- `company_name text` (display name of the legal entity)
- `org_number text` (Norwegian org.nr / company VAT — mirrors VDNX `company_vat`)
- `vdnx_company_id uuid` (nullable, for later VDNX linking)
- unique index on `(org_number)` where `org_number is not null`

Update `public.create_organization` RPC signature to also accept `p_company_name text` and `p_org_number text` and persist them on insert. Existing callers keep working (params default to NULL).

### 2. Signup form (`src/routes/auth.tsx`)
Extend the "Create account" tab with:
- First name, Last name (already there)
- Company name*
- Organization number*
- Email*, Password*, Confirm password*

On submit:
1. `supabase.auth.signUp({ email, password, options: { data: { first_name, last_name, company_name, org_number } } })`
2. After session is established, call `supabase.rpc("create_organization", { p_name: company_name, p_slug: slugify(company_name), p_company_name, p_org_number })`
3. Navigate to `/clients` (skips the onboarding "create workspace" step because the workspace already exists)

Add a link below the "Create account" button: "Don't have a VDNX account? Create one at vdnx.app" — opens `https://vdnxdialer.com` (or the stable VDNX URL). The link sits outside the form so it is purely navigational.

Sign-in tab stays unchanged.

### 3. Onboarding page (`src/routes/_authenticated/onboarding.tsx`)
Add the same Company name + Org number fields to the "Create workspace" form for users who reach onboarding without filling them at signup (e.g. invited users who decline the invite). Pass them through to the updated RPC.

### 4. (Optional, not in this change) VDNX linkage
The new `vdnx_company_id` column is created now but populated later by the VDNX → Dialer webhook / API key handshake. No code wired in this turn.

## Technical notes
- Field name `org_number` on Dialer ↔ `company_vat` on VDNX. We'll document the mapping in `.lovable/plan.md` so the inbound webhook handler can match orgs by `org_number == payload.company_vat`.
- `profiles.default_organization_id` is set by `create_organization` already; no extra work.
- No changes to RLS — `organizations` policies already cover the new columns.

## Files touched
- new migration: add columns + updated RPC
- `src/routes/auth.tsx` — extended signup form + post-signup org creation + VDNX link
- `src/routes/_authenticated/onboarding.tsx` — extended create-workspace form
- `.lovable/plan.md` — note the `org_number ↔ company_vat` mapping and the vdnx.app link
