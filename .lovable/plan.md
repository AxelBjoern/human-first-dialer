
# VDNX Dialer — Build Plan (Supabase integration, not Cloud)

External Supabase project `rzfewoitwlsclmyrymrs` connected via the **Lovable Supabase integration** (you connect it in the UI; no new Cloud project is provisioned).

---

## 0. Prereq — you connect Supabase in the UI

Top-right → **Supabase** → Connect existing project → pick `rzfewoitwlsclmyrymrs`. That gives the project:

- `src/integrations/supabase/client.ts` (managed)
- `src/integrations/supabase/types.ts` (managed, regenerated on schema changes)
- `src/integrations/supabase/auth-middleware.ts` + `auth-attacher.ts` (managed)
- `src/routes/_authenticated/route.tsx` (managed gate, `ssr: false`, redirect to `/auth`)
- `VITE_SUPABASE_*` + server `SUPABASE_*` env wired automatically
- Migrations under `supabase/migrations/` applied on push

Ping me once it's connected and I'll proceed.

## 1. Migration — `supabase/migrations/0001_dialer_init.sql`

Mirrors VDNX `clients` columns; adds dialer-specific tables. Every `public` table gets explicit `GRANT` + RLS + policies via `has_role`.

- **`profiles`** (id → `auth.users`, first/last name, email, extension, default_country=`'NO'`, presence enum, timestamps). Trigger `on_auth_user_created` auto-inserts.
- **`app_role`** enum + **`user_roles`** + `public.has_role()` SECURITY DEFINER. Default new user → `agent`.
- **`clients`** — VDNX-exact columns: first_name, last_name, email, phone, company_id (uuid, nullable, no FK), assigned_to, owner_id, personal_org_number, address, city, postal_code, country, investment_status, notes, **vdnx_client_id** (for sync), timestamps.
- **`call_outcomes`** (code pk, label, color, sort) — seeded: connected, voicemail, no_answer, busy, wrong_number, do_not_call, callback, interested, not_interested, deal_closed.
- **`call_logs`** — agent_id, client_id (nullable), direction, phone_e164, started_at, ended_at, duration_s, outcome_code, notes, follow_up_at, recording_url, external_call_id, vdnx_synced_at.
- **`call_reminders`** — agent_id, client_id, call_time, note, done.

**RLS**: agents see own + assigned `clients`; own `call_logs` / `call_reminders`. Admins/managers see all. `call_outcomes` readable by all authenticated. No `anon` grants.

## 2. VDNX design tokens

`src/styles.css` `:root` + `@theme inline`:
- Primary navy `#1E3A5F`, accent gold `#C9A962`, background warm paper `#F5F1E8`, foreground ink `#1A1A1A`, warm-neutral borders/muted/card.

Fonts via `@fontsource/playfair-display` (display) + `@fontsource/inter` (body), imported in `src/main.tsx`, registered as `--font-display` / `--font-sans` in `@theme`.

## 3. Auth + shell

- `src/routes/auth.tsx` — email/password sign in + sign up tabs (`emailRedirectTo: window.location.origin`). Public route. No Google/Apple for MVP.
- `src/routes/_authenticated/route.tsx` — **managed**, do not author. Gates everything below it.
- `src/routes/_authenticated/route.tsx`'s child layout (`_authenticated/_layout.tsx` or co-located in `__root.tsx`): `SidebarProvider` + `AppSidebar` (Clients / History / Reminders) + header w/ `SidebarTrigger` + main `<Outlet />` + **persistent right-rail Softphone panel** (sticky w-80, always mounted so an active call survives navigation).
- Root `onAuthStateChange` filtered to SIGNED_IN / SIGNED_OUT / USER_UPDATED → `router.invalidate()` + `queryClient.invalidateQueries()` (skip on SIGNED_OUT).

## 4. CallEngine (mock, swappable)

`src/lib/call-engine.ts`:
```
interface CallEngine {
  state: 'idle'|'dialing'|'ringing'|'active'|'ended'
  dial(e164, clientId?): void
  hangup(): void
  mute(b: boolean): void
  subscribe(cb): unsubscribe
}
```
In-memory mock: dial → active after 1.5s, tracks duration. `CallEngineProvider` context. Real SIP/WebRTC drops in later without UI changes.

## 5. Data access pattern

For agent-scoped reads (clients list, history, reminders): browser `supabase` client + `useSuspenseQuery` directly. Loader primes with `ensureQueryData`. RLS enforces scoping — no server function needed.

Use `createServerFn` + `requireSupabaseAuth` only when a write needs server validation (e.g. logging a call needs server-trusted `agent_id` from `context.userId`, not client input). Server fns called from components via `useServerFn` + `useMutation`. **Never** from public-route loaders.

## 6. Routes (under `_authenticated/`)

- `_authenticated/index.tsx` → redirect to `/clients`.
- `_authenticated/clients.tsx` — table (name, phone, status, assigned), search, click-to-call button (`engine.dial(phone, client.id)`), add/edit dialog.
- `_authenticated/history.tsx` — call_logs joined to clients + outcomes; filters by date/outcome/direction.
- `_authenticated/reminders.tsx` — `call_reminders where done=false order by call_time`, mark done, click-to-call.

## 7. Softphone panel (right rail)

States: idle (dialpad + E.164 input + country select), dialing/ringing (client name + spinner), active (timer, mute, hangup), ended → auto-opens Outcome Modal.

## 8. Outcome modal

Triggered on hangup. Fields: outcome (select from `call_outcomes`), notes, follow-up datetime (optional → inserts `call_reminders` row). Saves `call_logs` via a `logCall` server fn (uses `context.userId` as `agent_id`).

---

## Out of scope

Real SIP/WebRTC, VDNX MCP connector, recording storage, admin analytics, embedding shell, Google/Apple sign-in, dark mode.

## Build order

1. Wait for you to connect Supabase integration in the UI
2. `supabase/migrations/0001_dialer_init.sql`
3. VDNX tokens + fonts in `styles.css` / `main.tsx`
4. `/auth` route
5. `__root.tsx` shell + sidebar + persistent Softphone slot
6. `CallEngineProvider` + Softphone component
7. `_authenticated/clients`
8. `_authenticated/history` + Outcome modal + `logCall` server fn
9. `_authenticated/reminders`

**Confirm + connect Supabase, then approve to build.**
